import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import useStore from '../store';

const Register = () => {
  const navigate = useNavigate();
  const setUser  = useStore(s => s.setUser);

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!PASSWORD_REGEX.test(password)) {
      setError('Le mot de passe doit contenir 8 caractères min., majuscule, minuscule, chiffre et caractère spécial.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      setUser(data.user, data.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du compte');
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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Créez votre espace personnel</p>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Nom complet</label>
              <input className="input" type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Jean Dupont" required style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.fr" required style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Mot de passe</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="8 caractères minimum" required style={{ width: '100%' }}/>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Confirmer le mot de passe</label>
              <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" required style={{ width: '100%' }}/>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: '600', textDecoration: 'none' }}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
