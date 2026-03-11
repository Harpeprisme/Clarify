import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Card from '../components/Card';
import useStore from '../store';
import { format } from 'date-fns';

const Import = () => {
  const [file, setFile] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('COURANT');
  
  // Balance to set AFTER import
  const [importCurrentBalance, setImportCurrentBalance] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState(null);
  
  const fetchAccountsStore = useStore(state => state.fetchAccounts);
  const navigate = useNavigate();
  const fileInputRef = useRef();

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const { data } = await api.get('/accounts');
      setAccounts(data);
      if (data.length > 0 && !accountId) setAccountId(data[0].id.toString());
      else if (data.length === 0) setIsCreatingAccount(true);
    } catch (err) { console.error(err); }
  };

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setDetectedFormat(null);
    setStatus({ type: '', message: '' });
    setDetecting(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const { data } = await api.post('/import/detect', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDetectedFormat(data);
    } catch (err) { console.warn('Format detection failed:', err); }
    finally { setDetecting(false); }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { data } = await api.post('/accounts', {
        name:           newAccountName,
        type:           newAccountType,
      });
      await loadAccounts();
      setAccountId(data.id.toString());
      setIsCreatingAccount(false);
      setNewAccountName('');
      setStatus({ type: 'success', message: 'Compte créé avec succès !' });
      fetchAccountsStore();
    } catch (err) {
      console.error("Account creation failed:", err);
      // Give the user the exact error message so they see what went wrong
      const msg = err.response?.data?.error || err.message || 'Erreur inconnue';
      setStatus({ type: 'error', message: `Erreur: ${msg}` });
    } finally { setLoading(false); }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file || !accountId) {
      setStatus({ type: 'error', message: 'Veuillez sélectionner un fichier et un compte.' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId);
    if (importCurrentBalance !== '') {
      formData.append('currentBalance', importCurrentBalance);
    }

    try {
      setLoading(true);
      setStatus({ type: 'info', message: 'Import et catégorisation en cours...' });
      
      const { data } = await api.post('/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setStatus({ 
        type: 'success', 
        message: `✅ Import réussi ! ${data.rowsImported} transactions importées${data.rowsSkipped > 0 ? ` (${data.rowsSkipped} doublons ignorés)` : ''}. ${data.transfersDetected > 0 ? `${data.transfersDetected} virements internes détectés.` : ''}`
      });
      setFile(null);
      setDetectedFormat(null);
      setImportCurrentBalance('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      fetchAccountsStore();
      setTimeout(() => navigate('/transactions'), 3000);

    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Erreur lors de l\'importation du fichier CSV.'
      });
    } finally {
      setLoading(false);
    }
  };

  const statusBg = {
    error: 'rgba(239, 68, 68, 0.12)',
    success: 'rgba(16, 185, 129, 0.12)',
    info: 'rgba(59, 130, 246, 0.12)',
  };
  const statusColor = {
    error: 'var(--danger)',
    success: 'var(--success)',
    info: 'var(--info)',
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="title">Importer un relevé bancaire CSV</h1>
      
      {status.message && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: statusBg[status.type] || 'var(--bg-surface)',
          color: statusColor[status.type] || 'var(--text-main)',
          border: `1px solid ${statusColor[status.type] || 'var(--border-light)'}20`,
          fontWeight: '500'
        }}>
          {status.message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Account Selection */}
        <Card title="1. Compte de destination">
          {!isCreatingAccount ? (
            <div className="flex-col gap-4">
              {accounts.length > 0 ? (
                <>
                  <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                    ))}
                  </select>
                  <div style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => setIsCreatingAccount(true)}>
                      + Nouveau compte
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center" style={{ padding: '1rem' }}>
                  <p className="text-muted mb-4">Vous n'avez pas encore de compte.</p>
                  <button type="button" className="btn btn-primary" onClick={() => setIsCreatingAccount(true)}>
                    Créer mon premier compte
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateAccount} className="flex-col gap-4">
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nom du compte</label>
                <input type="text" className="input" placeholder="Ex: Compte Joint Boursorama" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Type de compte</label>
                <select className="input" value={newAccountType} onChange={e => setNewAccountType(e.target.value)}>
                  <option value="COURANT">Compte Courant</option>
                  <option value="LIVRET_A">Livret A</option>
                  <option value="PEA">PEA</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Création...' : 'Créer'}</button>
                {accounts.length > 0 && (
                  <button type="button" className="btn btn-outline" onClick={() => setIsCreatingAccount(false)}>Annuler</button>
                )}
              </div>
            </form>
          )}
        </Card>

        {/* File Upload */}
        <Card title="2. Fichier CSV">
          <div
            style={{
              border: `2px dashed ${file ? 'var(--accent-primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '3rem 2rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-app)',
              position: 'relative',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={e => handleFileChange(e.target.files[0])}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              disabled={accounts.length === 0 || isCreatingAccount}
            />
            <div style={{ pointerEvents: 'none' }}>
              <svg style={{ width: '48px', height: '48px', margin: '0 auto 1rem', color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {detecting ? (
                <p style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>Analyse du format en cours…</p>
              ) : file ? (
                <p className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                  {file.name} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({(file.size / 1024).toFixed(1)} Ko)</span>
                </p>
              ) : (
                <>
                  <p className="font-semibold" style={{ marginBottom: '0.5rem' }}>Glissez-déposez votre CSV ici</p>
                  <p className="text-muted" style={{ fontSize: '0.9rem' }}>ou cliquez pour parcourir vos fichiers</p>
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
                    Compatible : Crédit Agricole, BNP, Société Générale, Boursorama, LCL, Fortuneo, N26, Revolut, Wise…
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Format Detection Panel */}
          {detectedFormat && !detecting && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)'
            }}>
              <p className="font-semibold mb-2" style={{ fontSize: '0.9rem' }}>
                🔍 Format détecté automatiquement
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.85rem' }}>
                <div><span className="text-muted">Séparateur : </span><code style={{ backgroundColor: 'var(--bg-surface)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{detectedFormat.delimiter}</code></div>
                <div><span className="text-muted">En-têtes sautés : </span><strong>{detectedFormat.skippedHeaderRows}</strong></div>
                {detectedFormat.dateColumn && <div><span className="text-muted">Colonne date : </span><strong>{detectedFormat.dateColumn}</strong></div>}
                {detectedFormat.descColumn && <div><span className="text-muted">Colonne libellé : </span><strong>{detectedFormat.descColumn}</strong></div>}
                {detectedFormat.amountColumn && <div><span className="text-muted">Colonne montant : </span><strong>{detectedFormat.amountColumn}</strong></div>}
                {detectedFormat.debitColumn && <div><span className="text-muted">Colonne débit : </span><strong>{detectedFormat.debitColumn}</strong></div>}
                {detectedFormat.creditColumn && <div><span className="text-muted">Colonne crédit : </span><strong>{detectedFormat.creditColumn}</strong></div>}
              </div>
              {detectedFormat.sampleRows?.length > 0 && (
                <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Aperçu (3 premières lignes)</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '400px' }}>
                    <thead>
                      <tr>
                        {detectedFormat.columns.filter(c => c.trim()).slice(0, 5).map(col => (
                          <th key={col} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detectedFormat.sampleRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          {detectedFormat.columns.filter(c => c.trim()).slice(0, 5).map(col => (
                            <td key={col} style={{ padding: '0.4rem 0.6rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {String(row[col] || '').substring(0, 40)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 3. Final Balance Adjustment */}
        {file && !detecting && (
          <Card className="border-accent">
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              <div>
                <p className="font-semibold" style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  💰 3. Solde final après import (Optionnel)
                </p>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Si vous importez des transactions récentes, indiquez le solde de votre compte <strong>tel qu'il apparaît aujourd'hui</strong> sur votre application bancaire. L'application ajustera intelligemment l'historique pour retomber exactement sur ce solde final.
                </p>
              </div>
              <div style={{ maxWidth: '300px' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Solde bancaire actuel (€)</label>
                <input type="number" step="0.01" className="input" placeholder="Ex: 1524.30"
                  value={importCurrentBalance} onChange={e => setImportCurrentBalance(e.target.value)} />
              </div>
            </div>
          </Card>
        )}

        {/* Import Button */}
        <button
          onClick={handleImport}
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
          disabled={!file || !accountId || loading || isCreatingAccount || detecting}
        >
          {loading ? 'Traitement en cours…' : detecting ? 'Analyse du fichier…' : 'Importer et catégoriser'}
        </button>

      </div>
    </div>
  );
};

export default Import;
