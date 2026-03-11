import React from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store';

const TopBar = () => {
  const { darkMode, toggleDarkMode, user } = useStore();
  const avatarInitial = user?.name?.charAt(0).toUpperCase() || '?';

  return (
    <header style={{
      height: '70px',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      flexShrink: 0
    }}>
      <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
        {/* Placeholder for future global search if needed */}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button 
          onClick={toggleDarkMode}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-app)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          title={darkMode ? "Passer au thème clair" : "Passer au thème sombre"}
        >
          {darkMode ? (
            <svg className="w-6 h-6" style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border-light)' }} />

        <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', boxShadow: 'var(--shadow-lvl1)' }}/>
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '1.1rem',
              boxShadow: 'var(--shadow-lvl1)'
            }}>
              {avatarInitial}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>{user?.name || 'Profil'}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role}</span>
          </div>
        </Link>
      </div>
    </header>
  );
};

export default TopBar;
