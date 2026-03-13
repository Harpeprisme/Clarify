import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import useStore from '../store';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token manquant');
      return;
    }

    api.post('/auth/verify-email', { token })
      .then(res => {
        setStatus('success');
        setMessage(res.data.message);
        // Automatically refresh user in store if logged in
        const currentToken = localStorage.getItem('openbank_token');
        if (currentToken && res.data.user) {
           setUser(res.data.user, currentToken);
        }
        setTimeout(() => navigate('/profile'), 3000);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Erreur de vérification');
      });
  }, [token, navigate, setUser]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-app)', color: 'var(--text-main)'
    }}>
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <h1 className="title" style={{ fontSize: '1.5rem', marginBottom: '1rem', border: 'none' }}>Vérification de l'email</h1>
        {status === 'loading' && <p>Verification en cours...</p>}
        {status === 'success' && <p style={{ color: 'var(--success)', fontWeight: 'bold' }}>✅ {message}<br/><span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Redirection en cours...</span></p>}
        {status === 'error' && <p style={{ color: 'var(--danger)', fontWeight: 'bold' }}>❌ {message}</p>}
        {status !== 'loading' && (
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary w-full mt-4">
            Retour à l'accueil
          </button>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
