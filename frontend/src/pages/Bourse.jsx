import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import api from '../api';
import Card from '../components/Card';
import useFilterParams from '../hooks/useFilterParams';

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmt = (n, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(n ?? 0);

const fmtPct = (n) =>
  `${n >= 0 ? '+' : ''}${Number(n ?? 0).toFixed(2)} %`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });

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
  const [selected, setSelected]     = useState(null); // selected isin for chart
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  const { buildParams, dateFrom, dateTo, accountIds } = useFilterParams();

  // ─── Fetch holdings ────────────────────────────────────────────────────────
  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const { data } = await api.get(`/bourses?${params}`);
      setHoldings(data);
      if (data.length > 0 && !selected) setSelected(data[0].isin || data[0].name);
    } catch (err) {
      console.error('[Bourse] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, accountIds.join(',')]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  // ─── Fetch history for chart ───────────────────────────────────────────────
  const fetchHistory = useCallback(async (isin) => {
    if (!isin) return;
    setChartLoading(true);
    try {
      const params = buildParams({ isin });
      const { data } = await api.get(`/bourses/history?${params}`);
      setHistoryData(data);
    } catch (err) {
      console.error('[Bourse] history fetch error:', err);
    } finally {
      setChartLoading(false);
    }
  }, [dateFrom, dateTo, accountIds.join(',')]);

  useEffect(() => { if (selected) fetchHistory(selected); }, [selected, fetchHistory]);

  // ─── Analytics Helpers ─────────────────────────────────────────────────────
  const calculateMetrics = (data, key) => {
    const validPoints = data.filter(d => d[key] !== null);
    if (validPoints.length < 2) return { cagr: 0, volatility: 0 };

    const first = validPoints[0][key];
    const last  = validPoints[validPoints.length - 1][key];
    
    const startDate = new Date(validPoints[0].date);
    const endDate   = new Date(validPoints[validPoints.length - 1].date);
    const years     = Math.max(0.1, (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25));
    
    // CAGR = ((1 + R/100)^(1/years) - 1) * 100
    const totalReturnPct = last; 
    const cagr = (Math.pow(1 + totalReturnPct / 100, 1 / years) - 1) * 100;

    // Volatility: Annualized Standard Deviation of weekly returns
    const returns = [];
    for (let i = 1; i < validPoints.length; i++) {
      const prev = validPoints[i - 1][key];
      const curr = validPoints[i][key];
      const ret = ( (1 + curr/100) / (1 + prev/100) ) - 1;
      returns.push(ret);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const vol = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized (252 trading days)

    return { cagr, volatility: vol };
  };

  // ─── Data Normalization & DCA Logic ────────────────────────────────────────
  const series = useMemo(() => {
    if (!historyData) return [];

    const { investHistory, priceHistory, benchmarks } = historyData;

    const toKey = (d) => {
      if (!d) return null;
      const date = new Date(d);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    };

    const investByDate = Object.fromEntries(investHistory.map(p => [p.date?.slice(0, 10), p]));
    const priceByDate  = Object.fromEntries(priceHistory.map(p => [toKey(p.date), p.price]));
    const spByDate     = Object.fromEntries(benchmarks.sp500.map(p => [toKey(p.date), p.price]));
    const mwByDate     = Object.fromEntries(benchmarks.msciWorld.map(p => [toKey(p.date), p.price]));
    const sxByDate     = Object.fromEntries(benchmarks.stoxx50?.map(p => [toKey(p.date), p.price]) || []);

    const allDates = [...new Set([
      ...Object.keys(investByDate), ...Object.keys(priceByDate),
      ...Object.keys(spByDate), ...Object.keys(mwByDate), ...Object.keys(sxByDate)
    ])].filter(Boolean).sort();

    // User requested specifically to start from 2024-03-31
    const filterStart = "2024-03-31";
    const filteredDates = allDates.filter(d => d >= filterStart);

    let lastInvest   = { invested: 0, shares: 0, pru: 0 };
    let dcaBenchmark = { spUnits: 0, mwUnits: 0, sxUnits: 0 };
    let basePrices   = { me: null, sp: null, mw: null, sx: null };

    // Initial state simulation for pre-filter investments
    allDates.filter(d => d < filterStart).forEach(d => {
      if (investByDate[d]) lastInvest = investByDate[d];
    });

    return filteredDates.map(d => {
      const currentPrice = priceByDate[d] ?? null;
      const spPrice      = spByDate[d] ?? null;
      const mwPrice      = mwByDate[d] ?? null;
      const sxPrice      = sxByDate[d] ?? null;

      if (investByDate[d]) {
        const actualSharesPrev = lastInvest.shares;
        const actualSharesNew  = investByDate[d].shares;
        const deltaShares      = actualSharesNew - actualSharesPrev;
        const deltaCost        = investByDate[d].invested - lastInvest.invested;

        if (deltaShares > 0) {
          if (spPrice) dcaBenchmark.spUnits += deltaCost / spPrice;
          if (mwPrice) dcaBenchmark.mwUnits += deltaCost / mwPrice;
          if (sxPrice) dcaBenchmark.sxUnits += deltaCost / sxPrice;
        } else if (deltaShares < 0 && actualSharesPrev > 0) {
          const sellRatio = Math.abs(deltaShares) / actualSharesPrev;
          dcaBenchmark.spUnits *= (1 - sellRatio);
          dcaBenchmark.mwUnits *= (1 - sellRatio);
          dcaBenchmark.sxUnits *= (1 - sellRatio);
        }
        lastInvest = investByDate[d];
      }

      // Base 0% (TWR)
      if (basePrices.me === null && currentPrice !== null) basePrices.me = currentPrice;
      if (basePrices.sp === null && spPrice !== null)      basePrices.sp = spPrice;
      if (basePrices.mw === null && mwPrice !== null)      basePrices.mw = mwPrice;
      if (basePrices.sx === null && sxPrice !== null)      basePrices.sx = sxPrice;

      // TWR Normalization (Base 0% at established base price)
      const idxMe = (basePrices.me && currentPrice) ? ((currentPrice / basePrices.me) - 1) * 100 : (basePrices.me ? null : 0);
      const idxSP = (basePrices.sp && spPrice)      ? ((spPrice / basePrices.sp) - 1) * 100 : (basePrices.sp ? null : 0);
      const idxSX = (basePrices.sx && sxPrice)      ? ((sxPrice / basePrices.sx) - 1) * 100 : (basePrices.sx ? null : 0);
      const idxMW = (basePrices.mw && mwPrice)      ? ((mwPrice / basePrices.mw) - 1) * 100 : (basePrices.mw ? null : 0);

      // DCA Performance (MWR)
      const myDcaValue = lastInvest.shares * currentPrice;
      const dcaPerfMe = (lastInvest.invested > 0 && currentPrice) ? ((myDcaValue / lastInvest.invested) - 1) * 100 : (lastInvest.invested > 0 ? null : 0);

      return {
        date: d,
        price: currentPrice,
        pru:   lastInvest.pru,
        invested: lastInvest.invested,
        dcaMe: dcaPerfMe,
        idxMe: idxMe,
        idxSP: idxSP,
        idxSX: idxSX,
        idxMW: idxMW,
        alpha: (dcaPerfMe !== null && idxMW !== null) ? dcaPerfMe - idxMW : null,
      };
    }).filter(d => d.price !== null || d.idxSP !== null || d.idxMW !== null);
  }, [historyData]);

  // Metrics calculation
  const metrics = useMemo(() => {
    if (series.length < 2) return null;
    return {
      me: calculateMetrics(series, 'dcaMe'),
      wpea: calculateMetrics(series, 'idxMe'),
      mw: calculateMetrics(series, 'idxMW'),
      sp: calculateMetrics(series, 'idxSP'),
      sx: calculateMetrics(series, 'idxSX'),
    };
  }, [series]);

  // ─── Totals ───────────────────────────────────────────────────────────────
  const totalCurrentValue = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);
  const totalCost         = holdings.reduce((s, h) => s + (h.totalCost   || 0), 0);
  const totalPerfVal      = totalCurrentValue - totalCost;
  const totalPerfPct      = totalCost > 0 ? (totalPerfVal / totalCost) * 100 : 0;

  const lastPoint = series[series.length - 1] || {};

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
                  const key = h.isin || h.name;
                  const isActive = selected === key;
                  return (
                    <tr
                      key={i} onClick={() => setSelected(key)}
                      style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', background: isActive ? 'var(--surface-hover)' : undefined }}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
        
        {/* ── CHART 1: RENTABILITÉ VS ISIN ── */}
        <Card title="📊 Ma Rentabilité (DCA vs Titre)">
          <div className="text-xs text-muted mb-4">
            Comparaison de vos gains réels (**DCA**) par rapport à une détention simple du titre (**Hold**) depuis le 31/03/24.
          </div>
          {chartLoading ? <div className="text-center p-12 text-muted">Calcul des courbes...</div> :
           series.length === 0 ? <div className="text-center p-12 text-muted">Sélectionnez une position.</div> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={series} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} minTickGap={50} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  labelFormatter={fmtDate} 
                  formatter={(val, name) => [val !== null ? `${val.toFixed(2)} %` : 'N/A', name]}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 12 }} 
                />
                <Legend iconType="circle" verticalAlign="top" height={36} />
                <Line 
                  type="monotone" 
                  dataKey="dcaMe" 
                  name="Mon Portefeuille (DCA)" 
                  stroke="#4299E1" 
                  strokeWidth={5} 
                  dot={false} 
                  connectNulls={true} 
                />
                <Line 
                  type="monotone" 
                  dataKey="idxMe" 
                  name="Performance du Titre (Hold)" 
                  stroke="#38b2ac" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false} 
                  connectNulls={true} 
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── CHART 2: ISIN VS MSCI WORLD ── */}
        <Card title="🌍 Suivi d'Indice (Titre vs MSCI World)">
          <div className="text-xs text-muted mb-4">
            Comparaison de votre titre avec le marché mondial de référence (**MSCI World**).
          </div>
          {chartLoading ? <div className="text-center p-12 text-muted">Calcul des indices...</div> :
           series.length === 0 ? <div className="text-center p-12 text-muted">Pas de données disponibles.</div> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={series} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} minTickGap={50} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  labelFormatter={fmtDate} 
                  formatter={(val, name) => [`${val.toFixed(2)} %`, name]}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 12 }} 
                />
                <Legend iconType="circle" verticalAlign="top" height={36} />
                <Line 
                  type="monotone" 
                  dataKey="idxMe" 
                  name="Votre Titre (Ex: WPEA)" 
                  stroke="#38b2ac" 
                  strokeWidth={4} 
                  dot={false} 
                  connectNulls={true} 
                />
                <Line 
                  type="monotone" 
                  dataKey="idxMW" 
                  name="MSCI World Index" 
                  stroke="#a0aec0" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false} 
                  connectNulls={true} 
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── TECHNICAL COMPARISON TABLE ── */}
        {metrics && (
          <Card title="Comparatif Technique & Indices">
            <div className="text-xs text-muted mb-4 italic">Statistiques détaillées pour chaque indice (Base 0% au 31/03/24).</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>Cible / Indice</th>
                    <th style={{ padding: '0.8rem 1rem', fontWeight: 600, textAlign: 'right' }}>Performance Totale</th>
                    <th style={{ padding: '0.8rem 1rem', fontWeight: 600, textAlign: 'right' }}>Gain Moyen (vitesse)</th>
                    <th style={{ padding: '0.8rem 1rem', fontWeight: 600, textAlign: 'right' }}>Niveau de Risque</th>
                    <th style={{ padding: '0.8rem 1rem', fontWeight: 600, textAlign: 'right' }}>Score Efficacité*</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Mon Portefeuille (DCA)', key: 'me', color: 'var(--color-primary)', total: series[series.length-1]?.dcaMe },
                    { name: 'WPEA (Buy & Hold)', key: 'wpea', color: '#38b2ac', total: series[series.length-1]?.idxMe },
                    { name: 'MSCI World (Hold)', key: 'mw', color: '#a0aec0', total: series[series.length-1]?.idxMW },
                    { name: 'S&P 500 (Hold)', key: 'sp', color: '#ff3860', total: series[series.length-1]?.idxSP },
                    { name: 'Euro Stoxx 50 (Hold)', key: 'sx', color: '#ffdd57', total: series[series.length-1]?.idxSX },
                  ].map(item => {
                    const m = metrics[item.key];
                    const sharpe = (m.cagr - 2) / Math.max(1, m.volatility);
                    return (
                      <tr key={item.key} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '1rem', fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: item.color, marginRight: 10 }}></span>
                          {item.name}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: (item.total ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {(item.total ?? 0) >= 0 ? '+' : ''}{(item.total ?? 0).toFixed(2)} %
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>{m.cagr.toFixed(2)} % / an</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.volatility > 30 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                            {m.volatility > 30 ? 'Élevé' : 'Modéré'} ({m.volatility.toFixed(0)}%)
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontStyle: 'italic' }}>
                          {m.cagr > 0 ? (sharpe > 1.5 ? '🏆 Excellent' : sharpe > 0.8 ? '⭐ Très Bon' : '👍 Correct') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-[10px] text-muted mt-4 opacity-70">
                * Score basé sur la régularité et le rendement par rapport au risque.
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Bourse;
