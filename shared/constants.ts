export const statuses = [
  'NEW',
  'CONTACTED',
  'SCHEDULED',
  'IN_PROGRESS',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;
export type RequestStatus = (typeof statuses)[number];
export const statusLabels: Record<RequestStatus, string> = {
  NEW: 'Новая',
  CONTACTED: 'Связались',
  SCHEDULED: 'Записана',
  IN_PROGRESS: 'В работе',
  READY: 'Готова',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};
export const sourceLabels: Record<string, string> = {
  website: 'Сайт',
  phone: 'Телефон',
  telegram: 'Telegram',
  manual: 'Вручную',
};
export const roleLabels: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  MECHANIC: 'Механик',
};
export const methodLabels: Record<string, string> = {
  CASH: 'Наличные',
  CARD: 'Карта',
  TRANSFER: 'Перевод',
};
