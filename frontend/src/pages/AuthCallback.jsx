import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useStore from '../store';

/**
 * OAuth Callback — Handles the redirect from Google via the backend.
 * The backend redirects to /auth/callback?token=...&user=...
 * This page parses the params, stores them, and redirects to the dashboard.
 */
const AuthCallback = () => {
  const navigate       = useNavigate();
  const setUser        = useStore(s => s.setUser);
  const [params]       = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    const userStr = params.get('user');
    const error = params.get('error');

    if (error || !token || !userStr) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    try {
      // The backend already sends user as a JSON string, which is already URI encoded in the redirect.
      // useSearchParams already decodes the values for us.
      const user = JSON.parse(userStr);
      
      setUser(user, token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, [params, navigate, setUser]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-app)',
    }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Connexion en cours…</div>
        <div style={{ fontSize: '0.9rem' }}>Vous serez redirigé automatiquement.</div>
      </div>
    </div>
  );
};

export default AuthCallback;
