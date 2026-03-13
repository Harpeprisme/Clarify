import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';
import useFilterParams from '../hooks/useFilterParams';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const Tooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
      <p className="font-semibold mb-2">{label ?? payload[0]?.payload?.name}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
          {e.name === 'income' ? 'Revenus' : e.name === 'expense' ? 'Dépenses' : e.name}: {fmt(Math.abs(e.value))}
        </p>
      ))}
    </div>
  );
};

const Charts = () => {
  const [catData,    setCatData]    = useState([]);
  const [barData,    setBarData]    = useState([]);
  const [lineData,   setLineData]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Global filters
  const dateFrom   = useStore(s => s.filterDateFrom);
  const dateTo     = useStore(s => s.filterDateTo);
  const accountIds = useStore(s => s.filterAccountIds);
  const { buildParams } = useFilterParams();

  useEffect(() => { fetchAll(); }, [dateFrom, dateTo, accountIds.join(',')]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const qs = buildParams().toString();
      const prefix = qs ? `?${qs}` : '';

      const [catRes, barRes, lineRes] = await Promise.all([
        api.get(`/charts/expenses-by-category${prefix}`),
        api.get(`/charts/income-vs-expenses${prefix}`),
        api.get(`/charts/balance-evolution${prefix}`),
      ]);

      setCatData(catRes.data);

      setBarData(barRes.data.map(item => {
        const [y, m] = item.month.split('-');
        return { ...item, displayMonth: format(new Date(+y, +m - 1, 1), 'MMM yy', { locale: fr }) };
      }));

      setLineData(lineRes.data.map(item => ({
        ...item,
        displayDate: format(new Date(item.date), 'dd MMM', { locale: fr }),
      })));
    } catch (err) {
      console.error('Charts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const PIE_COLORS = catData.map(c => c.color || '#9CA3AF');

  const axisStyle = { fill: 'var(--text-muted)', fontSize: 12 };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="title" style={{ marginBottom: 0 }}>Graphiques & Analyses</h1>
      </div>
      
      {loading ? (
        <div className="text-center p-8 text-muted">Génération des graphiques…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* ── Solde cumulé ─────────────────────────────────────────── */}
          <Card title="Évolution du Solde" style={{ gridColumn: '1 / -1' }}>
            {lineData.length > 0 ? (
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={lineData}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="displayDate" tick={axisStyle} tickMargin={10} minTickGap={30} />
                    <YAxis tick={axisStyle} tickFormatter={v => `${v}€`} width={90} />
                    <RechartsTooltip content={<Tooltip />} />
                    <Area type="monotone" dataKey="balance" name="Solde"
                      stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)"
                      activeDot={{ r: 5, fill: 'var(--accent-primary)', stroke: 'white', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center text-muted py-8">Aucune donnée sur cette période</div>
            )}
          </Card>

          {/* ── Dépenses par catégorie ───────────────────────────────── */}
          <Card title="Dépenses par Catégorie">
            <div style={{ height: '300px' }}>
              {catData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catData} cx="50%" cy="50%"
                      innerRadius={60} outerRadius={100} paddingAngle={2}
                      dataKey="value" nameKey="name" labelLine={false}>
                      {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <RechartsTooltip content={<Tooltip />} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: 'var(--text-main)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-full text-muted">Aucune dépense catégorisée</div>
              )}
            </div>
          </Card>

          {/* ── Revenus vs Dépenses ──────────────────────────────────── */}
          <Card title="Revenus vs Dépenses par Mois">
            <div style={{ height: '300px' }}>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="displayMonth" tick={axisStyle} tickMargin={10} />
                    <YAxis tick={axisStyle} tickFormatter={v => `${Math.round(v / 1000)}k€`} width={60} />
                    <RechartsTooltip content={<Tooltip />} />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', color: 'var(--text-main)' }}
                      payload={[
                        { value: 'Revenus',  type: 'rect', color: 'var(--success)' },
                        { value: 'Dépenses', type: 'rect', color: 'var(--danger)'  },
                      ]} />
                    <Bar dataKey="income"  name="income"  fill="var(--success)" radius={[4,4,0,0]} maxBarSize={40} />
                    <Bar dataKey="expense" name="expense" fill="var(--danger)"  radius={[4,4,0,0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex justify-center items-center h-full text-muted">Aucune donnée</div>
              )}
            </div>
          </Card>

        </div>
      )}
    </div>
  );
};

export default Charts;
