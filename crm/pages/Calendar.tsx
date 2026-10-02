import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useResource } from '../../frontend/src/hooks/useResource';
import { useAuth, useToast } from '../../frontend/src/components/Providers';
import {
  PageHeader,
  Button,
  Modal,
  Loading,
  ErrorState,
  Empty,
  Badge,
  Select,
} from '../../frontend/src/components/UI';
import type { Appointment, User } from '../../frontend/src/services/types';
import { carName, timeLabel, localDate } from '../../frontend/src/utils/format';
import { ScheduleForm } from '../components/ScheduleForm';
export default function Calendar() {
  const { user } = useAuth(),
    toast = useToast();
  const [current, setCurrent] = useState(new Date(`${localDate()}T12:00:00`)),
    [mode, setMode] = useState<'day' | 'week' | 'month'>('week'),
    [master, setMaster] = useState(''),
    [open, setOpen] = useState(false);
  const users = useResource<User[]>('/users');
  const first =
    mode === 'day'
      ? current
      : mode === 'week'
        ? startOfWeek(current, { weekStartsOn: 1 })
        : startOfWeek(startOfMonth(current), { weekStartsOn: 1 });
  const last =
    mode === 'day'
      ? addDays(first, 1)
      : mode === 'week'
        ? addDays(first, 7)
        : addDays(startOfWeek(endOfMonth(current), { weekStartsOn: 1 }), 7);
  const from = `${format(first, 'yyyy-MM-dd')}T00:00:00%2B03:00`,
    to = `${format(last, 'yyyy-MM-dd')}T00:00:00%2B03:00`;
  const resource = useResource<Appointment[]>(`/appointments?from=${from}&to=${to}`, 5000);
  const days = eachDayOfInterval({ start: first, end: addDays(last, -1) });
  function navigate(direction: number) {
    setCurrent(
      mode === 'month'
        ? addMonths(current, direction)
        : addDays(current, direction * (mode === 'week' ? 7 : 1)),
    );
  }
  return (
    <>
      <PageHeader
        title="Календарь"
        description="Записи, загрузка мастеров и время обслуживания"
        action={
          user?.role !== 'MECHANIC' && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={18} /> Новая запись
            </Button>
          )
        }
      />
      <div className="calendar-toolbar">
        <div className="actions">
          <button className="icon-btn" aria-label="Предыдущий период" onClick={() => navigate(-1)}>
            <ChevronLeft size={19} />
          </button>
          <h2>
            {format(current, mode === 'day' ? 'd MMMM yyyy' : 'LLLL yyyy', {
              locale: ru,
            })}
          </h2>
          <button className="icon-btn" aria-label="Следующий период" onClick={() => navigate(1)}>
            <ChevronRight size={19} />
          </button>
          <Button
            variant="secondary"
            onClick={() => setCurrent(new Date(`${localDate()}T12:00:00`))}
          >
            Сегодня
          </Button>
        </div>
        <div className="actions">
          <Select label="Мастер" value={master} onChange={(e) => setMaster(e.target.value)}>
            <option value="">Все мастера</option>
            {users.data
              ?.filter((u) => u.role === 'MECHANIC')
              .map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
          <div className="segmented">
            {(
              [
                ['day', 'День'],
                ['week', 'Неделя'],
                ['month', 'Месяц'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className={mode === v ? 'active' : ''}
                aria-pressed={mode === v}
                onClick={() => setMode(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}{' '}
      {resource.loading ? (
        <Loading />
      ) : (
        <div className={`calendar-grid calendar-${mode}`}>
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd'),
              appointments =
                resource.data?.filter(
                  (a) =>
                    localDate(new Date(a.startsAt)) === key && (!master || a.mechanicId === master),
                ) || [];
            return (
              <section
                key={key}
                className={`calendar-day ${key === localDate() ? 'is-today' : ''} ${day.getMonth() !== current.getMonth() ? 'other-month' : ''}`}
              >
                <div className="calendar-day-header">
                  <span>{format(day, 'EEE', { locale: ru })}</span>
                  <strong>{format(day, 'd')}</strong>
                  {user?.role !== 'MECHANIC' && (
                    <button
                      className="icon-btn"
                      aria-label={`Назначить запись на ${key}`}
                      onClick={() => {
                        setCurrent(day);
                        setOpen(true);
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
                {appointments.map((a) => (
                  <Link
                    key={a.id}
                    className={`calendar-event status-${a.request.status.toLowerCase()}`}
                    to={`/crm/requests/${a.requestId}`}
                  >
                    <time>
                      {timeLabel(a.startsAt)}–{timeLabel(a.endsAt)}
                    </time>
                    <strong>{carName(a.request.car)}</strong>
                    <span>{a.request.service.name}</span>
                    <small>{a.request.client.name}</small>
                    <small>Мастер: {a.mechanic.name}</small>
                    <Badge status={a.request.status} />
                  </Link>
                ))}
                {!appointments.length && <span className="calendar-no-events">Нет записей</span>}
              </section>
            );
          })}
        </div>
      )}
      <p className="hint">
        Время указано по Москве (UTC+3). Мастера не могут быть назначены на пересекающиеся работы.
      </p>
      {open && (
        <Modal title="Новая запись" onClose={() => setOpen(false)}>
          <ScheduleForm
            date={format(current, 'yyyy-MM-dd')}
            onDone={() => {
              setOpen(false);
              void resource.refresh();
              toast('Запись подтверждена');
            }}
          />
        </Modal>
      )}
    </>
  );
}
