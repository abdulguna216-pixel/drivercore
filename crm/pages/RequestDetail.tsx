import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Edit3, Phone, Plus, File, Send, Trash2 } from 'lucide-react';
import { useResource } from '../../frontend/src/hooks/useResource';
import { useAuth, useToast } from '../../frontend/src/components/Providers';
import { send, api } from '../../frontend/src/services/api';
import {
  PageHeader,
  Button,
  Field,
  Select,
  Textarea,
  Modal,
  Loading,
  ErrorState,
  Empty,
  Badge,
} from '../../frontend/src/components/UI';
import type { RequestRecord, User } from '../../frontend/src/services/types';
import { statuses, statusLabels, sourceLabels } from '../../shared/constants';
import { carName, dateLabel, formObject, rub } from '../../frontend/src/utils/format';
import { ScheduleForm } from '../components/ScheduleForm';
import OrderPanel from '../components/OrderPanel';
const tabs = [
  'Информация',
  'Клиент',
  'Автомобиль',
  'Задачи',
  'Комментарии',
  'Файлы',
  'История',
  'Финансы',
];
export default function RequestDetail() {
  const { id } = useParams(),
    { user } = useAuth(),
    toast = useToast();
  const resource = useResource<RequestRecord>(`/requests/${id}`),
    users = useResource<User[]>('/users');
  const [tab, setTab] = useState('Информация'),
    [modal, setModal] = useState<'schedule' | 'edit' | 'task' | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const r = resource.data;
  const staff = user?.role !== 'MECHANIC';
  async function action(path: string, data: unknown, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      await send(path, data, method);
      await resource.refresh();
      toast('Изменения сохранены');
      setModal(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = formObject(event.currentTarget);
    await action(
      `/requests/${id}`,
      {
        comment: data.comment,
        preferredDate: data.preferredDate || null,
        managerId: data.managerId || null,
      },
      'PATCH',
    );
  }
  async function task(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = formObject(event.currentTarget);
    await action(`/requests/${id}/tasks`, {
      title: data.title,
      assigneeId: data.assigneeId,
      dueAt: new Date(`${data.dueAt}:00+03:00`).toISOString(),
    });
  }
  async function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await action(`/requests/${id}/comments`, { text: formObject(form).text })) form.reset();
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await api(`/requests/${id}/files`, { method: 'POST', body: data });
      form.reset();
      await resource.refresh();
      toast('Файлы загружены');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading) return <Loading />;
  if (!r)
    return <ErrorState message={resource.error || 'Заявка не найдена'} retry={resource.refresh} />;
  return (
    <>
      <Link to="/crm/requests" className="back-link">
        <ArrowLeft size={15} /> К заявкам
      </Link>
      <PageHeader
        title={`Заявка #${r.id}`}
        description={`${carName(r.car)} · ${r.service.name}`}
        action={
          <div className="actions">
            <select
              className="status-select"
              aria-label="Статус заявки"
              value={r.status}
              disabled={busy}
              onChange={(e) => void action(`/requests/${id}`, { status: e.target.value }, 'PATCH')}
            >
              {statuses
                .filter((s) => staff || ['IN_PROGRESS', 'READY', r.status].includes(s))
                .map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
            </select>
            {staff && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError('');
                  setModal('edit');
                }}
              >
                <Edit3 size={16} /> Редактировать
              </Button>
            )}
          </div>
        }
      />
      {error && <ErrorState message={error} />}
      <div className="request-summary">
        <div>
          <span className="avatar">{r.client.name[0]}</span>
          <div>
            <strong>{r.client.name}</strong>
            <a href={`tel:${r.client.phone}`}>{r.client.phone}</a>
          </div>
        </div>
        <div>
          <small>Источник</small>
          <strong>{sourceLabels[r.source]}</strong>
        </div>
        <div>
          <small>Создана</small>
          <strong>{dateLabel(r.createdAt, true)}</strong>
        </div>
        <Badge status={r.status} />
      </div>
      <div
        className="tabs"
        role="tablist"
        aria-label="Разделы заявки"
        onKeyDown={(event) => {
          const index = tabs.indexOf(tab);
          const next =
            event.key === 'ArrowRight'
              ? (index + 1) % tabs.length
              : event.key === 'ArrowLeft'
                ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          setTab(tabs[next]);
          document.getElementById(`request-tab-${next}`)?.focus();
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            id={`request-tab-${tabs.indexOf(t)}`}
            tabIndex={tab === t ? 0 : -1}
            aria-controls="request-tab-panel"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tab === t ? 'active' : ''}
          >
            {t}
            {t === 'Комментарии' && !!r.comments?.length && <span>{r.comments.length}</span>}
          </button>
        ))}
      </div>
      <section
        className="panel detail-panel"
        role="tabpanel"
        id="request-tab-panel"
        aria-labelledby={`request-tab-${tabs.indexOf(tab)}`}
      >
        {tab === 'Информация' && (
          <>
            <h2>Детали обращения</h2>
            <dl className="detail-grid">
              <div>
                <dt>Услуга</dt>
                <dd>{r.service.name}</dd>
              </div>
              <div>
                <dt>Желаемая дата</dt>
                <dd>{dateLabel(r.preferredDate)}</dd>
              </div>
              <div>
                <dt>Ответственный менеджер</dt>
                <dd>{r.manager?.name || 'Не назначен'}</dd>
              </div>
              <div>
                <dt>Назначенный мастер</dt>
                <dd>{r.mechanic?.name || 'Не назначен'}</dd>
              </div>
              <div className="span-2">
                <dt>Описание проблемы</dt>
                <dd className="pre-wrap">{r.comment || 'Клиент не оставил комментарий'}</dd>
              </div>
            </dl>
            <div className="appointment-summary">
              <CalendarDays size={25} />
              <div>
                <strong>
                  {r.appointment
                    ? `${r.status === 'COMPLETED' ? 'Визит завершён · ' : r.appointment.cancelled ? 'Запись отменена · ' : ''}${dateLabel(r.appointment.startsAt, true)}`
                    : 'Время визита ещё не назначено'}
                </strong>
                <p>
                  {r.appointment
                    ? `До ${new Date(r.appointment.endsAt).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })} · ${r.mechanic?.name}`
                    : 'Подтвердите дату и назначьте мастера, чтобы запись появилась в календаре.'}
                </p>
              </div>
              {staff && !['COMPLETED', 'CANCELLED'].includes(r.status) && (
                <Button onClick={() => setModal('schedule')}>
                  {r.appointment ? 'Изменить запись' : 'Назначить запись'}
                </Button>
              )}
            </div>
          </>
        )}
        {tab === 'Клиент' && (
          <>
            <h2>{r.client.name}</h2>
            <dl className="detail-grid">
              <div>
                <dt>Телефон</dt>
                <dd>
                  <a href={`tel:${r.client.phone}`}>{r.client.phone}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{r.client.email || 'Не указан'}</dd>
              </div>
            </dl>
            {staff && (
              <Link className="btn btn-secondary" to={`/crm/clients/${r.client.id}`}>
                История обслуживания клиента
              </Link>
            )}
          </>
        )}
        {tab === 'Автомобиль' && (
          <>
            <h2>{carName(r.car)}</h2>
            <dl className="detail-grid">
              {[
                ['Год', r.car.year],
                ['Госномер', r.car.licensePlate],
                ['VIN', r.car.vin],
                [
                  'Пробег',
                  r.car.mileage === null ? '—' : `${r.car.mileage.toLocaleString('ru-RU')} км`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || 'Не указан'}</dd>
                </div>
              ))}
            </dl>
            <Link className="btn btn-secondary" to={`/crm/cars/${r.car.id}`}>
              Карточка автомобиля
            </Link>
          </>
        )}
        {tab === 'Задачи' && (
          <>
            <div className="panel-heading">
              <h2>Задачи по заявке</h2>
              {staff && (
                <Button onClick={() => setModal('task')}>
                  <Plus size={16} /> Добавить задачу
                </Button>
              )}
            </div>
            {r.tasks?.length ? (
              <div className="task-list">
                {r.tasks.map((t) => (
                  <div key={t.id}>
                    <div>
                      <strong>{t.title}</strong>
                      <small>
                        {t.assignee.name} · до {dateLabel(t.dueAt, true)}
                      </small>
                    </div>
                    <select
                      aria-label={`Статус задачи ${t.title}`}
                      value={t.status}
                      disabled={busy || (!staff && t.assigneeId !== user?.id)}
                      onChange={(e) =>
                        void action(`/tasks/${t.id}`, { status: e.target.value }, 'PATCH')
                      }
                    >
                      <option value="NEW">Новая</option>
                      <option value="IN_PROGRESS">В работе</option>
                      <option value="DONE">Выполнена</option>
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Задач пока нет"
                description="Добавьте звонок клиенту или напоминание о согласовании работ."
              />
            )}
          </>
        )}
        {tab === 'Комментарии' && (
          <>
            <h2>Обсуждение заявки</h2>
            <form onSubmit={comment} className="comment-form">
              <Textarea label="Комментарий" name="text" required />
              <Button busy={busy} type="submit">
                <Send size={16} /> Добавить комментарий
              </Button>
            </form>
            <div className="comments-list">
              {r.comments?.map((c) => (
                <article key={c.id}>
                  <span className="avatar small">{c.user.name[0]}</span>
                  <div>
                    <strong>{c.user.name}</strong>
                    <small>{dateLabel(c.createdAt, true)}</small>
                    <p className="pre-wrap">{c.text}</p>
                  </div>
                </article>
              ))}
            </div>
            {!r.comments?.length && (
              <Empty
                title="Комментариев пока нет"
                description="Сохраните важные детали разговора с клиентом."
              />
            )}
          </>
        )}
        {tab === 'Файлы' && (
          <>
            <h2>Файлы заявки</h2>
            <form onSubmit={upload} className="file-form">
              <Field
                label="Фото, видео или документы"
                name="files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,.docx"
                required
              />
              <Button type="submit" busy={busy}>
                Загрузить
              </Button>
            </form>
            <p className="hint">До 5 файлов по 20 МБ. JPG, PNG, WebP, PDF, MP4, DOCX.</p>
            <div className="file-list">
              {r.files?.map((f) => (
                <a key={f.id} href={`/api/files/${f.id}/download`} target="_blank">
                  <File size={22} />
                  <div>
                    <strong>{f.fileName}</strong>
                    <small>
                      {(f.fileSize / 1024).toFixed(1)} КБ · {dateLabel(f.uploadedAt)}
                    </small>
                  </div>
                </a>
              ))}
            </div>
            {!r.files?.length && (
              <Empty
                title="Файлов пока нет"
                description="Прикрепите фото, результаты диагностики или документы."
              />
            )}
          </>
        )}
        {tab === 'История' && (
          <>
            <h2>История изменений</h2>
            <ol className="activity-list">
              {r.activities?.map((a) => (
                <li key={a.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{a.description}</strong>
                    <small>
                      {dateLabel(a.createdAt, true)} · {a.user?.name || 'Сайт DRIVECORE'}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        {tab === 'Финансы' && (
          <OrderPanel order={r.workOrder} record={r} refresh={resource.refresh} />
        )}
      </section>
      {modal === 'schedule' && (
        <Modal title="Запись в календарь" onClose={() => setModal(null)}>
          <ScheduleForm
            record={r}
            onDone={() => {
              setModal(null);
              void resource.refresh();
              toast('Запись подтверждена');
            }}
          />
        </Modal>
      )}
      {modal === 'edit' && (
        <Modal title={`Редактировать заявку #${r.id}`} onClose={() => setModal(null)}>
          <form onSubmit={edit} className="stack-form">
            {error && <ErrorState message={error} />}
            <Field
              label="Желаемая дата"
              name="preferredDate"
              type="date"
              defaultValue={r.preferredDate?.slice(0, 10) || ''}
            />
            <Select label="Менеджер" name="managerId" defaultValue={r.managerId || ''}>
              <option value="">Не назначен</option>
              {users.data
                ?.filter((u) => u.role !== 'MECHANIC' && u.active !== false)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </Select>
            <Textarea label="Описание проблемы" name="comment" defaultValue={r.comment} />
            <Button type="submit" busy={busy}>
              Сохранить
            </Button>
          </form>
        </Modal>
      )}
      {modal === 'task' && (
        <Modal title="Новая задача" onClose={() => setModal(null)}>
          <form onSubmit={task} className="stack-form">
            {error && <ErrorState message={error} />}
            <Field label="Название" name="title" maxLength={300} required />
            <Select label="Ответственный" name="assigneeId" defaultValue={user?.id} required>
              {users.data
                ?.filter((u) => u.active !== false)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </Select>
            <Field label="Выполнить до · Москва" name="dueAt" type="datetime-local" required />
            <Button busy={busy} type="submit">
              Создать задачу
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
