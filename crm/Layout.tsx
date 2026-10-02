import { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Columns3,
  CalendarDays,
  Users,
  CarFront,
  ClipboardList,
  UserRound,
  Wrench,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { Brand, Button, Modal, Empty, ErrorState } from '../frontend/src/components/UI';
import { useAuth, useToast } from '../frontend/src/components/Providers';
import { useResource, useDebounce } from '../frontend/src/hooks/useResource';
import { send } from '../frontend/src/services/api';
import type { RequestRecord, Client, Car, WorkOrder } from '../frontend/src/services/types';
import { roleLabels } from '../shared/constants';
import { carName, dateLabel } from '../frontend/src/utils/format';
const items = [
  { path: '', label: 'Обзор', icon: LayoutDashboard },
  { path: 'requests', label: 'Заявки', icon: Columns3 },
  { path: 'calendar', label: 'Календарь', icon: CalendarDays },
  { path: 'clients', label: 'Клиенты', icon: Users, staff: true },
  { path: 'cars', label: 'Автомобили', icon: CarFront },
  { path: 'orders', label: 'Заказ-наряды', icon: ClipboardList },
  { path: 'users', label: 'Сотрудники', icon: UserRound },
  { path: 'services', label: 'Услуги', icon: Wrench },
  { path: 'finance', label: 'Финансы', icon: Wallet, staff: true },
  {
    path: 'analytics',
    label: 'Аналитика',
    icon: ChartNoAxesCombined,
    staff: true,
  },
  { path: 'settings', label: 'Настройки', icon: Settings },
  { path: 'security', label: 'Безопасность', icon: ShieldCheck, admin: true },
];
export default function Layout() {
  const { user, logout } = useAuth(),
    toast = useToast();
  const [menu, setMenu] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [q, setQ] = useState('');
  const location = useLocation();
  const [compact, setCompact] = useState(window.matchMedia('(max-width: 1023px)').matches);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!menu || !compact) return;
    const origin = document.activeElement as HTMLElement | null;
    const path = window.location.pathname;
    const controls = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') || [],
      );
    controls()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const list = controls();
      if (event.shiftKey && document.activeElement === list[0]) {
        event.preventDefault();
        list.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === list.at(-1)) {
        event.preventDefault();
        list[0]?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      if (window.location.pathname === path) origin?.focus();
    };
  }, [menu, compact]);
  const mainRef = useRef<HTMLElement>(null);
  const searchQ = useDebounce(q);
  const search = useResource<{
    requests: RequestRecord[];
    clients: Client[];
    cars: Car[];
    orders: WorkOrder[];
  }>(`/search?q=${encodeURIComponent(searchQ)}`);
  const notifications = useResource<{
    items: {
      id: string;
      requestId: number;
      title: string;
      readAt: string | null;
      createdAt: string;
    }[];
    unread: number;
  }>('/notifications', 5000);
  useEffect(() => {
    setMenu(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);
  async function leave() {
    try {
      await logout();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <div className="crm-shell">
      <a className="skip-link" href="#crm-main">
        К основному содержимому
      </a>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenu(false)}
        />
      )}
      <aside ref={sidebarRef} inert={compact && !menu} className={`sidebar ${menu ? 'open' : ''}`}>
        <Link to="/crm" className="sidebar-brand">
          <Brand crm />
        </Link>
        <div className="workspace-label">
          <span className="live-dot" /> Автосервис · Москва
        </div>
        <p className="nav-group-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
        <nav aria-label="Разделы CRM">
          {items
            .filter((item) => (!item.staff || user?.role !== 'MECHANIC') && (!item.admin || user?.role === 'ADMIN'))
            .map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={`/crm${path ? '/' + path : ''}`} end={!path}>
                <Icon size={18} strokeWidth={1.7} />
                <span>{label}</span>
                {path === 'requests' && !!notifications.data?.unread && (
                  <b>{notifications.data.unread}</b>
                )}
              </NavLink>
            ))}
        </nav>
        <Link to="/" target="_blank" className="site-link">
          Публичный сайт <ArrowUpRight size={16} />
        </Link>
        <div className="sidebar-user">
          <span className="avatar">
            {user?.name
              .split(' ')
              .map((s) => s[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <strong>{user?.name}</strong>
            <small>{roleLabels[user?.role || 'MANAGER']}</small>
          </div>
          <button
            className="icon-btn"
            aria-label="Выйти"
            title="Выйти"
            onClick={() => void leave()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="crm-content" inert={compact && menu}>
        <header className="crm-topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Открыть меню"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Рабочее пространство <span>/</span>
            <strong>
              {items.find((i) => i.path === location.pathname.split('/')[2])?.label || 'Обзор'}
            </strong>
          </div>
          <div className="topbar-right">
            <button
              className="search-trigger"
              aria-label="Поиск по CRM"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
              <span>Поиск по CRM</span>
              <kbd>⌕</kbd>
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-btn notification-button"
              aria-label={`Уведомления, непрочитанных: ${notifications.data?.unread || 0}`}
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell size={20} />
              {!!notifications.data?.unread && <i />}
            </button>
            <span className="avatar small">{user?.name[0]}</span>
          </div>
        </header>
        <main id="crm-main" ref={mainRef} tabIndex={-1} className="crm-main">
          <Outlet />
        </main>
        <footer className="crm-footer">
          <span>DRIVECORE · Рабочее пространство</span>
          <span>Время записей: Москва (UTC+3)</span>
        </footer>
      </div>
      {searchOpen && (
        <Modal title="Поиск по CRM" onClose={() => setSearchOpen(false)}>
          <label className="search-input">
            <Search size={18} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Имя, телефон, госномер, VIN, № заявки или WO"
              aria-label="Глобальный поиск"
            />
          </label>
          {search.error && <ErrorState message={search.error} retry={search.refresh} />}
          <div className="search-results">
            {search.data?.requests.map((r) => (
              <Link key={r.id} to={`/crm/requests/${r.id}`}>
                Заявка #{r.id}
                <strong>{carName(r.car)}</strong>
                <small>{r.client.name}</small>
              </Link>
            ))}
            {search.data?.clients.map((c) => (
              <Link key={c.id} to={`/crm/clients/${c.id}`}>
                Клиент<strong>{c.name}</strong>
                <small>{c.phone}</small>
              </Link>
            ))}
            {search.data?.cars.map((c) => (
              <Link key={c.id} to={`/crm/cars/${c.id}`}>
                Автомобиль<strong>{carName(c)}</strong>
                <small>{c.licensePlate || c.vin}</small>
              </Link>
            ))}
            {search.data?.orders.map((o) => (
              <Link key={o.id} to={`/crm/orders/${o.id}`}>
                Заказ-наряд<strong>#WO-{o.id}</strong>
                <small>{carName(o.car)}</small>
              </Link>
            ))}
            {searchQ.length < 2 ? (
              <p className="muted">Введите минимум 2 символа.</p>
            ) : (
              search.data &&
              !Object.values(search.data).some((a) => a.length) && (
                <Empty title="Ничего не найдено" description="Попробуйте другой номер или имя." />
              )
            )}
          </div>
        </Modal>
      )}
      {notificationsOpen && (
        <Modal title="Уведомления" onClose={() => setNotificationsOpen(false)}>
          <Button
            variant="secondary"
            onClick={() => {
              void send('/notifications/read', {}, 'PATCH')
                .then(() => notifications.refresh())
                .catch((e) => toast((e as Error).message, true));
            }}
          >
            Отметить всё прочитанным
          </Button>
          {notifications.error && (
            <ErrorState message={notifications.error} retry={notifications.refresh} />
          )}
          <div className="notification-list">
            {notifications.data?.items.map((n) => (
              <Link
                key={n.id}
                to={`/crm/requests/${n.requestId}`}
                onClick={() => setNotificationsOpen(false)}
              >
                <i className={n.readAt ? 'read' : 'unread'} />
                <span>
                  <strong>{n.title}</strong>
                  <small>{dateLabel(n.createdAt, true)}</small>
                </span>
              </Link>
            ))}
            {!notifications.data?.items.length && (
              <Empty
                title="Уведомлений пока нет"
                description="Новые обращения с сайта появятся здесь автоматически."
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
