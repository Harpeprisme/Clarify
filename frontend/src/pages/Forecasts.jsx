import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';
import useFilterParams from '../hooks/useFilterParams';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, ReferenceLine,
} from 'recharts';

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

const Tooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', padding: '0.75rem 1rem', border: '1px solid var(--border-light)', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
      <p className="font-semibold" style={{ marginBottom: '0.25rem' }}>{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color, fontSize: '0.85rem' }}>
          {e.name}: {fmt(e.value)}
        </p>
      ))}
    </div>
  );
};

const ConfidenceBadge = ({ value }) => {
  const level = value >= 80 ? 'high' : value >= 50 ? 'medium' : 'low';
  const colors = {
    high:   { bg: 'rgba(39, 174, 96, 0.12)', color: 'var(--success)', label: 'Haute' },
    medium: { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', label: 'Moyenne' },
    low:    { bg: 'rgba(255, 107, 107, 0.12)', color: 'var(--danger)', label: 'Basse' },
  };
  const c = colors[level];
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: c.bg, color: c.color }}>
      {c.label} ({Math.round(value)}%)
    </span>
  );
};

const AlertBanner = ({ alert }) => {
  const styles = {
    DANGER:  { bg: 'rgba(255, 107, 107, 0.08)', border: 'var(--danger)', icon: '⚠️' },
    WARNING: { bg: 'rgba(245, 158, 11, 0.08)', border: '#F59E0B', icon: '⚡' },
    INFO:    { bg: 'rgba(45, 225, 194, 0.08)', border: 'var(--accent-primary)', icon: '💡' },
  };
  const s = styles[alert.type] || styles.INFO;
  return (
    <div style={{
      padding: '0.75rem 1rem', borderRadius: '10px', backgroundColor: s.bg,
      borderLeft: `3px solid ${s.border}`, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
    }}>
      <span>{s.icon}</span>
      <span>{alert.message}</span>
    </div>
  );
};

