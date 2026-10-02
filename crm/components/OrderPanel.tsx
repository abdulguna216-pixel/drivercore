import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Printer, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button, Field, Select, ErrorState, Empty, Modal } from '../../frontend/src/components/UI';
import { useAuth, useToast } from '../../frontend/src/components/Providers';
import { send } from '../../frontend/src/services/api';
import type { WorkOrder, OrderItem, RequestRecord } from '../../frontend/src/services/types';
import { rub, paidAmount, formObject, dateLabel, carName } from '../../frontend/src/utils/format';
import { methodLabels } from '../../shared/constants';
export default function OrderPanel({
  order,
  record,
  refresh,
}: {
  order: WorkOrder | null;
  record?: RequestRecord;
  refresh: () => unknown;
}) {
  const { user } = useAuth(),
    toast = useToast();
  const [items, setItems] = useState<OrderItem[]>(order?.items || []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [paymentOpen, setPaymentOpen] = useState(false);
  useEffect(() => setItems(order?.items || []), [order]);
  async function create() {
    setBusy(true);
    setError('');
    try {
      await send('/work-orders', { requestId: record?.id });
      await refresh();
      toast('Заказ-наряд создан');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await send(
        `/work-orders/${order!.id}/items`,
        {
          items: items.map((i) => ({
            kind: i.kind,
            name: i.name,
            quantity: Number(i.quantity),
            price: Number(i.price),
          })),
        },
        'PUT',
      );
      await refresh();
      toast('Состав и стоимость сохранены');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = formObject(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await send('/payments', {
        workOrderId: order!.id,
        amount: Number(data.amount),
        method: data.method,
      });
      setPaymentOpen(false);
      await refresh();
      toast('Оплата сохранена');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!order)
    return (
      <div>
        {error && <ErrorState message={error} />}
        <Empty
          title="Заказ-наряд ещё не создан"
          description="Добавьте работы и запчасти, чтобы рассчитать стоимость ремонта."
          action={
            user?.role !== 'MECHANIC' && (
              <Button busy={busy} onClick={() => void create()}>
                <Plus size={17} /> Создать заказ-наряд
              </Button>
            )
          }
        />
      </div>
    );
  const paid = paidAmount(order),
    remaining = Math.max(0, Number(order.total) - paid),
    locked = !!order.payments.length || order.status === 'COMPLETED',
    preview =
      items.reduce(
        (sum, item) => sum + Math.round(Number(item.price) * Number(item.quantity) * 100),
        0,
      ) / 100;
  function update(index: number, key: keyof OrderItem, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }
  return (
    <div className="order-panel">
      <div className="order-heading">
        <div>
          <span className="eyebrow">ЗАКАЗ-НАРЯД</span>
          <h2>#WO-{order.id}</h2>
          <small>{dateLabel(order.createdAt)}</small>
        </div>
        <div className="actions">
          <Link className="btn btn-ghost" to={`/crm/orders/${order.id}`}>
            Открыть документ
          </Link>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> Печать
          </Button>
        </div>
      </div>
      {error && <ErrorState message={error} />}
      <div className="print-order-info">
        <p>
          Клиент: {order.client?.name || record?.client.name} ·{' '}
          {order.client?.phone || record?.client.phone}
        </p>
        <p>
          Автомобиль: {carName(order.car || record!.car)} · Пробег:{' '}
          {(order.car || record?.car)?.mileage?.toLocaleString('ru-RU') || '—'} км
        </p>
      </div>
      <div className="table-wrap">
        <table className="order-items">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Наименование</th>
              <th>Кол-во</th>
              <th>Цена, ₽</th>
              <th>Сумма</th>
              <th className="no-print" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>
                  <select
                    aria-label={`Тип позиции ${index + 1}`}
                    value={item.kind}
                    disabled={locked || user?.role === 'MECHANIC'}
                    onChange={(e) => update(index, 'kind', e.target.value)}
                  >
                    <option value="LABOR">Работа</option>
                    <option value="PART">Запчасть</option>
                  </select>
                </td>
                <td>
                  {locked || (user?.role === 'MECHANIC' && item.kind === 'PART') ? (
                    <span className="order-name">{item.name}</span>
                  ) : (
                    <input
                      title={item.name}
                      aria-label={`Наименование позиции ${index + 1}`}
                      value={item.name}
                      maxLength={200}
                      disabled={locked || (user?.role === 'MECHANIC' && item.kind === 'PART')}
                      onChange={(e) => update(index, 'name', e.target.value)}
                    />
                  )}
                </td>
                <td>
                  <input
                    aria-label={`Количество позиции ${index + 1}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    disabled={locked || (user?.role === 'MECHANIC' && item.kind === 'PART')}
                    onChange={(e) => update(index, 'quantity', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Цена позиции ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    disabled={locked || (user?.role === 'MECHANIC' && item.kind === 'PART')}
                    onChange={(e) => update(index, 'price', e.target.value)}
                  />
                </td>
                <td className="numeric">
                  {rub(Math.round(Number(item.price) * Number(item.quantity) * 100) / 100)}
                </td>
                <td className="no-print">
                  <button
                    className="icon-btn"
                    aria-label={`Удалить позицию ${index + 1}`}
                    disabled={locked || (user?.role === 'MECHANIC' && item.kind === 'PART')}
                    onClick={() => setItems(items.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <p className="panel-empty-text">Добавьте первую работу или запчасть.</p>}
      {!locked && (
        <div className="actions order-actions no-print">
          <Button
            variant="secondary"
            onClick={() => setItems([...items, { kind: 'LABOR', name: '', quantity: 1, price: 0 }])}
          >
            <Plus size={16} /> Работа
          </Button>
          {user?.role !== 'MECHANIC' && (
            <Button
              variant="secondary"
              onClick={() =>
                setItems([...items, { kind: 'PART', name: '', quantity: 1, price: 0 }])
              }
            >
              <Plus size={16} /> Запчасть
            </Button>
          )}
          <Button onClick={() => void save()} busy={busy}>
            Сохранить состав
          </Button>
        </div>
      )}
      <div className="order-totals">
        <div>
          <span>Работы</span>
          <strong>
            {rub(
              items
                .filter((i) => i.kind === 'LABOR')
                .reduce(
                  (s, i) => s + Math.round(Number(i.quantity) * Number(i.price) * 100) / 100,
                  0,
                ),
            )}
          </strong>
        </div>
        <div>
          <span>Запчасти</span>
          <strong>
            {rub(
              items
                .filter((i) => i.kind === 'PART')
                .reduce(
                  (s, i) => s + Math.round(Number(i.quantity) * Number(i.price) * 100) / 100,
                  0,
                ),
            )}
          </strong>
        </div>
        <div className="total-row">
          <span>
            Итого
            {preview !== Number(order.total) && <small>Предварительно · сохраните состав</small>}
          </span>
          <strong>{rub(preview)}</strong>
        </div>
      </div>
      <section className="payment-section">
        <div>
          <span
            className={`badge ${remaining === 0 && paid > 0 ? 'status-completed' : paid > 0 ? 'status-scheduled' : 'status-new'}`}
          >
            <CreditCard size={13} />
            {remaining === 0 && paid > 0
              ? 'Оплачено'
              : paid > 0
                ? 'Частично оплачено'
                : 'Не оплачено'}
          </span>
          <p>
            Оплачено <strong>{rub(paid)}</strong> · Остаток <strong>{rub(remaining)}</strong>
          </p>
        </div>
        {user?.role !== 'MECHANIC' && remaining > 0 && (
          <Button
            onClick={() => {
              setError('');
              setPaymentOpen(true);
            }}
            disabled={preview !== Number(order.total)}
          >
            <Plus size={16} /> Внести оплату
          </Button>
        )}
      </section>
      {order.payments.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Способ оплаты</th>
                <th>Сотрудник</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((p) => (
                <tr key={p.id}>
                  <td>{dateLabel(p.createdAt, true)}</td>
                  <td>{rub(p.amount)}</td>
                  <td>{methodLabels[p.method]}</td>
                  <td>{p.user?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {locked && <p className="hint">Состав заказа зафиксирован после оплаты или завершения.</p>}
      {paymentOpen && (
        <Modal title={`Оплата заказ-наряда #WO-${order.id}`} onClose={() => setPaymentOpen(false)}>
          <form onSubmit={pay} className="stack-form">
            {error && <ErrorState message={error} />}
            <p>
              Остаток к оплате: <strong>{rub(remaining)}</strong>
            </p>
            <Field
              label="Сумма, ₽"
              name="amount"
              type="number"
              min="0.01"
              max={remaining}
              step="0.01"
              defaultValue={remaining}
              required
            />
            <Select label="Способ оплаты" name="method">
              <option value="CARD">Карта</option>
              <option value="CASH">Наличные</option>
              <option value="TRANSFER">Перевод</option>
            </Select>
            <Button type="submit" busy={busy}>
              Зафиксировать оплату
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
