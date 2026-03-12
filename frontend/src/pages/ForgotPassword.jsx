import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const ForgotPassword = () => {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

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
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
              <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Email envoyé !</h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Si <strong style={{ color: 'var(--text-main)' }}>{email}</strong> correspond à un compte, vous recevrez un lien de réinitialisation dans quelques instants. Vérifiez vos spams.
              </p>
              <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ color: 'var(--text-main)', fontWeight: 700, marginBottom: '0.5rem' }}>Mot de passe oublié</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Entrez votre email et nous vous enverrons un lien de réinitialisation valable 30 minutes.
              </p>

              {error && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                  Adresse email
                </label>
                <input
                  type="email"
                  className="input"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', marginBottom: '1.25rem' }}
                />
                <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ width: '100%', height: '46px' }}>
                  {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textDecoration: 'none' }}>
                  ← Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
