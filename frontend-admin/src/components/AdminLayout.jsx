import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Building2, ChevronLeft, ChevronRight, CreditCard, FileChartColumn, Gift, IdCard, LayoutDashboard,
  LogOut, Package, Scale, Star, Ticket, TrendingUp, Users, Wrench,
} from 'lucide-react';
import useAdminStore from '../store/adminStore';

const NAV_ITEMS = [
  { path: '/',          Icon: LayoutDashboard, label: 'Tableau de bord' },
  { path: '/orders',    Icon: Package,         label: 'Commandes' },
  { path: '/b2b',       Icon: Building2,       label: 'B2B & Séquestre' },
  { path: '/drivers',   Icon: IdCard,          label: 'Chauffeurs' },
  { path: '/clients',   Icon: Users,           label: 'Clients' },
  { path: '/payments',  Icon: CreditCard,      label: 'Paiements' },
  { path: '/reviews',   Icon: Star,            label: 'Avis' },
  { path: '/report',    Icon: FileChartColumn, label: 'Rapport mensuel' },
  { path: '/referrals', Icon: Gift,            label: 'Parrainage' },
  { path: '/disputes',  Icon: Scale,           label: 'Litiges' },
  { path: '/reliefs',   Icon: Wrench,          label: 'Pannes & relèves' },
  { path: '/barometer', Icon: TrendingUp,      label: 'Baromètre BTP' },
  { path: '/promos',    Icon: Ticket,          label: 'Codes promo' },
];


export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const logout = useAdminStore((s) => s.logout);
  const user = useAdminStore((s) => s.user);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={{ ...s.sidebar, width: sidebarOpen ? '220px' : '64px' }}>
        {/* Logo */}
        <div style={s.sidebarLogo}>
          <img src="/logo-icon.png" alt="BenneGo" style={{ width: 28, height: 28, borderRadius: 6, marginRight: 8 }} />
          {sidebarOpen && <span style={s.sidebarLogoText}>BenneGo</span>}
        </div>

        {/* Navigation */}
        <nav style={s.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                ...s.navItem,
                background: isActive ? 'rgba(255,107,0,0.15)' : 'transparent',
                color: isActive ? 'var(--brand-ink)' : 'var(--text-2)',
                borderLeft: isActive ? '3px solid #FF6B00' : '3px solid transparent',
              })}
            >
              <span style={s.navIcon}><item.Icon size={18} aria-hidden="true" /></span>
              {sidebarOpen && <span style={s.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Toggle + Logout */}
        <div style={s.sidebarBottom}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={s.toggleBtn} aria-label={sidebarOpen ? 'Réduire le menu' : 'Agrandir le menu'}>
            {sidebarOpen ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
          {sidebarOpen && (
            <button onClick={handleLogout} style={s.logoutBtn}>
              <LogOut size={16} aria-hidden="true" /> Déconnexion
            </button>
          )}
        </div>
      </aside>

      {/* Contenu principal */}
      <main style={s.main}>
        {/* Topbar */}
        <header style={s.topbar}>
          <h1 style={s.topbarTitle}>
            {NAV_ITEMS.find((n) => window.location.pathname === n.path)?.label || 'BenneGo Admin'}
          </h1>
          <div style={s.topbarRight}>
            <span style={s.adminBadge}>{user?.full_name || 'Admin'}</span>
          </div>
        </header>
        {/* Zone défilante : accessible au clavier pour pouvoir la faire défiler sans souris */}
        <div style={s.content} tabIndex={0}>{children}</div>
      </main>
    </div>
  );
}

const s = {
  shell: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  sidebar: {
    background: 'var(--surface)',
    borderRight: '1px solid var(--border-2)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    overflow: 'hidden',
  },
  sidebarLogo: {
    padding: '20px 16px',
    borderBottom: '1px solid var(--border-2)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '64px',
  },
  sidebarLogoIcon: { fontSize: '24px', flexShrink: 0 },
  sidebarLogoText: { fontSize: '18px', fontWeight: '800', color: 'var(--brand-ink)', whiteSpace: 'nowrap' },
  nav: { flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '2px' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  navIcon: { display: 'flex', flexShrink: 0 },
  navLabel: {},
  sidebarBottom: {
    padding: '12px',
    borderTop: '1px solid var(--border-2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  toggleBtn: { background: 'rgba(17, 24, 39, 0.05)', border: '1px solid var(--border-2)', color: 'var(--text-3)', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border-2)',
    padding: '0 24px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  topbarTitle: { color: 'var(--text-strong)', fontSize: '18px', fontWeight: '700', margin: 0 },
  topbarRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  adminBadge: { color: 'var(--text-3)', fontSize: '13px' },
  content: { flex: 1, padding: '24px', overflow: 'auto' },
};
