import { useState, type FormEvent } from 'react';
import { Field, Select, Button, ErrorState } from '../../frontend/src/components/UI';
import { useResource } from '../../frontend/src/hooks/useResource';
import { send } from '../../frontend/src/services/api';
import type { User, RequestRecord, PageData } from '../../frontend/src/services/types';
import { carName, formObject, localDate } from '../../frontend/src/utils/format';
export function ScheduleForm({
  record,
  onDone,
  date,
}: {
  record?: RequestRecord;
  onDone: () => void;
  date?: string;
}) {
  const users = useResource<User[]>('/users'),
    requests = useResource<PageData<RequestRecord>>('/requests?limit=100');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const start = record?.appointment?.startsAt
    ? new Date(Date.parse(record.appointment.startsAt) + 3 * 3600000).toISOString().slice(0, 16)
    : `${date || record?.preferredDate?.slice(0, 10) || localDate()}T10:00`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = formObject(event.currentTarget),
      startsAt = new Date(`${data.startsAt}:00+03:00`),
      endsAt = new Date(startsAt.getTime() + Number(data.duration) * 60000);
    setBusy(true);
    setError('');
    try {
      await send(
        record?.appointment ? `/appointments/${record.appointment.id}` : '/appointments',
        {
          requestId: record?.id || Number(data.requestId),
          mechanicId: data.mechanicId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
        record?.appointment ? 'PATCH' : 'POST',
      );
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack-form">
      {error && <ErrorState message={error} />}{' '}
      {!record && (
        <Select label="Заявка" name="requestId" required>
          <option value="">Выберите заявку</option>
          {requests.data?.items
            .filter((r) => !['COMPLETED', 'CANCELLED'].includes(r.status))
            .map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} · {carName(r.car)} · {r.client.name}
              </option>
            ))}
        </Select>
      )}
      <Select label="Мастер" name="mechanicId" defaultValue={record?.mechanicId || ''} required>
        <option value="">Выберите мастера</option>
        {users.data
          ?.filter((u) => u.role === 'MECHANIC' && u.active !== false)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
      </Select>
      <Field
        label="Начало · московское время"
        name="startsAt"
        type="datetime-local"
        defaultValue={start}
        required
      />
      <Field
        label="Продолжительность, мин"
        name="duration"
        type="number"
        min={15}
        max={1440}
        step={15}
        defaultValue={
          record?.appointment
            ? Math.round(
                (Date.parse(record.appointment.endsAt) - Date.parse(record.appointment.startsAt)) /
                  60000,
              )
            : record?.service.duration || 60
        }
        required
      />
      <p className="hint">Пересечения по времени проверяются автоматически.</p>
      <Button busy={busy} type="submit">
        Подтвердить запись
      </Button>
    </form>
  );
}
