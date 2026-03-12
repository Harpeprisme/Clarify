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
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="title mb-1">Paramètres</h1>
          <p className="text-muted text-sm">Gérez vos préférences, vos comptes et les accès de votre équipe.</p>
        </div>
        
        {/* Modern Tab Switcher */}
        {currentUser.role === 'ADMIN' && (
          <div className="flex p-1.5 rounded-2xl glass-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)' }}>
            <button 
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'profile' ? 'bg-primary text-white shadow-lvl2' : 'text-muted hover:text-main hover:bg-white/5'}`}
              onClick={() => setActiveTab('profile')}
              style={{ minWidth: '140px' }}
            >
              Mon Profil
            </button>
            <button 
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'users' ? 'bg-primary text-white shadow-lvl2' : 'text-muted hover:text-main hover:bg-white/5'}`}
              onClick={() => setActiveTab('users')}
              style={{ minWidth: '140px' }}
            >
              Équipe & Accès
            </button>
          </div>
        )}
      </div>

      {activeTab === 'profile' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
          
          {/* Accounts Management */}
          <div style={{ gridColumn: '1 / span 8' }} className="flex-col gap-6">
            <Card title="Comptes bancaires">
              <p className="text-muted text-sm mb-6">Ajustez les soldes de vos comptes connectés et gérez l'historique des données.</p>
              
              {actionMsg && (
                <div className="mb-6 p-4 rounded-xl glass-card" 
                     style={{ border: `1px solid ${actionMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)'}40` }}>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: '1.2rem' }}>{actionMsg.startsWith('✅') ? '✨' : '⚠️'}</span>
                    <span className="font-semibold text-sm" style={{ color: actionMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{actionMsg}</span>
                  </div>
                </div>
              )}

              <div className="flex-col gap-4">
                {accounts.map(acc => (
                  <div key={acc.id} className="p-5 rounded-2xl transition-all border border-light bg-surface-light" 
                       style={{ background: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}>
                    
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: acc.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}></div>

                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl" style={{ border: '1px solid var(--border-light)', background: 'var(--bg-app)' }}>
                          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{acc.name}</h4>
                          <span className="badge badge-outline" style={{ fontSize: '10px', opacity: 0.7 }}>{acc.type.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-muted font-semibold mb-1 uppercase tracking-wider">SOLDE ACTUEL</div>
                        <div className="text-xl font-bold" style={{ color: acc.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {fmt(acc.balance)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-light">
                      <button onClick={() => startEditBalance(acc)} 
                              className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', flex: 1 }}>
                        ✏️ Ajuster
                      </button>
                      <button onClick={() => { setConfirmClearId(acc.id); setConfirmDeleteId(null); }}
                              className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', flex: 1 }}>
                        🗑️ Effacer
                      </button>
                      <button onClick={() => { setConfirmDeleteId(acc.id); setConfirmClearId(null); }}
                              className="btn btn-outline text-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', flex: 0.4, borderColor: 'var(--danger-bg)' }}>
                        ⚠️ Supprimer
                      </button>
                    </div>

                    {editBalanceId === acc.id && (
                      <div className="mt-4 p-4 rounded-xl glass-card" style={{ border: '1px solid var(--accent-primary)40' }}>
                        <label className="text-xs font-bold text-muted mb-2 block uppercase">Nouveau solde réel</label>
                        <div className="flex gap-2">
                          <input type="number" step="0.01" className="input" style={{ flex: 1, fontSize: '0.85rem' }} autoFocus
                                 value={editBalanceVal} onChange={e => setEditBalanceVal(e.target.value)} />
                          <button onClick={() => saveBalance(acc.id)} disabled={balanceSaving} className="btn btn-primary text-sm px-4">
                            Enregistrer
                          </button>
                          <button onClick={() => setEditBalanceId(null)} className="btn btn-outline text-sm">Annuler</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Automatisations">
                <p className="text-muted text-sm mb-6">Assignez automatiquement des catégories lors de l'import de futurs relevés.</p>
                
                <div className="flex flex-wrap gap-3 mb-8">
                    {rules.map(rule => (
                    <div key={rule.id} className="flex items-center gap-3 p-2.5 px-4 rounded-xl border border-light bg-surface group relative">
                        <span className="font-bold text-sm">{rule.keyword}</span>
                        <div className="w-px h-4 bg-border-light"></div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" 
                                style={{ color: '#fff', background: rule.category?.color || 'var(--slate-gray)' }}>
                            {rule.category?.name || 'Autres'}
                        </span>
                        <button onClick={() => handleDeleteRule(rule.id)} 
                                className="ml-2 text-danger hover:scale-120 transition-all">×</button>
                    </div>
                    ))}
                </div>

                <div className="p-5 rounded-2xl glass-card" style={{ background: 'rgba(45, 225, 194, 0.03)', border: '1px solid var(--accent-primary)20' }}>
                    <form onSubmit={handleAddRule} className="flex gap-3 items-end">
                        <div style={{ flex: 2 }}>
                            <label className="text-[10px] font-bold text-muted mb-1 ml-1 block uppercase">Mot-clé</label>
                            <input type="text" className="input text-sm" placeholder="ex: NETFLIX" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} required />
                        </div>
                        <div style={{ flex: 2 }}>
                            <label className="text-[10px] font-bold text-muted mb-1 ml-1 block uppercase">Catégorie</label>
                            <select className="input text-sm" value={ruleCategoryId} onChange={e => setRuleCategoryId(e.target.value)} required>
                                <option value="">Choisir...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Ajouter</button>
                    </form>
                </div>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div style={{ gridColumn: '9 / span 4' }} className="flex-col gap-6">
            <Card>
                <div className="text-center py-4">
                    <div className="avatar-placeholder mx-auto mb-4" style={{ 
                    width: 80, height: 80, borderRadius: '24px', 
                    background: 'var(--accent-gradient)', padding: '2px'
                    }}>
                        <div className="w-full h-full rounded-[22px] bg-surface flex items-center justify-center font-bold text-3xl text-primary">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <h3 className="font-bold text-xl mb-1">{currentUser.name}</h3>
                    <p className="text-muted text-xs mb-6">{currentUser.email}</p>
                    
                    <div className="flex-col gap-2">
                        <div className="p-3 rounded-xl text-left border border-light" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="text-[10px] font-bold text-muted mb-1 uppercase tracking-widest">Rôle Actuel</div>
                            <div className="text-sm font-bold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--accent-primary)]"></span>
                                {currentUser.role === 'ADMIN' ? 'Administrateur' : 'Collaborateur'}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Données & Export">
                <div className="flex-col gap-4">
                    <div className="p-4 rounded-xl bg-surface-light border border-light">
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📑</div>
                        <h5 className="font-bold text-sm mb-1">Export CSV</h5>
                        <p className="text-muted text-[10px] mb-4">Téléchargez l'intégralité de vos données enrichies.</p>
                        <button className="btn btn-primary w-full text-xs" onClick={handleExportCSV}>
                            Exporter tout
                        </button>
                    </div>
                </div>
            </Card>
          </div>
        </div>
      ) : (
        <UsersManagement />
      )}
    </div>
  );
};

export default Settings;
