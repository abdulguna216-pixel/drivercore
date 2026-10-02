import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Phone,
  MapPin,
  Clock,
  Menu,
  X,
  Check,
  ShieldCheck,
  MoveUpRight,
} from 'lucide-react';
import { Brand, Modal, ErrorState } from '../frontend/src/components/UI';
import { useResource } from '../frontend/src/hooks/useResource';
import type { Service, Settings } from '../frontend/src/services/types';
import { rub } from '../frontend/src/utils/format';
import BookingForm from './BookingForm';
const imageFor = (name: string) =>
  name.includes('диагностика')
    ? 'diagnostics'
    : name.includes('обслуживание')
      ? 'maintenance'
      : name.includes('подвески')
        ? 'suspension'
        : name.includes('Тормоз')
          ? 'brakes'
          : name.includes('Шино')
            ? 'tires'
            : 'detail';
const nav = [
  ['Услуги', 'services'],
  ['Цены', 'prices'],
  ['О сервисе', 'about'],
  ['Работы', 'work'],
  ['Контакты', 'contacts'],
];
export default function PublicSite() {
  const services = useResource<Service[]>('/services'),
    settings = useResource<Settings>('/settings');
  const [menu, setMenu] = useState(false),
    [booking, setBooking] = useState<string | null>(null);
  const contact = settings.data;
  return (
    <div className="public-site">
      <a href="#main" className="skip-link">
        К основному содержимому
      </a>
      <header className="site-header">
        <a href="#" aria-label="DRIVECORE — главная">
          <Brand />
        </a>
        <nav className={menu ? 'site-nav open' : 'site-nav'} aria-label="Навигация сайта">
          {nav.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-phone" href={`tel:${contact?.phone.replace(/[^\d+]/g, '') || ''}`}>
            {contact?.phone}
          </a>
          <a className="btn btn-primary" href="#booking">
            Записаться <ArrowUpRight size={17} />
          </a>
          <button
            className="icon-btn mobile-menu"
            aria-label={menu ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <img
            src="/hero.webp"
            alt="Автомобиль в рабочей зоне DRIVECORE"
            className="hero-image"
            fetchPriority="high"
          />
          <div className="hero-shade" />
          <div className="container hero-content">
            <div className="eyebrow">
              <span className="orange-line" /> СЕРВИС С ХАРАКТЕРОМ
            </div>
            <h1>
              РЕМОНТ И<br />
              ОБСЛУЖИВАНИЕ
              <br />
              <span>БЕЗ ЛИШНИХ</span>
              <br />
              ПРОБЛЕМ<span className="accent-dot">.</span>
            </h1>
            <p>
              Диагностика, техническое обслуживание и ремонт автомобилей. Показываем стоимость до
              начала работ и сохраняем всю историю обслуживания.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#booking">
                Записаться на сервис <ArrowUpRight size={20} />
              </a>
              <a href="#services" className="text-link">
                Посмотреть услуги <ArrowRight size={18} />
              </a>
            </div>
            <div className="hero-caption">
              <span className="live-dot" />
              {contact?.hours || 'Ежедневно · 09:00–21:00'}
              <span className="caption-rule" />
              {contact?.address || 'Москва'}
            </div>
          </div>
          <div className="hero-bottom-label">
            ТОЧНОСТЬ В КАЖДОЙ ДЕТАЛИ <span>01 — DRIVECORE</span>
          </div>
        </section>
        <section className="proof-strip container" aria-label="Наши преимущества">
          {[
            ['8+', 'лет работаем с автомобилями'],
            ['12', 'мастеров в штате'],
            ['4.9 / 5', 'средняя оценка'],
            ['12 мес.', 'гарантия на работы'],
          ].map(([num, text]) => (
            <div key={text}>
              <strong>{num}</strong>
              <span>{text}</span>
            </div>
          ))}
        </section>
        <section id="services" className="section container">
          <div className="section-top">
            <div>
              <p className="eyebrow">
                <span className="orange-line" /> 01 / НАШИ УСЛУГИ
              </p>
              <h2>
                Всё, что нужно
                <br />
                вашему автомобилю.
              </h2>
            </div>
            <p className="section-intro">
              От планового ТО до сложного ремонта.
              <br />
              Разберёмся в причине, объясним решение
              <br />и согласуем каждый этап.
            </p>
          </div>
          {services.error && <ErrorState message={services.error} retry={services.refresh} />}
          <div className="service-grid">
            {services.data
              ?.filter((s) => s.active)
              .map((service, index) => (
                <button
                  className="service-card"
                  key={service.id}
                  onClick={() => setBooking(service.id)}
                >
                  <div className="service-image-wrap">
                    <img
                      src={`/${imageFor(service.name)}.webp`}
                      alt={service.name}
                      loading="lazy"
                      width="1000"
                      height="667"
                    />
                    <span className="service-index">0{index + 1}</span>
                    <span className="service-arrow">
                      <MoveUpRight size={22} />
                    </span>
                  </div>
                  <div className="service-info">
                    <h3>{service.name}</h3>
                    <p>{service.description}</p>
                    <span>от {rub(service.price)}</span>
                  </div>
                </button>
              ))}
          </div>
        </section>
        <section id="about" className="about-section">
          <div className="container about-grid">
            <div className="about-photo">
              <img
                src="/workshop.webp"
                alt="Рабочий день внутри сервиса DRIVECORE"
                loading="lazy"
                width="1000"
                height="667"
              />
              <div className="photo-label">
                <ShieldCheck size={23} />
                <span>
                  Забота о машине.
                  <br />
                  <strong>Уважение к вашему времени.</strong>
                </span>
              </div>
            </div>
            <div>
              <p className="eyebrow">
                <span className="orange-line" /> 02 / О СЕРВИСЕ
              </p>
              <h2>
                Знаем автомобили.
                <br />
                Понимаем людей.
              </h2>
              <p className="about-text">
                Хороший сервис начинается с честного разговора. Мы покажем, что требует внимания
                сейчас, а что может подождать. Без навязанных услуг и неожиданных сумм в счёте.
              </p>
              <div className="about-points">
                {[
                  'Согласовываем стоимость до начала работ',
                  'Объясняем ремонт понятным языком',
                  'Сохраняем историю каждого обслуживания',
                  'Даём гарантию на выполненные работы',
                ].map((text) => (
                  <div key={text}>
                    <Check size={18} />
                    {text}
                  </div>
                ))}
              </div>
              <a className="text-link" href="#booking">
                Познакомимся на сервисе <ArrowUpRight size={18} />
              </a>
            </div>
          </div>
        </section>
        <section className="section container">
          <p className="eyebrow">
            <span className="orange-line" /> 03 / КАК МЫ РАБОТАЕМ
          </p>
          <h2>
            Понятный процесс.
            <br />
            Предсказуемый результат.
          </h2>
          <div className="process-grid">
            {[
              'Оставляете заявку',
              'Менеджер связывается с вами',
              'Приезжаете на диагностику',
              'Согласовываем стоимость',
              'Выполняем ремонт',
              'Вы получаете автомобиль',
            ].map((text, i) => (
              <div key={text}>
                <span>0{i + 1}</span>
                <h3>{text}</h3>
                <div className="process-line" />
              </div>
            ))}
          </div>
        </section>
        <section id="prices" className="prices-section section">
          <div className="container prices-grid">
            <div>
              <p className="eyebrow">
                <span className="orange-line" /> 04 / СТОИМОСТЬ
              </p>
              <h2>
                Честная цена.
                <br />
                До начала работ.
              </h2>
              <p className="section-intro">
                Указана базовая стоимость работ.
                <br />
                Точная цена зависит от автомобиля
                <br />и согласовывается после диагностики.
              </p>
              <a href="#booking" className="btn btn-secondary">
                Уточнить стоимость <ArrowUpRight size={18} />
              </a>
            </div>
            <div className="price-list">
              {services.data
                ?.filter((s) => s.active)
                .map((service) => (
                  <button key={service.id} onClick={() => setBooking(service.id)}>
                    <span>{service.name}</span>
                    <strong>от {rub(service.price)}</strong>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
            </div>
          </div>
        </section>
        <section id="work" className="section container">
          <div className="section-top">
            <div>
              <p className="eyebrow">
                <span className="orange-line" /> 05 / ВНУТРИ DRIVECORE
              </p>
              <h2>Работа в деталях.</h2>
            </div>
            <p className="section-intro">
              Никаких лишних слов.
              <br />
              Внимание к каждой детали.
            </p>
          </div>
          <div className="work-gallery">
            <figure>
              <img src="/brakes.webp" alt="Обслуживание тормозного узла" loading="lazy" />
              <figcaption>
                Тормозная система <span>ТОЧНОСТЬ</span>
              </figcaption>
            </figure>
            <figure>
              <img
                src="/diagnostics.webp"
                alt="Электронная диагностика автомобиля"
                loading="lazy"
              />
              <figcaption>
                Компьютерная диагностика <span>ТЕХНОЛОГИИ</span>
              </figcaption>
            </figure>
            <figure>
              <img src="/suspension.webp" alt="Мастер осматривает подвеску" loading="lazy" />
              <figcaption>
                Ремонт подвески <span>ОПЫТ</span>
              </figcaption>
            </figure>
          </div>
        </section>
        <section id="booking" className="booking-section">
          <div className="container booking-grid">
            <div>
              <p className="eyebrow">
                <span className="orange-line" /> 06 / ЗАПИСЬ НА СЕРВИС
              </p>
              <h2>
                Ваш автомобиль
                <br />в надёжных руках<span className="accent-dot">.</span>
              </h2>
              <p>
                Расскажите о машине и выберите удобную дату. Менеджер свяжется с вами, уточнит
                детали и подтвердит время.
              </p>
              <div className="booking-contact">
                <Phone size={21} />
                <div>
                  <small>Можно просто позвонить</small>
                  <a href={`tel:${contact?.phone.replace(/[^\d+]/g, '') || ''}`}>
                    {contact?.phone}
                  </a>
                </div>
              </div>
              <img
                className="booking-detail"
                src="/detail.webp"
                alt="Инструменты на рабочем столе мастера"
                loading="lazy"
              />
            </div>
            <div className="booking-panel">
              <h3>Записаться в DRIVECORE</h3>
              <p>Оставьте заявку — остальное берём на себя.</p>
              <BookingForm services={services.data || []} />
            </div>
          </div>
        </section>
        <section id="contacts" className="section container contacts-grid">
          <div>
            <p className="eyebrow">
              <span className="orange-line" /> 07 / КОНТАКТЫ
            </p>
            <h2>
              До встречи
              <br />
              на сервисе.
            </h2>
          </div>
          <div className="contact-details">
            <div>
              <MapPin />
              <span>
                <small>АДРЕС</small>
                {contact?.address}
              </span>
            </div>
            <div>
              <Clock />
              <span>
                <small>РЕЖИМ РАБОТЫ</small>
                {contact?.hours}
              </span>
            </div>
            <div>
              <Phone />
              <span>
                <small>ТЕЛЕФОН</small>
                <a href={`tel:${contact?.phone.replace(/[^\d+]/g, '') || ''}`}>{contact?.phone}</a>
              </span>
            </div>
          </div>
          <img src="/tires.webp" alt="Рабочая зона шиномонтажа DRIVECORE" loading="lazy" />
        </section>
      </main>
      <footer className="site-footer container">
        <Brand />
        <span>© {new Date().getFullYear()} DRIVECORE · Демонстрационный проект</span>
        <Link to="/crm">
          Вход для сотрудников <ArrowUpRight size={14} />
        </Link>
      </footer>
      {booking !== null && (
        <Modal title="Записаться на сервис" onClose={() => setBooking(null)}>
          <BookingForm services={services.data || []} initialService={booking} />
        </Modal>
      )}
    </div>
  );
}
