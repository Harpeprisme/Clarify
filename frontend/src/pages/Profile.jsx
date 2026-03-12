import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Card from '../components/Card';
import UsersManagement from '../components/UsersManagement';
import useStore from '../store';

const Profile = () => {
  const navigate  = useNavigate();
  const user      = useStore(s => s.user);
  const setUser   = useStore(s => s.setUser);

  const [activeTab, setActiveTab] = useState('profile');

  // Profile editing
  const [name,    setName]    = useState(user?.name || '');
  const [nameMsg, setNameMsg] = useState('');

  // Password change
  const [oldPwd,  setOldPwd]  = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [cfmPwd,  setCfmPwd]  = useState('');
  const [pwdMsg,  setPwdMsg]  = useState('');

  // Misc
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const fmt = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  if (!user) { navigate('/login'); return null; }

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameMsg('');
    try {
      const { data } = await api.patch('/auth/profile', { name });
      setUser(data, localStorage.getItem('openbank_token'));
      setNameMsg('✅ Nom mis à jour');
    } catch (err) {
      setNameMsg('❌ ' + (err.response?.data?.error || 'Erreur'));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    if (newPwd !== cfmPwd) { setPwdMsg('❌ Les mots de passe ne correspondent pas'); return; }
    if (newPwd.length < 8)  { setPwdMsg('❌ 8 caractères minimum'); return; }
    try {
      await api.post('/auth/change-password', { currentPassword: oldPwd, newPassword: newPwd });
      setPwdMsg('✅ Mot de passe mis à jour');
      setOldPwd(''); setNewPwd(''); setCfmPwd('');
    } catch (err) {
      setPwdMsg('❌ ' + (err.response?.data?.error || 'Erreur'));
    }
  };

  const handleLogout = () => {
    setUser(null, null);
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/auth/account');
      setUser(null, null);
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const avatarInitial = user.name?.charAt(0).toUpperCase() || '?';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Header with tab toggle for admins */}
      <div className="flex justify-between items-end mb-6">
        <h1 className="title" style={{ marginBottom: 0 }}>Mon Compte</h1>

        {user.role === 'ADMIN' && (
          <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem', borderRadius: '16px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}>
            {[
              { key: 'profile', label: 'Mon Profil' },
              { key: 'users',   label: 'Équipe & Accès' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.5rem 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  transition: 'all 0.25s ease',
                  background: activeTab === tab.key ? 'var(--accent-gradient)' : 'transparent',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? '0 4px 14px rgba(45,225,194,0.3)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'users' ? (
        <UsersManagement />
      ) : (
        <>
          {/* Identity Card */}
          <Card style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', boxShadow: 'var(--shadow-lvl1)' }}/>
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: '700', color: '#fff', boxShadow: 'var(--shadow-lvl1)', flexShrink: 0 }}>
                  {avatarInitial}
                </div>
              )}
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.25rem', color: 'var(--text-main)' }}>{user.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{user.email}</div>
                <span className={`badge ${user.role === 'ADMIN' ? 'badge-info' : 'badge-success'}`}>{user.role}</span>
                {user.googleId && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', background: 'var(--bg-app)', borderRadius: '20px', border: '1px solid var(--border-light)' }}>
                    🔗 Lié à Google
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Edit Name */}
          <Card title="Informations personnelles" style={{ marginBottom: '1.5rem' }}>
            {nameMsg && (
              <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', background: nameMsg.startsWith('✅') ? 'var(--success-bg)' : 'var(--danger-bg)', color: nameMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', fontSize: '0.88rem' }}>
                {nameMsg}
              </div>
            )}
            <form onSubmit={handleSaveName} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Nom affiché</label>
                <input className="input" type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%' }}/>
              </div>
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Enregistrer</button>
            </form>
          </Card>

          {/* Change Password */}
          <Card title="Sécurité — Changer de mot de passe" style={{ marginBottom: '1.5rem' }}>
            {pwdMsg && (
              <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', background: pwdMsg.startsWith('✅') ? 'var(--success-bg)' : 'var(--danger-bg)', color: pwdMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', fontSize: '0.88rem' }}>
                {pwdMsg}
              </div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!user.googleId || user.passwordHash ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Mot de passe actuel</label>
                  <input className="input" type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ width: '100%' }}/>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Définissez un mot de passe pour utiliser l'application sans Google.</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Nouveau mot de passe</label>
                  <input className="input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="8 caractères min." style={{ width: '100%' }}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Confirmation</label>
                  <input className="input" type="password" value={cfmPwd} onChange={e => setCfmPwd(e.target.value)} placeholder="••••••••" style={{ width: '100%' }}/>
                </div>
              </div>
              <div>
                <button type="submit" className="btn btn-primary">Mettre à jour le mot de passe</button>
              </div>
            </form>
          </Card>

          {/* Danger Zone */}
          <Card title="Déconnexion & Suppression" style={{ borderColor: 'rgba(255,107,107,0.3)' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Se déconnecter
              </button>
              <div style={{ flex: 1 }}/>
              {!deleteConfirm ? (
                <button onClick={() => setDeleteConfirm(true)} style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                  ⚠️ Supprimer mon compte
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>Supprimer définitivement ?</span>
                  <button onClick={handleDeleteAccount} style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>Confirmer</button>
                  <button onClick={() => setDeleteConfirm(false)} style={{ background: 'transparent', border: '1px solid var(--border-light)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default Profile;
