import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';
import useFilterParams from '../hooks/useFilterParams';

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const Analysis = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const dateFrom   = useStore(s => s.filterDateFrom);
  const dateTo     = useStore(s => s.filterDateTo);
  const accountIds = useStore(s => s.filterAccountIds);
  const { buildParams } = useFilterParams();

  useEffect(() => { fetchAnalysis(); }, [dateFrom, dateTo, accountIds.join(',')]);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/analysis?${buildParams()}`);
      setData(data);
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center" style={{ height: '50vh' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Analyse en cours…</div>
      </div>
    );
  }

  const { bigExpenses, averages } = data;

  return (
    <div>
      <h1 className="title">Analyse Financière</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* ── Moyennes par catégorie ───────────────────────────────── */}
        <Card title="Dépenses moyennes par catégorie">
          <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>Moyenne mensuelle sur la période sélectionnée</p>
          <div className="flex-col gap-4">
            {averages.map((avg, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.8rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
              }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: avg.color, flexShrink: 0 }} />
                  <div>
                    <div className="font-semibold">{avg.categoryName}</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{avg.totalCount} transaction(s)</div>
                  </div>
                </div>
                <div className="font-bold text-danger">
                  {fmt(avg.averageMonthly)}{' '}
                  <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>/ mois</span>
                </div>
              </div>
            ))}
            {averages.length === 0 && (
              <div className="text-center p-4 text-muted">Pas assez de données sur cette période.</div>
            )}
          </div>
        </Card>

        {/* ── Top dépenses ─────────────────────────────────────────── */}
        <Card title="Plus grosses dépenses">
          <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>Top 15 sur la période sélectionnée</p>
          <div className="flex-col gap-2">
            {bigExpenses.map((tx) => (
              <div key={tx.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.8rem', borderBottom: '1px solid var(--border-light)',
              }}>
                <div>
                  <div className="font-semibold">{tx.description}</div>
                  <div className="text-muted flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                    <span>{format(new Date(tx.date), 'dd MMM yyyy', { locale: fr })}</span>
                    {tx.category && (
                      <>
                        <span>·</span>
                        <span style={{
                          color: tx.category.color,
                          background: `${tx.category.color}18`,
                          padding: '0.1rem 0.4rem', borderRadius: '4px',
                        }}>
                          {tx.category.name}
                        </span>
                      </>
                    )}
                    {tx.account && <><span>·</span><span>{tx.account.name}</span></>}
                  </div>
                </div>
                <div className="font-bold text-danger">{fmt(tx.amount)}</div>
              </div>
            ))}
            {bigExpenses.length === 0 && (
              <div className="text-center p-4 text-muted">Aucune dépense trouvée.</div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Analysis;
