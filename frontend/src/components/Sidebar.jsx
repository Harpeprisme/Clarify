import React from 'react';
import { NavLink } from 'react-router-dom';
import useStore from '../store';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { path: '/transactions', label: 'Transactions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { path: '/import', label: 'Importer CSV', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { path: '/charts', label: 'Graphiques', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z' },
  { path: '/budget', label: 'Budgets', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { path: '/analysis', label: 'Analyse', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { path: '/bourse', label: 'Bourse', icon: 'M3 3v18h18 M9 14l4-4 4 4 4-8' },
];

const Sidebar = () => {
  const user = useStore(s => s.user);

  const avatarInitial = user?.name?.charAt(0).toUpperCase() || '?';

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-header">
        <svg width="36" height="36" viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="clarifyGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1A2B3C" />
              <stop offset="100%" stopColor="#2DE1C2" />
            </linearGradient>
            <linearGradient id="clarifyGradDark" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0B1521" />
              <stop offset="100%" stopColor="#25C9AD" />
            </linearGradient>
          </defs>
          <path d="M 10 85 L 35 30 A 10 10 0 0 1 50 35 L 35 85 Z" fill="url(#clarifyGradDark)" opacity="0.9" />
          <path d="M 25 85 L 50 30 A 10 10 0 0 1 65 35 L 50 85 Z" fill="url(#clarifyGrad)" opacity="0.95" />
          <path d="M 40 85 L 75 15 A 8 8 0 0 1 90 20 L 70 85 Z" fill="url(#clarifyGrad)" />
        </svg>
        <div className="sidebar-brand-name">
          clar
          <span style={{ position: 'relative', display: 'inline-block' }}>
            ı
            <span style={{
              position: 'absolute', top: '0.1em', left: '45%',
              width: '6px', height: '7px',
              backgroundColor: 'var(--electric-mint)',
              transform: 'translateX(-50%) rotate(15deg) skewX(-10deg)',
              borderRadius: '1px'
            }} />
          </span>
          fy
        </div>
      </div>

      {/* Nav Links */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer: Profile link only */}
      <div className="sidebar-footer">
        <NavLink to="/profile" className={({ isActive }) => `sidebar-profile-link ${isActive ? 'active' : ''}`}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div className="sidebar-avatar">{avatarInitial}</div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <div className="nav-label sidebar-user-name">{user?.name || 'Profil'}</div>
            <div className="nav-label sidebar-user-role">{user?.role}</div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
