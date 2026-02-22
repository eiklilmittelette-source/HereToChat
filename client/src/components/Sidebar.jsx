import React, { useState, useRef } from 'react';
import { apiUrl } from '../api';

function picUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return apiUrl(path);
}

function UserAvatar({ user, size, onClick, editable }) {
  const s = size || 42;
  const style = { width: s, height: s, objectFit: 'cover', cursor: editable ? 'pointer' : 'default' };
  if (user.profile_pic) {
    return <img src={picUrl(user.profile_pic)} alt={user.username} className="avatar" style={style} onClick={onClick} />;
  }
  return (
    <div className="avatar" style={{ ...style, fontSize: s * 0.43 }} onClick={onClick}>
      {(user.nickname || user.full_name || user.username)[0].toUpperCase()}
    </div>
  );
}

function AddContactModal({ onClose, onAdd, currentUser }) {
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [notOnApp, setNotOnApp] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    setError('');
    setLoading(true);
    try {
      const result = await onAdd(phone.trim(), nickname.trim());
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  async function handleImportContacts() {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      // Contact Picker API not supported (iPhone, desktop, etc.)
      // Fall back to invite link
      const inviteUrl = `${window.location.origin}?invite=${currentUser?.id || ''}`;
      const text = `Rejoins-moi sur HereToChat ! ${inviteUrl}`;
      if (navigator.share) {
        navigator.share({ title: 'HereToChat', text, url: inviteUrl }).catch(() => {});
      } else {
        try { await navigator.clipboard.writeText(text); setImportStatus('Lien d\'invitation copié !'); }
        catch { setError('Partage le lien : ' + inviteUrl); }
      }
      return;
    }
    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      if (!contacts || contacts.length === 0) return;
      setLoading(true);
      setImportStatus(`Import de ${contacts.length} contacts...`);
      let added = 0;
      const missing = [];
      for (const c of contacts) {
        if (c.tel && c.tel[0]) {
          const result = await onAdd(c.tel[0], c.name?.[0] || '');
          if (!result.error) {
            added++;
          } else if (result.error === 'Aucun utilisateur avec ce numéro') {
            missing.push({ name: c.name?.[0] || c.tel[0], tel: c.tel[0] });
          }
        }
      }
      setImportStatus(`${added} contact${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`);
      if (missing.length > 0) {
        setNotOnApp(missing);
      } else {
        setTimeout(() => onClose(), 1500);
      }
    } catch {
      setError('Import annulé');
    } finally {
      setLoading(false);
    }
  }

  function inviteContact(contact) {
    const inviteUrl = `${window.location.origin}?invite=${currentUser?.id || ''}`;
    const text = `Salut ${contact.name} ! Rejoins-moi sur HereToChat : ${inviteUrl}`;
    if (navigator.share) {
      navigator.share({ title: 'HereToChat', text, url: inviteUrl }).catch(() => {});
    } else {
      window.open(`sms:${contact.tel}?body=${encodeURIComponent(text)}`, '_blank');
    }
  }

  function inviteAll() {
    const inviteUrl = `${window.location.origin}?invite=${currentUser?.id || ''}`;
    const text = `Rejoins-moi sur HereToChat ! ${inviteUrl}`;
    if (navigator.share) {
      navigator.share({ title: 'HereToChat', text, url: inviteUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Lien copié !')).catch(() => {});
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>Ajouter un contact</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {notOnApp.length > 0 ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {importStatus && <div className="success-msg">{importStatus}</div>}
            <div style={{ fontSize: 14, color: '#f39c12', fontWeight: 600 }}>
              {notOnApp.length} contact{notOnApp.length > 1 ? 's' : ''} pas encore sur l'app :
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 250 }}>
              {notOnApp.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
                  <span style={{ flex: 1, fontSize: 14, color: '#f0f0f0' }}>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => inviteContact(c)}
                    style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #3498db, #2980b9)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Inviter
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={inviteAll}
              style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #9b59b6, #8e44ad)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              📩 Inviter tout le monde
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <input
                type="tel"
                placeholder="Numéro de téléphone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                autoFocus
              />
              <input
                type="text"
                placeholder="Nom du contact"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
              {error && <div className="error">{error}</div>}
              {importStatus && <div className="success-msg">{importStatus}</div>}
              <button type="submit" disabled={loading}>
                {loading ? '...' : 'Ajouter'}
              </button>
            </form>
            <button
              type="button"
              disabled={loading}
              onClick={handleImportContacts}
              style={{ width: '100%', marginTop: 8, padding: '12px', background: 'linear-gradient(135deg, #2ecc71, #27ae60)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              📱 {('contacts' in navigator && 'ContactsManager' in window) ? 'Importer tous les contacts' : 'Inviter des amis'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsPage({ currentUser, onClose, onUpdateProfile, onLogout }) {
  const [name, setName] = useState(currentUser.full_name || currentUser.username || '');
  const [picPreview, setPicPreview] = useState('');
  const [picBase64, setPicBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const picRef = useRef(null);

  function handlePicSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPicPreview(reader.result);
      setPicBase64(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    try {
      await onUpdateProfile(name.trim(), picBase64 || null);
      setSuccess('Profil mis à jour !');
      setPicBase64('');
      setTimeout(() => onClose(), 800);
    } catch {
      setSuccess('Erreur');
    } finally {
      setLoading(false);
    }
  }

  const avatarSrc = picPreview || (currentUser.profile_pic ? picUrl(currentUser.profile_pic) : '');

  return (
    <div className="settings-page">
      <div className="settings-top-bar">
        <button className="settings-back-btn" onClick={onClose}>←</button>
        <h2>Paramètres</h2>
      </div>
      <div className="settings-content">
        <div className="settings-avatar-section">
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" className="settings-avatar-img" />
          ) : (
            <div className="settings-avatar-placeholder">
              <span>{(name || '?')[0].toUpperCase()}</span>
            </div>
          )}
          <input
            id="profile-pic-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePicSelect}
            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer', zIndex: 10 }}
          />
          <div className="settings-avatar-overlay">Changer la photo</div>
        </div>
        <form className="settings-form" onSubmit={handleSave}>
          <div className="settings-field">
            <label>Nom</label>
            <input
              type="text"
              placeholder="Ton nom"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="settings-info-card">
            <div className="settings-info-icon">📱</div>
            <div className="settings-info-details">
              <span className="settings-info-label">Téléphone</span>
              <span className="settings-info-value">{currentUser.phone || 'Non défini'}</span>
            </div>
          </div>
          {success && <div className="success-msg">{success}</div>}
          <button type="submit" className="settings-save-btn" disabled={loading}>
            {loading ? '...' : 'Enregistrer'}
          </button>
          <button type="button" className="settings-logout-btn" onClick={onLogout}>
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}

function displayName(user) {
  return user.nickname || user.full_name || user.username;
}

function CreateGroupModal({ onClose, onCreate, contacts }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [groupPic, setGroupPic] = useState('');
  const picRef = useRef(null);

  function toggleMember(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handlePicChange(e) {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setGroupPic(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (selected.length === 0) { setError('Ajoute au moins 1 membre'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await onCreate(name.trim(), selected, groupPic || undefined);
      if (result.error) { setError(result.error); }
      else { onClose(); }
    } catch { setError('Erreur'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>Nouveau groupe</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="avatar group-avatar"
              style={{ width: 56, height: 56, fontSize: 24, cursor: 'pointer', flexShrink: 0, overflow: 'hidden' }}
              onClick={() => picRef.current?.click()}
            >
              {groupPic ? <img src={groupPic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '📷'}
            </div>
            <input ref={picRef} type="file" accept="image/*" onChange={handlePicChange} style={{ display: 'none' }} />
            <input
              type="text"
              placeholder="Nom du groupe"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ fontSize: 13, color: '#6a6a85', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Membres ({selected.length} sélectionné{selected.length > 1 ? 's' : ''})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 250 }}>
            {contacts.map(c => (
              <div
                key={c.id}
                onClick={() => toggleMember(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 12, cursor: 'pointer',
                  background: selected.includes(c.id) ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.04)',
                  border: selected.includes(c.id) ? '2px solid #2ecc71' : '2px solid transparent',
                  transition: 'all 0.15s'
                }}
              >
                <UserAvatar user={c} size={34} />
                <span style={{ flex: 1, fontSize: 14 }}>{c.nickname || c.full_name || c.username}</span>
                {selected.includes(c.id) && <span style={{ color: '#2ecc71', fontWeight: 700 }}>✓</span>}
              </div>
            ))}
            {contacts.length === 0 && <div style={{ color: '#6a6a85', textAlign: 'center', padding: 20 }}>Aucun contact</div>}
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? '...' : 'Créer le groupe'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RenameModal({ contact, onClose, onRename }) {
  const [nickname, setNickname] = useState(contact.nickname || contact.full_name || contact.username || '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await onRename(contact.id, nickname.trim());
    setLoading(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Renommer le contact</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nouveau nom"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? '...' : 'Renommer'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Sidebar({ className, users, groups, onlineUsers, currentUser, selectedUser, selectedGroup, onSelectUser, onSelectGroup, onLogout, onAddContact, onUpdateProfile, onRenameContact, onCreateGroup }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [renamingContact, setRenamingContact] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div className={`sidebar ${className || ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-user-info" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>
          <UserAvatar user={currentUser} size={36} />
          <span className="sidebar-username">{currentUser.full_name || currentUser.username}</span>
        </div>
        <div className="sidebar-actions">
          <div style={{ position: 'relative' }}>
            <button className="add-contact-btn" onClick={() => setShowAddMenu(!showAddMenu)} title="Ajouter">＋</button>
            {showAddMenu && (
              <div className="add-menu">
                <button className="add-menu-item" onTouchEnd={(e) => { e.preventDefault(); setShowAddMenu(false); setShowAddModal(true); }} onClick={() => { setShowAddMenu(false); setShowAddModal(true); }}>
                  <span>👤</span> Ajouter un contact
                </button>
                <button className="add-menu-item" onTouchEnd={(e) => { e.preventDefault(); setShowAddMenu(false); setShowCreateGroup(true); }} onClick={() => { setShowAddMenu(false); setShowCreateGroup(true); }}>
                  <span>👥</span> Nouveau groupe
                </button>
                <button className="add-menu-item" onTouchEnd={(e) => { e.preventDefault(); setShowAddMenu(false); const inviteUrl = `${window.location.origin}?invite=${currentUser.id}`; const text = `Rejoins-moi sur HereToChat ! ${inviteUrl}`; if (navigator.share) { navigator.share({ title: 'HereToChat', text, url: inviteUrl }).catch(() => {}); } else { navigator.clipboard.writeText(text).then(() => alert('Lien copié !')).catch(() => {}); } }} onClick={() => {
                  setShowAddMenu(false);
                  const inviteUrl = `${window.location.origin}?invite=${currentUser.id}`;
                  const text = `Rejoins-moi sur HereToChat ! ${inviteUrl}`;
                  if (navigator.share) {
                    navigator.share({ title: 'HereToChat', text, url: inviteUrl }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).then(() => alert('Lien copié !')).catch(() => {});
                  }
                }}>
                  <span>📩</span> Inviter des amis
                </button>
              </div>
            )}
          </div>
          <button className="settings-btn" onClick={() => setShowSettings(true)} title="Paramètres">⚙</button>
        </div>
      </div>
      <div className="sidebar-search">
        <span className="search-icon">🔍</span>
        <span className="search-text">Rechercher ou démarrer une discussion</span>
      </div>
      <div className="user-list">
        {/* Contacts */}
        {users.map(user => (
          <div
            key={user.id}
            className={`user-item ${selectedUser?.id === user.id && !selectedGroup ? 'active' : ''}`}
            onClick={() => onSelectUser(user)}
          >
            <UserAvatar user={user} />
            <div className="user-item-info">
              <span className="user-item-name">{displayName(user)}</span>
              <span className="user-item-status">
                {onlineUsers.includes(user.id) ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
            <button
              className="rename-contact-btn"
              title="Renommer"
              onClick={e => { e.stopPropagation(); setRenamingContact(user); }}
            >✏</button>
            {onlineUsers.includes(user.id) && <div className="online-dot" />}
          </div>
        ))}
        {/* Groups */}
        {(groups || []).length > 0 && (
          <div className="group-section-label">Groupes</div>
        )}
        {(groups || []).map(group => (
          <div
            key={`g-${group.id}`}
            className={`user-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
            onClick={() => onSelectGroup(group)}
          >
            {group.pic ? (
              <img src={picUrl(group.pic)} alt={group.name} className="avatar group-avatar" style={{ width: 44, height: 44, objectFit: 'cover' }} />
            ) : (
              <div className="avatar group-avatar" style={{ fontSize: 20 }}>
                {group.name[0].toUpperCase()}
              </div>
            )}
            <div className="user-item-info">
              <span className="user-item-name">{group.name}</span>
              <span className="user-item-status">Groupe</span>
            </div>
          </div>
        ))}
        {users.length === 0 && (!groups || groups.length === 0) && (
          <div className="no-users">
            Aucun contact pour le moment<br />
            <span className="no-users-hint">Clique sur ＋ pour ajouter quelqu'un</span>
          </div>
        )}
      </div>
      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onAdd={onAddContact}
          currentUser={currentUser}
        />
      )}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={onCreateGroup}
          contacts={users}
        />
      )}
      {renamingContact && (
        <RenameModal
          contact={renamingContact}
          onClose={() => setRenamingContact(null)}
          onRename={onRenameContact}
        />
      )}
      {showSettings && (
        <SettingsPage
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onUpdateProfile={onUpdateProfile}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
