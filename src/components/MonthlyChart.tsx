import { formatRM } from '@/types/invoice';

interface MonthlyChartProps {
  data: { key: string; label: string; total: number }[];
}

/** Short bar label so 12 columns fit on narrow screens, e.g. 350, 1.2k, 2.5M */
function compactAmount(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Lightweight CSS bar chart (no chart library) */
export default function MonthlyChart({ data }: MonthlyChartProps) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="bar-chart" role="img" aria-label="Billed amount per month for the last 12 months">
      {data.map(d => (
        <div key={d.key} className="bar-col" title={`${d.label}: ${formatRM(d.total)}`}>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(d.total / max) * 100}%` }}>
              <span className={`bar-value${d.total ? '' : ' bar-value--zero'}`}>{compactAmount(d.total)}</span>
            </div>
          </div>
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
