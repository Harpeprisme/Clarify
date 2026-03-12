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
    <div className="flex-col gap-6">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-xl font-bold">Équipe & Accès</h2>
          <p className="text-muted text-sm">Gérez les permissions et les accès de vos collaborateurs.</p>
        </div>
        {!showAdd && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Nouvel utilisateur
          </button>
        )}
      </div>

      {msg.text && (
        <div className={`badge badge-${msg.type}`} style={{ padding: '0.75rem 1rem', width: '100%', display: 'block', textAlign: 'center' }}>
          {msg.text}
        </div>
      )}

      {showAdd && (
        <Card title="Ajouter un collaborateur" style={{ border: '1px solid var(--accent-primary)40' }}>
          <form onSubmit={handleAddUser} className="flex-col gap-4">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="flex-col gap-1">
                <label className="text-xs font-semibold text-muted ml-1">NOM COMPLET</label>
                <input 
                  className="input" 
                  placeholder="ex: Marie Curie" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="flex-col gap-1">
                <label className="text-xs font-semibold text-muted ml-1">ADRESSE EMAIL</label>
                <input 
                  type="email" 
                  className="input" 
                  placeholder="marie@clarify.app" 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="flex-col gap-1">
                <label className="text-xs font-semibold text-muted ml-1">MOT DE PASSE TEMPORAIRE</label>
                <input 
                  type="password" 
                  className="input" 
                  placeholder="********" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  required 
                />
              </div>
              <div className="flex-col gap-1">
                <label className="text-xs font-semibold text-muted ml-1">RÔLE</label>
                <select 
                  className="input" 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="READER">Utilisateur (Lecture/Écriture)</option>
                  <option value="ADMIN">Administrateur (Gestion équipe)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                {saving ? 'Création...' : 'Confirmer la création'}
              </button>
              <button type="button" className="btn btn-outline" style={{ flex: 0.4 }} onClick={() => setShowAdd(false)}>
                Annuler
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="glass shadow-xl overflow-hidden" style={{ borderRadius: '12px', border: '1px solid var(--border-light)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.8rem' }}>UTILISATEUR</th>
              <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.8rem' }}>RÔLE</th>
              <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.8rem' }}>DATE D'AJOUT</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center' }} className="text-muted">Chargement de la liste...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center' }} className="text-muted">Aucun collaborateur.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover-bg" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '1rem' }}>
                  <div className="flex items-center gap-3">
                    <div className="avatar-placeholder" style={{ 
                      width: 36, height: 36, borderRadius: '50%', 
                      background: 'var(--accent-primary)20', 
                      color: 'var(--accent-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '0.9rem'
                    }}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{u.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span 
                    className={`badge ${u.role === 'ADMIN' ? 'badge-primary' : 'badge-outline'}`}
                    style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    {u.role === 'ADMIN' ? '🔐 Administrateur' : '👤 Utilisateur'}
                  </span>
                </td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {new Date(u.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <div className="flex gap-2 justify-end">
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => handleToggleRole(u)}
                      title="Changer le rôle"
                    >
                      Permuter rôle
                    </button>
                    <button 
                      className="text-danger" 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
                      onClick={() => handleDelete(u.id, u.name)}
                      title="Supprimer l'accès"
                    >
                      <svg className="w-5 h-5" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersManagement;
