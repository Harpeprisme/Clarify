import React, { useState, useEffect } from 'react';
import api, { getUsers, createUser, updateUser, deleteUser } from '../api';
import Card from './Card';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Add User Form
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'READER' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      showMsg('Erreur lors du chargement des utilisateurs', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser(formData);
      showMsg('Collaborateur ajouté avec succès');
      setFormData({ name: '', email: '', password: '', role: 'READER' });
      setShowAdd(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      showMsg(err.response?.data?.error || 'Erreur lors de la création', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'ADMIN' ? 'READER' : 'ADMIN';
    try {
      await updateUser(user.id, { role: newRole });
      showMsg(`Rôle de ${user.name} mis à jour : ${newRole}`);
      fetchUsers();
    } catch (err) {
      console.error(err);
      showMsg('Erreur lors du changement de rôle', 'danger');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer l'accès de ${name} ?`)) return;
    try {
      await deleteUser(id);
      showMsg('Utilisateur supprimé');
      fetchUsers();
    } catch (err) {
      console.error(err);
      showMsg('Erreur lors de la suppression', 'danger');
    }
  };

  return (
    <div className="flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="h2-title mb-1">Équipe & Accès</h2>
          <p className="text-muted text-sm">Gérez les permissions et les accès de vos collaborateurs en toute sécurité.</p>
        </div>
        {!showAdd && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
             <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="mr-1"><path d="M12 4v16m8-8H4"/></svg>
             Recruter
          </button>
        )}
      </div>

      {msg.text && (
        <div className="p-4 rounded-xl glass-card animate-in fade-in slide-in-from-top-2 duration-300" 
             style={{ border: `1px solid ${msg.type === 'success' ? 'var(--success)' : 'var(--danger)'}40`, background: msg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.2rem' }}>{msg.type === 'success' ? '✨' : '⚠️'}</span>
            <span className="font-semibold text-sm" style={{ color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{msg.text}</span>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="animate-in zoom-in-95 duration-300">
          <Card title="Nouveau Collaborateur" style={{ border: '1px solid var(--accent-primary)30', background: 'rgba(45, 225, 194, 0.02)' }}>
            <form onSubmit={handleAddUser} className="flex-col gap-6">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="flex-col gap-2">
                  <label className="text-[10px] font-bold text-muted ml-1 uppercase tracking-widest">Identité</label>
                  <input 
                    className="input" 
                    placeholder="Prénom Nom" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="flex-col gap-2">
                  <label className="text-[10px] font-bold text-muted ml-1 uppercase tracking-widest">Email Professionnel</label>
                  <input 
                    type="email" 
                    className="input" 
                    placeholder="collaborateur@entreprise.com" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="flex-col gap-2">
                  <label className="text-[10px] font-bold text-muted ml-1 uppercase tracking-widest">Password Temporaire</label>
                  <input 
                    type="password" 
                    className="input" 
                    placeholder="••••••••" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    required 
                  />
                </div>
                <div className="flex-col gap-2">
                  <label className="text-[10px] font-bold text-muted ml-1 uppercase tracking-widest">Niveau d'Accès</label>
                  <select 
                    className="input" 
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="READER">Utilisateur Standard (Lecture/Écriture)</option>
                    <option value="ADMIN">Administrateur (Contrôle total)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-light">
                <button type="button" className="btn btn-outline px-8" onClick={() => setShowAdd(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary px-10" disabled={saving}>
                  {saving ? '…' : 'Créer l\'accès'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div className="glass-card shadow-xl overflow-hidden" style={{ borderRadius: '24px', border: '1px solid var(--border-light)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', tracking: '0.1em' }}>Collaborateur</th>
                <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', tracking: '0.1em' }}>Permissions</th>
                <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', tracking: '0.1em' }}>Inscrit le</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', tracking: '0.1em' }}>Gestion</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ padding: '5rem', textAlign: 'center' }} className="text-muted italic">Séquençage des données...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '5rem', textAlign: 'center' }} className="text-muted">Aucun collaborateur actif.</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="transition-all hover:bg-white/5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div className="flex items-center gap-4">
                      <div className="avatar" style={{ 
                        width: 44, height: 44, borderRadius: '16px', 
                        background: 'var(--accent-gradient)', padding: '1.5px'
                      }}>
                        <div className="w-full h-full rounded-[14.5px] bg-surface flex items-center justify-center font-bold text-sm text-primary">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-sm leading-tight mb-0.5">{u.name}</div>
                        <div className="text-muted text-xs">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div className="flex items-center gap-2">
                       <span 
                        className={`badge ${u.role === 'ADMIN' ? 'badge-primary' : 'badge-outline'}`}
                        style={{ 
                          fontSize: '10px', fontWeight: '800', border: 'none',
                          background: u.role === 'ADMIN' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                          color: u.role === 'ADMIN' ? 'white' : 'var(--text-muted)',
                          padding: '0.4rem 0.8rem',
                          boxShadow: u.role === 'ADMIN' ? 'var(--shadow-lvl2)' : 'none'
                        }}
                      >
                        {u.role === 'ADMIN' ? 'ADMIN' : 'READER'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '500' }}>
                    {new Date(u.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <div className="flex gap-3 justify-end">
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem', borderRadius: '10px' }}
                        onClick={() => handleToggleRole(u)}
                        title="Inverser les droits d'accès"
                      >
                         ⚡ Rôle
                      </button>
                      <button 
                        className="p-2.5 rounded-xl text-muted hover:text-danger hover:bg-danger-bg transition-all"
                        onClick={() => handleDelete(u.id, u.name)}
                        title="Révoquer l'accès"
                      >
                        <svg className="w-5 h-5" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersManagement;
