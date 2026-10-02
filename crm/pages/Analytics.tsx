import { useState } from 'react';
import { Download } from 'lucide-react';
import { useResource } from '../../frontend/src/hooks/useResource';
import { PageHeader, Loading, ErrorState, Empty, Button } from '../../frontend/src/components/UI';
import type { Analytics as AnalyticsData } from '../../frontend/src/services/types';
import { sourceLabels } from '../../shared/constants';
import { rub } from '../../frontend/src/utils/format';
import { Stat, Bars } from '../components/Stats';
import { csvCell } from '../../frontend/src/utils/csv';
export default function Analytics() {
  const [days, setDays] = useState(30),
    resource = useResource<AnalyticsData>(`/analytics?days=${days}`);
  const d = resource.data;
  function exportCsv() {
    if (!d) return;
    const rows = [
      ['Показатель', 'Значение'],
      ['Заявки', d.requests],
      ['Новые клиенты', d.newClients],
      ['Повторные клиенты (всего)', d.repeatClients],
      ['Завершённые заказы', d.completedOrders],
      ['Средний чек', d.averageCheck],
      ['Выручка', d.revenue],
      ['Конверсия %', d.conversion],
      ...d.services.map((s) => [s.name, s.count]),
    ];
    const text =
      '\uFEFF' +
      rows
        .map((row) => row.map(csvCell).join(';'))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `drivecore-analytics-${days}days.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeader
        title="Аналитика"
        description="Результаты сервиса на основе сохранённых данных"
        action={
          <div className="actions">
            <select
              aria-label="Период аналитики"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 дней</option>
              <option value={30}>30 дней</option>
              <option value={90}>90 дней</option>
              <option value={365}>365 дней</option>
            </select>
            <Button variant="secondary" onClick={exportCsv} disabled={!d}>
              <Download size={16} /> CSV
            </Button>
          </div>
        }
      />
      {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}{' '}
      {resource.loading ? (
        <Loading />
      ) : (
        d && (
          <>
            <div className="stat-grid">
              <Stat label="Заявки" value={d.requests} />
              <Stat label="Новые клиенты" value={d.newClients} />
              <Stat
                label="Повторные клиенты"
                value={d.repeatClients}
                note="Всего клиентов с 2+ обращениями"
              />
              <Stat label="Завершённые заказы" value={d.completedOrders} />
            </div>
            <div className="stat-grid three">
              <Stat
                label="Средний чек"
                value={rub(d.averageCheck)}
                note="По завершённым заказ-нарядам"
              />
              <Stat label="Выручка" value={rub(d.revenue)} note="Фактические оплаты за период" />
              <Stat
                label="Конверсия заявок"
                value={`${d.conversion.toFixed(1)}%`}
                note="Завершённые / созданные за период"
              />
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Популярные услуги</h2>
                  <span className="muted">Количество заявок</span>
                </div>
                {d.services.length ? (
                  <div className="horizontal-bars">
                    {d.services.map((s) => (
                      <div key={s.name}>
                        <div>
                          <span>{s.name}</span>
                          <strong>{s.count}</strong>
                        </div>
                        <div className="horizontal-track">
                          <div
                            style={{
                              width: `${(s.count / Math.max(...d.services.map((v) => v.count))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Данных пока нет"
                    description="Статистика появится после первого обращения."
                  />
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Источники заявок</h2>
                </div>
                {d.sources.length ? (
                  <Bars
                    label="Количество обращений"
                    data={d.sources.map((s) => ({
                      label: sourceLabels[s.name],
                      count: s.count,
                    }))}
                  />
                ) : (
                  <Empty
                    title="Нет обращений за период"
                    description="Выберите другой период или дождитесь первой заявки."
                  />
                )}
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
