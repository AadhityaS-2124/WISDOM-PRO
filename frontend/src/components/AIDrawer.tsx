import React, { useState, useRef } from 'react';
import { Search, Play, Pause, Music, Sparkles } from 'lucide-react';
import type { TrackMetadata } from '../services/AudioManager';

interface SearchResult extends TrackMetadata {
  relative_path: string;
  score: number;
}

interface AIDrawerProps {
  onAddTrack: (track: TrackMetadata) => void;
}

export const AIDrawer: React.FC<AIDrawerProps> = ({ onAddTrack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewingPath, setPreviewingPath] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, k: 6 }),
      });
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Failed to query AI sidecar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (track: SearchResult) => {
    if (previewingPath === track.path) {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPreviewingPath(null);
    } else {
      // Play new
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audioUrl = `http://localhost:8000/audio-file?path=${encodeURIComponent(track.path)}`;
      const newAudio = new Audio(audioUrl);
      newAudio.play();
      
      newAudio.onended = () => {
        setPreviewingPath(null);
      };
      
      audioRef.current = newAudio;
      setPreviewingPath(track.path);
    }
  };

  const handleDragStart = (e: React.DragEvent, track: SearchResult) => {
    const dragData = {
      name: track.name,
      path: track.path,
      duration: track.duration,
      samplerate: track.samplerate,
      channels: track.channels
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full select-none text-gray-200">
      {/* Drawer Header */}
      <div 
        className="p-4 border-b border-gray-800 flex items-center gap-2 justify-between"
        style={{
          background: 'linear-gradient(to bottom, #1f2937, #111827)'
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-gray-100">
            AI Sound Intuiter
          </h2>
        </div>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
          Turbovec Index
        </span>
      </div>

      {/* Search Input Form */}
      <form onSubmit={handleSearch} className="p-4 border-b border-gray-800 bg-gray-950">
        <div className="relative">
          <input
            type="text"
            placeholder="Search e.g. 'vintage warm synth bass'..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-sans"
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold tracking-wide shadow-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Intuit Sound</span>
            </>
          )}
        </button>
      </form>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-950">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-600">
            <Music className="w-8 h-8 mb-2 stroke-1" />
            <p className="text-xs">Type a query above to search local loops offline.</p>
          </div>
        ) : (
          results.map((track) => {
            const isPreviewing = previewingPath === track.path;
            const matchPercentage = Math.round(track.score * 100);
            
            return (
              <div
                key={track.path}
                draggable
                onDragStart={(e) => handleDragStart(e, track)}
                className="p-3 bg-gray-900 border border-gray-800 rounded-md hover:border-emerald-500/50 transition-all cursor-grab active:cursor-grabbing flex flex-col gap-2 relative group"
                style={{
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {/* Match Tag */}
                <div className="absolute right-3 top-3 text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {matchPercentage > 100 ? 100 : matchPercentage}% Match
                </div>

                {/* Track Title */}
                <div className="pr-16">
                  <div className="text-xs font-bold text-gray-200 truncate" title={track.name}>
                    {track.name}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {track.duration.toFixed(2)}s | {(track.samplerate / 1000).toFixed(1)}kHz
                  </div>
                </div>

                {/* Control Action row */}
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-800/50">
                  <button
                    onClick={() => handlePreview(track)}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-emerald-400 transition-colors font-semibold"
                  >
                    {isPreviewing ? (
                      <>
                        <Pause className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Pause Preview</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
                        <span>Preview Loop</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onAddTrack(track)}
                    className="text-[10px] bg-gray-800 hover:bg-emerald-600 hover:text-white text-gray-300 px-2 py-1 rounded transition-colors font-semibold"
                  >
                    Load Track
                  </button>
                </div>
                
                {/* Drag affordance indicator on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-emerald-500">
                  <span className="text-xs text-emerald-400 font-semibold tracking-wide flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5" />
                    Drag to timeline lane
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
