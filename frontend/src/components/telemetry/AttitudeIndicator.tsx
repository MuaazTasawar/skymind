"use client";

interface AttitudeIndicatorProps {
  roll: number;
  pitch: number;
  size?: number;
}

export default function AttitudeIndicator({
  roll = 0,
  pitch = 0,
  size = 120,
}: AttitudeIndicatorProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 4;

  // Pitch offset in pixels (1 degree = r/45 pixels)
  const pitchOffset = (pitch / 45) * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <clipPath id="adi-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* Rotating sphere */}
      <g
        transform={`rotate(${-roll}, ${cx}, ${cy})`}
        clipPath="url(#adi-clip)"
      >
        {/* Sky */}
        <rect
          x={0} y={0}
          width={size}
          height={cy + pitchOffset}
          fill="#1e3a5f"
        />
        {/* Ground */}
        <rect
          x={0} y={cy + pitchOffset}
          width={size}
          height={size}
          fill="#5c3a1e"
        />
        {/* Horizon line */}
        <line
          x1={0} y1={cy + pitchOffset}
          x2={size} y2={cy + pitchOffset}
          stroke="#ffffff" strokeWidth={1.5} opacity={0.8}
        />
        {/* Pitch ladder lines */}
        {[-20, -10, 10, 20].map(deg => {
          const y = cy + pitchOffset + (deg / 45) * r;
          const w = deg % 20 === 0 ? r * 0.5 : r * 0.3;
          return (
            <line
              key={deg}
              x1={cx - w} y1={y}
              x2={cx + w} y2={y}
              stroke="white" strokeWidth={1} opacity={0.5}
            />
          );
        })}
      </g>

      {/* Fixed aircraft symbol */}
      <g>
        {/* Left wing */}
        <rect x={cx - r * 0.6} y={cy - 1.5} width={r * 0.35} height={3} rx={1.5} fill="#f59e0b" />
        {/* Right wing */}
        <rect x={cx + r * 0.25} y={cy - 1.5} width={r * 0.35} height={3} rx={1.5} fill="#f59e0b" />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill="#f59e0b" />
      </g>

      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth={3} />

      {/* Roll indicator tick at top */}
      <line
        x1={cx} y1={4}
        x2={cx} y2={4 + r * 0.15}
        stroke="#f59e0b" strokeWidth={2}
      />

      {/* Labels */}
      <text x={8} y={cy + 4} fontSize={9} fill="#9ca3af">R</text>
      <text x={size - 14} y={cy + 4} fontSize={9} fill="#9ca3af">L</text>
    </svg>
  );
}