import { Link } from 'react-router-dom';
import {
  Plus,
  ArrowUpRight,
  Inbox,
  CalendarDays,
  Wrench,
  CheckCircle2,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useResource } from '../../frontend/src/hooks/useResource';
import { useAuth } from '../../frontend/src/components/Providers';
import { PageHeader, Loading, ErrorState, Empty, Badge } from '../../frontend/src/components/UI';
import type { Dashboard as DashboardData } from '../../frontend/src/services/types';
import { rub, carName, timeLabel, dateLabel } from '../../frontend/src/utils/format';
import { Stat, Bars } from '../components/Stats';
export default function Dashboard() {
  const { user } = useAuth(),
    resource = useResource<DashboardData>('/dashboard', 5000);
  const data = resource.data;
  return (
    <>
      <PageHeader
        title={`Добрый день, ${user?.name.split(' ')[0]}`}
        description={new Date().toLocaleDateString('ru-RU', {
          timeZone: 'Europe/Moscow',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        action={
          user?.role !== 'MECHANIC' && (
            <Link className="btn btn-primary" to="/crm/requests?new=1">
              <Plus size={18} /> Новая заявка
            </Link>
          )
        }
      />
      {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}{' '}
      {resource.loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stat-grid">
              <Stat
                label="Новые заявки"
                value={data.counts.NEW || 0}
                icon={<Inbox size={19} />}
                note="Ожидают первого контакта"
              />
              <Stat
                label="Записано сегодня"
                value={data.today}
                icon={<CalendarDays size={19} />}
                note="Подтверждённые записи"
              />
              <Stat
                label="Сейчас в работе"
                value={data.counts.IN_PROGRESS || 0}
                icon={<Wrench size={19} />}
                note="Автомобили в сервисе"
              />
              <Stat
                label="Готовы к выдаче"
                value={data.counts.READY || 0}
                icon={<CheckCircle2 size={19} />}
                note="Работы выполнены"
              />
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Заявки за неделю</h2>
                  <span className="muted">Последние 7 дней</span>
                </div>
                {data.weekly.some((day) => day.count > 0) ? (
                  <Bars
                    data={data.weekly.map((d) => ({
                      label: dateLabel(d.date).slice(0, 6),
                      count: d.count,
                    }))}
                  />
                ) : (
                  <Empty
                    title="Заявок за неделю пока нет"
                    description="График заполнится по мере поступления обращений."
                  />
                )}
                <div className="chart-footer">
                  <span>Всего за неделю</span>
                  <strong>{data.weekly.reduce((s, d) => s + d.count, 0)} заявок</strong>
                </div>
              </section>
              <section className="panel appointments-panel">
                <div className="panel-heading">
                  <h2>Сегодняшние записи</h2>
                  <Link to="/crm/calendar" className="icon-btn" aria-label="Открыть календарь">
                    <ArrowUpRight size={19} />
                  </Link>
                </div>
                {data.appointments.length ? (
                  data.appointments.map((a) => (
                    <Link
                      key={a.id}
                      to={`/crm/requests/${a.requestId}`}
                      className="today-appointment"
                    >
                      <time>{timeLabel(a.startsAt)}</time>
                      <div>
                        <strong>{carName(a.request.car)}</strong>
                        <span>{a.request.service.name}</span>
                        <small>{a.mechanic.name}</small>
                      </div>
                      <Badge status={a.request.status} />
                    </Link>
                  ))
                ) : (
                  <Empty
                    title="На сегодня записей нет"
                    description="Подтверждённые записи появятся после назначения мастера и времени."
                  />
                )}
              </section>
            </div>
            <div className="dashboard-grid bottom-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Последние заявки</h2>
                  <Link to="/crm/requests" className="subtle-link">
                    Все заявки <ArrowRight size={15} />
                  </Link>
                </div>
                {data.recent.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Заявка / автомобиль</th>
                          <th>Клиент</th>
                          <th>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <Link to={`/crm/requests/${r.id}`}>
                                <strong>{carName(r.car)}</strong>
                                <small>
                                  #{r.id} · {r.service.name}
                                </small>
                              </Link>
                            </td>
                            <td>
                              {r.client.name}
                              <small>{r.client.phone}</small>
                            </td>
                            <td>
                              <Badge status={r.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Заявок пока нет"
                    description="Новые обращения с сайта появятся здесь автоматически."
                    action={
                      <Link to="/" target="_blank" className="text-link">
                        Открыть сайт <ArrowUpRight size={16} />
                      </Link>
                    }
                  />
                )}
              </section>
              <div className="dashboard-side">
                {user?.role !== 'MECHANIC' && (
                  <div className="revenue-card">
                    <span>
                      Выручка за месяц <ArrowUpRight size={18} />
                    </span>
                    <strong>{rub(data.revenue)}</strong>
                    <small>По фактически поступившим оплатам</small>
                  </div>
                )}
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Ближайшие задачи</h2>
                    <Clock size={17} />
                  </div>
                  {data.tasks.length ? (
                    data.tasks.map((t) => (
                      <Link
                        className="task-preview"
                        key={t.id}
                        to={`/crm/requests/${t.request?.id}`}
                      >
                        <strong>{t.title}</strong>
                        <small>
                          {t.assignee.name} · {dateLabel(t.dueAt, true)}
                        </small>
                      </Link>
                    ))
                  ) : (
                    <p className="panel-empty-text">Нет незавершённых задач</p>
                  )}
                </section>
              </div>
            </div>
          </>
        )
      )}
    </>
  );
}
