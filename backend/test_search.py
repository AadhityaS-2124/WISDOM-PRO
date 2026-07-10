import numpy as np
from turbovec import TurboQuantIndex
import os

index_path = "d:\\Wisdom Pro\\backend\\index.tv"
if os.path.exists(index_path):
    print("Loading index...")
    index = TurboQuantIndex.load(index_path)
    print("Index loaded:", index)
    
    vec = np.random.randn(1, 512).astype(np.float32)
    # Ensure it's unit length just like our real query vectors
    vec /= np.linalg.norm(vec)
    
    print("vec type:", type(vec))
    print("vec shape:", vec.shape)
    print("vec dtype:", vec.dtype)
    print("vec contiguous:", vec.flags['C_CONTIGUOUS'])
    
    try:
        res = index.search(vec, k=3)
        print("Search succeeded:", res)
    except Exception as e:
        print("Search failed with exception:", e)
        import traceback
        traceback.print_exc()
else:
    print("Index file not found at", index_path)
