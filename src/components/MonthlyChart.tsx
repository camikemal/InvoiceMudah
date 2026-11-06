import { formatRM } from '@/types/invoice';

interface MonthlyChartProps {
  data: { key: string; label: string; total: number }[];
}

/** Lightweight CSS bar chart (no chart library) */
export default function MonthlyChart({ data }: MonthlyChartProps) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="bar-chart" role="img" aria-label="Billed amount per month for the last 12 months">
      {data.map(d => (
        <div key={d.key} className="bar-col" title={`${d.label}: ${formatRM(d.total)}`}>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(d.total / max) * 100}%` }} />
          </div>
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
