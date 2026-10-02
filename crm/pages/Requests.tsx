import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  Plus,
  Search,
  LayoutList,
  Columns3,
  GripVertical,
  CalendarDays,
  ArrowUpRight,
} from 'lucide-react';
import { useResource, useDebounce } from '../../frontend/src/hooks/useResource';
import { useToast, useAuth } from '../../frontend/src/components/Providers';
import { send } from '../../frontend/src/services/api';
import {
  PageHeader,
  Button,
  Modal,
  Select,
  Field,
  Loading,
  ErrorState,
  Empty,
  Badge,
  Pagination,
} from '../../frontend/src/components/UI';
import type { PageData, RequestRecord, Service, User } from '../../frontend/src/services/types';
import { statuses, statusLabels, sourceLabels } from '../../shared/constants';
import { carName, dateLabel } from '../../frontend/src/utils/format';
import BookingForm from '../../public-site/BookingForm';
function KanbanCard({ record }: { record: RequestRecord }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: record.id,
  });
  return (
    <article
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      ref={setNodeRef}
      style={
        transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined
      }
    >
      <div className="card-top">
        <span>#{record.id}</span>
        <button
          {...listeners}
          {...attributes}
          className="drag-handle"
          aria-label={`Переместить заявку ${record.id}; статус также можно изменить внутри заявки`}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <Link to={`/crm/requests/${record.id}`} className="kanban-main">
        <h3>{carName(record.car)}</h3>
        <p>{record.service.name}</p>
        <div className="kanban-client">
          <span className="avatar small">{record.client.name[0]}</span>
          <span>
            {record.client.name}
            <small>{record.client.phone}</small>
          </span>
        </div>
      </Link>
      <div className="kanban-footer">
        <span>
          <CalendarDays size={13} />
          {dateLabel(record.preferredDate).replace('2026 г.', '')}
        </span>
        <span>{sourceLabels[record.source]}</span>
      </div>
      {record.mechanic && <div className="kanban-mechanic">Мастер: {record.mechanic.name}</div>}
    </article>
  );
}
function Column({ status, items }: { status: (typeof statuses)[number]; items: RequestRecord[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className={`kanban-column ${isOver ? 'over' : ''}`} ref={setNodeRef}>
      <h2>
        <i className={`column-dot status-${status.toLowerCase()}`} />
        {statusLabels[status]}
        <span>{items.length}</span>
      </h2>
      <div className="column-cards">
        {items.map((r) => (
          <KanbanCard key={r.id} record={r} />
        ))}
        {!items.length && <p className="kanban-empty">Нет заявок</p>}
      </div>
    </section>
  );
}
export default function Requests() {
  const [params, setParams] = useSearchParams(),
    [q, setQ] = useState(params.get('q') || ''),
    [view, setView] = useState<'board' | 'list'>('board'),
    [newOpen, setNewOpen] = useState(params.has('new'));
  const { user } = useAuth();
  const toast = useToast(),
    searchQ = useDebounce(q);
  const [filters, setFilters] = useState<Record<string, string>>({
      status: '',
      source: '',
      managerId: '',
      mechanicId: '',
      serviceId: '',
      date: '',
    }),
    [page, setPage] = useState(1);
  const users = useResource<User[]>('/users'),
    services = useResource<Service[]>('/services');
  const query = new URLSearchParams({
    q: searchQ,
    page: String(page),
    limit: view === 'board' ? '100' : '20',
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  });
  const resource = useResource<PageData<RequestRecord>>(`/requests?${query}`, 5000);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  useEffect(() => setPage(1), [searchQ, filters, view]);
  async function move(event: DragEndEvent) {
    if (!event.over || !statuses.includes(event.over.id as (typeof statuses)[number])) return;
    const record = resource.data?.items.find((r) => r.id === event.active.id);
    if (record?.status === event.over.id) return;
    try {
      await send(`/requests/${event.active.id}`, { status: event.over.id }, 'PATCH');
      await resource.refresh();
      toast('Статус заявки сохранён');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  function closeNew() {
    setNewOpen(false);
    params.delete('new');
    setParams(params, { replace: true });
  }
  return (
    <>
      <PageHeader
        title="Заявки"
        description="От первого обращения до выдачи автомобиля"
        action={
          user?.role !== 'MECHANIC' && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus size={18} /> Новая заявка
            </Button>
          )
        }
      />
      <div className="filters-panel">
        <div className="filters-top">
          <label className="search-input">
            <Search size={17} />
            <input
              aria-label="Поиск заявок"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Клиент, автомобиль, телефон или номер"
            />
          </label>
          <div className="segmented">
            <button
              onClick={() => setView('board')}
              className={view === 'board' ? 'active' : ''}
              aria-pressed={view === 'board'}
            >
              <Columns3 size={16} /> Доска
            </button>
            <button
              onClick={() => setView('list')}
              className={view === 'list' ? 'active' : ''}
              aria-pressed={view === 'list'}
            >
              <LayoutList size={16} /> Список
            </button>
          </div>
        </div>
        <div className="filters-grid">
          <Select
            label="Статус"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Все статусы</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </Select>
          <Select
            label="Источник"
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          >
            <option value="">Все источники</option>
            {Object.entries(sourceLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Менеджер"
            value={filters.managerId}
            onChange={(e) => setFilters({ ...filters, managerId: e.target.value })}
          >
            <option value="">Все менеджеры</option>
            {users.data
              ?.filter((u) => u.role !== 'MECHANIC')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
          <Select
            label="Мастер"
            value={filters.mechanicId}
            onChange={(e) => setFilters({ ...filters, mechanicId: e.target.value })}
          >
            <option value="">Все мастера</option>
            {users.data
              ?.filter((u) => u.role === 'MECHANIC')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
          <Select
            label="Услуга"
            value={filters.serviceId}
            onChange={(e) => setFilters({ ...filters, serviceId: e.target.value })}
          >
            <option value="">Все услуги</option>
            {services.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Field
            label="Желаемая дата"
            type="date"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
        </div>
      </div>
      {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}{' '}
      {resource.loading ? (
        <Loading />
      ) : view === 'board' ? (
        <DndContext sensors={sensors} onDragEnd={(event) => void move(event)}>
          <div className="kanban-board">
            {statuses.map((status) => (
              <Column
                key={status}
                status={status}
                items={resource.data?.items.filter((r) => r.status === status) || []}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Автомобиль / услуга</th>
                  <th>Клиент</th>
                  <th>Дата</th>
                  <th>Источник</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {resource.data?.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/crm/requests/${r.id}`}>#{r.id}</Link>
                    </td>
                    <td>
                      <Link to={`/crm/requests/${r.id}`}>
                        <strong>{carName(r.car)}</strong>
                        <small>{r.service.name}</small>
                      </Link>
                    </td>
                    <td>
                      {r.client.name}
                      <small>{r.client.phone}</small>
                    </td>
                    <td>{dateLabel(r.preferredDate)}</td>
                    <td>{sourceLabels[r.source]}</td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!resource.data?.items.length && (
            <Empty
              title="Заявок не найдено"
              description="Измените фильтры или создайте новое обращение."
            />
          )}
        </div>
      )}
      {resource.data && (
        <Pagination
          page={page}
          total={resource.data.total}
          limit={resource.data.limit}
          onChange={setPage}
        />
      )}
      <p className="hint">
        Перетащите карточку за значок ⋮⋮ или измените статус в карточке заявки.
      </p>
      {newOpen && (
        <Modal title="Новая заявка" onClose={closeNew}>
          <BookingForm
            internal
            services={services.data || []}
            onSuccess={() => {
              closeNew();
              void resource.refresh();
              toast('Заявка создана');
            }}
          />
        </Modal>
      )}
    </>
  );
}
