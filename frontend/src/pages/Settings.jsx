import React, { useState, useEffect } from 'react';
import api from '../api';
import Card from '../components/Card';
import UsersManagement from '../components/UsersManagement';
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

  const [activeTab, setActiveTab] = useState('profile');

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
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="title mb-0">Paramètres</h1>
        </div>
        
        {/* Modern Premium Tabs */}
        {currentUser.role === 'ADMIN' && (
          <div className="flex p-1 rounded-2xl glass-card" style={{ border: '1px solid var(--border-light)' }}>
            <button 
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'profile' ? 'bg-primary text-white shadow-lvl2' : 'text-muted hover:text-main hover:bg-white/5'}`}
              onClick={() => setActiveTab('profile')}
            >
              Mon Profil
            </button>
            <button 
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'users' ? 'bg-primary text-white shadow-lvl2' : 'text-muted hover:text-main hover:bg-white/5'}`}
              onClick={() => setActiveTab('users')}
            >
              Équipe & Accès
            </button>
          </div>
        )}
      </div>

      {activeTab === 'profile' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          
          {/* Accounts Management — full width */}
          <Card title="Comptes bancaires" style={{ gridColumn: '1 / -1' }}>
            {actionMsg && (
              <div className="p-3 mb-4 rounded-xl font-semibold text-sm" 
                   style={{ backgroundColor: actionMsg.startsWith('✅') ? 'var(--success-bg)' : 'var(--danger-bg)', color: actionMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>
                {actionMsg}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {accounts.map(acc => (
                <div key={acc.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', backgroundColor: 'var(--bg-app)' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div className="font-bold text-lg">{acc.name}</div>
                      <div className="text-muted text-xs uppercase tracking-widest">{acc.type}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-bold text-lg" style={{ color: acc.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {fmt(acc.balance)}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>solde total</div>
                    </div>
                  </div>

                  {/* Current Balance — inline editor */}
                  {editBalanceId === acc.id ? (
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--accent-primary)40' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: '600' }}>Ajuster le solde actuel</p>
                      <input type="number" step="0.01" className="input mb-3" style={{ fontSize: '0.9rem' }} autoFocus
                        value={editBalanceVal} onChange={e => setEditBalanceVal(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={() => saveBalance(acc.id)} disabled={balanceSaving} className="btn btn-primary" style={{ flex: 1, height: '36px', fontSize: '0.8rem' }}>
                          {balanceSaving ? '…' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setEditBalanceId(null)} className="btn btn-outline" style={{ height: '36px' }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 rounded-xl border border-light flex justify-between items-center bg-surface">
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Solde actuel</div>
                        <div className="font-bold">{fmt(acc.balance)}</div>
                      </div>
                      <button onClick={() => startEditBalance(acc)} className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>✏️ Ajuster</button>
                    </div>
                  )}

                  <div className="flex-col gap-2">
                    {/* Clear history */}
                    {confirmClearId === acc.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleClearHistory(acc.id)} className="btn btn-primary" style={{ flex: 2, background: 'var(--danger)', fontSize: '0.7rem' }}>EFFACER</button>
                        <button onClick={() => setConfirmClearId(null)} className="btn btn-outline" style={{ flex: 1 }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setConfirmClearId(acc.id); setConfirmDeleteId(null); }} className="btn btn-outline w-full text-xs py-2">
                        🗑️ Effacer l'historique
                      </button>
                    )}

                    {/* Delete account */}
                    {confirmDeleteId === acc.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteAccount(acc.id)} className="btn btn-primary" style={{ flex: 2, background: 'var(--danger)', fontSize: '0.7rem' }}>SUPPRIMER</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="btn btn-outline" style={{ flex: 1 }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setConfirmDeleteId(acc.id); setConfirmClearId(null); }} className="btn btn-outline w-full text-xs py-2 text-danger" style={{ borderColor: 'var(--danger-bg)' }}>
                        ⚠️ Supprimer le compte
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {accounts.length === 0 && <p className="text-muted p-6">Aucun compte bancaire configuré.</p>}
            </div>
          </Card>

          {/* Export Data */}
          <Card title="Export des données">
            <p className="text-muted mb-6 text-sm">
              Téléchargez toutes vos transactions avec leurs catégories et informations enrichies au format CSV.
            </p>
            <button className="btn btn-primary px-8 py-3" onClick={handleExportCSV}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="mr-2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Télécharger Export CSV
            </button>
          </Card>

          {/* Auto-categorization Rules */}
          <Card title="Règles d'automatisations" style={{ gridColumn: '1 / -1' }}>
            <p className="text-muted mb-6 text-sm">
              Définissez des mots-clés pour classer automatiquement vos transactions lors des futurs imports.
            </p>
            
            <div className="flex-col gap-6">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {rules.map(rule => (
                  <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)' }}>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm bg-surface px-2 py-1 rounded border border-light">{rule.keyword}</span>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" className="text-muted"><path d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ color: '#fff', background: rule.category?.color || 'var(--slate-gray)' }}>
                        {rule.category?.name || 'Autres'}
                      </span>
                    </div>
                    <button className="text-danger p-2 hover:bg-danger-bg rounded-lg transition-all" onClick={() => handleDeleteRule(rule.id)}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-2xl glass-card border border-light" style={{ background: 'rgba(45, 225, 194, 0.03)' }}>
                <form onSubmit={handleAddRule} className="flex gap-4 items-end">
                  <div style={{ flex: 1 }}>
                    <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">Si libellé contient</label>
                    <input type="text" className="input" placeholder="ex: NETFLIX" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">Catégorie cible</label>
                    <select className="input" value={ruleCategoryId} onChange={e => setRuleCategoryId(e.target.value)} required>
                      <option value="">Choisir...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary px-8" style={{ height: '42px' }} disabled={rules.length > 50}>
                    Créer la règle
                  </button>
                </form>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <UsersManagement />
      )}
    </div>
  );
};

export default Settings;
