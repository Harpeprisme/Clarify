import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';
import useFilterParams from '../hooks/useFilterParams';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

// Colors per account (stable by index)
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState(null);

  // Drill-down State
  const [selectedKpi, setSelectedKpi]         = useState(null);
  const [kpiTransactions, setKpiTransactions] = useState([]);
  const [kpiLoading, setKpiLoading]           = useState(false);
  const [kpiPage, setKpiPage]                 = useState(1);
  const [kpiMeta, setKpiMeta]                 = useState({ total: 0, totalPages: 1 });

  const dateFrom   = useStore(s => s.filterDateFrom);
  const dateTo     = useStore(s => s.filterDateTo);
  const accountIds = useStore(s => s.filterAccountIds);
  const { buildParams } = useFilterParams();

  useEffect(() => { fetchDashboard(); }, [dateFrom, dateTo, accountIds.join(',')]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const qs = buildParams();
      const [dashRes, forecastRes] = await Promise.all([
        api.get(`/dashboard?${qs}`),
        api.get(`/forecasts/projection?${qs}`).catch(() => ({ data: null })),
      ]);
      setData(dashRes.data);
      setForecast(forecastRes.data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedKpi) fetchKpiTransactions();
  }, [selectedKpi, kpiPage, dateFrom, dateTo, accountIds.join(',')]);

  const fetchKpiTransactions = async () => {
    setKpiLoading(true);
    try {
      const params = new URLSearchParams(buildParams());
      params.set('page', kpiPage.toString());
      params.set('limit', '10');
      if (selectedKpi === 'INCOME')  { params.set('type', 'INCOME');  params.set('excludeInternal', 'true'); }
      if (selectedKpi === 'EXPENSE') { params.set('type', 'EXPENSE'); params.set('excludeInternal', 'true'); }
      if (selectedKpi === 'SAVINGS') params.set('excludeInternal', 'true');
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
    if (selectedKpi === kpi) { setSelectedKpi(null); }
    else { setKpiPage(1); setSelectedKpi(kpi); }
  };

  if (loading || !data) {
    return <div className="loading-screen">Chargement…</div>;
  }

  const { totalBalance, period, accounts, recentTransactions } = data;
  const pieData = accounts
    .map((a, i) => ({ ...a, absBalance: Math.abs(a.balance), color: COLORS[i % COLORS.length] }))
    .filter(a => a.absBalance > 0);

  // Reusable transaction row renderer
  const renderTxRow = (tx, idx, list) => (
    <div key={tx.id} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '1rem 1.5rem',
      borderBottom: idx === list.length - 1 ? 'none' : '1px solid var(--border-light)',
    }}>
      <div className="flex items-center gap-4">
        <div
          className="tx-icon"
          style={{
            backgroundColor: tx.category?.color ? `${tx.category.color}20` : 'var(--bg-app)',
            color: tx.category?.color || 'var(--text-muted)',
          }}
        >
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
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="title" style={{ marginBottom: 0 }}>Tableau de bord</h1>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid-kpi">
        {[
          { key: 'ALL',     label: 'Solde Global',    value: fmt(totalBalance),          color: totalBalance >= 0 ? 'var(--text-main)' : 'var(--danger)', sub: 'Tous les comptes' },
          { key: 'INCOME',  label: 'Revenus (période)', value: `+${fmt(period.income)}`, color: 'var(--success)' },
          { key: 'EXPENSE', label: 'Dépenses (période)', value: `-${fmt(period.expense)}`, color: 'var(--danger)' },
          { key: 'SAVINGS', label: 'Épargne Nette',   value: `${period.savings > 0 ? '+' : ''}${fmt(period.savings)}`, color: period.savings >= 0 ? 'var(--success)' : 'var(--danger)' },
        ].map(({ key, label, value, color, sub }) => (
          <Card
            key={key}
            className={`glass-card kpi-card ${selectedKpi === key ? 'active' : ''}`}
            onClick={() => handleKpiClick(key)}
          >
            <div className="kpi-label">{label}</div>
            <div className="kpi" style={{ color }}>{value}</div>
            {sub && <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>{sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid-dashboard-main">
        {/* ── Transactions Area ──────────────────────────────────────── */}
        {!selectedKpi ? (
          <Card title="Transactions récentes" noPadding>
            {recentTransactions?.length > 0
              ? <div style={{ display: 'flex', flexDirection: 'column' }}>{recentTransactions.map((tx, i) => renderTxRow(tx, i, recentTransactions))}</div>
              : <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune transaction sur cette période.</div>
            }
          </Card>
        ) : (
          <Card
            title={
              selectedKpi === 'ALL'     ? 'Détail : Historique des transactions' :
              selectedKpi === 'INCOME'  ? 'Détail : Revenus' :
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
                  {kpiTransactions.map((tx, i) => renderTxRow(tx, i, kpiTransactions))}
                </div>
                <div className="tx-pagination">
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

        {/* ── Accounts Overview ──────────────────────────────────────── */}
        <div className="flex-col gap-4">
          <Card title="Mes Comptes">
            {pieData.length > 0 && (
              <div style={{ height: '180px', marginBottom: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="absBalance" nameKey="name">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {accounts.map((acc, i) => (
                <div key={acc.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
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

          {/* ── Forecast Widget ────────────────────────────────────────── */}
          {forecast && (
            <Card
              className="glass-card"
              onClick={() => navigate('/forecasts')}
              style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="font-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📊 Prévision fin de mois</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Voir les détails →</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Solde projeté</div>
                  <div className="font-bold" style={{
                    fontSize: '1.5rem',
                    color: forecast.projectedBalance >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {fmt(forecast.projectedBalance)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Épargne possible</div>
                  <div className="font-bold" style={{ fontSize: '1.1rem', color: forecast.savingsPotential > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {fmt(forecast.savingsPotential)}
                  </div>
                </div>
              </div>
              {forecast.daysRemaining > 0 && (
                <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: '0.5rem' }}>
                  {forecast.daysRemaining} jours restants · {forecast.alerts?.length > 0 ? forecast.alerts[0].message.slice(0, 60) + '…' : ''}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
