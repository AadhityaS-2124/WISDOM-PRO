import React, { useEffect, useRef } from 'react';

interface TimelineWaveformProps {
  peaks: number[];
  width: number;
  height: number;
  isActive?: boolean;
}

export const TimelineWaveform: React.FC<TimelineWaveformProps> = ({
  peaks,
  width,
  height,
  isActive = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Re-draw offscreen cache whenever peaks or size changes
  useEffect(() => {
    if (peaks.length === 0 || width <= 0 || height <= 0) return;

    // Create or resize offscreen canvas
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    
    const offscreen = offscreenCanvasRef.current;
    offscreen.width = width;
    offscreen.height = height;

    const oCtx = offscreen.getContext('2d');
    if (!oCtx) return;

    // Draw background grid lines (mesh grid)
    oCtx.fillStyle = isActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(31, 41, 55, 0.3)';
    oCtx.fillRect(0, 0, width, height);

    // Draw horizontal center line
    oCtx.strokeStyle = 'rgba(75, 85, 99, 0.4)';
    oCtx.lineWidth = 1;
    oCtx.beginPath();
    oCtx.moveTo(0, height / 2);
    oCtx.lineTo(width, height / 2);
    oCtx.stroke();

    // Draw waveform peaks
    const barWidth = Math.max(1.5, width / peaks.length);
    const spacing = 1.0;
    const drawWidth = barWidth - spacing;
    
    // Waveform gradient skin
    const gradient = oCtx.createLinearGradient(0, 0, 0, height);
    if (isActive) {
      gradient.addColorStop(0, '#34d399');   // Emerald-400
      gradient.addColorStop(0.5, '#10b981'); // Emerald-500
      gradient.addColorStop(1, '#059669');   // Emerald-600
    } else {
      gradient.addColorStop(0, '#9ca3af');   // Gray-400
      gradient.addColorStop(0.5, '#6b7280'); // Gray-500
      gradient.addColorStop(1, '#4b5563');   // Gray-650
    }

    oCtx.fillStyle = gradient;
    
    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth;
      const peakVal = peaks[i];
      // Scale amplitude to height with safety margins
      const amplitudeHeight = peakVal * (height * 0.85);
      const y = (height - amplitudeHeight) / 2;

      // Draw rounded bars for skeuomorphic hardware look
      oCtx.fillRect(x, y, drawWidth, amplitudeHeight);
    }
    
    // Trigger blitting to the onscreen canvas
    blitToOnscreen();
  }, [peaks, width, height, isActive]);

  const blitToOnscreen = () => {
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fast copy from offscreen cache
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(offscreen, 0, 0);
  };

  // Blit on regular rendering cycles
  useEffect(() => {
    blitToOnscreen();
  }, [width, height]);

  return (
    <canvas 
      ref={canvasRef}
      width={width}
      height={height}
      className="block cursor-pointer select-none rounded border border-gray-800"
      style={{ 
        width, 
        height,
        boxShadow: isActive 
          ? '0 0 10px rgba(16,185,129,0.15), inset 0 1px 3px rgba(0,0,0,0.5)' 
          : 'inset 0 1px 3px rgba(0,0,0,0.5)' 
      }}
    />
  );
};
