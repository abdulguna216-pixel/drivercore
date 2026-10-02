import { useState, type FormEvent } from 'react';
import { ShieldCheck, PlugZap } from 'lucide-react';
import { useResource } from '../../frontend/src/hooks/useResource';
import { useAuth, useToast } from '../../frontend/src/components/Providers';
import { send } from '../../frontend/src/services/api';
import { PageHeader, Button, Field, Loading, ErrorState } from '../../frontend/src/components/UI';
import type { Settings as SettingsData } from '../../frontend/src/services/types';
import { formObject } from '../../frontend/src/utils/format';
export default function Settings() {
  const { user } = useAuth(),
    toast = useToast(),
    resource = useResource<SettingsData>('/settings');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const admin = user?.role === 'ADMIN';
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await send('/settings', formObject(event.currentTarget), 'PATCH');
      await resource.refresh();
      toast('Настройки сохранены');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Настройки" description="Контакты сервиса и рабочее пространство" />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <div className="settings-grid">
            <section className="panel detail-panel">
              <h2>Информация о сервисе</h2>
              <p className="muted">Эти контакты отображаются на публичном сайте.</p>
              <form onSubmit={save} className="stack-form">
                {error && <ErrorState message={error} />}
                <Field
                  label="Название"
                  name="name"
                  defaultValue={resource.data.name}
                  readOnly={!admin}
                  required
                />
                <Field
                  label="Телефон"
                  name="phone"
                  defaultValue={resource.data.phone}
                  readOnly={!admin}
                  required
                />
                <Field
                  label="Адрес"
                  name="address"
                  defaultValue={resource.data.address}
                  readOnly={!admin}
                  required
                />
                <Field
                  label="Режим работы"
                  name="hours"
                  defaultValue={resource.data.hours}
                  readOnly={!admin}
                  required
                />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  defaultValue={resource.data.email}
                  readOnly={!admin}
                  required
                />
                {admin && (
                  <Button busy={busy} type="submit">
                    Сохранить настройки
                  </Button>
                )}
              </form>
            </section>
            <div>
              <section className="panel detail-panel">
                <ShieldCheck className="accent-icon" size={26} />
                <h2>Доступ и роли</h2>
                <p className="muted">
                  Администратор управляет командой и настройками. Менеджер ведёт заявки и оплаты.
                  Мастер видит назначенные работы.
                </p>
                <p className="hint">
                  Настройки доступны для изменения администратору. Время календаря: Москва, UTC+3.
                </p>
              </section>
              <section className="panel detail-panel integration-panel">
                <PlugZap className="accent-icon" size={26} />
                <h2>Telegram</h2>
                <p className="muted">
                  Уведомления о новых заявках поддерживаются сервером. Для подключения задайте
                  TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в окружении backend.
                </p>
                <p className="hint">Секреты интеграции не сохраняются в интерфейсе.</p>
              </section>
            </div>
          </div>
        )
      )}
      {resource.error && <ErrorState message={resource.error} retry={resource.refresh} />}
    </>
  );
}
