import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ButtonHTMLAttributes,
} from 'react';
import {
  X,
  LoaderCircle,
  ArrowRight,
  Inbox,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import type { RequestStatus } from '../../../shared/constants';
import { statusLabels } from '../../../shared/constants';
export function Brand({ crm = false }: { crm?: boolean }) {
  return (
    <span className="brand">
      <svg width="31" height="31" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M3 6h12l-5 7H3V6ZM29 26H17l5-7h7v7ZM15 6h14v7H10l5-7ZM17 26H3v-7h19l-5 7Z"
          fill="currentColor"
        />
      </svg>
      <span>DRIVECORE{crm && <small>WORKSPACE</small>}</span>
    </span>
  );
}
export function Button({
  children,
  busy = false,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      {...{ ...props, disabled: props.disabled || busy }}
    >
      {busy && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {props.required && ' *'}
      </span>
      <input
        id={id}
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {props.required && ' *'}
      </span>
      <select id={id} {...props}>
        {children}
      </select>
    </label>
  );
}
export function Textarea({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        required={required}
        maxLength={4000}
        rows={3}
      />
    </label>
  );
}
export function Badge({ status }: { status: RequestStatus }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <i aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
export function Empty({
  title = 'Пока здесь пусто',
  description = 'Новые данные появятся здесь после первого обращения.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={30} strokeWidth={1.4} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeletons" aria-label="Загрузка" role="status">
      <div />
      <div />
      <div />
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => unknown }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <span>{message}</span>
      {retry && (
        <Button variant="secondary" onClick={() => void retry()}>
          Повторить
        </Button>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Закрыть" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} из ${total}`
          : '0 записей'}
      </span>
      <div>
        <button
          className="icon-btn"
          aria-label="Предыдущая страница"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / limit))}
        </span>
        <button
          className="icon-btn"
          aria-label="Следующая страница"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export { ArrowRight, Check };
