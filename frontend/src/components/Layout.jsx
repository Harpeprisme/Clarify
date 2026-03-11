import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import GlobalFilterBar from './GlobalFilterBar';
import useStore from '../store';

const Layout = () => {
  const fetchAccounts = useStore(state => state.fetchAccounts);

  // Load accounts once on mount so GlobalFilterBar + all pages have them
  useEffect(() => { fetchAccounts(); }, []);

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <TopBar />
        <GlobalFilterBar />
        <div className="page-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
