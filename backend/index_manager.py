import os
import json
import numpy as np
from turbovec import TurboQuantIndex

class IndexManager:
    def __init__(self, index_path="index.tv", metadata_path="metadata.json", dim=512, bit_width=4):
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.dim = dim
        self.bit_width = bit_width
        
        self.index = None
        self.metadata = []  # List of dicts mapping index IDs to file info
        
        self.load_or_create()
        
    def load_or_create(self):
        """
        Loads the index and metadata from disk, or creates a new empty one if they don't exist.
        """
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            try:
                print(f"Loading Turbovec index from {self.index_path}...")
                self.index = TurboQuantIndex.load(self.index_path)
                with open(self.metadata_path, 'r', encoding='utf-8') as f:
                    self.metadata = json.load(f)
                print(f"Successfully loaded index with {len(self.metadata)} vectors.")
                return
            except Exception as e:
                print(f"Error loading index: {e}. Creating new empty index.")
                
        print("Initializing new empty Turbovec index...")
        self.index = TurboQuantIndex(dim=self.dim, bit_width=self.bit_width)
        self.metadata = []
        
    def add_vector(self, vector: np.ndarray, meta: dict):
        """
        Adds a single normalized vector to the index along with its metadata.
        """
        # Force a clean native numpy array conversion to prevent C-API layout casting issues
        if isinstance(vector, np.ndarray):
            clean_vec = np.array(vector.tolist(), dtype=np.float32)
        else:
            clean_vec = np.array(vector, dtype=np.float32)
            
        vec = np.ascontiguousarray(clean_vec, dtype=np.float32)
        if len(vec.shape) == 1:
            vec = np.expand_dims(vec, axis=0)
            
        self.index.add(vec)
        self.metadata.append(meta)
        
    def search(self, query_vector: np.ndarray, k=5):
        """
        Searches the index with a query vector, returning (results, scores).
        """
        if len(self.metadata) == 0:
            return [], []
            
        # Force a clean native numpy array conversion to prevent C-API layout casting issues
        if isinstance(query_vector, np.ndarray):
            clean_vec = np.array(query_vector.tolist(), dtype=np.float32)
        else:
            clean_vec = np.array(query_vector, dtype=np.float32)
            
        vec = np.ascontiguousarray(clean_vec, dtype=np.float32)
        if len(vec.shape) == 1:
            vec = np.expand_dims(vec, axis=0)
            
        # Turbovec search returns (scores, indices)
        k_val = min(k, len(self.metadata))
        scores, indices = self.index.search(vec, k=k_val)
        
        results = []
        res_scores = []
        
        # Flatten results since we query with 1 vector
        for score, idx in zip(scores[0], indices[0]):
            # Skip invalid indices (e.g. -1 returned if search fails to find enough items)
            if idx < 0 or idx >= len(self.metadata):
                continue
            results.append(self.metadata[idx])
            res_scores.append(float(score))
            
        return results, res_scores
        
    def remove_by_path(self, path: str) -> bool:
        """
        Removes an entry by file path (uses swap-remove matching Turbovec implementation).
        """
        target_idx = -1
        for i, meta in enumerate(self.metadata):
            if meta.get("path") == path:
                target_idx = i
                break
                
        if target_idx == -1:
            return False
            
        # Run swap_remove on Turbovec index
        self.index.swap_remove(target_idx)
        
        # Reflect swap_remove in metadata list
        if target_idx < len(self.metadata) - 1:
            self.metadata[target_idx] = self.metadata[-1]
            
        self.metadata.pop()
        return True

    def save(self):
        """
        Saves index and metadata to disk.
        """
        try:
            self.index.write(self.index_path)
            with open(self.metadata_path, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, indent=2)
            print(f"Successfully saved index to {self.index_path} and metadata to {self.metadata_path}")
        except Exception as e:
            print(f"Error saving index/metadata: {e}")
