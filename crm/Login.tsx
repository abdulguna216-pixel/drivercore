import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useAuth } from '../frontend/src/components/Providers';
import { Brand, Button, Field, ErrorState } from '../frontend/src/components/UI';
import { formObject } from '../frontend/src/utils/format';
export default function Login() {
  const { user, login, loading } = useAuth();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = formObject(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await login(String(data.email), String(data.password));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user) return <Navigate to="/crm" replace />;
  return (
    <div className="login-page">
      <div className="login-visual">
        <img src="/workshop.webp" alt="Мастерская DRIVECORE" />
        <Brand />
        <div>
          <p className="eyebrow">DRIVECORE / WORKSPACE</p>
          <h1>
            Всё под контролем.
            <br />
            От записи до выдачи.
          </h1>
          <p>Единое рабочее пространство команды автосервиса.</p>
        </div>
        <span>ТОЧНОСТЬ В КАЖДОЙ ДЕТАЛИ</span>
      </div>
      <main className="login-form-wrap">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> На сайт
        </Link>
        <form onSubmit={submit} className="login-form">
          <div className="login-icon">
            <LockKeyhole size={24} />
          </div>
          <p className="eyebrow">ВХОД ДЛЯ СОТРУДНИКОВ</p>
          <h2>Добро пожаловать</h2>
          <p>Войдите в DRIVECORE CRM, чтобы продолжить.</p>
          {error && <ErrorState message={error} />}
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="name@drivecore.local"
            autoComplete="username"
            required
          />
          <div className="password-field">
            <Field
              label="Пароль"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <Button busy={busy || loading} className="full" type="submit">
            Войти в CRM <ArrowUpRight size={18} />
          </Button>
          <small>Если у вас нет доступа, обратитесь к администратору сервиса.</small>
        </form>
        <footer>© {new Date().getFullYear()} DRIVECORE</footer>
      </main>
    </div>
  );
}
