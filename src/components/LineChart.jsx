import { useMemo } from 'react';

function formatMonthLabel(monthKey) {
  // monthKey = YYYY-MM
  const [y, m] = String(monthKey).split('-');
  return `${m}/${y}`;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function formatCompact(n) {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function LineChart({
  title,
  months,
  series,
  height = 320,
  yLabel = '',
}) {
  const width = 960;
  const pad = { l: 56, r: 18, t: 18, b: 44 };

  const { pathD, points, yMax, ticks } = useMemo(() => {
    const vals = series.map((d) => d.value);
    const rawMax = Math.max(0, ...vals);
    const yMaxLocal = niceMax(rawMax);

    const xFor = (i) => {
      const w = width - pad.l - pad.r;
      if (months.length <= 1) return pad.l + w / 2;
      return pad.l + (i * w) / (months.length - 1);
    };
    const yFor = (v) => {
      const h = height - pad.t - pad.b;
      const t = yMaxLocal === 0 ? 0 : v / yMaxLocal;
      return pad.t + (1 - t) * h;
    };

    const pts = series.map((d, i) => ({
      ...d,
      x: xFor(i),
      y: yFor(d.value),
    }));

    const d =
      pts.length === 0
        ? ''
        : pts
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
            .join(' ');

    const tickCount = 5;
    const ticksLocal = Array.from({ length: tickCount }, (_, i) => {
      const v = (yMaxLocal * (tickCount - 1 - i)) / (tickCount - 1);
      return { v, y: yFor(v) };
    });

    return { pathD: d, points: pts, yMax: yMaxLocal, ticks: ticksLocal };
  }, [height, months.length, pad.b, pad.l, pad.r, pad.t, series, width]);

  const xTickEvery = months.length <= 12 ? 1 : months.length <= 24 ? 2 : 3;

  return (
    <div className="card chartCard">
      <div className="cardHeader">
        <div>
          <div className="cardTitle">{title}</div>
          <div className="cardSubtle">
            {months.length} months • y-max {formatCompact(yMax)} {yLabel ? `• ${yLabel}` : ''}
          </div>
        </div>
      </div>

      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {/* grid + y ticks */}
        {ticks.map((t) => (
          <g key={t.y}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={t.y}
              y2={t.y}
              className="chartGrid"
            />
            <text x={pad.l - 10} y={t.y + 4} textAnchor="end" className="chartAxis">
              {formatCompact(t.v)}
            </text>
          </g>
        ))}

        {/* x ticks */}
        {months.map((m, i) => {
          if (i % xTickEvery !== 0 && i !== months.length - 1) return null;
          const x =
            months.length <= 1
              ? pad.l + (width - pad.l - pad.r) / 2
              : pad.l + (i * (width - pad.l - pad.r)) / (months.length - 1);
          return (
            <g key={m}>
              <line
                x1={x}
                x2={x}
                y1={height - pad.b}
                y2={height - pad.b + 6}
                className="chartTick"
              />
              <text
                x={x}
                y={height - pad.b + 22}
                textAnchor="middle"
                className="chartAxis"
              >
                {formatMonthLabel(m)}
              </text>
            </g>
          );
        })}

        {/* line */}
        <path d={pathD} className="chartLine" />

        {/* points */}
        {points.map((p) => (
          <circle key={p.month} cx={p.x} cy={p.y} r="3.5" className="chartDot">
            <title>
              {p.month}: {p.value.toLocaleString()}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}


