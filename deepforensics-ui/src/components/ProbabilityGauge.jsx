import './ProbabilityGauge.css';

export default function ProbabilityGauge({ value = 87.4 }) {
  const radius = 70;
  const stroke = 12;
  const c = 2 * Math.PI * radius;
  const offset = c - (value / 100) * c;
  const tone = value >= 70 ? 'high' : value >= 40 ? 'med' : 'low';

  return (
    <div className={`gauge ${tone}`}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} stroke="var(--bg-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx="90" cy="90" r={radius}
          stroke="url(#gauge-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
        />
        <defs>
          <linearGradient id="gauge-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
      </svg>
      <div className="gauge-center">
        <div className="gauge-value">{value.toFixed(1)}%</div>
        <div className="gauge-label">probability</div>
      </div>
    </div>
  );
}
