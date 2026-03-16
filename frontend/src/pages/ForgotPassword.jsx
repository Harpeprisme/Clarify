import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const ForgotPassword = () => {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-app)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none" style={{ margin: '0 auto 1rem' }}>
            <defs>
              <linearGradient id="registerGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1A2B3C"/>
                <stop offset="100%" stopColor="#2DE1C2"/>
              </linearGradient>
            </defs>
            <path d="M15 80 Q25 60 40 50 Q55 40 65 25 Q72 15 80 10" stroke="url(#registerGrad)" strokeWidth="14" strokeLinecap="round" fill="none"/>
            <circle cx="80" cy="10" r="8" fill="#2DE1C2"/>
          </svg>
          <h1 style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: '2rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>clarify</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {sent ? 'Vérifiez votre boîte mail' : 'Retrouvez l\'accès à votre compte'}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h2 style={{ color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 700, marginBottom: 12 }}>Email envoyé !</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 20 }}>
                Si <strong style={{ color: 'var(--accent-primary)' }}>{email}</strong> correspond à un compte, vous recevrez un lien de réinitialisation dans quelques instants.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Le lien est valable <strong style={{ color: 'var(--text-main)' }}>30 minutes</strong>. Pensez à vérifier vos spams.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ display: 'block', marginTop: 24, width: '100%', padding: '0.8rem', textDecoration: 'none', textAlign: 'center' }}>
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.85rem' }}>
                  {error}
                </div>
              )}

              {/* Info banner */}
              <div style={{ background: 'rgba(45,225,194,0.06)', border: '1px solid rgba(45,225,194,0.15)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>🔑</span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Entrez votre adresse email et nous vous enverrons un lien pour <strong style={{ color: 'var(--accent-primary)' }}>réinitialiser votre mot de passe</strong>.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Email</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.fr" required style={{ width: '100%' }}/>
              </div>
              
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }}>
                {loading ? 'Envoi en cours…' : '✉️ Envoyer le lien'}
              </button>
            </form>
          )}
        </div>

        {!sent && (
          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← Retour à la connexion
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
