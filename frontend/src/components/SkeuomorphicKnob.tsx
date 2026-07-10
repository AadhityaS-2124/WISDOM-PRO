import React, { useRef, useEffect } from 'react';

interface KnobProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  defaultValue?: number;
  unit?: string;
  size?: number;
}

export const SkeuomorphicKnob: React.FC<KnobProps> = ({
  min,
  max,
  value,
  onChange,
  label,
  defaultValue = 0,
  unit = "",
  size = 48
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  
  // Track drag state outside React state to prevent re-renders
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  // Conversion helpers: map values [min, max] to degrees [-135, 135]
  const valToDeg = (val: number) => {
    const percent = (val - min) / (max - min);
    return -135 + percent * 270;
  };

  const degToVal = (deg: number) => {
    // clamp deg to [-135, 135]
    const clampedDeg = Math.max(-135, Math.min(deg, 135));
    const percent = (clampedDeg + 135) / 270;
    return min + percent * (max - min);
  };

  // Sync initial and external value changes
  useEffect(() => {
    if (!isDragging.current && indicatorRef.current && readoutRef.current) {
      const deg = valToDeg(value);
      indicatorRef.current.style.transform = `rotate(${deg}deg)`;
      readoutRef.current.textContent = `${value.toFixed(1)}${unit}`;
    }
  }, [value, min, max]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    if (readoutRef.current) {
      readoutRef.current.classList.add('knob-readout-active');
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    
    // Sensitivity: 150px drag represents full sweep (270 degrees)
    const deltaY = startY.current - e.clientY;
    const degDelta = (deltaY / 150) * 270;
    
    const startDeg = valToDeg(startVal.current);
    const newDeg = Math.max(-135, Math.min(startDeg + degDelta, 135));
    
    // Direct DOM manipulation - NO React state update
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = `rotate(${newDeg}deg)`;
    }
    
    if (readoutRef.current) {
      const val = degToVal(newDeg);
      readoutRef.current.textContent = `${val.toFixed(1)}${unit}`;
    }
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (readoutRef.current) {
      readoutRef.current.classList.remove('knob-readout-active');
    }

    // Sync final value to React state at drag completion
    if (indicatorRef.current) {
      // Parse current rotation from DOM style
      const match = indicatorRef.current.style.transform.match(/rotate\(([-\d.]+)deg\)/);
      if (match) {
        const finalDeg = parseFloat(match[1]);
        const finalVal = degToVal(finalDeg);
        onChange(finalVal);
      }
    }
  };

  const handleDoubleClick = () => {
    if (indicatorRef.current && readoutRef.current) {
      const defDeg = valToDeg(defaultValue);
      indicatorRef.current.style.transform = `rotate(${defDeg}deg)`;
      readoutRef.current.textContent = `${defaultValue.toFixed(1)}${unit}`;
      onChange(defaultValue);
    }
  };

  const radius = size / 2;
  const strokeWidth = size * 0.08;
  const c = radius;
  const r = radius - strokeWidth;
  const circumference = 2 * Math.PI * r;
  // Arc length is 270 deg (75% of circumference)
  const strokeDasharray = `${circumference * 0.75} ${circumference}`;
  const strokeDashoffset = `${circumference * 0.625}`; // rotate starting point to bottom left

  return (
    <div className="flex flex-col items-center select-none py-1">
      <div 
        ref={knobRef}
        className="relative cursor-ns-resize group"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Skeuomorphic Ring Background */}
        <svg width={size} height={size} className="absolute top-0 left-0 -rotate-90">
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="transparent"
            stroke="#1f2937"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
          {/* Active glow path */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="transparent"
            stroke="#10b981"
            strokeWidth={strokeWidth * 0.8}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="opacity-40 group-hover:opacity-80 transition-opacity"
          />
        </svg>

        {/* The physical knob body */}
        <div 
          className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none"
          style={{ 
            margin: `${strokeWidth + 2}px`,
            background: 'radial-gradient(circle at 35% 35%, #4b5563 0%, #1f2937 60%, #111827 100%)',
            boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.15), 0 3px 5px rgba(0,0,0,0.5)',
            border: '1px solid #111827'
          }}
        >
          {/* Inner metallic notch */}
          <div 
            ref={indicatorRef}
            className="w-full h-full relative"
            style={{ 
              transform: `rotate(${valToDeg(value)}deg)`,
              transition: isDragging.current ? 'none' : 'transform 150ms ease-out'
            }}
          >
            {/* Skeuomorphic physical line indicator */}
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 bg-emerald-400 rounded-full"
              style={{ 
                height: `${size * 0.22}px`, 
                marginTop: '2px',
                boxShadow: '0 0 3px #10b981'
              }}
            />
          </div>
        </div>

        {/* Dynamic value overlay text (appears on drag/hover) */}
        <div 
          ref={readoutRef}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 bg-gray-950 border border-gray-800 rounded shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
        >
          {value.toFixed(1)}{unit}
        </div>
      </div>
      
      {/* Parameter Label */}
      <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase mt-1">
        {label}
      </span>
    </div>
  );
};