const Forecasts = () => {
  const [projection, setProjection] = useState(null);
  const [recurring, setRecurring]   = useState([]);
  const [chartData, setChartData]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('expenses'); // 'expenses' | 'income'

  const { buildParams, dateFrom, dateTo, accountIds } = useFilterParams();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildParams().toString();
      const prefix = qs ? `?${qs}` : '';

      const [projRes, recRes, balRes] = await Promise.all([
        api.get(`/forecasts/projection${prefix}`),
        api.get(`/forecasts/recurring${prefix}`),
        api.get(`/charts/balance-evolution${prefix}`),
      ]);

      setProjection(projRes.data);
      setRecurring(recRes.data);

      // Build chart: real balance + projected future
      const balanceData = balRes.data.map(p => ({
        date: p.date,
        displayDate: format(new Date(p.date), 'dd MMM', { locale: fr }),
        soldeRéel: p.balance,
      }));

      // Add projection points
      const proj = projRes.data;
      if (balanceData.length > 0 && proj) {
        const lastPoint = balanceData[balanceData.length - 1];
        const today = new Date().toISOString().slice(0, 10);

        // Add today's point as bridge
        balanceData.push({
          date: today,
          displayDate: format(new Date(today), 'dd MMM', { locale: fr }),
          soldeRéel: proj.currentBalance,
          soldeProjeté: proj.currentBalance,
        });

        // Add end-of-month projection
        balanceData.push({
          date: proj.projectedDate,
          displayDate: format(new Date(proj.projectedDate), 'dd MMM', { locale: fr }),
          soldeProjeté: proj.projectedBalance,
        });
      }

      setChartData(balanceData);
    } catch (err) {
      console.error('[Forecasts] error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, accountIds.join(',')]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleConfirm = async (item) => {
    try {
      await api.post('/forecasts/recurring/confirm', {
        description: item.normalizedDescription || item.description,
        averageAmount: item.averageAmount,
        frequency: item.frequency,
        nextExpectedDate: item.nextExpectedDate,
        lastSeenDate: item.lastSeenDate,
        occurrences: item.occurrences,
        confidence: item.confidence,
        categoryId: item.categoryId,
      });
      fetchAll();
    } catch (err) { console.error(err); }
  };

  const handleToggleActive = async (item) => {
    if (!item.id) return;
    try {
      await api.patch(`/forecasts/recurring/${item.id}`, {
        isActive: !item.isActive,
      });
      fetchAll();
    } catch (err) { console.error(err); }
  };

  const expenseRecurring = recurring.filter(r => r.averageAmount < 0);
  const incomeRecurring = recurring.filter(r => r.averageAmount > 0);
  const displayedRecurring = activeTab === 'expenses' ? expenseRecurring : incomeRecurring;

  const totalMonthlyExpenses = expenseRecurring.filter(r => r.isActive !== false).reduce((s, r) => s + Math.abs(r.averageAmount), 0);
  const totalMonthlyIncome = incomeRecurring.filter(r => r.isActive !== false).reduce((s, r) => s + r.averageAmount, 0);

  if (loading || !projection) {
    return (
      <div className="flex items-center justify-center" style={{ height: '50vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Analyse en cours…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="title" style={{ marginBottom: 0 }}>Prévisions</h1>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid-kpi">
        {[
          {
            label: 'Solde Actuel',
            value: fmt(projection.currentBalance),
            color: projection.currentBalance >= 0 ? 'var(--text-main)' : 'var(--danger)',
            sub: 'Aujourd\'hui',
          },
          {
            label: 'Solde Projeté',
            value: fmt(projection.projectedBalance),
            color: projection.projectedBalance >= 0 ? 'var(--success)' : 'var(--danger)',
            sub: `au ${format(new Date(projection.projectedDate), 'dd MMMM', { locale: fr })}`,
          },
          {
            label: 'Potentiel d\'Épargne',
            value: fmt(projection.savingsPotential),
            color: projection.savingsPotential > 0 ? 'var(--success)' : 'var(--text-muted)',
            sub: `Coussin ${fmt(projection.settings.safetyBuffer)}`,
          },
          {
            label: 'Jours Restants',
            value: `${projection.daysRemaining}j`,
            color: 'var(--accent-primary)',
            sub: 'Avant fin du mois',
          },
        ].map((kpi, i) => (
          <Card key={i} className="glass-card kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>{kpi.sub}</div>
          </Card>
        ))}
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────────── */}
      {projection.alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {projection.alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* ── Projection Chart ────────────────────────────────────────────── */}
        <Card title="Projection du Solde" style={{ gridColumn: '1 / -1' }}>
          {chartData.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="displayDate" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickMargin={10} minTickGap={30} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={v => `${v}€`} width={90} />
                  <RechartsTooltip content={<Tooltip />} />
                  <ReferenceLine y={projection.settings.safetyBuffer} stroke="var(--danger)" strokeDasharray="5 5" label={{ value: 'Coussin', fill: 'var(--danger)', fontSize: 11 }} />
                  <Area type="monotone" dataKey="soldeRéel" name="Solde réel"
                    stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorReal)"
                    activeDot={{ r: 5, fill: 'var(--accent-primary)', stroke: 'white', strokeWidth: 2 }}
                    connectNulls={false} />
                  <Area type="monotone" dataKey="soldeProjeté" name="Projection"
                    stroke="#F59E0B" strokeWidth={2} strokeDasharray="8 4" fillOpacity={1} fill="url(#colorProjected)"
                    activeDot={{ r: 5, fill: '#F59E0B', stroke: 'white', strokeWidth: 2 }}
                    connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-muted py-8">Aucune donnée disponible</div>
          )}
        </Card>

        {/* ── Recurring Transactions ──────────────────────────────────────── */}
        <Card title="Abonnements & Récurrences" style={{ gridColumn: '1 / -1' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setActiveTab('expenses')}
            >
              Dépenses ({expenseRecurring.length})
            </button>
            <button
              className={`btn ${activeTab === 'income' ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setActiveTab('income')}
            >
              Revenus ({incomeRecurring.length})
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              Total mensuel : <strong style={{ color: activeTab === 'expenses' ? 'var(--danger)' : 'var(--success)' }}>
                {activeTab === 'expenses' ? `-${fmt(totalMonthlyExpenses)}` : `+${fmt(totalMonthlyIncome)}`}
              </strong>
            </div>
          </div>

          {/* Table */}
          {displayedRecurring.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Catégorie</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Montant</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Fréquence</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Confiance</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'center' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRecurring.map((r, i) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--border-light)',
                      opacity: r.isActive === false ? 0.4 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div className="font-semibold">{r.description}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {r.occurrences} occurrence{r.occurrences > 1 ? 's' : ''}
                          {r.nextExpectedDate && ` · Prochaine : ${format(new Date(r.nextExpectedDate), 'dd MMM', { locale: fr })}`}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {r.category ? (
                          <span style={{
                            fontSize: '0.78rem', fontWeight: 600,
                            padding: '0.2rem 0.5rem', borderRadius: '6px',
                            backgroundColor: `${r.category.color}18`,
                            color: r.category.color,
                          }}>
                            {r.category.name}
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>
                        <span style={{ color: r.averageAmount >= 0 ? 'var(--success)' : '' }}>
                          {r.averageAmount >= 0 ? '+' : ''}{fmt(r.averageAmount)}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: 'var(--bg-app)', fontWeight: 600 }}>
                          {r.frequency === 'MONTHLY' ? 'Mensuel' :
                           r.frequency === 'WEEKLY' ? 'Hebdo' :
                           r.frequency === 'QUARTERLY' ? 'Trimestriel' : 'Annuel'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <ConfidenceBadge value={r.confidence} />
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                          {!r.isSaved && (
                            <button
                              onClick={() => handleConfirm(r)}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              title="Confirmer cette récurrence"
                            >✓</button>
                          )}
                          {r.isSaved && (
                            <button
                              onClick={() => handleToggleActive(r)}
                              className="btn btn-outline"
                              style={{
                                padding: '0.2rem 0.5rem', fontSize: '0.75rem',
                                color: r.isActive ? 'var(--danger)' : 'var(--success)',
                              }}
                              title={r.isActive ? 'Désactiver' : 'Réactiver'}
                            >{r.isActive ? '⏸' : '▶'}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-8 text-muted">
              {activeTab === 'expenses'
                ? 'Aucune dépense récurrente détectée. Importez plus de données pour améliorer la détection.'
                : 'Aucun revenu récurrent détecté.'
              }
            </div>
          )}
        </Card>

        {/* ── Breakdown: Pending vs Paid ──────────────────────────────────── */}
        <Card title="Ce mois-ci : Encore à venir">
          <div className="flex-col gap-3">
            {projection.breakdown.recurringPending.length > 0 ? (
              projection.breakdown.recurringPending.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: '8px',
                }}>
                  <div>
                    <div className="font-semibold" style={{ fontSize: '0.85rem' }}>{r.description}</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {r.frequency === 'MONTHLY' ? 'Mensuel' : r.frequency} · Non prélevé
                    </div>
                  </div>
                  <div className="font-bold" style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>
                    {fmt(r.averageAmount)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted py-4" style={{ fontSize: '0.85rem' }}>
                Toutes les dépenses récurrentes ont été prélevées ce mois.
              </div>
            )}
            {projection.breakdown.incomeExpected.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <div className="text-muted font-semibold" style={{ fontSize: '0.78rem', marginBottom: '0.5rem' }}>Revenus attendus</div>
                </div>
                {projection.breakdown.incomeExpected.map((r, i) => (
                  <div key={`inc-${i}`} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.6rem 0.75rem', border: '1px solid var(--border-light)', borderRadius: '8px',
                  }}>
                    <div className="font-semibold" style={{ fontSize: '0.85rem' }}>{r.description}</div>
                    <div className="font-bold" style={{ color: 'var(--success)' }}>+{fmt(r.averageAmount)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>

        {/* ── Recommendations ─────────────────────────────────────────────── */}
        <Card title="Recommandations d'Épargne">
          <div className="flex-col gap-3">
            {projection.totalRecurringMonthly > 0 && (
              <div style={{
                padding: '1rem', borderRadius: '10px', backgroundColor: 'rgba(45, 225, 194, 0.06)',
                border: '1px solid rgba(45, 225, 194, 0.15)',
              }}>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  💳 <strong>Abonnements</strong> : {fmt(projection.totalRecurringMonthly)}/mois
                </div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  Soit {fmt(projection.totalRecurringMonthly * 12)}/an. En réduisant de 20%, vous économisez {fmt(projection.totalRecurringMonthly * 12 * 0.2)}/an.
                </div>
              </div>
            )}
            {projection.estimatedVariableExpenses < 0 && (
              <div style={{
                padding: '1rem', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
              }}>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  🛒 <strong>Dépenses variables estimées</strong> : {fmt(Math.abs(projection.estimatedVariableExpenses))} restant ce mois
                </div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  Basé sur votre moyenne des 3 derniers mois, proratisé sur {projection.daysRemaining} jours restants.
                </div>
              </div>
            )}
            {projection.savingsPotential > 0 ? (
              <div style={{
                padding: '1rem', borderRadius: '10px', backgroundColor: 'rgba(39, 174, 96, 0.06)',
                border: '1px solid rgba(39, 174, 96, 0.15)',
              }}>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  🎯 <strong>Potentiel d'épargne</strong> : {fmt(projection.savingsPotential)}
                </div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  Montant que vous pourriez mettre de côté après le coussin de sécurité de {fmt(projection.settings.safetyBuffer)}.
                </div>
              </div>
            ) : (
              <div style={{
                padding: '1rem', borderRadius: '10px', backgroundColor: 'rgba(255, 107, 107, 0.06)',
                border: '1px solid rgba(255, 107, 107, 0.15)',
              }}>
                <div style={{ fontSize: '0.85rem' }}>
                  ⚠️ Pas de potentiel d'épargne ce mois-ci. Le solde projeté est en dessous du coussin de sécurité.
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Forecasts;
