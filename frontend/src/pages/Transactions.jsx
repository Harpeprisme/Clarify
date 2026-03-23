import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Pencil, Trash2, X, Check, Plus, Check as CheckIcon, Circle, FileText, ArrowLeftRight } from 'lucide-react';
import api from '../api';
import Card from '../components/Card';
import CategoryBadge from '../components/CategoryBadge';
import useStore from '../store';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const BLANK_FORM = {
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  amount: '',
  categoryId: '',
  accountId: '',
  notes: '',
};

const Transactions = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initCat = searchParams.get('categoryId') || '';

  const [transactions, setTransactions] = useState([]);
  const [meta, setMeta]                 = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState(initCat);
  const [categories, setCategories]     = useState([]);

  const accounts   = useStore(s => s.accounts);
  const dateFrom   = useStore(s => s.filterDateFrom);
  const dateTo     = useStore(s => s.filterDateTo);
  const accountIds = useStore(s => s.filterAccountIds);

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm]         = useState(BLANK_FORM);
  const [addSaving, setAddSaving]     = useState(false);
  const [deletingId, setDeletingId]   = useState(null);

  // Reset to page 1 when filters change
  useEffect(() => { setMeta(p => ({ ...p, page: 1 })); }, [dateFrom, dateTo, accountIds.join(',')]);

  // Sync filterCategoryId back to URL for shareability
  useEffect(() => {
    if (filterCategoryId) {
      searchParams.set('categoryId', filterCategoryId);
    } else {
      searchParams.delete('categoryId');
    }
    setSearchParams(searchParams, { replace: true });
  }, [filterCategoryId]);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchTransactions(); }, [meta.page, search, filterCategoryId, dateFrom, dateTo, accountIds.join(',')]);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (err) { console.error(err); }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: meta.page, limit: 20 });
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo)   params.set('endDate',   dateTo);
      if (accountIds.length > 0) params.set('accountIds', accountIds.join(','));
      if (search) params.append('search', search);
      if (filterCategoryId) params.append('categoryId', filterCategoryId);
      const { data } = await api.get(`/transactions?${params}`);
      setTransactions(data.data);
      setMeta(prev => ({ ...prev, ...data.meta }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setEditForm({
      date: format(new Date(tx.date), 'yyyy-MM-dd'),
      description: tx.description,
      amount: tx.amount,
      categoryId: tx.categoryId ?? '',
      accountId: tx.accountId,
      notes: tx.notes ?? '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id) => {
    try {
      setLoading(true);
      await api.patch(`/transactions/${id}`, {
        date: editForm.date,
        description: editForm.description,
        amount: parseFloat(editForm.amount),
        accountId: editForm.accountId,
        categoryId: editForm.categoryId || null,
        notes: editForm.notes || null,
      });
      cancelEdit();
      fetchTransactions();
    } catch (err) { console.error(err); setLoading(false); }
  };

  const confirmDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      setDeletingId(null);
      fetchTransactions();
    } catch (err) { console.error(err); }
  };

  const togglePointed = async (tx) => {
    try {
      const newStatus = !tx.isPointed;
      // Optimistic UI update
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, isPointed: newStatus } : t));
      await api.patch(`/transactions/${tx.id}`, { isPointed: newStatus });
    } catch (err) {
      console.error(err);
      fetchTransactions(); // Revert on failure
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      await api.post('/transactions', {
        date: addForm.date,
        description: addForm.description,
        amount: parseFloat(addForm.amount),
        accountId: addForm.accountId,
        categoryId: addForm.categoryId || null,
        notes: addForm.notes || null,
      });
      setAddForm(BLANK_FORM);
      setShowAddForm(false);
      fetchTransactions();
    } catch (err) { console.error(err); }
    finally { setAddSaving(false); }
  };

  const tableContent = React.useMemo(() => {
    if (loading && transactions.length === 0) {
      return <tr><td colSpan="6" className="text-center p-4 text-muted">Chargement...</td></tr>;
    }
    if (transactions.length === 0) {
      return <tr><td colSpan="6" className="text-center p-4 text-muted">Aucune transaction.</td></tr>;
    }
    
    return transactions.map(tx => {
      const isEditing  = editingId === tx.id;
      const isDeleting = deletingId === tx.id;

      return (
        <tr key={tx.id} style={{ transition: 'all 0.15s', opacity: tx.isPointed ? 0.6 : 1, backgroundColor: tx.isPointed ? 'rgba(0,0,0,0.02)' : '' }}
          className={isEditing ? 'is-editing' : isDeleting ? 'is-deleting' : 'hover-bg'}>

          {/* POINTAGE */}
          <td style={{ textAlign: 'center' }}>
            <button 
              onClick={() => togglePointed(tx)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px', borderRadius: '50%',
                color: tx.isPointed ? 'var(--success)' : 'var(--border-light)',
                transition: 'color 0.2s', display: 'inline-flex'
              }}
              title={tx.isPointed ? 'Dépointer' : 'Pointer'}
            >
              {tx.isPointed
                ? <CheckIcon size={16} strokeWidth={2.5} />
                : <Circle size={16} strokeWidth={1.5} />}
            </button>
          </td>

          {/* DATE */}
          <td>
            {isEditing
              ? <input type="date" className="tx-input" style={{ width: '130px' }} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
              : <span className="whitespace-nowrap" style={{ fontSize: '0.9rem' }}>{format(new Date(tx.date), 'dd/MM/yyyy')}</span>
            }
          </td>

          {/* DESCRIPTION */}
          <td>
            {isEditing
              ? <input type="text" className="tx-input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-semibold" style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                      {tx.description}
                    </div>
                    {tx.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FileText size={11} />{tx.notes}</div>}
                    {tx.type === 'TRANSFER' && <span className="badge badge-info" style={{ fontSize: '0.68rem', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><ArrowLeftRight size={10} />Virement interne</span>}
                  </div>
                  {tx.rawDescription && tx.rawDescription !== tx.description && (
                    <div style={{ position: 'relative' }}>
                      <button
                        className="raw-desc-btn"
                        onMouseEnter={e => { const t = e.currentTarget.nextSibling; if(t) t.style.display='block'; }}
                        onMouseLeave={e => { const t = e.currentTarget.nextSibling; if(t) t.style.display='none'; }}
                        title="Voir le libellé brut"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </button>
                      <div className="raw-desc-tooltip" style={{ display: 'none' }}>
                        <strong style={{ display: 'block', marginBottom: '0.15rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Libellé bancaire brut</strong>
                        {tx.rawDescription}
                      </div>
                    </div>
                  )}
                </div>
              )
            }
          </td>

          {/* ACCOUNT */}
          <td className="text-muted" style={{ fontSize: '0.85rem' }}>
            {isEditing
              ? <select className="tx-input" style={{ width: '140px' }} value={editForm.accountId} onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              : tx.account?.name
            }
          </td>

          {/* CATEGORY */}
          <td>
            {isEditing
              ? <select className="tx-input" style={{ width: '150px' }} value={editForm.categoryId} onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">Non catégorisé</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              : <CategoryBadge category={tx.category} />
            }
          </td>

          {/* AMOUNT */}
          <td style={{ textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {isEditing
              ? <input type="number" step="0.01" className="tx-input" style={{ width: '110px', textAlign: 'right' }}
                  value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
              : <span className={tx.amount > 0 ? 'text-success' : ''} style={{ fontSize: '0.95rem' }}>
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </span>
            }
          </td>

          {/* ACTIONS */}
          <td style={{ textAlign: 'center' }}>
            {isEditing ? (
              <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                <button className="icon-btn success" title="Enregistrer" onClick={() => saveEdit(tx.id)}><Check size={14} /></button>
                <button className="icon-btn" title="Annuler" onClick={cancelEdit}><X size={14} /></button>
              </div>
            ) : isDeleting ? (
              <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                <button className="tx-action-confirm-btn" title="Confirmer" onClick={() => confirmDelete(tx.id)}
                  style={{ background: 'var(--danger)', color: '#fff', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Confirmer</button>
                <button className="icon-btn" title="Annuler" onClick={() => setDeletingId(null)}><X size={14} /></button>
              </div>
            ) : (
              <div className="tx-action-btns">
                <button className="icon-btn" title="Modifier" onClick={() => startEdit(tx)}><Pencil size={14} /></button>
                <button className="icon-btn danger" title="Supprimer" onClick={() => setDeletingId(tx.id)}><Trash2 size={14} /></button>
              </div>
            )}
          </td>
        </tr>
      );
    });
  }, [transactions, editingId, deletingId, editForm, accounts, categories, loading]);

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="page-header">
        <h1 className="title" style={{ marginBottom: 0 }}>Transactions ({meta.total})</h1>
        <button className="btn btn-primary" onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}>
          {showAddForm ? <><X size={16} /> Annuler</> : <><Plus size={16} /> Ajouter</>}
        </button>
      </div>

      {/* ── Add Form ─────────────────────────────────────────────── */}
      {showAddForm && (
        <Card title="Nouvelle transaction" className="mb-4">
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Date *</label>
                <input type="date" className="tx-input" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Description *</label>
                <input type="text" className="tx-input" placeholder="Ex: Courses Carrefour" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Montant * <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>(négatif = dépense)</span>
                </label>
                <input type="number" step="0.01" className="tx-input" placeholder="-42.50" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Compte *</label>
                <select className="tx-input" value={addForm.accountId} onChange={e => setAddForm(f => ({ ...f, accountId: e.target.value }))} required>
                  <option value="">Sélectionner...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Catégorie</label>
                <select className="tx-input" value={addForm.categoryId} onChange={e => setAddForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">Non catégorisé</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Notes</label>
                <input type="text" className="tx-input" placeholder="Optionnel" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={addSaving}>{addSaving ? 'Enregistrement...' : 'Créer la transaction'}</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Annuler</button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Filters ──────────────────────────────────────────────── */}
      <Card className="mb-4">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Rechercher</label>
            <input type="text" className="input" placeholder="Mot-clé..." value={search}
              onChange={e => { setSearch(e.target.value); setMeta(p => ({ ...p, page: 1 })); }} />
          </div>
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Catégorie</label>
            <select className="input" value={filterCategoryId} onChange={e => { setFilterCategoryId(e.target.value); setMeta(p => ({ ...p, page: 1 })); }}>
              <option value="">Toutes</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* ── Table ────────────────────────────────────────────────── */}
      <Card noPadding>
        <div className="tx-table-wrapper">
          <table className="tx-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }} title="Pointage">✓</th>
                <th>Date</th>
                <th style={{ width: '30%' }}>Description</th>
                <th>Compte</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableContent}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="tx-pagination">
          <div className="text-muted" style={{ fontSize: '0.9rem' }}>
            Page {meta.page} sur {meta.totalPages || 1}&nbsp;·&nbsp;{meta.total} transaction{meta.total > 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }}
              disabled={meta.page <= 1} onClick={() => setMeta(p => ({ ...p, page: p.page - 1 }))}>
              ← Précédent
            </button>
            <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }}
              disabled={meta.page >= meta.totalPages} onClick={() => setMeta(p => ({ ...p, page: p.page + 1 }))}>
              Suivant →
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Transactions;
