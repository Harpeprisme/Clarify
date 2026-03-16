import React, { useState, useRef, useEffect } from 'react';
import useStore from '../store';

const PRESETS = [
  { key: '1M',  label: '1 mois' },
  { key: '3M',  label: '3 mois' },
  { key: '6M',  label: '6 mois' },
  { key: 'YTD', label: 'YTD' },
  { key: 'ALL', label: 'Tout' },
  { key: 'CUSTOM', label: 'Personnalisé' },
];

const ACCOUNT_TYPES = [
  { key: 'ALL', label: 'Tous' },
  { key: 'COURANT', label: 'Courant' },
  { key: 'EPARGNE', label: 'Épargne' },
  { key: 'INVESTISSEMENT', label: 'Investissement' },
  { key: 'CREDIT', label: 'Crédit' },
];

const GlobalFilterBar = () => {
  const filterPreset = useStore(state => state.filterPreset);
  const filterDateFrom = useStore(state => state.filterDateFrom);
  const filterDateTo = useStore(state => state.filterDateTo);
  const filterAccountIds = useStore(state => state.filterAccountIds);
  const filterAccountType = useStore(state => state.filterAccountType);
  const setFilterPreset = useStore(state => state.setFilterPreset);
  const setFilterCustomRange = useStore(state => state.setFilterCustomRange);
  const setFilterAccountType = useStore(state => state.setFilterAccountType);
  const toggleFilterAccount = useStore(state => state.toggleFilterAccount);
  const clearFilterAccounts = useStore(state => state.clearFilterAccounts);
  const accounts = useStore(state => state.accounts);

  const [showCustom, setShowCustom] = useState(filterPreset === 'CUSTOM');
  const [customFrom, setCustomFrom] = useState(filterDateFrom);
  const [customTo,   setCustomTo]   = useState(filterDateTo);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const menuRef = useRef();

  // Close account dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePreset = (key) => {
    if (key === 'CUSTOM') {
      setShowCustom(true);
      setFilterPreset('CUSTOM');
    } else {
      setShowCustom(false);
      setFilterPreset(key);
    }
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setFilterCustomRange(customFrom, customTo);
    }
  };

  // Helper for type matching (mirrors store logic)
  // No longer needed since we use accountTypes directly


  // Filter accounts based on type
  const accountTypes = useStore(state => state.accountTypes);
  const filteredAccounts = accounts.filter(acc => {
    if (filterAccountType === 'ALL') return true;
    const typeDef = accountTypes.find(t => t.id === acc.type);
    const group = typeDef ? typeDef.group : null;
    return group === filterAccountType;
  });

  // Label for account button
  const accountLabel = filterAccountIds.length === 0
    ? `Tous (${filterAccountType === 'ALL' ? 'comptes' : (ACCOUNT_TYPES.find(t => t.key === filterAccountType)?.label || filterAccountType)})`
    : filterAccountIds.length === 1
      ? accounts.find(a => a.id === filterAccountIds[0])?.name ?? '1 compte'
      : `${filterAccountIds.length} comptes`;

  const pill = (active) => ({
    padding: '0.35rem 0.85rem',
    borderRadius: '20px',
    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-light)'}`,
    background: active ? 'var(--accent-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: active ? '600' : '400',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-light)',
      padding: '0.55rem 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      {/* Time label */}
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>
        Période
      </span>

      {/* Preset pills */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.key} style={pill(filterPreset === p.key)} onClick={() => handlePreset(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {(showCustom || filterPreset === 'CUSTOM') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
          />
          <button onClick={handleCustomApply} style={{ ...pill(false), borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
            Appliquer
          </button>
        </div>
      )}

      {/* Separator */}
      <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-light)', margin: '0 0.25rem' }} />

      {/* Type selection */}
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>
        Type
      </span>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {ACCOUNT_TYPES.map(t => (
          <button key={t.key} style={pill(filterAccountType === t.key)} onClick={() => setFilterAccountType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-light)', margin: '0 0.25rem' }} />

      {/* Account label */}
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>
        Compte
      </span>

      {/* Account multi-select dropdown */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowAccountMenu(v => !v)}
          style={{
            ...pill(filterAccountIds.length > 0),
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          {filterAccountIds.length > 0 && (
            <span style={{
              width: '16px', height: '16px', borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: '700',
            }}>
              {filterAccountIds.length}
            </span>
          )}
          {accountLabel}
          <svg style={{ width: 12, height: 12, transition: 'transform 0.15s', transform: showAccountMenu ? 'rotate(180deg)' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAccountMenu && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 100,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: '220px',
            overflow: 'hidden',
          }}>
            {/* "All accounts" option */}
            <button
              onClick={() => { clearFilterAccounts(); setShowAccountMenu(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                width: '100%', padding: '0.7rem 1rem',
                background: filterAccountIds.length === 0 ? 'var(--bg-app)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border-light)',
                cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.88rem',
                fontWeight: filterAccountIds.length === 0 ? '600' : '400',
              }}
            >
              <span style={{
                width: '16px', height: '16px', borderRadius: '4px',
                border: `2px solid ${filterAccountIds.length === 0 ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                background: filterAccountIds.length === 0 ? 'var(--accent-primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {filterAccountIds.length === 0 && <svg style={{ width: 10, height: 10 }} fill="white" viewBox="0 0 20 20"><path d="M16.7 5.3a1 1 0 00-1.4 0L8 12.6 4.7 9.3a1 1 0 00-1.4 1.4l4 4a1 1 0 001.4 0l8-8a1 1 0 000-1.4z"/></svg>}
              </span>
              Tous les comptes
            </button>

            {/* Individual accounts - filtered */}
            {filteredAccounts.map(acc => {
              const isSelected = filterAccountIds.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  onClick={() => toggleFilterAccount(acc.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    width: '100%', padding: '0.7rem 1rem',
                    background: isSelected ? 'var(--bg-app)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.88rem',
                    fontWeight: isSelected ? '600' : '400',
                  }}
                >
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '4px',
                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                    background: isSelected ? 'var(--accent-primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {isSelected && <svg style={{ width: 10, height: 10 }} fill="white" viewBox="0 0 20 20"><path d="M16.7 5.3a1 1 0 00-1.4 0L8 12.6 4.7 9.3a1 1 0 00-1.4 1.4l4 4a1 1 0 001.4 0l8-8a1 1 0 000-1.4z"/></svg>}
                  </span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div>{acc.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {accountTypes.find(t => t.id === acc.type)?.name || acc.type}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredAccounts.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Aucun compte de ce type
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active filter summary badge removed */}
    </div>
  );
};

export default GlobalFilterBar;
