import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import useStore from './store';

import Dashboard   from './pages/Dashboard';
import Import      from './pages/Import';
import Transactions from './pages/Transactions';
import Charts      from './pages/Charts';
import Budget      from './pages/Budget';
import Analysis    from './pages/Analysis';
import Settings    from './pages/Settings';
import Profile     from './pages/Profile';
import Login       from './pages/Login';
import Register    from './pages/Register';
import AuthCallback from './pages/AuthCallback';

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
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages (no layout) */}
        <Route path="/login"  element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected pages (with layout) */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="import"       element={<Import />} />
          <Route path="charts"       element={<Charts />} />
          <Route path="budget"       element={<Budget />} />
          <Route path="analysis"     element={<Analysis />} />
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
