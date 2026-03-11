import React, { useState, useEffect } from 'react';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';

const Settings = () => {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Rule form
  const [newKeyword, setNewKeyword] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState('');

  // User form
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Accounts: confirm states per account id
  const [confirmClearId, setConfirmClearId]   = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [actionMsg, setActionMsg]             = useState('');

  // currentBalance editing — per account
  const [editBalanceId, setEditBalanceId]     = useState(null);   // which account is being edited
  const [editBalanceVal, setEditBalanceVal]   = useState('');
  const [balanceSaving, setBalanceSaving]     = useState(false);

  const currentUser = useStore(state => state.user) || { name: 'Julien (Admin)', role: 'ADMIN' };
  const accounts = useStore(state => state.accounts);
  const fetchAccountsStore = useStore(state => state.fetchAccounts);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, rulesRes, usersRes] = await Promise.all([
        api.get('/categories'),
        api.get('/rules'),
        api.get('/users')
      ]);
      setCategories(catRes.data);
      setRules(rulesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newKeyword || !ruleCategoryId) return;
    try {
      await api.post('/rules', { keyword: newKeyword, categoryId: ruleCategoryId });
      setNewKeyword('');
      fetchData();
    } catch (error) {
       console.error(error);
    }
  };

  const handleDeleteRule = async (id) => {
    try {
      await api.delete(`/rules/${id}`);
      fetchData();
    } catch (error) {
       console.error(error);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    try {
      await api.post('/users', { name: newUserName, email: newUserEmail, role: 'READER' });
      setNewUserName('');
      setNewUserEmail('');
      fetchData();
    } catch (error) {
       console.error(error);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      fetchData();
    } catch (error) {
       console.error(error);
    }
  };

  const handleClearHistory = async (accountId) => {
    try {
      const { data } = await api.delete(`/accounts/${accountId}/transactions`);
      setConfirmClearId(null);
      setActionMsg(`✅ Historique effacé — ${data.deleted} transaction(s) supprimée(s).`);
      fetchAccountsStore();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setActionMsg('❌ Erreur lors de la suppression.');
    }
  };

  const handleDeleteAccount = async (accountId) => {
    try {
      await api.delete(`/accounts/${accountId}`);
      setConfirmDeleteId(null);
      setActionMsg('✅ Compte supprimé.');
      fetchAccountsStore();
      setTimeout(() => setActionMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setActionMsg('❌ Erreur lors de la suppression du compte.');
    }
  };

  const startEditBalance = (acc) => {
    setEditBalanceId(acc.id);
    setEditBalanceVal(acc.balance ?? 0);
  };

  const saveBalance = async (accId) => {
    setBalanceSaving(true);
    try {
      await api.patch(`/accounts/${accId}`, {
        currentBalance: parseFloat(editBalanceVal)
      });
      setEditBalanceId(null);
      setActionMsg('✅ Solde mis à jour.');
      fetchAccountsStore();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setActionMsg('❌ Erreur lors de la mise à jour du solde.');
    } finally { setBalanceSaving(false); }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'openbank_export_enrichi.csv');
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error("Export error", error);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 className="title">Paramètres</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Accounts Management — full width */}
        <Card title="Comptes bancaires" style={{ gridColumn: '1 / -1' }}>
          {actionMsg && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: actionMsg.startsWith('✅') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: actionMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', fontWeight: '500', fontSize: '0.9rem' }}>
              {actionMsg}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', backgroundColor: 'var(--bg-app)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div className="font-semibold">{acc.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>{acc.type}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-semibold" style={{ color: acc.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {fmt(acc.balance)}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>solde total</div>
                  </div>
                </div>

                {/* Current Balance — inline editor */}
                {editBalanceId === acc.id ? (
                  <div style={{ marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--accent-primary)40' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ajuster le solde actuel</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input type="number" step="0.01" className="input" style={{ fontSize: '0.85rem' }} placeholder="Solde exact aujourd'hui"
                        value={editBalanceVal} onChange={e => setEditBalanceVal(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveBalance(acc.id)} disabled={balanceSaving}
                        style={{ flex: 1, padding: '0.35rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
                        {balanceSaving ? '…' : '✓ Enregistrer'}
                      </button>
                      <button onClick={() => setEditBalanceId(null)}
                        style={{ padding: '0.35rem 0.6rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Solde sur l'application bancaire</div>
                      <div className="font-semibold" style={{ fontSize: '0.9rem' }}>{fmt(acc.balance)}</div>
                    </div>
                    <button onClick={() => startEditBalance(acc)}
                      style={{ padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}>✏️ Ajuster</button>
                  </div>
                )}

                {/* Clear history */}
                {confirmClearId === acc.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Effacer toutes les transactions ?</span>
                    <button onClick={() => handleClearHistory(acc.id)} style={{ padding: '0.25rem 0.6rem', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}>Confirmer</button>
                    <button onClick={() => setConfirmClearId(null)} style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setConfirmClearId(acc.id); setConfirmDeleteId(null); }}
                    style={{ width: '100%', marginBottom: '0.5rem', padding: '0.45rem', fontSize: '0.83rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    🗑️ Effacer l'historique des transactions
                  </button>
                )}

                {/* Delete account */}
                {confirmDeleteId === acc.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Supprimer le compte aussi ?</span>
                    <button onClick={() => handleDeleteAccount(acc.id)} style={{ padding: '0.25rem 0.6rem', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}>Confirmer</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setConfirmDeleteId(acc.id); setConfirmClearId(null); }}
                    style={{ width: '100%', padding: '0.45rem', fontSize: '0.83rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    ⚠️ Supprimer le compte
                  </button>
                )}
              </div>
            ))}
            {accounts.length === 0 && <p className="text-muted" style={{ fontSize: '0.9rem' }}>Aucun compte. Importez d'abord un relevé.</p>}
          </div>
        </Card>

        {/* Export Data */}
        <Card title="Export des données">
          <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
            Téléchargez toutes vos transactions avec leurs catégories et informations enrichies au format CSV.
          </p>
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleExportCSV}>
            <svg className="w-5 h-5" style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Télécharger Export CSV
          </button>
        </Card>

        {/* Users */}
        <Card title="Utilisateurs" className={currentUser.role !== 'ADMIN' ? 'opacity-50' : ''}>
          {currentUser.role !== 'ADMIN' ? (
            <p className="text-muted text-center py-4">Accès réservé aux administrateurs.</p>
          ) : (
            <div className="flex-col gap-4">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <th style={{ padding: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Nom</th>
                      <th style={{ padding: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Email</th>
                      <th style={{ padding: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Rôle</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>{u.name}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span className={`badge ${u.role === 'ADMIN' ? 'badge-info' : 'badge-success'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          <button 
                            className="text-danger" 
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                            onClick={() => handleDeleteUser(u.id)}
                            title="Supprimer"
                          >
                            <svg className="w-5 h-5" style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleAddUser} className="flex gap-2 mt-4">
                <input type="text" className="input" placeholder="Nom" value={newUserName} onChange={e => setNewUserName(e.target.value)} required style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} />
                <input type="email" className="input" placeholder="Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required style={{ flex: 1.5, padding: '0.5rem', fontSize: '0.85rem' }} />
                <button type="submit" className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Ajouter</button>
              </form>
            </div>
          )}
        </Card>

        {/* Auto-categorization Rules */}
        <Card title="Règles d'auto-catégorisation" className="col-span-2" style={{ gridColumn: '1 / -1' }}>
          <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
            Définissez des mots-clés qui assigneront automatiquement une catégorie lors de l'import de futurs relevés bancaires.
          </p>
          
          <div className="flex-col gap-4">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {rules.map(rule => (
                <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)' }}>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{rule.keyword}</span>
                    <svg className="w-4 h-4 text-muted" style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    <span 
                      style={{ 
                        color: rule.category?.color || 'inherit',
                        padding: '0.2rem 0.6rem',
                        background: rule.category?.color ? `${rule.category.color}15` : 'transparent',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: '600'
                      }}
                    >
                      {rule.category ? rule.category.name : 'Unknown'}
                    </span>
                  </div>
                  <button 
                    className="text-danger" 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddRule} className="flex gap-4 items-center mt-4 p-4 border rounded-md" style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-app)' }}>
              <div style={{ flex: 1 }}>
                <label className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.2rem', display: 'block' }}>Si le libellé contient :</label>
                <input type="text" className="input" placeholder="ex: NETFLIX" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.2rem', display: 'block' }}>Classer dans la catégorie :</label>
                <select className="input" value={ruleCategoryId} onChange={e => setRuleCategoryId(e.target.value)} required>
                  <option value="">Sélectionner...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ paddingTop: '1.2rem' }}>
                <button type="submit" className="btn btn-primary" disabled={rules.length > 50}>Créer la règle</button>
              </div>
            </form>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Settings;
