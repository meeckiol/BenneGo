import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAdminStore from '../store/adminStore';

const NAV_ITEMS = [
  { path: '/',          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>, label: 'Tableau de bord' },
  { path: '/orders',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 7l-8-4-8 4v10l8 4 8-4V7zm-8 2.2L6.3 7 12 4.2 17.7 7 12 9.2z"/></svg>, label: 'Commandes' },
  { path: '/b2b',       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>, label: 'B2B & Séquestre' },
  { path: '/drivers',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-2 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>, label: 'Chauffeurs' },
  { path: '/clients',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>, label: 'Clients' },
  { path: '/payments',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>, label: 'Paiements' },
  { path: '/reviews',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>, label: 'Avis' },
  { path: '/report',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2V7h2v10zm4 0h-2v-4h2v4zm-8 0H6v-7h2v7z"/></svg>, label: 'Rapport mensuel' },
  { path: '/referrals', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>, label: 'Parrainage' },
  { path: '/promos',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/></svg>, label: 'Codes promo' },
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
            <span style={s.adminBadge}>{user?.full_name || 'Admin'}</span>
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
