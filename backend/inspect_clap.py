import torch
from transformers import ClapModel, ClapProcessor
import numpy as np

print("Loading processor & model...")
processor = ClapProcessor.from_pretrained("laion/clap-htsat-unfused")
model = ClapModel.from_pretrained("laion/clap-htsat-unfused")
model.eval()

print("Testing text features...")
inputs = processor(text=["bass"], return_tensors="pt")
with torch.no_grad():
    text_outputs = model.get_text_features(**inputs)
    print("get_text_features shape:", text_outputs.shape)

    # Let's also check get_audio_features with dummy audio (1 sec of silence at 48kHz)
    dummy_audio = np.zeros(48000, dtype=np.float32)
    audio_inputs = processor(audios=dummy_audio, sampling_rate=48000, return_tensors="pt")
    audio_outputs = model.get_audio_features(**audio_inputs)
    print("get_audio_features shape:", audio_outputs.shape)
