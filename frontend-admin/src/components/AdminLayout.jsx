import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAdminStore from '../store/adminStore';

const NAV_ITEMS = [
  { path: '/',          icon: '📊', label: 'Tableau de bord' },
  { path: '/orders',    icon: '📦', label: 'Commandes' },
  { path: '/b2b',       icon: '🏢', label: 'B2B & Séquestre' },
  { path: '/drivers',   icon: '🚛', label: 'Chauffeurs' },
  { path: '/clients',   icon: '👥', label: 'Clients' },
  { path: '/payments',  icon: '💰', label: 'Paiements' },
  { path: '/reviews',   icon: '⭐', label: 'Avis' },
  { path: '/report',    icon: '📊', label: 'Rapport mensuel' },
  { path: '/referrals', icon: '🤝', label: 'Parrainage' },
  { path: '/promos',    icon: '🎟️', label: 'Codes promo' },
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
          <span style={s.sidebarLogoIcon}>🚛</span>
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
                color: isActive ? '#FF6B00' : '#94a3b8',
                borderLeft: isActive ? '3px solid #FF6B00' : '3px solid transparent',
              })}
            >
              <span style={s.navIcon}>{item.icon}</span>
              {sidebarOpen && <span style={s.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Toggle + Logout */}
        <div style={s.sidebarBottom}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={s.toggleBtn}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
          {sidebarOpen && (
            <button onClick={handleLogout} style={s.logoutBtn}>
              ↩ Déconnexion
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
            <span style={s.adminBadge}>👤 {user?.full_name || 'Admin'}</span>
          </div>
        </header>
        <div style={s.content}>{children}</div>
      </main>
    </div>
  );
}

const s = {
  shell: { display: 'flex', minHeight: '100vh', background: '#0f172a' },
  sidebar: {
    background: '#1e293b',
    borderRight: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    overflow: 'hidden',
  },
  sidebarLogo: {
    padding: '20px 16px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '64px',
  },
  sidebarLogoIcon: { fontSize: '24px', flexShrink: 0 },
  sidebarLogoText: { fontSize: '18px', fontWeight: '800', color: '#FF6B00', whiteSpace: 'nowrap' },
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
  navIcon: { fontSize: '18px', flexShrink: 0 },
  navLabel: {},
  sidebarBottom: {
    padding: '12px',
    borderTop: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  toggleBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  logoutBtn: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    padding: '0 24px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  topbarTitle: { color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 },
  topbarRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  adminBadge: { color: '#94a3b8', fontSize: '13px' },
  content: { flex: 1, padding: '24px', overflow: 'auto' },
};
