import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  useDroppable,
  useDraggable,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  DragOverlay,
  pointerWithin,
  rectIntersection,
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
import { statuses, statusLabels, sourceLabels, type RequestStatus } from '../../shared/constants';
import { carName, dateLabel } from '../../frontend/src/utils/format';
import BookingForm from '../../public-site/BookingForm';
import { formatPhone } from '../../shared/phone';
function CardContent({ record }: { record: RequestRecord }) {
  return (
    <>
      <h3>{carName(record.car)}</h3>
      <p>{record.service.name}</p>
      <div className="kanban-client">
        <span className="avatar small">{record.client.name[0]}</span>
        <span>
          {record.client.name}
          <small>{formatPhone(record.client.phone)}</small>
        </span>
      </div>
    </>
  );
}
type CardProps = {
  record: RequestRecord;
  disabled: boolean;
  mechanic: boolean;
  onMove: (id: number, status: RequestStatus) => Promise<void>;
};
function KanbanCard({ record, disabled, mechanic, onMove }: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: record.id,
    disabled,
  });
  return (
    <article
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      ref={setNodeRef}
      onMouseDown={(event) => listeners?.onMouseDown?.(event)}
    >
      <div className="card-top">
        <span>#{record.id}</span>
        <button
          {...attributes}
          ref={setActivatorNodeRef}
          onTouchStart={(event) => listeners?.onTouchStart?.(event)}
          onKeyDown={(event) => listeners?.onKeyDown?.(event)}
          type="button"
          disabled={disabled}
          className="drag-handle"
          aria-label={`Переместить заявку ${record.id}`}
          title="Перетащите карточку в другой статус"
        >
          <GripVertical size={16} />
        </button>
      </div>
      <Link to={`/crm/requests/${record.id}`} className="kanban-main">
        <CardContent record={record} />
      </Link>
      <div className="kanban-footer">
        <span>
          <CalendarDays size={13} />
          {dateLabel(record.preferredDate).replace('2026 г.', '')}
        </span>
        <span>{sourceLabels[record.source]}</span>
      </div>
      {record.mechanic && <div className="kanban-mechanic">Мастер: {record.mechanic.name}</div>}
      <select
        className="kanban-status"
        aria-label={`Статус заявки ${record.id}`}
        value={record.status}
        disabled={disabled}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => void onMove(record.id, event.target.value as RequestStatus)}
      >
        {statuses
          .filter((status) => !mechanic || ['IN_PROGRESS', 'READY', record.status].includes(status))
          .map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
      </select>
    </article>
  );
}
function Column({
  status,
  items,
  disabled,
  mechanic,
  onMove,
}: {
  status: RequestStatus;
  items: RequestRecord[];
} & Omit<CardProps, 'record'>) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: disabled || (mechanic && !['IN_PROGRESS', 'READY'].includes(status)),
  });
  return (
    <section
      className={`kanban-column ${isOver ? 'over' : ''}`}
      ref={setNodeRef}
      aria-label={statusLabels[status]}
      data-status={status}
    >
      <h2>
        <i className={`column-dot status-${status.toLowerCase()}`} />
        {statusLabels[status]}
        <span>{items.length}</span>
      </h2>
      <div className="column-cards">
        {items.map((r) => (
          <KanbanCard
            key={r.id}
            record={r}
            disabled={disabled}
            mechanic={mechanic}
            onMove={onMove}
          />
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
    [activeId, setActiveId] = useState<number | null>(null),
    [movingId, setMovingId] = useState<number | null>(null),
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
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const activeRecord = resource.data?.items.find((record) => record.id === activeId);
  useEffect(() => setPage(1), [searchQ, filters, view]);
  async function move(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || !statuses.includes(event.over.id as (typeof statuses)[number])) return;
    await moveTo(Number(event.active.id), event.over.id as RequestStatus);
  }
  async function moveTo(id: number, status: RequestStatus) {
    const record = resource.data?.items.find((r) => r.id === id);
    if (!record || record.status === status || movingId !== null) return;
    setMovingId(id);
    try {
      await send(`/requests/${id}`, { status }, 'PATCH');
      resource.setData(
        (data) =>
          data && {
            ...data,
            items: data.items.map((item) => (item.id === id ? { ...item, status } : item)),
          },
      );
      await resource.refresh();
      toast('Статус заявки сохранён');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setMovingId(null);
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
        <DndContext
          sensors={sensors}
          collisionDetection={(args) =>
            args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)
          }
          onDragStart={(event) => setActiveId(Number(event.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={(event) => void move(event)}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                'Нажмите пробел, чтобы взять заявку, стрелки — чтобы переместить, пробел — чтобы отпустить, Escape — чтобы отменить. Также можно выбрать статус прямо на карточке.',
            },
          }}
        >
          <p className="kanban-hint">
            Перетащите карточку в нужную колонку или выберите статус на карточке.
          </p>
          <div className="kanban-board">
            {statuses.map((status) => (
              <Column
                key={status}
                status={status}
                items={resource.data?.items.filter((r) => r.status === status) || []}
                disabled={movingId !== null}
                mechanic={user?.role === 'MECHANIC'}
                onMove={moveTo}
              />
            ))}
          </div>
          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeRecord && (
                <article className="kanban-card kanban-overlay" aria-hidden="true">
                  <div className="card-top">#{activeRecord.id}</div>
                  <div className="kanban-main">
                    <CardContent record={activeRecord} />
                  </div>
                </article>
              )}
            </DragOverlay>,
            document.body,
          )}
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
                      <small>{formatPhone(r.client.phone)}</small>
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
