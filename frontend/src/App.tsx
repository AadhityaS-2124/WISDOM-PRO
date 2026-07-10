import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Volume2, Plus, 
  Sliders, Layers, RefreshCw
} from 'lucide-react';
import { audioManager } from './services/AudioManager';
import type { TrackState, TrackMetadata } from './services/AudioManager';
import { SkeuomorphicKnob } from './components/SkeuomorphicKnob';
import { VUMeter } from './components/VUMeter';
import { TimelineWaveform } from './components/TimelineWaveform';
import { AIDrawer } from './components/AIDrawer';

export default function App() {
  const [tracks, setTracks] = useState<TrackState[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(60); // pixels per second

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize and subscribe to time updates
  useEffect(() => {
    audioManager.setOnTimeUpdate((time) => {
      setCurrentTime(time);
    });

    // Initial load from sidecar database
    loadExistingTracks();

    return () => {
      audioManager.stop();
    };
  }, []);

  const loadExistingTracks = async () => {
    setLoadingStatus("Connecting to sidecar...");
    try {
      const res = await fetch("http://localhost:8000/tracks");
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        setLoadingStatus(`Decoding ${data.tracks.length} sound loops...`);
        for (let i = 0; i < data.tracks.length; i++) {
          const t = data.tracks[i];
          setLoadingStatus(`Decoding ${t.name} (${i + 1}/${data.tracks.length})...`);
          
          const fileRes = await fetch(`http://localhost:8000/audio-file?path=${encodeURIComponent(t.path)}`);
          const buffer = await fileRes.arrayBuffer();
          
          await audioManager.addTrack({
            id: t.path,
            name: t.name,
            path: t.path,
            duration: t.duration,
            samplerate: t.samplerate,
            channels: t.channels
          }, buffer);
        }
        setTracks(audioManager.getTracks());
      }
    } catch (e) {
      console.error("Failed to load existing tracks:", e);
    } finally {
      setLoadingStatus(null);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      audioManager.pause();
      setIsPlaying(false);
    } else {
      audioManager.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioManager.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleAddLocalTrack = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingStatus(`Loading ${file.name}...`);
    try {
      // 1. Send the file path to backend /add-asset to save and index it
      // Since it's a browser upload, we mock the local path or use a relative path.
      // In a real desktop app, we can obtain the file path.
      // We will upload it to backend or save it in the library folder.
      // For this demo DAW, we write the file to the library or index it directly.
      const arrayBuffer = await file.arrayBuffer();
      
      // Let's index it locally in Web Audio Context
      const mockMeta: TrackMetadata = {
        id: file.name,
        name: file.name,
        path: file.name,
        duration: 0,
        samplerate: 44100,
        channels: 2
      };
      
      await audioManager.addTrack(mockMeta, arrayBuffer);
      setTracks(audioManager.getTracks());
    } catch (error) {
      console.error("Failed to import audio track:", error);
    } finally {
      setLoadingStatus(null);
    }
  };

  const handleAddTrackFromAI = async (meta: TrackMetadata) => {
    setLoadingStatus(`Loading ${meta.name}...`);
    try {
      const response = await fetch(`http://localhost:8000/audio-file?path=${encodeURIComponent(meta.path)}`);
      const buffer = await response.arrayBuffer();
      await audioManager.addTrack(meta, buffer);
      setTracks(audioManager.getTracks());
    } catch (e) {
      console.error("Failed to add track from search:", e);
    } finally {
      setLoadingStatus(null);
    }
  };

  const handleMute = (id: string, state: boolean) => {
    audioManager.setMute(id, state);
    setTracks(audioManager.getTracks());
  };

  const handleSolo = (id: string, state: boolean) => {
    audioManager.setSolo(id, state);
    setTracks(audioManager.getTracks());
  };

  const handleVolumeChange = (id: string, val: number) => {
    audioManager.setVolume(id, val);
    setTracks(audioManager.getTracks());
  };

  const handlePanChange = (id: string, val: number) => {
    audioManager.setPan(id, val);
    setTracks(audioManager.getTracks());
  };

  const handleEQChange = (id: string, band: 'low' | 'high', val: number) => {
    audioManager.setEQ(id, band, val);
    setTracks(audioManager.getTracks());
  };

  const handleMasterVolumeChange = (val: number) => {
    setMasterVolume(val);
    audioManager.setMasterVolume(val);
  };

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setBpm(val);
    audioManager.setBpm(val);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const time = clickX / timelineZoom;
    audioManager.seek(time);
  };

  // Drag and drop loops into timeline
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const meta = JSON.parse(dataStr) as TrackMetadata;
        await handleAddTrackFromAI(meta);
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };


  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-gray-200">
      {/* DAW Header (Transport bar & LCD Panel) */}
      <div 
        className="h-14 border-b border-gray-900 flex items-center justify-between px-6 z-25 shadow-md"
        style={{
          background: 'linear-gradient(to bottom, #2d3340 0%, #1f232e 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 5px rgba(0,0,0,0.5)'
        }}
      >
        {/* Logo and Import */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center font-bold text-black text-sm shadow-[0_0_8px_#10b981]">
              W
            </div>
            <span className="font-bold text-sm tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
              Wisdom Pro
            </span>
          </div>

          <button 
            onClick={handleAddLocalTrack}
            className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded border border-gray-700 shadow transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Import Audio
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="audio/*" 
            className="hidden" 
          />
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePlayPause}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
              isPlaying 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4.5 h-4.5 fill-current" />
            ) : (
              <Play className="w-4.5 h-4.5 fill-current translate-x-0.5" />
            )}
          </button>

          <button 
            onClick={handleStop}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
          
          <button 
            onClick={loadExistingTracks}
            title="Refresh tracks from sidecar"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors ml-2"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* LCD display screen */}
        <div className="lcd-screen w-80 h-9 rounded px-3 flex items-center justify-between text-xs font-mono select-none">
          <div className="flex flex-col">
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">Position</span>
            <span className="lcd-glow-green font-bold text-sm tracking-widest">{formatTime(currentTime)}</span>
          </div>
          
          <div className="h-6 w-[1px] bg-gray-800" />
          
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">BPM</span>
            <div className="flex items-center gap-1 mt-0.5">
              <input 
                type="number" 
                value={bpm} 
                onChange={handleBpmChange}
                min={60} 
                max={220}
                className="w-10 bg-transparent text-center border-none focus:outline-none focus:ring-0 lcd-glow-blue font-bold text-xs p-0 m-0"
              />
            </div>
          </div>

          <div className="h-6 w-[1px] bg-gray-800" />

          <div className="flex flex-col items-end">
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">Tracks</span>
            <span className="lcd-glow-blue font-bold text-xs">{tracks.length}</span>
          </div>
        </div>

        {/* Master Output Meter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-gray-400" />
            <input 
              type="range"
              min={0}
              max={1.2}
              step={0.01}
              value={masterVolume}
              onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
              className="hardware-slider w-24"
            />
          </div>
          <div className="scale-y-75 origin-bottom">
            <VUMeter trackId={null} width={8} height={36} />
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Track Headers + Waveform Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Zoom controls & Timeline Ruler */}
          <div className="h-8 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4 text-[10px] font-semibold text-gray-500 select-none">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-gray-400" />
              <span>TRACK LANES</span>
            </div>
            
            <div className="flex items-center gap-3">
              <span>Zoom:</span>
              <input 
                type="range" 
                min={20} 
                max={150} 
                value={timelineZoom} 
                onChange={(e) => setTimelineZoom(parseInt(e.target.value))} 
                className="w-16 h-1 bg-gray-800 rounded-full appearance-none outline-none"
              />
            </div>
          </div>

          {/* Timeline Grid (headers + waveforms) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-slate-900/50">
            {tracks.length === 0 ? (
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-500 border-2 border-dashed border-gray-800 m-8 rounded-lg"
              >
                <Layers className="w-12 h-12 mb-3 stroke-1 text-gray-600 animate-bounce" />
                <p className="text-sm font-semibold text-gray-400">Import files or drag loops from the AI drawer to start your mix.</p>
                <p className="text-xs text-gray-600 mt-1">Accepts WAV, MP3, and AI recommendations.</p>
              </div>
            ) : (
              <div 
                className="flex flex-col divide-y divide-gray-900/80"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {tracks.map((track) => {
                  const isSelected = selectedTrackId === track.id;
                  
                  return (
                    <div 
                      key={track.id}
                      onClick={() => setSelectedTrackId(track.id)}
                      className={`flex h-24 transition-colors ${
                        isSelected ? 'bg-slate-800/40' : 'hover:bg-slate-900/30'
                      }`}
                    >
                      {/* Track Header Details */}
                      <div 
                        className="w-52 flex-shrink-0 border-r border-gray-900 p-3 flex flex-col justify-between"
                        style={{
                          background: 'linear-gradient(to right, #1f232e, #1a1e27)'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-200 truncate pr-2 w-32" title={track.name}>
                            {track.name}
                          </span>
                          <span className="text-[9px] font-mono text-gray-500">{track.duration.toFixed(1)}s</span>
                        </div>
                        
                        {/* Mute/Solo & Vol fader */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 select-none">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMute(track.id, !track.mute);
                              }}
                              className={`w-6 h-5 rounded text-[10px] font-bold border transition-colors flex items-center justify-center ${
                                track.mute 
                                  ? 'bg-red-500/20 border-red-500 text-red-400 font-extrabold shadow-[0_0_5px_rgba(239,68,68,0.3)]' 
                                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                              }`}
                            >
                              M
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSolo(track.id, !track.solo);
                              }}
                              className={`w-6 h-5 rounded text-[10px] font-bold border transition-colors flex items-center justify-center ${
                                track.solo 
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-extrabold shadow-[0_0_5px_rgba(245,158,11,0.3)]' 
                                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                              }`}
                            >
                              S
                            </button>
                          </div>
                          
                          <input
                            type="range"
                            min={0}
                            max={1.0}
                            step={0.01}
                            value={track.volume}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                            className="hardware-slider w-20"
                          />
                        </div>
                      </div>

                      {/* Track Waveform timeline lane */}
                      <div 
                        ref={timelineRef}
                        onClick={handleTimelineClick}
                        className="flex-1 relative overflow-hidden bg-slate-950/60 timeline-grid-bg"
                        style={{ height: '100%' }}
                      >
                        {/* Waveform Drawing */}
                        <div 
                          className="absolute left-0 top-1.5" 
                          style={{ width: track.duration * timelineZoom, height: 80 }}
                        >
                          <TimelineWaveform 
                            peaks={track.peaks} 
                            width={track.duration * timelineZoom} 
                            height={78} 
                            isActive={isSelected}
                          />
                        </div>

                        {/* Playhead Indicator overlay */}
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 pointer-events-none z-10"
                          style={{ 
                            left: `${currentTime * timelineZoom}px`,
                            boxShadow: '0 0 8px #10b981'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Mixer Console (Skeuomorphic channels strip racks) */}
          <div 
            className="h-64 border-t border-gray-900 flex z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]"
            style={{
              background: 'linear-gradient(to bottom, #212530 0%, #161821 100%)'
            }}
          >
            {/* Left rack ears */}
            <div className="rack-ear-left flex-shrink-0">
              <div className="rack-screw" />
              <div className="rack-screw" />
            </div>

            {/* Mixer Channel rack list */}
            <div className="flex-1 flex overflow-x-auto divide-x divide-gray-900/60 p-3 gap-2">
              {tracks.map((track) => {
                const isSelected = selectedTrackId === track.id;
                
                return (
                  <div 
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`w-32 flex-shrink-0 flex flex-col justify-between p-2 rounded-md transition-colors select-none ${
                      isSelected 
                        ? 'bg-slate-800/30 border border-emerald-500/20' 
                        : 'bg-slate-900/20 border border-transparent hover:bg-slate-900/30'
                    }`}
                  >
                    {/* Track Title */}
                    <div className="text-[10px] font-bold text-gray-300 truncate text-center" title={track.name}>
                      {track.name}
                    </div>

                    {/* EQ Knobs */}
                    <div className="flex justify-center gap-1.5 my-1">
                      <SkeuomorphicKnob 
                        min={-12} 
                        max={12} 
                        value={track.eqHigh} 
                        onChange={(val) => handleEQChange(track.id, 'high', val)}
                        label="HI EQ"
                        unit="dB"
                        size={28}
                      />
                      <SkeuomorphicKnob 
                        min={-12} 
                        max={12} 
                        value={track.eqLow} 
                        onChange={(val) => handleEQChange(track.id, 'low', val)}
                        label="LO EQ"
                        unit="dB"
                        size={28}
                      />
                    </div>

                    {/* Pan knob */}
                    <div className="flex justify-center mb-1.5">
                      <SkeuomorphicKnob 
                        min={-1} 
                        max={1} 
                        value={track.pan} 
                        onChange={(val) => handlePanChange(track.id, val)}
                        label="PAN"
                        defaultValue={0}
                        size={28}
                      />
                    </div>

                    {/* Fader section */}
                    <div className="flex-1 flex justify-center items-center gap-2 mt-1.5">
                      {/* VU Meter */}
                      <VUMeter trackId={track.id} width={7} height={70} />
                      
                      {/* Vertical Volume Fader */}
                      <div className="relative h-[72px] flex items-center justify-center">
                        <input
                          type="range"
                          min={0}
                          max={1.0}
                          step={0.01}
                          value={track.volume}
                          onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                          style={{
                            transform: 'rotate(-90deg)',
                            width: '72px',
                            height: '12px',
                            cursor: 'ns-resize',
                            background: 'transparent'
                          }}
                          className="appearance-none focus:outline-none cursor-ns-resize"
                        />
                      </div>
                    </div>

                    {/* Mute / Solo triggers */}
                    <div className="flex items-center gap-1 justify-center mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMute(track.id, !track.mute);
                        }}
                        className={`w-10 h-4.5 rounded text-[8px] font-bold border flex items-center justify-center ${
                          track.mute ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-500'
                        }`}
                      >
                        MUTE
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSolo(track.id, !track.solo);
                        }}
                        className={`w-10 h-4.5 rounded text-[8px] font-bold border flex items-center justify-center ${
                          track.solo ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-500'
                        }`}
                      >
                        SOLO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right master ear panel */}
            <div className="rack-ear-right flex-shrink-0">
              <div className="rack-screw" />
              <div className="rack-screw" />
            </div>
          </div>
        </div>

        {/* Right Side: AI Sound Intuiter search Drawer */}
        <AIDrawer onAddTrack={handleAddTrackFromAI} />
      </div>

      {/* Startup loading overlays */}
      {loadingStatus && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 select-none">
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full">
            <Sliders className="w-8 h-8 text-emerald-400 animate-spin" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-gray-100 uppercase tracking-wide">
                DAW Engine Initializing
              </span>
              <span className="text-xs text-emerald-400 font-mono">
                {loadingStatus}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden border border-gray-800">
              <div className="h-full bg-emerald-500 animate-[pulse_1s_infinite] w-[70%]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
