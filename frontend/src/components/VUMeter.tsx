import React, { useEffect, useRef } from 'react';
import { audioManager } from '../services/AudioManager';

interface VUMeterProps {
  trackId: string | null; // null represents Master
  width?: number;
  height?: number;
}

export const VUMeter: React.FC<VUMeterProps> = ({
  trackId,
  width = 12,
  height = 80
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const peakLevel = useRef(0);
  const peakHoldTime = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support high DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const segmentCount = 14;
    const gap = 2;
    const segmentHeight = (height - (segmentCount - 1) * gap) / segmentCount;

    const drawMeter = () => {
      ctx.clearRect(0, 0, width, height);

      // Fetch level (RMS: 0.0 to 1.0)
      let rms = 0;
      try {
        rms = trackId === null 
          ? audioManager.getMasterRmsLevel() 
          : audioManager.getTrackRmsLevel(trackId);
      } catch (e) {
        // Audio context might not be active
      }

      // Convert RMS to peak level (with slow decay)
      if (rms > peakLevel.current) {
        peakLevel.current = rms;
        peakHoldTime.current = 30; // Hold peak for ~30 frames
      } else {
        if (peakHoldTime.current > 0) {
          peakHoldTime.current--;
        } else {
          // Slow decay
          peakLevel.current = Math.max(0, peakLevel.current - 0.015);
        }
      }

      // Render LED segments from bottom to top
      for (let i = 0; i < segmentCount; i++) {
        // Calculate segment bottom coordinate
        const y = height - (i + 1) * (segmentHeight + gap) + gap;
        
        // Find if this segment is active
        const segmentThreshold = i / segmentCount;
        const isActive = rms > segmentThreshold;
        const isPeak = peakLevel.current > segmentThreshold && peakLevel.current <= (i + 1) / segmentCount;

        // Colors
        let activeColor = '#10b981'; // Green
        let dimColor = '#064e3b';
        
        if (i >= segmentCount * 0.8) {
          // Top 20% is red (danger)
          activeColor = '#ef4444';
          dimColor = '#450a0a';
        } else if (i >= segmentCount * 0.6) {
          // Next 20% is yellow (warning)
          activeColor = '#fbbf24';
          dimColor = '#451a03';
        }

        ctx.fillStyle = isActive ? activeColor : dimColor;
        
        // Draw the segment
        ctx.fillRect(0, y, width, segmentHeight);

        // Add subtle shine/bevel to active segments
        if (isActive) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(0, y, width, segmentHeight * 0.3);
        }

        // Draw Peak indicator bar
        if (isPeak && !isActive) {
          ctx.fillStyle = activeColor;
          ctx.fillRect(0, y, width, 1.5);
        }
      }

      animationRef.current = requestAnimationFrame(drawMeter);
    };

    drawMeter();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [trackId, width, height]);

  return (
    <div 
      className="rounded bg-black border border-gray-800 p-1 flex items-center justify-center"
      style={{ 
        width: width + 10, 
        height: height + 10,
        boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.05)'
      }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ width, height, display: 'block' }} 
      />
    </div>
  );
};
