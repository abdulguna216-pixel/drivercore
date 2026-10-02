import { useState } from 'react';
import { useAuth, useToast } from '../../frontend/src/components/Providers';
import { useResource } from '../../frontend/src/hooks/useResource';
import { PageHeader, Loading, ErrorState, Empty, Button } from '../../frontend/src/components/UI';
import { send } from '../../frontend/src/services/api';
import { dateLabel } from '../../frontend/src/utils/format';
const labels: Record<string, string> = { LOGIN_FAILED: 'Неудачный вход', LOGIN_SUCCESS: 'Успешный вход', LOGOUT: 'Выход', INVALID_SESSION: 'Недействительная сессия', ACCESS_DENIED: 'Отказ в доступе', CSRF_DENIED: 'Отклонён источник формы', RATE_LIMITED: 'Превышен лимит запросов', USER_CREATED: 'Создан сотрудник', USER_CHANGED: 'Изменён сотрудник или права', PASSWORD_CHANGED: 'Изменён пароль', UPLOAD_REJECTED: 'Отклонена загрузка', STORAGE_LIMIT: 'Достигнут предел хранилища', SERVER_ERROR: 'Ошибка сервера' };
type Data = { alerts: { id: string; type: string; severity: string; count: number; acknowledgedAt: string | null; createdAt: string }[]; events: { id: string; type: string; status: number | null; requestId: string; createdAt: string }[] };
function AdminSecurity() {
  const resource = useResource<Data>('/security', 15000);
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  async function acknowledge(id: string) {
    setPending(id);
    try { await send(`/security/alerts/${id}`, {}, 'PATCH'); await resource.refresh(); }
    catch (error) { toast(error instanceof Error ? error.message : 'Не удалось сохранить отметку.', true); }
    finally { setPending(null); }
  }
  return <>
    <PageHeader title="Безопасность" description="Предупреждения и последние 100 событий доступа" />
    {resource.loading && <Loading />}
    {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}
    {resource.data && <>
      <section className="panel detail-panel"><h2>Предупреждения</h2>
        {!resource.data.alerts.length && <Empty title="Предупреждений нет" description="Подозрительная активность и изменения доступа появятся здесь." />}
        {resource.data.alerts.map((alert) => <div className="panel-heading" key={alert.id}><div><strong>{labels[alert.type] || alert.type}</strong><p className="muted">{dateLabel(alert.createdAt)} · Событий: {alert.count} · {alert.acknowledgedAt ? 'Просмотрено' : 'Требует внимания'}</p></div>{!alert.acknowledgedAt && <Button variant="secondary" disabled={pending !== null} onClick={() => acknowledge(alert.id)}>{pending === alert.id ? 'Сохранение…' : 'Отметить просмотренным'}</Button>}</div>)}
      </section>
      <section className="panel detail-panel"><h2>Журнал доступа</h2><div className="table-wrap"><table><thead><tr><th>Время</th><th>Событие</th><th>Результат</th><th>Номер запроса</th></tr></thead><tbody>{resource.data.events.map((event) => <tr key={event.id}><td>{dateLabel(event.createdAt)}</td><td>{labels[event.type] || event.type}</td><td>{event.status || '—'}</td><td><code>{event.requestId.slice(0, 8)}</code></td></tr>)}</tbody></table></div></section>
    </>}
  </>;
}
export default function Security() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <AdminSecurity /> : <ErrorState message="Журнал безопасности доступен администратору." />;
}
