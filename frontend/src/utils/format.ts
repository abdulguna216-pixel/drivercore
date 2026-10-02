export const rub = (value: string | number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
export const dateLabel = (value: string | null | undefined, withTime = false) =>
  value
    ? new Date(value).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: 'short',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' }),
      })
    : 'Не назначена';
export const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
export const carName = (car: { brand: string; model: string }) => `${car.brand} ${car.model}`;
export const paidAmount = (order: { payments: { amount: string }[] }) =>
  order.payments.reduce((s, p) => s + Number(p.amount), 0);
export const formObject = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form).entries());
export const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
