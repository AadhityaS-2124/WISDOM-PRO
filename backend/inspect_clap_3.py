import torch
from transformers import ClapModel, ClapProcessor
import numpy as np
import inspect

processor = ClapProcessor.from_pretrained("laion/clap-htsat-unfused")
model = ClapModel.from_pretrained("laion/clap-htsat-unfused")

print("get_audio_features source code:")
try:
    print(inspect.getsource(model.get_audio_features))
except Exception as e:
    print("Could not get source:", e)

dummy_audio = np.zeros(48000, dtype=np.float32)
audio_inputs = processor(audios=dummy_audio, sampling_rate=48000, return_tensors="pt")
with torch.no_grad():
    audio_outputs = model.get_audio_features(**audio_inputs)
    print("get_audio_features output type:", type(audio_outputs))
    print("get_audio_features pooler_output shape:", audio_outputs.pooler_output.shape)
