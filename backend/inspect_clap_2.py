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
    print("text_outputs type:", type(text_outputs))
    print("text_outputs keys/attributes:", dir(text_outputs))
    print("text_outputs structure:", text_outputs)
