import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';

const ResetPassword = () => {
  const [params]    = useSearchParams();
  const navigate    = useNavigate();
  const token       = params.get('token') || '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 8)  { setError('8 caractères minimum.'); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Lien invalide ou expiré. Faites une nouvelle demande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-app)', padding: '2rem'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-1px' }}>
            <span style={{ color: 'var(--accent-primary)' }}>✦</span>
            <span style={{ color: 'var(--text-main)', marginLeft: '0.5rem' }}>Clarify</span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2.5rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)' }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Mot de passe mis à jour !</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Redirection vers la connexion dans quelques secondes…
              </p>
              <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
                Se connecter →
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ color: 'var(--text-main)', fontWeight: 700, marginBottom: '0.5rem' }}>Nouveau mot de passe</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Choisissez un mot de passe sécurisé.
              </p>

              {/* Password requirements */}
              <div style={{ background: 'rgba(45,225,194,0.06)', border: '1px solid rgba(45,225,194,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exigences du mot de passe</p>
                {[
                  { label: 'Au moins 8 caractères', ok: password.length >= 8 },
                  { label: 'Une lettre majuscule (A-Z)', ok: /[A-Z]/.test(password) },
                  { label: 'Une lettre minuscule (a-z)', ok: /[a-z]/.test(password) },
                  { label: 'Un chiffre (0-9)', ok: /\d/.test(password) },
                  { label: 'Un caractère spécial (!@#$…)', ok: /[\W_]/.test(password) },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: password ? (r.ok ? '#2DE1C2' : '#ff6b6b') : 'var(--text-muted)', marginTop: 4, transition: 'color 0.2s' }}>
                    <span style={{ fontSize: 12 }}>{password ? (r.ok ? '✅' : '❌') : '○'}</span>
                    {r.label}
                  </div>
                ))}
              </div>

              {!token && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem' }}>
                  Lien invalide. <Link to="/forgot-password" style={{ color: 'var(--danger)', fontWeight: 600 }}>Faire une nouvelle demande</Link>
                </div>
              )}

              {error && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                  {confirm && confirm !== password && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#ff6b6b' }}>❌ Les mots de passe ne correspondent pas</p>
                  )}
                  {confirm && confirm === password && password.length > 0 && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#2DE1C2' }}>✅ Les mots de passe correspondent</p>
                  )}
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading || !token} style={{ width: '100%', height: '46px' }}>
                  {loading ? 'Enregistrement…' : '🔐 Créer mon mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
