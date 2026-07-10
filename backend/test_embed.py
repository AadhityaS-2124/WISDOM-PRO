import sys
import numpy as np
import os
import time

from model import AudioEmbedder
from index_manager import IndexManager

WORKSPACE_DIR = "d:\\Wisdom Pro"

print("Initializing modules...")
embedder = AudioEmbedder(use_clap=True)

# Wait up to 60 seconds for CLAP to load
for i in range(60):
    if embedder.clap_loaded:
        print(f"CLAP loaded after {i} seconds!")
        break
    print("Waiting for CLAP...")
    time.sleep(1)

if not embedder.clap_loaded:
    print("CLAP did not load within 60 seconds. Exiting.")
    sys.exit(1)

index_manager = IndexManager(
    index_path=os.path.join(WORKSPACE_DIR, "backend", "index.tv"),
    metadata_path=os.path.join(WORKSPACE_DIR, "backend", "metadata.json")
)

print("Getting text embedding...")
query_embed = embedder.get_text_embedding("bass")

print("Query embed properties:")
print("Type:", type(query_embed))
print("Shape:", query_embed.shape)
print("Dtype:", query_embed.dtype)
print("Contiguous:", query_embed.flags['C_CONTIGUOUS'] if isinstance(query_embed, np.ndarray) else "N/A")

print("Searching...")
try:
    results, scores = index_manager.search(query_embed, k=3)
    print("Search succeeded!")
    print("Results:", results)
    print("Scores:", scores)
except Exception as e:
    print("Search failed!")
    import traceback
    traceback.print_exc()
