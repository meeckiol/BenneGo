import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, ChartSpline, ChevronDown, ChevronLeft, ChevronRight, CreditCard, FileChartColumn, Gift, IdCard,
  LayoutDashboard, LogOut, Menu, MessageCircle, Package, Scale, Search, Settings, Star, Ticket, TrendingUp, Users,
  Wrench, X,
} from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import useAdminStore from '../store/adminStore';
import { initials } from '../utils/format';
import { t } from '../../../shared/i18n/dom';
import './layout.css';

// Menu en rubriques ; « badge » renvoie au compteur de GET /api/admin/badges (ce qui attend une action)
const SECTIONS = [
  { id: 'pilotage', title: 'Pilotage', items: [
    { path: '/', Icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/analytics', Icon: ChartSpline, label: 'Analyses' },
    { path: '/report', Icon: FileChartColumn, label: 'Rapport mensuel' },
  ] },
  { id: 'operations', title: 'Opérations', items: [
    { path: '/orders', Icon: Package, label: 'Commandes', badge: 'orders', hint: 'Commandes payées sans chauffeur depuis 30 min' },
    { path: '/messages', Icon: MessageCircle, label: 'Messagerie' },
    { path: '/disputes', Icon: Scale, label: 'Litiges', badge: 'disputes', hint: 'Litiges ouverts', tone: 'danger' },
    { path: '/reliefs', Icon: Wrench, label: 'Pannes & relèves', badge: 'reliefs', hint: 'Pannes à relever', tone: 'danger' },
  ] },
  { id: 'comptes', title: 'Comptes', items: [
    { path: '/clients', Icon: Users, label: 'Clients' },
    { path: '/drivers', Icon: IdCard, label: 'Chauffeurs', badge: 'drivers', hint: 'Chauffeurs à vérifier' },
    { path: '/b2b', Icon: Building2, label: 'B2B & Séquestre' },
  ] },
  { id: 'finances', title: 'Finances', items: [
    { path: '/payments', Icon: CreditCard, label: 'Paiements', badge: 'payments', hint: 'Versements aux chauffeurs à faire' },
    { path: '/referrals', Icon: Gift, label: 'Parrainage', badge: 'referrals', hint: 'Retraits de crédit demandés' },
    { path: '/promos', Icon: Ticket, label: 'Codes promo' },
  ] },
  { id: 'marche', title: 'Qualité & marché', items: [
    { path: '/reviews', Icon: Star, label: 'Avis' },
    { path: '/barometer', Icon: TrendingUp, label: 'Baromètre BTP' },
  ] },
  { id: 'compte', title: 'Compte', items: [
    { path: '/settings', Icon: Settings, label: 'Réglages' },
  ] },
];
const ALL_ITEMS = SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title })));

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ } },
};

const fold = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Compteurs du menu, rafraîchis en temps réel et toutes les 2 minutes. */
function useBadges() {
  const [badges, setBadges] = useState({});
  const load = useCallback(() => api.get('/admin/badges').then(({ data }) => setBadges(data)).catch(() => {}), []);
  useEffect(() => {
    load();
    const socket = getSocket();
    socket?.on('analytics_changed', load);
    const timer = setInterval(load, 2 * 60 * 1000);
    return () => { clearInterval(timer); socket?.off('analytics_changed', load); };
  }, [load]);
  return badges;
}

