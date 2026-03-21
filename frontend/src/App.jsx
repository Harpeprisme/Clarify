import React, { useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import useStore from './store';
import api from './api';

import Dashboard    from './pages/Dashboard';
import Import       from './pages/Import';
import Transactions from './pages/Transactions';
import Charts       from './pages/Charts';
import Budget       from './pages/Budget';
import Bourse       from './pages/Bourse';
import Analysis     from './pages/Analysis';
import Forecasts    from './pages/Forecasts';
import Settings     from './pages/Settings';
import Profile      from './pages/Profile';
import Login        from './pages/Login';
import Register     from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import VerifyEmail    from './pages/VerifyEmail';

// Session timeout in ms (env var or default 10 minutes)
const SESSION_TIMEOUT = parseInt(import.meta.env.VITE_SESSION_TIMEOUT || '600000', 10);

// Real auth guard — redirects to /login if no user token
const PrivateRoute = ({ children }) => {
  const user  = useStore(state => state.user);
  const token = localStorage.getItem('openbank_token');
  return (user && token) ? children : <Navigate to="/login" replace />;
};

// Guest-only guard — already logged in users are redirected away from login/register
const GuestRoute = ({ children }) => {
  const user  = useStore(state => state.user);
  const token = localStorage.getItem('openbank_token');
  return (user && token) ? <Navigate to="/dashboard" replace /> : children;
};

const App = () => {
  const setUser = useStore(state => state.setUser);
  const user    = useStore(state => state.user);
  const timerRef = useRef(null);

  // On every app load, refresh the user profile from the server to get fresh role/data.
  useEffect(() => {
    const token = localStorage.getItem('openbank_token');
    if (!token) return;
    api.get('/auth/me')
      .then(({ data }) => {
        if (data.mustChangePassword) {
          // Force them back to login to change password
          localStorage.removeItem('openbank_token');
          localStorage.removeItem('openbank_user');
          setUser(null, null);
          return;
        }
        localStorage.setItem('openbank_user', JSON.stringify(data));
        setUser(data, token);
        useStore.getState().fetchAccountTypes();
      })
      .catch(() => {
        localStorage.removeItem('openbank_token');
        localStorage.removeItem('openbank_user');
        setUser(null, null);
      });
  }, []);

  // ── Auto-logout on inactivity ─────────────────────────────────────────────
  const forceLogout = useCallback(() => {
    localStorage.removeItem('openbank_token');
    localStorage.removeItem('openbank_user');
    setUser(null, null);
    window.location.href = '/login?expired=1';
  }, [setUser]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(forceLogout, SESSION_TIMEOUT);
  }, [forceLogout]);

  useEffect(() => {
    const token = localStorage.getItem('openbank_token');
    if (!user || !token) return;

    // Start the idle timer
    resetTimer();

    // Reset on any user activity
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [user, resetTimer]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth pages */}
        <Route path="/login"           element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register"        element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/verify-email"    element={<VerifyEmail />} />
        <Route path="/auth/callback"   element={<AuthCallback />} />

        {/* Protected pages (with layout) */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="import"       element={<Import />} />
          <Route path="charts"       element={<Charts />} />
          <Route path="budget"       element={<Budget />} />
          <Route path="bourse"       element={<Bourse />} />
          <Route path="analysis"     element={<Analysis />} />
          <Route path="forecasts"    element={<Forecasts />} />
          <Route path="settings"     element={<Settings />} />
          <Route path="profile"      element={<Profile />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
