import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';
import useFilterParams from '../hooks/useFilterParams';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

// Colors per account (stable by index)
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const Dashboard = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Drill-down State
  const [selectedKpi, setSelectedKpi] = useState(null); // 'ALL', 'INCOME', 'EXPENSE', 'SAVINGS'
  const [kpiTransactions, setKpiTransactions] = useState([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiPage, setKpiPage] = useState(1);
  const [kpiMeta, setKpiMeta] = useState({ total: 0, totalPages: 1 });

  // Read global filters
  const dateFrom   = useStore(s => s.filterDateFrom);
  const dateTo     = useStore(s => s.filterDateTo);
  const accountIds = useStore(s => s.filterAccountIds);
  const { buildParams } = useFilterParams();

  // Re-fetch whenever filters change
  useEffect(() => { fetchDashboard(); }, [dateFrom, dateTo, accountIds.join(',')]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/dashboard?${buildParams()}`);
      setData(data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch KPI specific transactions when selectedKpi or page changes
  useEffect(() => {
    if (selectedKpi) {
      fetchKpiTransactions();
    }
  }, [selectedKpi, kpiPage, dateFrom, dateTo, accountIds.join(',')]);

  const fetchKpiTransactions = async () => {
    setKpiLoading(true);
    try {
      const params = new URLSearchParams(buildParams());
      params.set('page', kpiPage.toString());
      params.set('limit', '10');

      if (selectedKpi === 'INCOME') {
        params.set('type', 'INCOME');
        params.set('excludeInternal', 'true');
      } else if (selectedKpi === 'EXPENSE') {
        params.set('type', 'EXPENSE');
        params.set('excludeInternal', 'true');
      } else if (selectedKpi === 'SAVINGS') {
        // Savings = Income + Expense (excluding internals)
        params.set('excludeInternal', 'true');
      }

      const { data } = await api.get(`/transactions?${params.toString()}`);
      setKpiTransactions(data.data);
      setKpiMeta(data.meta);
    } catch (err) {
      console.error('KPI Transactions error:', err);
    } finally {
      setKpiLoading(false);
    }
  };

  const handleKpiClick = (kpi) => {
    if (selectedKpi === kpi) {
      // Toggle off
      setSelectedKpi(null);
    } else {
      setKpiPage(1);
      setSelectedKpi(kpi);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center" style={{ height: '50vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Chargement…</div>
      </div>
    );
  }

  const { totalBalance, period, accounts, recentTransactions } = data;

  // For the pie chart: only accounts with non-zero balance, use abs value for sizing
  const pieData = accounts
    .map((a, i) => ({ ...a, absBalance: Math.abs(a.balance), color: COLORS[i % COLORS.length] }))
    .filter(a => a.absBalance > 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="title" style={{ marginBottom: 0 }}>Tableau de bord</h1>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <Card 
          className={`glass-card ${selectedKpi === 'ALL' ? 'border-accent' : ''}`}
          style={{ cursor: 'pointer', transition: 'transform 0.1s, border-color 0.2s', transform: selectedKpi === 'ALL' ? 'scale(1.02)' : 'scale(1)' }}
          onClick={() => handleKpiClick('ALL')}
        >
          <div className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500 }}>Solde Global</div>
          <div className="kpi" style={{ color: totalBalance >= 0 ? 'var(--text-main)' : 'var(--danger)' }}>
            {fmt(totalBalance)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Tous les comptes</div>
        </Card>
        
        <Card 
          className={`glass-card ${selectedKpi === 'INCOME' ? 'border-accent' : ''}`}
          style={{ cursor: 'pointer', transition: 'transform 0.1s, border-color 0.2s', transform: selectedKpi === 'INCOME' ? 'scale(1.02)' : 'scale(1)' }}
          onClick={() => handleKpiClick('INCOME')}
        >
          <div className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500 }}>Revenus (période)</div>
          <div className="kpi text-success">+{fmt(period.income)}</div>
        </Card>
        
        <Card 
          className={`glass-card ${selectedKpi === 'EXPENSE' ? 'border-accent' : ''}`}
          style={{ cursor: 'pointer', transition: 'transform 0.1s, border-color 0.2s', transform: selectedKpi === 'EXPENSE' ? 'scale(1.02)' : 'scale(1)' }}
          onClick={() => handleKpiClick('EXPENSE')}
        >
          <div className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500 }}>Dépenses (période)</div>
          <div className="kpi text-danger">-{fmt(period.expense)}</div>
        </Card>
        
        <Card 
          className={`glass-card ${selectedKpi === 'SAVINGS' ? 'border-accent' : ''}`}
          style={{ cursor: 'pointer', transition: 'transform 0.1s, border-color 0.2s', transform: selectedKpi === 'SAVINGS' ? 'scale(1.02)' : 'scale(1)' }}
          onClick={() => handleKpiClick('SAVINGS')}
        >
          <div className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500 }}>Épargne Nette</div>
          <div className="kpi" style={{ color: period.savings >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {period.savings > 0 ? '+' : ''}{fmt(period.savings)}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

        {/* ── Transactions Area ──────────────────────────────────────── */}
        {!selectedKpi ? (
          <Card title="Transactions récentes" noPadding>
            {recentTransactions && recentTransactions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentTransactions.map((tx, idx) => (
                  <div key={tx.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 1.5rem',
                    borderBottom: idx === recentTransactions.length - 1 ? 'none' : '1px solid var(--border-light)',
                  }}>
                    <div className="flex items-center gap-4">
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        backgroundColor: tx.category?.color ? `${tx.category.color}20` : 'var(--bg-app)',
                        color: tx.category?.color || 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span className="font-bold">{tx.category ? tx.category.name.charAt(0).toUpperCase() : '?'}</span>
                      </div>
                      <div>
                        <div className="font-semibold">{tx.description}</div>
                        <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {format(new Date(tx.date), 'dd MMM yyyy', { locale: fr })} · {tx.account?.name}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold ${tx.amount > 0 ? 'text-success' : 'text-main'}`}>
                      {tx.amount > 0 ? '+' : ''}{fmt(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Aucune transaction sur cette période.
              </div>
            )}
          </Card>
        ) : (
          <Card 
            title={
              selectedKpi === 'ALL' ? 'Détail : Historique des transactions' :
              selectedKpi === 'INCOME' ? 'Détail : Revenus' :
              selectedKpi === 'EXPENSE' ? 'Détail : Dépenses' :
              'Détail : Épargne Nette (Flux)'
            } 
            noPadding
          >
            {kpiLoading ? (
               <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>
            ) : kpiTransactions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {kpiTransactions.map((tx, idx) => (
                    <div key={tx.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '1rem 1.5rem',
                      borderBottom: idx === kpiTransactions.length - 1 ? 'none' : '1px solid var(--border-light)',
                    }}>
                      <div className="flex items-center gap-4">
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          backgroundColor: tx.category?.color ? `${tx.category.color}20` : 'var(--bg-app)',
                          color: tx.category?.color || 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="font-bold">{tx.category ? tx.category.name.charAt(0).toUpperCase() : '?'}</span>
                        </div>
                        <div>
                          <div className="font-semibold">{tx.description}</div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {format(new Date(tx.date), 'dd MMM yyyy', { locale: fr })} · {tx.account?.name}
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold ${tx.amount > 0 ? 'text-success' : 'text-main'}`}>
                        {tx.amount > 0 ? '+' : ''}{fmt(tx.amount)}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Pagination Controls */}
                <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-app)' }}>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Page {kpiMeta.page} sur {kpiMeta.totalPages || 1}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                      disabled={kpiMeta.page <= 1} onClick={() => setKpiPage(p => p - 1)}>
                      ← Précédent
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                      disabled={kpiMeta.page >= kpiMeta.totalPages} onClick={() => setKpiPage(p => p + 1)}>
                      Suivant →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Aucune transaction ne correspond à cet indicateur.
              </div>
            )}
          </Card>
        )}

        {/* ── Accounts Overview ────────────────────────────────────────── */}
        <div className="flex-col gap-4">
          <Card title="Mes Comptes">

            {/* Pie chart — only when there's something positive to show */}
            {pieData.length > 0 && (
              <div style={{ height: '180px', marginBottom: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={40} outerRadius={70}
                      paddingAngle={4}
                      dataKey="absBalance"
                      nameKey="name"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name, props) => [fmt(props.payload.balance), props.payload.name]}
                      contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-light)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-main)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Account list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {accounts.map((acc, i) => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: '0.9rem' }}>{acc.name}</span>
                  </div>
                  <span className="font-semibold" style={{ fontSize: '0.9rem', color: acc.balance >= 0 ? 'var(--text-main)' : 'var(--danger)' }}>
                    {fmt(acc.balance)}
                  </span>
                </div>
              ))}
              {accounts.length === 0 && (
                <div className="text-muted text-center" style={{ fontSize: '0.9rem' }}>
                  Commencez par importer un fichier CSV.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
