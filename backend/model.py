import os
import re
import numpy as np
import soundfile as sf
import scipy.signal

class AudioEmbedder:
    def __init__(self, use_clap=True):
        self.use_clap = use_clap
        self.model = None
        self.processor = None
        self.clap_loaded = False
        
        # Vocabulary of common DAW terms for fallback keyword-based projection
        self.vocab = [
            'bass', 'synth', 'lead', 'drum', 'kick', 'snare', 'hihat', 'perc', 
            'loop', 'melody', 'chord', 'pad', 'vocal', 'guitar', 'piano', 'organ', 
            'synthwave', 'techno', 'house', 'hiphop', 'beat', 'retro', 'vintage', 
            'heavy', 'warm', 'bright', 'chill', 'ambient', 'pluck', 'sound', 'fx', 
            'noise', 'clap', 'sub', 'acoustic', 'electric', 'brass', 'string', 'perc'
        ]
        
        # Generate deterministic random projection vectors for each vocab term
        # Using a fixed seed guarantees consistent projection across server restarts
        self.dim = 512
        rng = np.random.RandomState(42)
        self.vocab_vectors = {}
        for term in self.vocab:
            vec = rng.randn(self.dim).astype(np.float32)
            self.vocab_vectors[term] = vec / np.linalg.norm(vec)
            
        # Default projection vector for unseen words
        self.default_rng = np.random.RandomState(1337)
        
        if use_clap:
            import threading
            threading.Thread(target=self._init_clap, daemon=True).start()
            
    def _init_clap(self):
        try:
            print("Starting background load of CLAP model (laion/clap-htsat-unfused)...")
            import torch
            from transformers import ClapModel, ClapProcessor
            
            # Load processor and model on CPU
            processor = ClapProcessor.from_pretrained("laion/clap-htsat-unfused")
            model = ClapModel.from_pretrained("laion/clap-htsat-unfused")
            model.eval()
            
            self.processor = processor
            self.model = model
            self.clap_loaded = True
            print("CLAP model successfully loaded in the background.")
        except Exception as e:
            print(f"Failed to load CLAP model in background: {e}")
            print("Continuing in high-performance deterministic keyword + acoustic feature projection mode.")
            self.clap_loaded = False

    def get_text_embedding(self, text: str) -> np.ndarray:
        """
        Generates a 512-dimensional embedding for a text query.
        """
        if self.clap_loaded:
            try:
                import torch
                inputs = self.processor(text=[text], return_tensors="pt")
                with torch.no_grad():
                    outputs = self.model.get_text_features(**inputs)
                    embedding = outputs.pooler_output[0].cpu().numpy().astype(np.float32)
                    return embedding / np.linalg.norm(embedding)
            except Exception as e:
                print(f"CLAP text embedding error: {e}. Using fallback.")
                
        return self._get_fallback_text_embedding(text)

    def get_audio_embedding(self, file_path: str) -> np.ndarray:
        """
        Generates a 512-dimensional embedding for an audio file.
        """
        if self.clap_loaded:
            try:
                import torch
                # Load and resample audio to 48000Hz (CLAP's expected rate)
                audio_data, samplerate = sf.read(file_path)
                if len(audio_data.shape) > 1:
                    # Convert stereo to mono
                    audio_data = np.mean(audio_data, axis=1)
                
                # Resample if not 48kHz
                if samplerate != 48000:
                    num_samples = int(len(audio_data) * 48000 / samplerate)
                    audio_data = scipy.signal.resample(audio_data, num_samples)
                    
                inputs = self.processor(audio=audio_data, sampling_rate=48000, return_tensors="pt")
                with torch.no_grad():
                    outputs = self.model.get_audio_features(**inputs)
                    embedding = outputs.pooler_output[0].cpu().numpy().astype(np.float32)
                    return embedding / np.linalg.norm(embedding)
            except Exception as e:
                print(f"CLAP audio embedding error for {file_path}: {e}. Using fallback.")
                
        return self._get_fallback_audio_embedding(file_path)

    def _get_fallback_text_embedding(self, text: str) -> np.ndarray:
        """
        Computes text embedding by finding vocabulary words and hashing unseen words.
        """
        # Tokenize and normalize text
        tokens = re.findall(r'[a-zA-Z]+', text.lower())
        if not tokens:
            # Return a random unit vector if text is empty or has no letters
            vec = np.random.randn(self.dim).astype(np.float32)
            return vec / np.linalg.norm(vec)
            
        accum_vec = np.zeros(self.dim, dtype=np.float32)
        words_found = 0
        
        for token in tokens:
            if token in self.vocab_vectors:
                accum_vec += self.vocab_vectors[token] * 2.0  # Boost known vocabulary words
                words_found += 1
            else:
                # Hash the word to generate a deterministic pseudorandom vector
                h = hash(token) % (2**32 - 1)
                rng = np.random.RandomState(h)
                rand_vec = rng.randn(self.dim).astype(np.float32)
                accum_vec += rand_vec / np.linalg.norm(rand_vec)
                words_found += 1
                
        # Normalize result
        return accum_vec / np.linalg.norm(accum_vec)

    def _get_fallback_audio_embedding(self, file_path: str) -> np.ndarray:
        """
        Extracts acoustic features from the file and blends them with filename token embeddings.
        """
        filename = os.path.basename(file_path)
        # 1. Text representation from filename
        filename_text = filename.replace('_', ' ').replace('-', ' ').replace('.', ' ')
        filename_embed = self._get_fallback_text_embedding(filename_text)
        
        # 2. Extract basic acoustic features
        try:
            audio_data, samplerate = sf.read(file_path)
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)
                
            # If the audio file is empty
            if len(audio_data) == 0:
                return filename_embed
                
            # Compute Zero Crossing Rate (ZCR) - high ZCR indicates percussion/high-frequencies
            zcr = np.mean(np.abs(np.diff(np.sign(audio_data))) > 0)
            
            # Compute Spectral Centroid (rough approximation via FFT)
            fft_vals = np.abs(np.fft.rfft(audio_data))
            freqs = np.fft.rfftfreq(len(audio_data), 1.0 / samplerate)
            if np.sum(fft_vals) > 0:
                spectral_centroid = np.sum(freqs * fft_vals) / np.sum(fft_vals)
            else:
                spectral_centroid = 0.0
                
            # Normalize acoustic features
            # Bass sounds: low spectral centroid (< 500 Hz), low ZCR (< 0.05)
            # Drum kicks: high energy transients, low centroid
            # Hi-hats/Percussion: very high ZCR (> 0.2), high centroid (> 4000 Hz)
            # Melodic synth: mid-range centroid (1000 - 3000 Hz)
            
            acoustic_influence = np.zeros(self.dim, dtype=np.float32)
            
            # Map features to vocab vectors to steer the embedding semantically
            if spectral_centroid < 500:
                if 'bass' in self.vocab_vectors:
                    acoustic_influence += self.vocab_vectors['bass']
                if 'kick' in self.vocab_vectors:
                    acoustic_influence += self.vocab_vectors['kick']
            elif spectral_centroid > 3500 or zcr > 0.15:
                if 'bright' in self.vocab_vectors:
                    acoustic_influence += self.vocab_vectors['bright']
                if 'hihat' in self.vocab_vectors:
                    acoustic_influence += self.vocab_vectors['hihat']
                if 'perc' in self.vocab_vectors:
                    acoustic_influence += self.vocab_vectors['perc']
            else:
                if 'melody' in self.vocab_vectors:
                    acoustic_influence += self.vocab_vectors['melody']
                if 'synth' in self.vocab_vectors:
                    acoustic_influence += self.vocab_vectors['synth']
            
            # Blend filename embedding (80%) and acoustic profile (20%)
            if np.linalg.norm(acoustic_influence) > 0:
                acoustic_influence = acoustic_influence / np.linalg.norm(acoustic_influence)
                final_embed = 0.8 * filename_embed + 0.2 * acoustic_influence
                return final_embed / np.linalg.norm(final_embed)
                
        except Exception as e:
            print(f"Fallback audio analysis error for {file_path}: {e}")
            
        return filename_embed