export default function AdminLayout({ children }) {
  const [open, setOpen] = useState(() => store.get('bennego-admin-menu-open', true));
  const [folded, setFolded] = useState(() => store.get('bennego-admin-menu-folded', {}));
  const [mobile, setMobile] = useState(false);
  const [filter, setFilter] = useState('');
  const [bell, setBell] = useState(false);
  const logout = useAdminStore((s) => s.logout);
  const user = useAdminStore((s) => s.user);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const badges = useBadges();
  const searchRef = useRef(null);

  useEffect(() => { store.set('bennego-admin-menu-open', open); }, [open]);
  useEffect(() => { store.set('bennego-admin-menu-folded', folded); }, [folded]);
  // Sur téléphone, le menu se referme après chaque navigation
  useEffect(() => { setMobile(false); setBell(false); }, [pathname]);

  // Ctrl+K (ou ⌘K) : chercher une rubrique du menu
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        // Sur petit écran, le menu est un tiroir : on l'ouvre pour montrer la recherche
        if (window.matchMedia?.('(max-width: 900px)').matches) setMobile(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') { setMobile(false); setBell(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = ALL_ITEMS.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)));
  const todo = ALL_ITEMS.filter((item) => item.badge && badges[item.badge] > 0);
  const todoTotal = todo.reduce((a, item) => a + badges[item.badge], 0);

  const sections = useMemo(() => {
    const q = fold(filter.trim());
    if (!q) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => fold(t(item.label)).includes(q) || fold(item.label).includes(q) || fold(t(section.title)).includes(q)),
    })).filter((section) => section.items.length);
  }, [filter]);

  const onSearchKey = (e) => {
    if (e.key === 'Enter' && sections[0]?.items[0]) {
      navigate(sections[0].items[0].path);
      setFilter('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const expanded = open || mobile;

  return (
    <div className={`adm${expanded ? '' : ' adm--mini'}${mobile ? ' adm--drawer' : ''}`}>
      {mobile && <button type="button" className="adm-scrim" aria-label="Fermer le menu" onClick={() => setMobile(false)} />}

      <aside className="adm-side" aria-label="Menu de la console">
        <div className="adm-brand">
          <img src="/logo-icon.png" alt="" width="30" height="30" />
          {expanded && <span translate="no">BenneGo<small>Console admin</small></span>}
          {mobile && (
            <button type="button" className="adm-icon-btn adm-brand__close" aria-label="Fermer le menu" onClick={() => setMobile(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {expanded && (
          <label className="adm-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Aller à…"
              aria-label="Rechercher une rubrique"
            />
            <kbd>Ctrl K</kbd>
          </label>
        )}

        <nav className="adm-nav">
          {sections.map((section) => {
            const isFolded = !filter && folded[section.id];
            const sectionCount = section.items.reduce((a, item) => a + (item.badge ? badges[item.badge] || 0 : 0), 0);
            return (
              <div key={section.id} className="adm-section">
                {expanded ? (
                  <button
                    type="button"
                    className="adm-section__title"
                    aria-expanded={!isFolded}
                    onClick={() => setFolded((f) => ({ ...f, [section.id]: !f[section.id] }))}
                  >
                    <span>{section.title}</span>
                    {isFolded && sectionCount > 0 && <span className="adm-badge">{sectionCount}</span>}
                    <ChevronDown size={14} aria-hidden="true" className={isFolded ? 'is-folded' : ''} />
                  </button>
                ) : <hr className="adm-section__rule" />}
                {!isFolded && section.items.map((item) => {
                  const count = item.badge ? badges[item.badge] || 0 : 0;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) => `adm-link${isActive ? ' is-active' : ''}`}
                      title={expanded ? (count ? `${t(item.hint)} : ${count}` : undefined) : t(item.label)}
                    >
                      <item.Icon size={18} aria-hidden="true" />
                      {expanded && <span className="adm-link__label">{item.label}</span>}
                      {count > 0 && (
                        <span className={`adm-badge${item.tone === 'danger' ? ' adm-badge--danger' : ''}`}
                          aria-label={`${count} : ${t(item.hint)}`}>{count > 99 ? '99+' : count}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
          {!sections.length && <p className="adm-nav__empty">Aucune rubrique</p>}
        </nav>

        <div className="adm-foot">
          <div className="adm-me">
            <span className="adm-avatar" aria-hidden="true">{initials(user?.full_name || 'Admin')}</span>
            {expanded && (
              <span className="adm-me__text">
                <strong translate="no">{user?.full_name || 'Admin'}</strong>
                <small>{user?.phone ? <span translate="no">{user.phone}</span> : 'Administrateur'}</small>
              </span>
            )}
          </div>
          <div className="adm-foot__actions">
            {!mobile && (
              <button type="button" className="adm-icon-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Réduire le menu' : 'Agrandir le menu'}>
                {open ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              </button>
            )}
            <button type="button" className="adm-logout" onClick={handleLogout} aria-label="Déconnexion" title="Déconnexion">
              <LogOut size={16} aria-hidden="true" />{expanded && <span>Déconnexion</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="adm-main">
        <header className="adm-top">
          <button type="button" className="adm-icon-btn adm-burger" aria-label="Ouvrir le menu" onClick={() => setMobile(true)}>
            <Menu size={18} aria-hidden="true" />
          </button>
          <div className="adm-top__title">
            <nav aria-label="Fil d'Ariane" className="adm-crumbs">
              <Link to="/">Console</Link>
              {current && current.path !== '/' && <><span aria-hidden="true">/</span><span>{current.section}</span></>}
            </nav>
            <h1>{current?.label || 'BenneGo Admin'}</h1>
          </div>
          <div className="adm-top__right">
            <div className="adm-bell">
              <button type="button" className="adm-icon-btn" aria-expanded={bell} aria-label="À traiter" onClick={() => setBell(!bell)}>
                <Bell size={18} aria-hidden="true" />
                {todoTotal > 0 && <span className="adm-bell__dot">{todoTotal > 99 ? '99+' : todoTotal}</span>}
              </button>
              {bell && (
                <div className="adm-bell__panel" role="dialog" aria-label="À traiter">
                  <p className="adm-bell__title">À traiter</p>
                  {todo.length ? todo.map((item) => (
                    <Link key={item.path} to={item.path} className="adm-bell__item">
                      <item.Icon size={16} aria-hidden="true" />
                      <span>{item.hint}</span>
                      <b>{badges[item.badge]}</b>
                    </Link>
                  )) : <p className="adm-bell__empty">Rien en attente 🎉</p>}
                </div>
              )}
            </div>
            <span className="adm-top__me">
              <span className="adm-avatar adm-avatar--sm" aria-hidden="true">{initials(user?.full_name || 'Admin')}</span>
              <span translate="no">{user?.full_name || 'Admin'}</span>
            </span>
          </div>
        </header>
        {/* Zone défilante : accessible au clavier pour pouvoir la faire défiler sans souris */}
        <div className="adm-content" tabIndex={0}>{children}</div>
      </main>
    </div>
  );
}
