import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../api';
import Card from '../components/Card';
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
  const [transactions, setTransactions] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  const accounts     = useStore(s => s.accounts);
  const dateFrom     = useStore(s => s.filterDateFrom);
  const dateTo       = useStore(s => s.filterDateTo);
  const accountIds   = useStore(s => s.filterAccountIds);
  const [categories, setCategories] = useState([]);

  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm]       = useState(BLANK_FORM);
  const [addSaving, setAddSaving]   = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Reset to page 1 when filters change
  useEffect(() => { setMeta(p => ({ ...p, page: 1 })); }, [dateFrom, dateTo, accountIds.join(',')]);

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


  // ── Edit helpers ────────────────────────────────────────────────
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

  // ── Delete ──────────────────────────────────────────────────────
  const confirmDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      setDeletingId(null);
      fetchTransactions();
    } catch (err) { console.error(err); }
  };

  // ── Create ──────────────────────────────────────────────────────
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

  // ── Shared cell style ───────────────────────────────────────────
  const th = { padding: '0.85rem 1.2rem', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' };
  const td = { padding: '0.85rem 1.2rem', verticalAlign: 'middle' };

  const inputSm = {
    width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.82rem',
    border: '1px solid var(--border-light)', borderRadius: '6px',
    backgroundColor: 'var(--bg-app)', color: 'var(--text-main)',
    outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="title" style={{ marginBottom: 0 }}>Transactions ({meta.total})</h1>
        <button className="btn btn-primary" onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}>
          {showAddForm ? '✕ Annuler' : '+ Ajouter'}
        </button>
      </div>

      {/* ── Add form ───────────────────────────────────── */}
      {showAddForm && (
        <Card title="Nouvelle transaction" className="mb-4">
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Date *</label>
                <input type="date" style={inputSm} value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Description *</label>
                <input type="text" style={inputSm} placeholder="Ex: Courses Carrefour" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Montant * <span style={{fontSize: '0.7rem', opacity: 0.7}}>(négatif = dépense)</span></label>
                <input type="number" step="0.01" style={inputSm} placeholder="-42.50" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Compte *</label>
                <select style={inputSm} value={addForm.accountId} onChange={e => setAddForm(f => ({ ...f, accountId: e.target.value }))} required>
                  <option value="">Sélectionner...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Catégorie</label>
                <select style={inputSm} value={addForm.categoryId} onChange={e => setAddForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">Non catégorisé</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Notes</label>
                <input type="text" style={inputSm} placeholder="Optionnel" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={addSaving}>{addSaving ? 'Enregistrement...' : 'Créer la transaction'}</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>Annuler</button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Filters ───────────────────────────────────── */}
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

      {/* ── Table ─────────────────────────────────────── */}
      <Card noPadding>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-app)' }}>
                <th style={th}>Date</th>
                <th style={{ ...th, width: '30%' }}>Description</th>
                <th style={th}>Compte</th>
                <th style={th}>Catégorie</th>
                <th style={{ ...th, textAlign: 'right' }}>Montant</th>
                <th style={{ ...th, textAlign: 'center', width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && transactions.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-4 text-muted">Chargement...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-4 text-muted">Aucune transaction.</td></tr>
              ) : transactions.map(tx => {
                const isEditing = editingId === tx.id;
                const isDeleting = deletingId === tx.id;

                return (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      backgroundColor: isEditing ? 'var(--accent-primary)10' : isDeleting ? 'rgba(239,68,68,0.06)' : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {/* ── DATE ── */}
                    <td style={td}>
                      {isEditing ? (
                        <input type="date" style={{ ...inputSm, width: '130px' }} value={editForm.date}
                          onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                      ) : (
                        <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                          {format(new Date(tx.date), 'dd/MM/yyyy')}
                        </span>
                      )}
                    </td>

                    {/* ── DESCRIPTION ── */}
                    <td style={td}>
                      {isEditing ? (
                        <input type="text" style={inputSm} value={editForm.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                      ) : (
                        <div>
                          <div className="font-semibold" style={{ fontSize: '0.9rem' }}>{tx.description}</div>
                          {tx.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>📝 {tx.notes}</div>}
                          {tx.type === 'TRANSFER' && <span className="badge badge-info" style={{ fontSize: '0.68rem', marginTop: '2px' }}>Virement interne</span>}
                        </div>
                      )}
                    </td>

                    {/* ── ACCOUNT ── */}
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {isEditing ? (
                        <select style={{ ...inputSm, width: '140px' }} value={editForm.accountId}
                          onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      ) : tx.account?.name}
                    </td>

                    {/* ── CATEGORY ── */}
                    <td style={td}>
                      {isEditing ? (
                        <select style={{ ...inputSm, width: '150px' }} value={editForm.categoryId}
                          onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}>
                          <option value="">Non catégorisé</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '6px',
                          backgroundColor: tx.category?.color ? `${tx.category.color}18` : 'var(--bg-app)',
                          color: tx.category?.color || 'var(--text-muted)',
                          fontSize: '0.8rem', fontWeight: '600',
                        }}>
                          {tx.category?.name || '—'}
                        </span>
                      )}
                    </td>

                    {/* ── AMOUNT ── */}
                    <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <input type="number" step="0.01" style={{ ...inputSm, width: '110px', textAlign: 'right' }}
                          value={editForm.amount}
                          onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                      ) : (
                        <span className={tx.amount > 0 ? 'text-success' : ''} style={{ fontSize: '0.95rem' }}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </span>
                      )}
                    </td>

                    {/* ── ACTIONS ── */}
                    <td style={{ ...td, textAlign: 'center' }}>
                      {isEditing ? (
                        <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                          <button title="Enregistrer" onClick={() => saveEdit(tx.id)}
                            style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '1rem' }}>✓</button>
                          <button title="Annuler" onClick={cancelEdit}
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                        </div>
                      ) : isDeleting ? (
                        <div className="flex gap-1" style={{ justifyContent: 'center' }}>
                          <button title="Confirmer suppression" onClick={() => confirmDelete(tx.id)}
                            style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>Confirmer</button>
                          <button title="Annuler" onClick={() => setDeletingId(null)}
                            style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-1" style={{ justifyContent: 'center', opacity: 0.4, transition: 'opacity 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0.4}>
                          <button title="Modifier" onClick={() => startEdit(tx)}
                            style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.3rem 0.55rem', cursor: 'pointer', fontSize: '0.9rem' }}>✏️</button>
                          <button title="Supprimer" onClick={() => setDeletingId(tx.id)}
                            style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.3rem 0.55rem', cursor: 'pointer', fontSize: '0.9rem' }}>🗑️</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)' }}>
          <div className="text-muted" style={{ fontSize: '0.9rem' }}>
            Page {meta.page} sur {meta.totalPages || 1} &nbsp;·&nbsp; {meta.total} transaction{meta.total > 1 ? 's' : ''}
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
