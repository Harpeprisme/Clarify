import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Card from '../components/Card';
import useFilterParams from '../hooks/useFilterParams';

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmt = (n, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(n ?? 0);

const fmtPct = (n) =>
  `${n >= 0 ? '+' : ''}${Number(n ?? 0).toFixed(2)} %`;

// ─── Performance component with dynamic colors ──────────────────────────────
const Perf = ({ value, suffix = '', showPlus = true }) => {
  const isPos = value >= 0;
  return (
    <span style={{ color: isPos ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
      {isPos ? (showPlus ? '▲ +' : '▲ ') : '▼ '}
      {Math.abs(Number(value ?? 0)).toFixed(2)} % {suffix}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const Bourse = () => {
  const [holdings, setHoldings]     = useState([]);
  const [loading, setLoading]       = useState(true);

  const { buildParams, dateFrom, dateTo, accountIds } = useFilterParams();

  // ─── Fetch holdings ────────────────────────────────────────────────────────
  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const { data } = await api.get(`/bourses?${params}`);
      setHoldings(data);
    } catch (err) {
      console.error('[Bourse] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, accountIds.join(',')]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totalCurrentValue = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);
  const totalCost         = holdings.reduce((s, h) => s + (h.totalCost   || 0), 0);
  const totalPerfVal      = totalCurrentValue - totalCost;
  const totalPerfPct      = totalCost > 0 ? (totalPerfVal / totalCost) * 100 : 0;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="title" style={{ marginBottom: 0 }}>Analyse Portefeuille Bourse</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <Card>
          <div className="text-muted text-sm font-semibold mb-1 uppercase tracking-wider">Valeur Totale</div>
          <div className="text-2xl font-bold">{fmt(totalCurrentValue)}</div>
        </Card>
        <Card>
          <div className="text-muted text-sm font-semibold mb-1 uppercase tracking-wider">Total Investi</div>
          <div className="text-2xl font-bold">{fmt(totalCost)}</div>
        </Card>
        <Card>
          <div className="text-muted text-sm font-semibold mb-1 uppercase tracking-wider">Performance</div>
          <div className="text-2xl font-bold" style={{ color: totalPerfVal >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {totalPerfVal >= 0 ? '+' : ''}{fmt(totalPerfVal)}
          </div>
          <div className="text-sm mt-1 mb-0"><Perf value={totalPerfPct} /></div>
        </Card>
      </div>

      <Card title="Positions Détenues" style={{ marginBottom: '2rem' }}>
        {loading ? (
          <div className="text-center p-8 text-muted">Mise à jour des prix...</div>
        ) : holdings.length === 0 ? (
          <div className="text-center p-8 text-muted">Aucun actif sur cette période ou ces comptes.</div>
        ) : (
          <div style={{ overflowX: 'auto', margin: '0 -1.5rem', padding: '0 1.5rem' }}>
            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  {['Actif', 'Qté', 'PRU', 'Cours', 'Evolution', 'Performance', 'Valeur'].map(h => (
                    <th key={h} style={{ padding: '0.8rem 0.5rem', fontWeight: 600, textAlign: h === 'Actif' ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => {
                  return (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--border-light)' }}
                      className="hover:bg-surface transition-colors"
                    >
                      <td style={{ padding: '0.8rem 0.5rem' }}>
                        <div className="font-bold">{h.name}</div>
                        <div className="text-xs text-muted font-mono">{h.isin} {h.symbol !== h.isin ? `(${h.symbol})` : ''}</div>
                      </td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{h.quantity.toLocaleString('fr-FR')}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }}>{fmt(h.pru)}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{fmt(h.currentPrice)}</td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }}><Perf value={h.dailyChangePercent} showPlus={false} /></td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ color: h.performanceTotal >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                          {h.performanceTotal >= 0 ? '+' : ''}{fmt(h.performanceTotal)}
                        </div>
                        <div className="text-xs"><Perf value={h.performancePercent} /></div>
                      </td>
                      <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{fmt(h.currentValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Bourse;
