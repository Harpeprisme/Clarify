import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';

const Settings = () => {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [accountTypes, setAccountTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Rule form
  const [newKeyword, setNewKeyword] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState('');

  // Account Type form
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeGroup, setNewTypeGroup] = useState('COURANT');

  // Accounts: confirm states per account id
  const [confirmClearId, setConfirmClearId]   = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [actionMsg, setActionMsg]             = useState('');

  // currentBalance editing — per account
  const [editBalanceId, setEditBalanceId]     = useState(null);   // which account is being edited
  const [editBalanceVal, setEditBalanceVal]   = useState('');
  const [balanceSaving, setBalanceSaving]     = useState(false);


  const navigate = useNavigate();
  const currentUser = useStore(state => state.user) || { name: 'Admin', role: 'ADMIN' };
  const accounts = useStore(state => state.accounts);
  const fetchAccountsStore = useStore(state => state.fetchAccounts);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, rulesRes, typesRes] = await Promise.all([
        api.get('/categories'),
        api.get('/rules'),
        api.get('/account-types'),
      ]);
      setCategories(catRes.data);
      setRules(rulesRes.data);
      setAccountTypes(typesRes.data);
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

  const handleAddAccountType = async (e) => {
    e.preventDefault();
    if (!newTypeName || !newTypeGroup) return;
    try {
      await api.post('/account-types', {
        id: newTypeName.toUpperCase().replace(/\s+/g, '_'),
        name: newTypeName,
        group: newTypeGroup
      });
      setNewTypeName('');
      fetchData();
      useStore.getState().fetchAccountTypes();
    } catch (err) { console.error(err); }
  };

  const handleDeleteAccountType = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce type de compte ?')) return;
    try {
      await api.delete(`/account-types/${id}`);
      fetchData();
      useStore.getState().fetchAccountTypes();
    } catch (err) { console.error(err); }
  };

  const handleClearHistory = async (accountId) => {
    try {
      const { data } = await api.delete(`/accounts/${accountId}/transactions`);
      setConfirmClearId(null);
      await fetchAccountsStore();
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setActionMsg('❌ Erreur lors de la suppression.');
    }
  };

  const handleDeleteAccount = async (accountId) => {
    try {
      await api.delete(`/accounts/${accountId}`);
      setConfirmDeleteId(null);
      await fetchAccountsStore();
      navigate('/dashboard');
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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 className="title">Paramètres</h1>

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

          {currentUser.role === 'ADMIN' && (
            <Card title="Types de comptes (Admin)" style={{ gridColumn: '1 / -1' }}>
              <p className="text-muted mb-6 text-sm">
                Gérez les types de comptes et leurs regroupements (Courant, Épargne, Investissements).
              </p>
              <div className="flex-col gap-6">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {accountTypes.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)' }}>
                      <div>
                        <div className="font-bold text-sm">{t.name}</div>
                        <div className="text-xs text-muted uppercase tracking-widest">{t.group}</div>
                      </div>
                      <button className="text-danger p-2 hover:bg-danger-bg rounded-lg transition-all" onClick={() => handleDeleteAccountType(t.id)}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-2xl glass-card border border-light" style={{ background: 'rgba(45, 225, 194, 0.03)' }}>
                  <form onSubmit={handleAddAccountType} className="flex gap-4 items-end">
                    <div style={{ flex: 1 }}>
                      <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">Nom</label>
                      <input type="text" className="input" placeholder="ex: Assurance-Vie" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">Groupe</label>
                      <select className="input" value={newTypeGroup} onChange={e => setNewTypeGroup(e.target.value)} required>
                        <option value="COURANT">COURANT</option>
                        <option value="EPARGNE">ÉPARGNE</option>
                        <option value="INVESTISSEMENT">INVESTISSEMENT</option>
                        <option value="CREDIT">CRÉDIT</option>
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary px-8" style={{ height: '42px' }}>
                      Ajouter
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          )}

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

          <ForecastSettingsCard />
        </div>
    </div>
  );
};

// ── Forecast Settings Card ──────────────────────────────────────────────────
const ForecastSettingsCard = () => {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/forecasts/settings')
      .then(({ data }) => setSettings(data))
      .catch(err => console.error('Forecast settings error:', err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/forecasts/settings', {
        monthlySalary: settings.monthlySalary || null,
        safetyBuffer: settings.safetyBuffer,
        detectionMinOccurrences: settings.detectionMinOccurrences,
        detectionAmountTolerance: settings.detectionAmountTolerance,
        detectionDayTolerance: settings.detectionDayTolerance,
      });
      setSettings(data);
      setMsg('✅ Paramètres sauvegardés');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setMsg('❌ Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  };

  if (!settings) return null;

  return (
    <Card title="Prévisions & Récurrences" style={{ gridColumn: '1 / -1' }}>
      <p className="text-muted mb-6 text-sm">
        Configurez les paramètres utilisés pour la détection automatique des abonnements et les prévisions financières.
      </p>

      {msg && (
        <div className="p-3 mb-4 rounded-xl font-semibold text-sm"
             style={{ backgroundColor: msg.startsWith('✅') ? 'rgba(39,174,96,0.1)' : 'rgba(255,107,107,0.1)', color: msg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Salary */}
        <div>
          <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">
            Salaire net mensuel (€)
          </label>
          <input
            type="number" step="0.01" className="input"
            placeholder="Détection automatique si vide"
            value={settings.monthlySalary ?? ''}
            onChange={e => setSettings(s => ({ ...s, monthlySalary: e.target.value ? parseFloat(e.target.value) : null }))}
          />
          <p className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
            Laissez vide pour que le moteur utilise la détection automatique des revenus récurrents.
          </p>
        </div>

        {/* Safety buffer */}
        <div>
          <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">
            Coussin de sécurité (€)
          </label>
          <input
            type="number" step="1" className="input"
            value={settings.safetyBuffer}
            onChange={e => setSettings(s => ({ ...s, safetyBuffer: parseFloat(e.target.value) || 0 }))}
          />
          <p className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
            Montant minimum à conserver. Utilisé pour le calcul du potentiel d'épargne.
          </p>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
        <h4 className="font-semibold mb-4 text-muted" style={{ fontSize: '0.85rem' }}>Sensibilité de la détection</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">
              Occurrences minimum
            </label>
            <input
              type="number" min="2" max="12" className="input"
              value={settings.detectionMinOccurrences}
              onChange={e => setSettings(s => ({ ...s, detectionMinOccurrences: parseInt(e.target.value) || 2 }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">
              Tolérance montant (%)
            </label>
            <input
              type="number" min="1" max="50" className="input"
              value={settings.detectionAmountTolerance}
              onChange={e => setSettings(s => ({ ...s, detectionAmountTolerance: parseFloat(e.target.value) || 15 }))}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted mb-2 ml-1 block uppercase tracking-widest">
              Tolérance intervalle (jours)
            </label>
            <input
              type="number" min="1" max="15" className="input"
              value={settings.detectionDayTolerance}
              onChange={e => setSettings(s => ({ ...s, detectionDayTolerance: parseInt(e.target.value) || 5 }))}
            />
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="btn btn-primary px-8" style={{ height: '42px' }} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Sauvegarder les paramètres'}
      </button>
    </Card>
  );
};

export default Settings;
