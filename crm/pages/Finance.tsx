import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, CreditCard, Receipt } from 'lucide-react';
import { useResource } from '../../frontend/src/hooks/useResource';
import {
  PageHeader,
  Loading,
  ErrorState,
  Empty,
  Pagination,
} from '../../frontend/src/components/UI';
import type { Payment, PageData, Dashboard } from '../../frontend/src/services/types';
import { rub, dateLabel, carName } from '../../frontend/src/utils/format';
import { methodLabels } from '../../shared/constants';
import { Stat } from '../components/Stats';
export default function Finance() {
  const [page, setPage] = useState(1);
  const resource = useResource<PageData<Payment>>(`/payments?page=${page}`, 5000),
    dashboard = useResource<Dashboard>('/dashboard');
  return (
    <>
      <PageHeader title="Финансы" description="Фактические поступления и история оплат" />
      <div className="stat-grid three">
        <Stat
          label="Выручка за текущий месяц"
          value={rub(dashboard.data?.revenue || 0)}
          icon={<Wallet size={19} />}
        />
        <Stat
          label="Всего операций"
          value={resource.data?.total || 0}
          icon={<Receipt size={19} />}
        />
        <Stat
          label="Как внести оплату"
          value="Из заказ-наряда"
          icon={<CreditCard size={19} />}
          note="Откройте заказ и нажмите «Внести оплату»"
        />
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2>История оплат</h2>
          <Link to="/crm/orders" className="btn btn-secondary">
            Заказ-наряды
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
                  <th>Дата</th>
                  <th>Заказ-наряд</th>
                  <th>Клиент / автомобиль</th>
                  <th>Сумма</th>
                  <th>Метод</th>
                  <th>Принял</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{dateLabel(p.createdAt, true)}</td>
                    <td>
                      <Link to={`/crm/orders/${p.workOrderId}`}>#WO-{p.workOrderId}</Link>
                    </td>
                    <td>
                      {p.workOrder?.client.name}
                      <small>{p.workOrder && carName(p.workOrder.car)}</small>
                    </td>
                    <td>
                      <strong>{rub(p.amount)}</strong>
                    </td>
                    <td>{methodLabels[p.method]}</td>
                    <td>{p.user?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Оплат пока нет"
            description="Поступления появятся после оплаты первого заказ-наряда."
          />
        )}
        {resource.data && (
          <Pagination
            page={page}
            limit={resource.data.limit}
            total={resource.data.total}
            onChange={setPage}
          />
        )}
      </div>
    </>
  );
}
