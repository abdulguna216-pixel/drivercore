import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import { useResource, useDebounce } from '../../frontend/src/hooks/useResource';
import {
  PageHeader,
  Loading,
  ErrorState,
  Empty,
  Badge,
  Pagination,
} from '../../frontend/src/components/UI';
import type { WorkOrder, PageData } from '../../frontend/src/services/types';
import { rub, paidAmount, carName, dateLabel } from '../../frontend/src/utils/format';
import OrderPanel from '../components/OrderPanel';
export default function Orders() {
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    search = useDebounce(q);
  const resource = useResource<PageData<WorkOrder>>(
    `/work-orders?q=${encodeURIComponent(search)}&page=${page}`,
  );
  return (
    <>
      <PageHeader
        title="Заказ-наряды"
        description="Работы, запчасти и расчёты по каждому автомобилю"
      />
      <div className="panel">
        <div className="directory-toolbar">
          <label className="search-input">
            <Search size={17} />
            <input
              aria-label="Поиск заказ-нарядов"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Номер WO или клиент"
            />
          </label>
          <Link to="/crm/requests" className="btn btn-secondary">
            Создать из заявки
          </Link>
        </div>
        {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}{' '}
        {resource.loading ? (
          <Loading />
        ) : resource.data?.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Заказ-наряд</th>
                  <th>Клиент</th>
                  <th>Автомобиль</th>
                  <th>Итого</th>
                  <th>Оплачено</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/crm/orders/${o.id}`}>
                        <strong>#WO-{o.id}</strong>
                        <small>{dateLabel(o.createdAt)}</small>
                      </Link>
                    </td>
                    <td>{o.client.name}</td>
                    <td>{carName(o.car)}</td>
                    <td>{rub(o.total)}</td>
                    <td>{rub(paidAmount(o))}</td>
                    <td>
                      <Badge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Заказ-нарядов пока нет"
            description="Откройте заявку и создайте заказ-наряд во вкладке «Финансы»."
          />
        )}
        {resource.data && (
          <Pagination
            page={page}
            total={resource.data.total}
            limit={resource.data.limit}
            onChange={setPage}
          />
        )}
      </div>
    </>
  );
}
export function OrderDetail() {
  const { id } = useParams(),
    resource = useResource<WorkOrder>(`/work-orders/${id}`);
  if (resource.loading) return <Loading />;
  if (!resource.data)
    return <ErrorState message={resource.error || 'Заказ не найден'} retry={resource.refresh} />;
  return (
    <>
      <Link to="/crm/orders" className="back-link">
        <ArrowLeft size={16} /> К заказ-нарядам
      </Link>
      <PageHeader
        title={`Заказ-наряд #WO-${id}`}
        description={`${carName(resource.data.car)} · ${resource.data.client.name}`}
        action={
          <Link className="btn btn-secondary" to={`/crm/requests/${resource.data.requestId}`}>
            Открыть заявку #{resource.data.requestId}
          </Link>
        }
      />
      <div className="panel detail-panel">
        <OrderPanel order={resource.data} refresh={resource.refresh} />
      </div>
    </>
  );
}
