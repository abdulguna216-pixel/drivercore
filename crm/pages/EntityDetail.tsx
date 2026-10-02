import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useResource } from '../../frontend/src/hooks/useResource';
import { PageHeader, Loading, ErrorState, Badge, Empty } from '../../frontend/src/components/UI';
import type { Client, Car } from '../../frontend/src/services/types';
import { carName, dateLabel, rub } from '../../frontend/src/utils/format';
export default function EntityDetail({ kind }: { kind: 'cars' | 'clients' }) {
  const { id } = useParams();
  const resource = useResource<Client | Car>(`/${kind}/${id}`);
  if (resource.loading) return <Loading />;
  if (!resource.data)
    return <ErrorState message={resource.error || 'Запись не найдена'} retry={resource.refresh} />;
  const c = resource.data;
  return (
    <>
      <Link to={`/crm/${kind}`} className="back-link">
        <ArrowLeft size={16} /> {kind === 'clients' ? 'К клиентам' : 'К автомобилям'}
      </Link>
      <PageHeader
        title={kind === 'clients' ? (c as Client).name : carName(c as Car)}
        description={
          kind === 'clients'
            ? (c as Client).phone
            : `${(c as Car).licensePlate || 'Без госномера'} · ${(c as Car).year || 'Год не указан'}`
        }
      />
      <div className="panel detail-panel">
        <h2>{kind === 'clients' ? 'Автомобили клиента' : 'Данные автомобиля'}</h2>
        {kind === 'clients' ? (
          <div className="client-cars">
            {(c as Client).cars?.map((car) => (
              <Link to={`/crm/cars/${car.id}`} key={car.id}>
                <strong>{carName(car)}</strong>
                <span>
                  {car.year} · {car.licensePlate || 'Без госномера'}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <dl className="detail-grid">
            {[
              ['VIN', (c as Car).vin],
              ['Пробег', `${(c as Car).mileage?.toLocaleString('ru-RU') || '—'} км`],
              ['Владелец', (c as Car).client?.name],
              ['Телефон', (c as Car).client?.phone],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || 'Не указан'}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="panel history-panel">
        <div className="panel-heading">
          <h2>История обслуживания</h2>
          <span className="muted">{c.requests?.length || 0} обращений</span>
        </div>
        {c.requests?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата / заявка</th>
                  <th>Автомобиль</th>
                  <th>Услуга</th>
                  <th>Стоимость</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {c.requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/crm/requests/${r.id}`}>
                        {dateLabel(r.appointment?.startsAt || r.createdAt)}
                        <small>Заявка #{r.id}</small>
                      </Link>
                    </td>
                    <td>{carName(r.car)}</td>
                    <td>{r.service.name}</td>
                    <td>{r.workOrder ? rub(r.workOrder.total) : '—'}</td>
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
            title="Обращений пока нет"
            description="История ремонта появится после первой заявки."
          />
        )}
      </div>
    </>
  );
}
