export interface TrackMetadata {
  id: string;
  name: string;
  path: string;
  duration: number;
  samplerate: number;
  channels: number;
}

export interface TrackState {
  id: string;
  name: string;
  path: string;
  duration: number;
  volume: number;      // 0 to 1
  pan: number;         // -1 (left) to 1 (right)
  mute: boolean;
  solo: boolean;
  eqLow: number;       // -12 to +12 dB
  eqHigh: number;      // -12 to +12 dB
  buffer: AudioBuffer | null;
  peaks: number[];     // Sampled peaks for waveform rendering
}

export class AudioManager {
  public ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public masterAnalyser: AnalyserNode | null = null;
  
  private tracks: Map<string, TrackState> = new Map();
  // We keep running source nodes and channel nodes separately
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private channelGains: Map<string, GainNode> = new Map();
  private channelPanners: Map<string, StereoPannerNode> = new Map();
  private channelLowEQ: Map<string, BiquadFilterNode> = new Map();
  private channelHighEQ: Map<string, BiquadFilterNode> = new Map();
  private channelAnalysers: Map<string, AnalyserNode> = new Map();

  // Playback state
  public isPlaying = false;
  private bpm = 120;
  private startOffset = 0;      // Seek offset in seconds
  private startCtxTime = 0;     // Context time when play was pressed
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private rafId: number | null = null;

  constructor() {
    // AudioContext will be initialized on user interaction (Standard browser safety)
  }

  public init() {
    if (this.ctx) return;
    
    // Create audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
    
    // Create master routing chain
    this.masterGain = this.ctx.createGain();
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
    
    console.log("AudioContext initialized successfully.");
  }

  public setOnTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdateCallback = callback;
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setBpm(value: number) {
    this.bpm = value;
  }

  public getTracks(): TrackState[] {
    return Array.from(this.tracks.values());
  }

  public getTrack(id: string): TrackState | undefined {
    return this.tracks.get(id);
  }

  public async addTrack(metadata: TrackMetadata, arrayBuffer: ArrayBuffer): Promise<TrackState> {
    this.init();
    if (!this.ctx) throw new Error("AudioContext not initialized");
    
    // Decode audio data
    const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    
    // Extract peaks for drawing the waveform (downsample to 300 points)
    const peaks = this.extractPeaks(decodedBuffer, 300);
    
    const track: TrackState = {
      id: metadata.id,
      name: metadata.name,
      path: metadata.path,
      duration: decodedBuffer.duration,
      volume: 0.7,
      pan: 0,
      mute: false,
      solo: false,
      eqLow: 0,
      eqHigh: 0,
      buffer: decodedBuffer,
      peaks
    };
    
    this.tracks.set(track.id, track);
    this.setupTrackNodeChain(track);
    
    return track;
  }

  private setupTrackNodeChain(track: TrackState) {
    if (!this.ctx || !this.masterGain) return;
    
    // Create nodes
    const lowEQ = this.ctx.createBiquadFilter();
    lowEQ.type = 'lowshelf';
    lowEQ.frequency.value = 300; // 300 Hz cutoff
    lowEQ.gain.value = track.eqLow;
    
    const highEQ = this.ctx.createBiquadFilter();
    highEQ.type = 'highshelf';
    highEQ.frequency.value = 3000; // 3 kHz cutoff
    highEQ.gain.value = track.eqHigh;
    
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = track.pan;
    
    const gainNode = this.ctx.createGain();
    // Default volume mapping with headroom
    gainNode.gain.value = track.mute ? 0 : track.volume;
    
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256;
    
    // Connect chain: Source (dynamic) -> LowEQ -> HighEQ -> Panner -> Gain -> Analyser -> MasterGain
    lowEQ.connect(highEQ);
    highEQ.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(this.masterGain);
    
    // Save node references
    this.channelLowEQ.set(track.id, lowEQ);
    this.channelHighEQ.set(track.id, highEQ);
    this.channelPanners.set(track.id, panner);
    this.channelGains.set(track.id, gainNode);
    this.channelAnalysers.set(track.id, analyser);
  }

  public removeTrack(id: string) {
    this.stopTrackSource(id);
    
    // Disconnect nodes if they exist
    this.channelLowEQ.get(id)?.disconnect();
    this.channelHighEQ.get(id)?.disconnect();
    this.channelPanners.get(id)?.disconnect();
    this.channelGains.get(id)?.disconnect();
    this.channelAnalysers.get(id)?.disconnect();
    
    // Delete references
    this.channelLowEQ.delete(id);
    this.channelHighEQ.delete(id);
    this.channelPanners.delete(id);
    this.channelGains.delete(id);
    this.channelAnalysers.delete(id);
    this.tracks.delete(id);
    this.activeSources.delete(id);
  }

  public play() {
    this.init();
    if (this.isPlaying || !this.ctx) return;
    
    // Resume context if suspended (browser security)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    const currTime = this.ctx.currentTime;
    this.startCtxTime = currTime;
    this.isPlaying = true;
    
    // Start all tracks at the offset
    this.tracks.forEach((track) => {
      this.startTrackSource(track, this.startOffset);
    });
    
    // Start animation loop for timeline playhead progress
    this.startPlaybackTimer();
  }

  public pause() {
    if (!this.isPlaying || !this.ctx) return;
    
    this.isPlaying = false;
    this.stopPlaybackTimer();
    
    // Calculate precise offset we paused at
    const elapsed = this.ctx.currentTime - this.startCtxTime;
    this.startOffset += elapsed;
    
    // Stop all active sources with small ramp to prevent pops
    this.tracks.forEach((_, id) => {
      this.stopTrackSource(id);
    });
  }

