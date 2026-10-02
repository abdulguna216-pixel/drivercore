import { useState, type FormEvent } from 'react';
import { ArrowUpRight, CheckCircle2, Paperclip, ShieldCheck } from 'lucide-react';
import { Button, Field, Select, Textarea, ErrorState } from '../frontend/src/components/UI';
import { send, ApiError } from '../frontend/src/services/api';
import type { Service } from '../frontend/src/services/types';
import { localDate } from '../frontend/src/utils/format';
export default function BookingForm({
  services,
  initialService = '',
  onSuccess,
  internal = false,
}: {
  services: Service[];
  initialService?: string;
  onSuccess?: () => void;
  internal?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [success, setSuccess] = useState<number | null>(null),
    [error, setError] = useState(''),
    [fields, setFields] = useState<Record<string, string[] | undefined>>({});
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!services.length) {
      setError('Список услуг недоступен. Обновите страницу или свяжитесь с сервисом.');
      return;
    }
    data.delete('consent');
    if (!internal) data.set('source', 'website');
    for (const key of ['year', 'mileage', 'licensePlate', 'preferredDate', 'comment'])
      if (data.get(key) === '') data.delete(key);
    const files = (form.elements.namedItem('files') as HTMLInputElement).files;
    data.delete('files');
    for (const file of Array.from(files || [])) data.append('files', file);
    setBusy(true);
    setError('');
    setFields({});
    try {
      const result = await send<{ id: number }>('/requests', data);
      setSuccess(result.id);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить заявку.');
      if (e instanceof ApiError) {
        setFields(e.fields);
        const name = Object.keys(e.fields)[0];
        if (name) (form.elements.namedItem(name) as HTMLInputElement | null)?.focus();
      }
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="booking-success" role="status">
        <CheckCircle2 size={48} />
        <h3>Заявка отправлена</h3>
        <p>Номер обращения #{success}. Мы свяжемся с вами для подтверждения записи.</p>
        <Button variant="secondary" onClick={() => setSuccess(null)}>
          Отправить ещё одну заявку
        </Button>
      </div>
    );
  return (
    <form className="booking-form" onSubmit={submit}>
      {error && <ErrorState message={error} />}
      <div className="form-grid">
        <Field
          label="Ваше имя"
          name="name"
          placeholder="Александр"
          autoComplete="name"
          required
          maxLength={100}
          error={fields.name?.[0]}
        />
        <Field
          label="Телефон"
          name="phone"
          type="tel"
          placeholder="+7 (999) 000-00-00"
          autoComplete="tel"
          required
          error={fields.phone?.[0]}
        />
        <Field
          label="Марка автомобиля"
          name="carBrand"
          placeholder="BMW"
          required
          maxLength={80}
          error={fields.carBrand?.[0]}
        />
        <Field
          label="Модель"
          name="carModel"
          placeholder="320i"
          required
          maxLength={80}
          error={fields.carModel?.[0]}
        />
        <Field
          label="Год выпуска"
          name="year"
          type="number"
          min={1900}
          max={new Date().getFullYear() + 1}
          placeholder="2021"
          error={fields.year?.[0]}
        />
        <Field label="Госномер" name="licensePlate" placeholder="А123АА77" maxLength={20} />
        <Field
          label="Пробег, км"
          name="mileage"
          type="number"
          min={0}
          max={3000000}
          placeholder="64 000"
          error={fields.mileage?.[0]}
        />
        <Field
          label="Желаемая дата"
          name="preferredDate"
          type="date"
          min={localDate()}
          error={fields.preferredDate?.[0]}
        />
      </div>
      {internal && (
        <Select label="Источник заявки" name="source" defaultValue="manual">
          <option value="manual">Вручную</option>
          <option value="phone">Телефон</option>
          <option value="telegram">Telegram</option>
          <option value="website">Сайт</option>
        </Select>
      )}
      <Select label="Услуга" name="serviceId" defaultValue={initialService} required>
        <option value="">Выберите услугу</option>
        {services
          .filter((s) => s.active)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </Select>
      <Textarea label="Что беспокоит автомобиль?" name="comment" />
      <label className="upload-box">
        <Paperclip size={18} />
        <span>
          Прикрепить фотографии
          <small>JPG, PNG, WebP · до 5 файлов по 5 МБ</small>
        </span>
        <input name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple />
      </label>
      {!internal && (
        <label className="consent">
          <input type="checkbox" name="consent" required />
          <span>
            Согласен на обработку указанных данных для связи и записи в сервис. Данные доступны
            только сотрудникам DRIVECORE.
          </span>
        </label>
      )}
      <Button type="submit" busy={busy} disabled={!services.length} className="full">
        Отправить заявку <ArrowUpRight size={19} />
      </Button>
      <p className="form-note">
        <ShieldCheck size={14} /> Без предоплаты. Время подтвердит менеджер.
      </p>
    </form>
  );
}
