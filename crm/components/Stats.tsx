import type { ReactNode } from 'react';
export function Stat({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  note?: string;
}) {
  return (
    <div className="stat-card">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Bars({
  data,
  label = 'Количество заявок',
}: {
  data: { label: string; count: number }[];
  label?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="bar-chart" aria-label={label}>
      <div className="chart-bars">
        {data.map((d, i) => (
          <div key={i} className="chart-col">
            <span>{d.count}</span>
            <div className="chart-track">
              <div style={{ height: `${(d.count / max) * 100}%` }} />
            </div>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
      <details className="chart-data">
        <summary>Данные графика</summary>
        <table>
          <thead>
            <tr>
              <th>Период / категория</th>
              <th>{label}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.label}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