  public stop() {
    this.isPlaying = false;
    this.stopPlaybackTimer();
    this.startOffset = 0;
    
    this.tracks.forEach((_, id) => {
      this.stopTrackSource(id);
    });
    
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(0);
    }
  }

  public seek(timeInSeconds: number) {
    const wasPlaying = this.isPlaying;
    
    if (wasPlaying) {
      this.pause();
    }
    
    // Bound check
    const maxDuration = this.getMaxDuration();
    this.startOffset = Math.max(0, Math.min(timeInSeconds, maxDuration));
    
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.startOffset);
    }
    
    if (wasPlaying) {
      this.play();
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.startOffset;
    }
    const elapsed = this.ctx.currentTime - this.startCtxTime;
    const current = this.startOffset + elapsed;
    const maxDur = this.getMaxDuration();
    
    if (current >= maxDur && maxDur > 0) {
      // Loop or stop
      this.stop();
      return 0;
    }
    return current;
  }

  public getMaxDuration(): number {
    let max = 0;
    this.tracks.forEach(t => {
      if (t.duration > max) max = t.duration;
    });
    return max;
  }

  private startTrackSource(track: TrackState, offset: number) {
    if (!this.ctx || !track.buffer) return;
    
    // Stop previous if exists
    this.stopTrackSource(track.id);
    
    // If seek offset is beyond track duration, we don't start the track
    if (offset >= track.buffer.duration) return;
    
    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    
    // Connect to EQ chain input
    const targetInput = this.channelLowEQ.get(track.id);
    if (targetInput) {
      source.connect(targetInput);
    }
    
    // Play with precise timing
    source.start(0, offset);
    this.activeSources.set(track.id, source);
  }

  private stopTrackSource(id: string) {
    const source = this.activeSources.get(id);
    if (source) {
      try {
        source.stop();
      } catch (e) {
        // Source may already have ended naturally
      }
      source.disconnect();
      this.activeSources.delete(id);
    }
  }

  // Parameter controls
  public setVolume(id: string, value: number) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.volume = value;
    
    const gainNode = this.channelGains.get(id);
    if (gainNode && this.ctx) {
      // If muted or solo system overrides it
      const targetVolume = this.calculateEffectiveVolume(id);
      gainNode.gain.setValueAtTime(targetVolume, this.ctx.currentTime);
    }
  }

  public setPan(id: string, value: number) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.pan = value;
    
    const panner = this.channelPanners.get(id);
    if (panner && this.ctx) {
      panner.pan.setValueAtTime(value, this.ctx.currentTime);
    }
  }

  public setMute(id: string, state: boolean) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.mute = state;
    this.updateAllChannelsVolume();
  }

  public setSolo(id: string, state: boolean) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.solo = state;
    this.updateAllChannelsVolume();
  }

  public setEQ(id: string, band: 'low' | 'high', value: number) {
    const track = this.tracks.get(id);
    if (!track) return;
    
    if (band === 'low') {
      track.eqLow = value;
      const node = this.channelLowEQ.get(id);
      if (node && this.ctx) {
        node.gain.setValueAtTime(value, this.ctx.currentTime);
      }
    } else {
      track.eqHigh = value;
      const node = this.channelHighEQ.get(id);
      if (node && this.ctx) {
        node.gain.setValueAtTime(value, this.ctx.currentTime);
      }
    }
  }

  public setMasterVolume(value: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(value, this.ctx.currentTime);
    }
  }

  private calculateEffectiveVolume(id: string): number {
    const track = this.tracks.get(id);
    if (!track || track.mute) return 0;
    
    // Check if any other track is soloed
    let isAnyTrackSoloed = false;
    this.tracks.forEach(t => {
      if (t.solo) isAnyTrackSoloed = true;
    });
    
    // If some track is soloed, this track must also be soloed to play
    if (isAnyTrackSoloed && !track.solo) {
      return 0;
    }
    
    return track.volume;
  }

  private updateAllChannelsVolume() {
    this.tracks.forEach((_, id) => {
      const gainNode = this.channelGains.get(id);
      if (gainNode && this.ctx) {
        const targetVol = this.calculateEffectiveVolume(id);
        // Smooth transition to prevent audio clicks
        gainNode.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.015);
      }
    });
  }

  // LED Meter Data Extraction
  public getTrackRmsLevel(id: string): number {
    const analyser = this.channelAnalysers.get(id);
    if (!analyser) return 0;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    // Calculate Root Mean Square (RMS) amplitude
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128; // Normalize to [-1.0, 1.0]
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    return rms;
  }

  public getMasterRmsLevel(): number {
    if (!this.masterAnalyser) return 0;
    
    const bufferLength = this.masterAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.masterAnalyser.getByteTimeDomainData(dataArray);
    
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128;
      sumSquares += val * val;
    }
    return Math.sqrt(sumSquares / bufferLength);
  }

  // Waveform Peak Downsampling helper
  private extractPeaks(buffer: AudioBuffer, points: number): number[] {
    const channelData = buffer.getChannelData(0); // Use first channel
    const step = Math.floor(channelData.length / points);
    const peaks: number[] = [];
    
    for (let i = 0; i < points; i++) {
      let maxVal = 0;
      const start = i * step;
      const end = start + step;
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > maxVal) {
          maxVal = val;
        }
      }
      peaks.push(maxVal);
    }
    return peaks;
  }

  // Playback timer loops
  private startPlaybackTimer() {
    const tick = () => {
      if (this.isPlaying && this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.getCurrentTime());
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopPlaybackTimer() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const audioManager = new AudioManager();
