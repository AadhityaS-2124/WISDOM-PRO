import os
import sys
import numpy as np
import soundfile as sf
import scipy.signal
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import AudioEmbedder
from index_manager import IndexManager

# Define default directories
WORKSPACE_DIR = "d:\\Wisdom Pro"
AUDIO_LIBRARY_DIR = os.path.join(WORKSPACE_DIR, "audio_library")

app = FastAPI(title="Wisdom Pro AI Sidecar Backend", version="1.0")

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the Vite host (http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize modules
embedder = AudioEmbedder(use_clap=True)
index_manager = IndexManager(
    index_path=os.path.join(WORKSPACE_DIR, "backend", "index.tv"),
    metadata_path=os.path.join(WORKSPACE_DIR, "backend", "metadata.json")
)

# Request Models
class SearchRequest(BaseModel):
    query: str
    k: int = 5

class AddAssetRequest(BaseModel):
    file_path: str

class IngestRequest(BaseModel):
    directory: str = ""

def generate_synth_samples(output_dir):
    """
    Generates high-quality demo sound loops programmatically using NumPy and Scipy.
    """
    os.makedirs(output_dir, exist_ok=True)
    sr = 44100
    
    # 1. Vintage Kick Drum (Sine frequency sweep from 150 Hz to 40 Hz)
    t = np.linspace(0, 0.3, int(sr * 0.3), endpoint=False)
    freq = 150 - (110 * (t / 0.3))
    phase = 2 * np.pi * np.cumsum(freq) / sr
    kick = np.sin(phase) * np.exp(-12 * t)
    kick /= np.max(np.abs(kick)) + 1e-6
    sf.write(os.path.join(output_dir, "vintage_kick_loop.wav"), kick, sr)
    
    # 2. Retro Snare (Decaying noise burst, bandpass filtered)
    t = np.linspace(0, 0.25, int(sr * 0.25), endpoint=False)
    noise = np.random.randn(len(t))
    b, a = scipy.signal.butter(4, [1000, 3000], btype='bandpass', fs=sr)
    snare = scipy.signal.lfilter(b, a, noise)
    snare = snare * np.exp(-15 * t)
    snare /= np.max(np.abs(snare)) + 1e-6
    sf.write(os.path.join(output_dir, "retro_snare_loop.wav"), snare, sr)

    # 3. Bright Hihat (High-frequency noise with very rapid decay)
    t = np.linspace(0, 0.08, int(sr * 0.08), endpoint=False)
    noise = np.random.randn(len(t))
    b, a = scipy.signal.butter(4, 7000, btype='highpass', fs=sr)
    hihat = scipy.signal.lfilter(b, a, noise)
    hihat = hihat * np.exp(-40 * t)
    hihat /= np.max(np.abs(hihat)) + 1e-6
    sf.write(os.path.join(output_dir, "bright_hihat_closed.wav"), hihat, sr)

    # 4. Heavy Vintage Synth Bass (Low sawtooth notes: A1, C2, G1)
    t = np.linspace(0, 4.0, int(sr * 4.0), endpoint=False)
    freq_pattern = np.zeros(len(t))
    quarter = len(t) // 4
    freq_pattern[0:quarter] = 55.0        # A1
    freq_pattern[quarter:2*quarter] = 55.0
    freq_pattern[2*quarter:3*quarter] = 65.4  # C2
    freq_pattern[3*quarter:] = 48.99      # G1
    
    phase = 2 * np.pi * np.cumsum(freq_pattern) / sr
    bass = scipy.signal.sawtooth(phase)
    b, a = scipy.signal.butter(4, 350, btype='lowpass', fs=sr)
    bass = scipy.signal.lfilter(b, a, bass)
    bass /= np.max(np.abs(bass)) + 1e-6
    sf.write(os.path.join(output_dir, "heavy_vintage_synth_bass.wav"), bass, sr)

    # 5. Melodic Lead Synth (Square wave arpeggio with delay effect)
    t = np.linspace(0, 4.0, int(sr * 4.0), endpoint=False)
    freq_pattern = np.zeros(len(t))
    step = len(t) // 8
    notes = [440.0, 523.25, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25]
    for i in range(8):
        freq_pattern[i*step:(i+1)*step] = notes[i]
        
    phase = 2 * np.pi * np.cumsum(freq_pattern) / sr
    lead = scipy.signal.square(phase)
    b, a = scipy.signal.butter(4, 2000, btype='lowpass', fs=sr)
    lead = scipy.signal.lfilter(b, a, lead)
    # Simple echo
    delay_samples = int(sr * 0.25)
    echo = np.zeros(len(lead))
    echo[delay_samples:] = lead[:-delay_samples] * 0.35
    lead = lead + echo
    lead /= np.max(np.abs(lead)) + 1e-6
    sf.write(os.path.join(output_dir, "melodic_lead_synth_loop.wav"), lead, sr)

    # 6. Lush Ambient Pad (Chorus chord: A3, C4, E4, G4 with detuning)
    t = np.linspace(0, 6.0, int(sr * 6.0), endpoint=False)
    chord_freqs = [220.0, 261.63, 329.63, 392.00]
    pad = np.zeros(len(t))
    for f in chord_freqs:
        pad += np.sin(2 * np.pi * f * t) * 0.4
        pad += np.sin(2 * np.pi * (f + 1.2) * t) * 0.2
        pad += np.sin(2 * np.pi * (f - 1.0) * t) * 0.2
    # Long fade-in / fade-out
    envelope = np.ones(len(t))
    fade = int(sr * 1.5)
    envelope[:fade] = np.linspace(0, 1, fade)
    envelope[-fade:] = np.linspace(1, 0, fade)
    pad = pad * envelope
    pad /= np.max(np.abs(pad)) + 1e-6
    sf.write(os.path.join(output_dir, "lush_ambient_pad_chord.wav"), pad, sr)

    print("Demo sound samples generated successfully in", output_dir)


@app.on_event("startup")
def startup_event():
    """
    On startup, generate demo sound library if it's empty, and ingest it into the index.
    """
    if not os.path.exists(AUDIO_LIBRARY_DIR) or len(os.listdir(AUDIO_LIBRARY_DIR)) == 0:
        print("Audio library is empty. Generating demo synth loops...")
        generate_synth_samples(AUDIO_LIBRARY_DIR)
        
    print("Auto-ingesting audio library...")
    ingest_directory(AUDIO_LIBRARY_DIR)


def get_audio_info(file_path: str):
    """
    Helper to extract audio metadata (duration, sample rate, channels).
    """
    try:
        info = sf.info(file_path)
        return {
            "name": os.path.basename(file_path),
            "path": file_path,
            "duration": float(info.duration),
            "samplerate": int(info.samplerate),
            "channels": int(info.channels)
        }
    except Exception as e:
        print(f"Error reading audio info for {file_path}: {e}")
        return None


def ingest_directory(directory: str) -> int:
    """
    Scans directory for wav/mp3 files and adds them to the Turbovec index.
    """
    if not os.path.exists(directory):
        return 0
        
    count = 0
    for root, _, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(('.wav', '.mp3')):
                file_path = os.path.join(root, file)
                # Check if already indexed
                already_indexed = any(meta.get("path") == file_path for meta in index_manager.metadata)
                if already_indexed:
                    continue
                    
                meta = get_audio_info(file_path)
                if meta:
                    print(f"Indexing audio file: {file}...")
                    embed = embedder.get_audio_embedding(file_path)
                    index_manager.add_vector(embed, meta)
                    count += 1
                    
    if count > 0:
        index_manager.save()
        
    return count


@app.post("/ingest")
async def ingest(request: IngestRequest = Body(...)):
    directory = request.directory or AUDIO_LIBRARY_DIR
    if not os.path.exists(directory):
        raise HTTPException(status_code=400, detail="Specified directory does not exist")
        
    count = ingest_directory(directory)
    return {"message": f"Successfully ingested {count} new files into the index.", "total_indexed": len(index_manager.metadata)}


@app.post("/search")
async def search(request: SearchRequest = Body(...)):
    if not request.query:
        raise HTTPException(status_code=400, detail="Query string cannot be empty")
        
    print(f"Performing similarity search for query: '{request.query}'...")
    query_embed = embedder.get_text_embedding(request.query)
    results, scores = index_manager.search(query_embed, k=request.k)
    
    response_items = []
    for meta, score in zip(results, scores):
        # Convert absolute path to relative or filename for frontend safety
        relative_path = os.path.relpath(meta["path"], WORKSPACE_DIR)
        response_items.append({
            "name": meta["name"],
            "path": meta["path"],
            "relative_path": relative_path.replace("\\", "/"),
            "duration": meta["duration"],
            "samplerate": meta["samplerate"],
            "channels": meta["channels"],
            "score": score
        })
        
    return {"results": response_items}


@app.post("/add-asset")
async def add_asset(request: AddAssetRequest = Body(...)):
    file_path = request.file_path
    if not os.path.exists(file_path):
        # Try resolving relative path from workspace
        resolved_path = os.path.join(WORKSPACE_DIR, file_path)
        if os.path.exists(resolved_path):
            file_path = resolved_path
        else:
            raise HTTPException(status_code=400, detail="File path does not exist")
            
    meta = get_audio_info(file_path)
    if not meta:
        raise HTTPException(status_code=400, detail="Invalid audio file or metadata read failure")
        
    # Check if already in index
    for i, existing in enumerate(index_manager.metadata):
        if existing["path"] == file_path:
            return {"message": "File is already in the index", "track": existing}
            
    embed = embedder.get_audio_embedding(file_path)
    index_manager.add_vector(embed, meta)
    index_manager.save()
    
    return {"message": "Successfully added file to the index", "track": meta}


@app.get("/tracks")
async def list_tracks():
    """
    Returns all indexed audio tracks.
    """
    tracks = []
    for meta in index_manager.metadata:
        relative_path = os.path.relpath(meta["path"], WORKSPACE_DIR)
        tracks.append({
            "name": meta["name"],
            "path": meta["path"],
            "relative_path": relative_path.replace("\\", "/"),
            "duration": meta["duration"],
            "samplerate": meta["samplerate"],
            "channels": meta["channels"]
        })
    return {"tracks": tracks}


@app.get("/audio-file")
async def get_audio_file(path: str):
    """
    Serves the binary audio file for playback and decoding in the browser.
    """
    # Security check: Ensure file lies inside our workspace
    abs_path = os.path.abspath(path)
    workspace_abs = os.path.abspath(WORKSPACE_DIR)
    
    if not abs_path.lower().startswith(workspace_abs.lower()):
        raise HTTPException(status_code=403, detail="Access denied. Path lies outside workspace.")
        
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
        
    return FileResponse(abs_path, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    # Run server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
