import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit3, Search } from 'lucide-react';
import { useResource, useDebounce } from '../../frontend/src/hooks/useResource';
import { useAuth, useToast } from '../../frontend/src/components/Providers';
import { send } from '../../frontend/src/services/api';
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
  Pagination,
} from '../../frontend/src/components/UI';
import type { Client, Car, User, Service, PageData } from '../../frontend/src/services/types';
import { roleLabels } from '../../shared/constants';
import { rub, carName, dateLabel, paidAmount, formObject } from '../../frontend/src/utils/format';
type Kind = 'clients' | 'cars' | 'users' | 'services';
type Entity = Client | Car | User | Service;
const config = {
  clients: {
    title: 'Клиенты',
    desc: 'Контакты и история обслуживания',
    single: 'клиента',
  },
  cars: {
    title: 'Автомобили',
    desc: 'Автомобили, владельцы и история ремонта',
    single: 'автомобиль',
  },
  users: {
    title: 'Сотрудники',
    desc: 'Команда, роли и текущая загрузка',
    single: 'сотрудника',
  },
  services: {
    title: 'Услуги',
    desc: 'Каталог работ и базовые цены',
    single: 'услугу',
  },
};
export default function Directory({ kind }: { kind: Kind }) {
  const { user } = useAuth(),
    toast = useToast();
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Entity | null | undefined>(undefined),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const debounced = useDebounce(q),
    paged = kind === 'cars' || kind === 'clients';
  const resource = useResource<PageData<Entity> | Entity[]>(
    `/${kind}${paged ? `?q=${encodeURIComponent(debounced)}&page=${page}` : ''}`,
  );
  const clients = useResource<PageData<Client>>(
    '/clients?limit=100',
    0,
    kind === 'cars' && user?.role !== 'MECHANIC',
  );
  let entries = resource.data
    ? Array.isArray(resource.data)
      ? resource.data
      : resource.data.items
    : [];
  if (!paged && q)
    entries = entries.filter((e) =>
      (('name' in e ? e.name : '') + ' ' + ('email' in e ? e.email : ''))
        .toLowerCase()
        .includes(q.toLowerCase()),
    );
  const canEdit =
    kind === 'users' || kind === 'services' ? user?.role === 'ADMIN' : user?.role !== 'MECHANIC';
  const cfg = config[kind];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data: Record<string, unknown> = formObject(event.currentTarget);
    if (kind === 'services') {
      data.price = Number(data.price);
      data.duration = Number(data.duration);
      data.active = data.active === 'true';
    }
    if (kind === 'users') {
      data.active = data.active === 'true';
      if (!data.password) delete data.password;
    }
    if (kind === 'cars') {
      for (const key of ['year', 'mileage']) data[key] = data[key] ? Number(data[key]) : null;
      if (!data.vin) data.vin = null;
    }
    setBusy(true);
    setError('');
    try {
      await send(`/${kind}${editing ? '/' + editing.id : ''}`, data, editing ? 'PATCH' : 'POST');
      setEditing(undefined);
      await resource.refresh();
      toast('Запись сохранена');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(entity: Entity | null) {
    setEditing(entity);
    setError('');
  }
  return (
    <>
      <PageHeader
        title={cfg.title}
        description={cfg.desc}
        action={
          canEdit && (
            <Button onClick={() => open(null)}>
              <Plus size={18} /> Добавить {cfg.single}
            </Button>
          )
        }
      />
      <div className="panel">
        <div className="directory-toolbar">
          <label className="search-input">
            <Search size={17} />
            <input
              aria-label={`Поиск: ${cfg.title}`}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Поиск по разделу"
            />
          </label>
          <span className="muted">
            {resource.data
              ? Array.isArray(resource.data)
                ? entries.length
                : resource.data.total
              : 0}{' '}
            записей
          </span>
        </div>
        {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}{' '}
        {resource.loading ? (
          <Loading />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {(kind === 'clients'
                      ? [
                          'Клиент',
                          'Телефон',
                          'Автомобили',
                          'Обращения',
                          'Последний визит',
                          'Всего оплачено',
                        ]
                      : kind === 'cars'
                        ? ['Автомобиль', 'Госномер / VIN', 'Пробег', 'Владелец', 'Обращения']
                        : kind === 'users'
                          ? ['Сотрудник', 'Email', 'Роль', 'Текущая загрузка', 'Доступ']
                          : ['Услуга', 'Описание', 'Стоимость от', 'Длительность', 'Доступность']
                    ).map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                    {canEdit && <th aria-label="Действия" />}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entity) => (
                    <tr key={entity.id}>
                      {kind === 'clients' &&
                        (() => {
                          const c = entity as Client;
                          return (
                            <>
                              <td>
                                <Link to={`/crm/clients/${c.id}`}>
                                  <strong>{c.name}</strong>
                                  <small>{c.email || 'Email не указан'}</small>
                                </Link>
                              </td>
                              <td>
                                <a href={`tel:${c.phone}`}>{c.phone}</a>
                              </td>
                              <td>{c.cars?.map(carName).join(', ') || '—'}</td>
                              <td>{c.requests?.length || 0}</td>
                              <td>
                                {dateLabel(
                                  c.requests?.find((r) => r.status === 'COMPLETED')?.appointment
                                    ?.startsAt ||
                                    c.requests?.find((r) => r.status === 'COMPLETED')?.createdAt,
                                )}
                              </td>
                              <td>
                                {rub(c.workOrders?.reduce((sum, o) => sum + paidAmount(o), 0) || 0)}
                              </td>
                            </>
                          );
                        })()}
                      {kind === 'cars' &&
                        (() => {
                          const c = entity as Car;
                          return (
                            <>
                              <td>
                                <Link to={`/crm/cars/${c.id}`}>
                                  <strong>{carName(c)}</strong>
                                  <small>{c.year || 'Год не указан'}</small>
                                </Link>
                              </td>
                              <td>
                                {c.licensePlate || '—'}
                                <small className="vin">{c.vin || 'VIN не указан'}</small>
                              </td>
                              <td>{c.mileage?.toLocaleString('ru-RU') || '—'} км</td>
                              <td>{c.client?.name}</td>
                              <td>{c._count?.requests || 0}</td>
                            </>
                          );
                        })()}
                      {kind === 'users' &&
                        (() => {
                          const u = entity as User;
                          return (
                            <>
                              <td>
                                <div className="person-cell">
                                  <span className="avatar small">{u.name[0]}</span>
                                  <strong>{u.name}</strong>
                                </div>
                              </td>
                              <td>{u.email}</td>
                              <td>{roleLabels[u.role]}</td>
                              <td>
                                {u.role === 'MECHANIC'
                                  ? `${u._count?.mechanicRequests || 0} автомобилей`
                                  : '—'}
                              </td>
                              <td>
                                <span
                                  className={`badge ${u.active ? 'status-completed' : 'status-cancelled'}`}
                                >
                                  {u.active ? 'Активен' : 'Отключён'}
                                </span>
                              </td>
                            </>
                          );
                        })()}
                      {kind === 'services' &&
                        (() => {
                          const s = entity as Service;
                          return (
                            <>
                              <td>
                                <strong>{s.name}</strong>
                              </td>
                              <td className="description-cell">{s.description}</td>
                              <td>{rub(s.price)}</td>
                              <td>{s.duration} мин</td>
                              <td>
                                <span
                                  className={`badge ${s.active ? 'status-completed' : 'status-cancelled'}`}
                                >
                                  {s.active ? 'Доступна' : 'Скрыта'}
                                </span>
                              </td>
                            </>
                          );
                        })()}
                      {canEdit && (
                        <td>
                          <button
                            className="icon-btn"
                            onClick={() => open(entity)}
                            aria-label={`Редактировать ${'name' in entity ? entity.name : carName(entity as Car)}`}
                          >
                            <Edit3 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!entries.length && (
              <Empty
                title={`${cfg.title}: записей пока нет`}
                description="Данные будут сохраняться по мере работы с обращениями."
              />
            )}
          </>
        )}
        {paged && resource.data && !Array.isArray(resource.data) && (
          <Pagination
            page={page}
            total={resource.data.total}
            limit={resource.data.limit}
            onChange={setPage}
          />
        )}
      </div>
      {editing !== undefined && (
        <Modal
          title={`${editing ? 'Редактировать' : 'Добавить'} ${cfg.single}`}
          onClose={() => setEditing(undefined)}
        >
          <form className="stack-form" onSubmit={save}>
            {error && <ErrorState message={error} />}{' '}
            {kind === 'clients' &&
              (() => {
                const e = editing as Client | null;
                return (
                  <>
                    <Field
                      label="Имя"
                      name="name"
                      defaultValue={e?.name}
                      maxLength={100}
                      required
                    />
                    <Field
                      label="Телефон"
                      name="phone"
                      type="tel"
                      defaultValue={e?.phone}
                      required
                    />
                    <Field label="Email" name="email" type="email" defaultValue={e?.email || ''} />
                  </>
                );
              })()}
            {kind === 'cars' &&
              (() => {
                const e = editing as Car | null;
                return (
                  <>
                    <Select
                      label="Владелец"
                      name="clientId"
                      defaultValue={e?.clientId || ''}
                      required
                    >
                      <option value="">Выберите клиента</option>
                      {clients.data?.items.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name} · {c.phone}
                        </option>
                      ))}
                    </Select>
                    <div className="form-grid">
                      <Field label="Марка" name="brand" defaultValue={e?.brand} required />
                      <Field label="Модель" name="model" defaultValue={e?.model} required />
                      <Field
                        label="Год"
                        name="year"
                        type="number"
                        min={1900}
                        max={new Date().getFullYear() + 1}
                        defaultValue={e?.year || ''}
                      />
                      <Field
                        label="Пробег, км"
                        name="mileage"
                        type="number"
                        min={0}
                        defaultValue={e?.mileage ?? ''}
                      />
                    </div>
                    <Field
                      label="Госномер"
                      name="licensePlate"
                      defaultValue={e?.licensePlate || ''}
                    />
                    <Field
                      label="VIN · 17 символов"
                      name="vin"
                      defaultValue={e?.vin || ''}
                      minLength={17}
                      maxLength={17}
                    />
                  </>
                );
              })()}
            {kind === 'users' &&
              (() => {
                const e = editing as User | null;
                return (
                  <>
                    <Field label="Имя" name="name" defaultValue={e?.name} required />
                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      defaultValue={e?.email}
                      required
                    />
                    <Field
                      label={
                        editing
                          ? 'Новый пароль · оставьте пустым, чтобы сохранить'
                          : 'Пароль · минимум 12 символов'
                      }
                      name="password"
                      type="password"
                      maxLength={72}
                      minLength={12}
                      autoComplete="new-password"
                      required={!editing}
                    />
                    <Select label="Роль" name="role" defaultValue={e?.role || 'MANAGER'}>
                      {Object.entries(roleLabels).map(([v, label]) => (
                        <option value={v} key={v}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Доступ"
                      name="active"
                      defaultValue={e?.active === false ? 'false' : 'true'}
                    >
                      <option value="true">Активен</option>
                      <option value="false">Отключён</option>
                    </Select>
                  </>
                );
              })()}
            {kind === 'services' &&
              (() => {
                const e = editing as Service | null;
                return (
                  <>
                    <Field label="Название" name="name" defaultValue={e?.name} required />
                    <Textarea
                      label="Описание"
                      name="description"
                      defaultValue={e?.description}
                      required
                    />
                    <div className="form-grid">
                      <Field
                        label="Стоимость от, ₽"
                        name="price"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={e?.price}
                        required
                      />
                      <Field
                        label="Длительность, мин"
                        name="duration"
                        type="number"
                        min={15}
                        max={1440}
                        defaultValue={e?.duration || 60}
                        required
                      />
                    </div>
                    <Select
                      label="Доступность"
                      name="active"
                      defaultValue={e?.active === false ? 'false' : 'true'}
                    >
                      <option value="true">Доступна на сайте</option>
                      <option value="false">Скрыта</option>
                    </Select>
                  </>
                );
              })()}
            <Button type="submit" busy={busy}>
              Сохранить
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
