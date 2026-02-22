import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../api';

function picUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return apiUrl(path);
}

function UserAvatar({ user, size, onClick }) {
  const s = size || 42;
  if (user.profile_pic) {
    return <img src={picUrl(user.profile_pic)} alt={user.username} className="avatar" style={{ width: s, height: s, objectFit: 'cover', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick} />;
  }
  return (
    <div className="avatar" style={{ width: s, height: s, fontSize: s * 0.43, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      {(user.full_name || user.username || '?')[0].toUpperCase()}
    </div>
  );
}

function VoiceMessage({ src }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  }

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  }

  return (
    <div className="voice-message">
      <audio ref={audioRef} src={picUrl(src)}
        onTimeUpdate={() => { const a = audioRef.current; if (a) setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0); }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button className="voice-play-btn" onClick={toggle} type="button">{playing ? '⏸' : '▶'}</button>
      <div className="voice-track"><div className="voice-progress" style={{ width: `${progress}%` }} /></div>
      <span className="voice-duration">{formatTime(duration)}</span>
    </div>
  );
}

function FileMessage({ url, name }) {
  return (
    <a href={picUrl(url)} target="_blank" rel="noopener noreferrer" className="file-message">
      <span className="file-icon">📄</span>
      <span className="file-name">{name || 'Fichier'}</span>
      <span className="file-download">⬇</span>
    </a>
  );
}

function VideoMessage({ url, onFullscreen }) {
  return (
    <div className="video-message" onClick={() => onFullscreen(picUrl(url))}>
      <video src={picUrl(url)} className="video-thumb" preload="metadata" />
      <div className="video-play-overlay">▶</div>
    </div>
  );
}

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

const BG_OPTIONS = [
  { id: 'default', label: 'Par défaut', value: '' },
  { id: 'sunset', label: 'Coucher', value: 'linear-gradient(135deg, #ff9a9e, #fad0c4, #ffecd2)' },
  { id: 'ocean', label: 'Océan', value: 'linear-gradient(135deg, #a8edea, #fed6e3, #d4fc79)' },
  { id: 'sky', label: 'Ciel', value: 'linear-gradient(135deg, #89f7fe, #66a6ff, #c2e9fb)' },
  { id: 'forest', label: 'Forêt', value: 'linear-gradient(135deg, #d4fc79, #96e6a1, #a8edea)' },
  { id: 'candy', label: 'Bonbon', value: 'linear-gradient(135deg, #f093fb, #f5576c, #ffd89b)' },
  { id: 'rainbow', label: 'Arc-en-ciel', value: 'linear-gradient(135deg, #ff9a9e, #fad0c4, #fcb69f, #a1c4fd, #c2e9fb, #d4fc79)' },
  { id: 'peach', label: 'Pêche', value: 'linear-gradient(135deg, #ffecd2, #fcb69f, #ff9a9e)' },
  { id: 'lavender', label: 'Lavande', value: 'linear-gradient(135deg, #e0c3fc, #8ec5fc, #f5efef)' },
  { id: 'mint', label: 'Menthe', value: 'linear-gradient(135deg, #c1dfc4, #deecdd, #a8edea)' },
  { id: 'night', label: 'Nuit', value: 'linear-gradient(135deg, #2c3e50, #4a69bd, #1c1c2e)' },
  { id: 'dark-violet', label: 'Violet', value: 'linear-gradient(135deg, #1a0a2e, #3d1a6e, #6c3483, #1a0a2e)' },
  { id: 'black', label: 'Noir', value: '#0a0a0a' },
  { id: 'custom', label: '+ Photo', value: 'custom' },
];

const MSG_COLOR_OPTIONS = [
  { id: 'rainbow', label: 'Arc-en-ciel' },
  { id: 'blue', label: 'Bleu', color: 'linear-gradient(135deg, #3498db, #2980b9)' },
  { id: 'green', label: 'Vert', color: 'linear-gradient(135deg, #2ecc71, #27ae60)' },
  { id: 'red', label: 'Rouge', color: 'linear-gradient(135deg, #e74c3c, #c0392b)' },
  { id: 'orange', label: 'Orange', color: 'linear-gradient(135deg, #f39c12, #e67e22)' },
  { id: 'purple', label: 'Violet', color: 'linear-gradient(135deg, #9b59b6, #8e44ad)' },
  { id: 'pink', label: 'Rose', color: 'linear-gradient(135deg, #fd79a8, #e84393)' },
  { id: 'cyan', label: 'Cyan', color: 'linear-gradient(135deg, #00cec9, #0984e3)' },
  { id: 'gold', label: 'Or', color: 'linear-gradient(135deg, #f1c40f, #f39c12)' },
  { id: 'dark', label: 'Sombre', color: 'linear-gradient(135deg, #2d3436, #636e72)' },
];


const RECEIVED_BUBBLE_COLORS = [
  { id: 'default', label: 'Défaut', color: 'rgba(255,255,255,0.85)' },
  { id: 'blue', label: 'Bleu', color: 'linear-gradient(135deg, #3498db, #2980b9)' },
  { id: 'green', label: 'Vert', color: 'linear-gradient(135deg, #2ecc71, #27ae60)' },
  { id: 'red', label: 'Rouge', color: 'linear-gradient(135deg, #e74c3c, #c0392b)' },
  { id: 'orange', label: 'Orange', color: 'linear-gradient(135deg, #f39c12, #e67e22)' },
  { id: 'purple', label: 'Violet', color: 'linear-gradient(135deg, #9b59b6, #8e44ad)' },
  { id: 'pink', label: 'Rose', color: 'linear-gradient(135deg, #fd79a8, #e84393)' },
  { id: 'cyan', label: 'Cyan', color: 'linear-gradient(135deg, #00cec9, #0984e3)' },
  { id: 'gold', label: 'Or', color: 'linear-gradient(135deg, #f1c40f, #f39c12)' },
  { id: 'dark', label: 'Sombre', color: 'linear-gradient(135deg, #2d3436, #636e72)' },
];

function MessageContextMenu({ x, y, msg, isSent, isGroup, onClose, onDelete, onCopy, onReply, onReact }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [onClose]);

  const style = { position: 'fixed', top: y, left: x, zIndex: 300 };

  return (
    <div className="msg-context-menu" style={style} ref={menuRef}>
      <div className="ctx-quick-reactions">
        {QUICK_REACTIONS.map(emoji => (
          <button key={emoji} onClick={() => { onReact(msg.id, emoji, isGroup); onClose(); }}>{emoji}</button>
        ))}
      </div>
      <button onClick={() => { onReply(msg); onClose(); }}>
        <span>↩</span> Répondre
      </button>
      <button onClick={() => {
        const text = msg.content || msg.file_name || '';
        navigator.clipboard.writeText(text).catch(() => {});
        onClose();
      }}>
        <span>📋</span> Copier
      </button>
      {isSent && (
        <button className="ctx-delete" onClick={() => { onDelete(msg.id, isGroup); onClose(); }}>
          <span>🗑</span> Supprimer
        </button>
      )}
    </div>
  );
}

function GroupInfoPanel({ group, currentUser, token, onClose, onLeaveGroup, onDeleteGroup, onGroupUpdated, contacts }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupPic, setGroupPic] = useState(group.pic || '');
  const picInputRef = useRef(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addedContacts, setAddedContacts] = useState([]); // IDs of members added to contacts this session

  useEffect(() => {
    fetch(apiUrl(`/api/groups/${group.id}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setMembers(data.members || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [group.id, token]);

  const currentMember = members.find(m => m.id === currentUser.id);
  const isAdmin = currentMember?.role === 'admin';

  async function handleSetAdmin(userId) {
    await fetch(apiUrl(`/api/groups/${group.id}/set-admin`), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: 'admin' } : m));
  }

  async function handleRemoveAdmin(userId) {
    await fetch(apiUrl(`/api/groups/${group.id}/remove-admin`), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: 'member' } : m));
  }

  async function handleChangePic(e) {
    const file = e.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(apiUrl(`/api/groups/${group.id}/update-pic`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pic: reader.result })
        });
        const data = await res.json();
        if (res.ok) {
          setGroupPic(data.pic);
          if (onGroupUpdated) onGroupUpdated({ ...group, pic: data.pic });
        }
      } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleRemoveMember(userId) {
    await fetch(apiUrl(`/api/groups/${group.id}/remove-member`), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
    setMembers(prev => prev.filter(m => m.id !== userId));
  }

  async function handleAddMember(userId) {
    const res = await fetch(apiUrl(`/api/groups/${group.id}/add-member`), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
    if (res.ok) {
      // Re-fetch members
      const r = await fetch(apiUrl(`/api/groups/${group.id}`), { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setMembers(data.members || []);
      setShowAddMember(false);
    }
  }

  async function handleAddToContacts(member) {
    const res = await fetch(apiUrl('/api/contacts/add'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: member.phone, nickname: '' })
    });
    if (res.ok) {
      setAddedContacts(prev => [...prev, member.id]);
    }
  }

  // Contacts not already in the group
  const availableContacts = (contacts || []).filter(c => !members.some(m => m.id === c.id));
  // Contact IDs for checking if a member is already a contact
  const contactIds = (contacts || []).map(c => c.id);

  return (
    <div className="group-info-overlay" onClick={onClose}>
      <div className="group-info-panel" onClick={e => e.stopPropagation()}>
        <div className="group-info-header">
          <button className="group-info-close" onClick={onClose}>✕</button>
          <h3>Info du groupe</h3>
        </div>
        <div className="group-info-name">
          <input ref={picInputRef} type="file" accept="image/*" onChange={handleChangePic} style={{ display: 'none' }} />
          <div className="group-pic-wrapper" onClick={() => isAdmin && picInputRef.current?.click()} style={{ cursor: isAdmin ? 'pointer' : 'default', position: 'relative' }}>
            {groupPic ? (
              <img src={picUrl(groupPic)} alt={group.name} className="avatar group-avatar" style={{ width: 80, height: 80, objectFit: 'cover' }} />
            ) : (
              <div className="avatar group-avatar" style={{ width: 80, height: 80, fontSize: 32 }}>
                {group.name[0].toUpperCase()}
              </div>
            )}
            {isAdmin && <div className="group-pic-edit-overlay">📷</div>}
          </div>
          <h2>{group.name}</h2>
          <span>{members.length} participants</span>
        </div>
        <div className="group-info-members">
          <h4>Participants</h4>
          {loading ? <p style={{color:'#6a6a85',padding:'12px'}}>Chargement...</p> : members.map(m => (
            <div key={m.id} className="group-member-item">
              <UserAvatar user={m} size={40} />
              <div className="group-member-info">
                <span className="group-member-name">
                  {m.full_name || m.username}
                  {m.id === currentUser.id && ' (Toi)'}
                </span>
                <span className="group-member-phone">{m.phone || 'Pas de numéro'}</span>
              </div>
              {m.role === 'admin' && <span className="admin-badge">Admin</span>}
              {m.id !== currentUser.id && !contactIds.includes(m.id) && !addedContacts.includes(m.id) && m.phone && (
                <button className="add-contact-from-group" onClick={() => handleAddToContacts(m)} title="Ajouter aux contacts">＋</button>
              )}
              {addedContacts.includes(m.id) && <span className="added-badge">Ajouté</span>}
              {isAdmin && m.id !== currentUser.id && (
                <div className="group-member-actions">
                  {m.role !== 'admin' && <button onClick={() => handleSetAdmin(m.id)} title="Rendre admin">👑</button>}
                  {m.role === 'admin' && <button onClick={() => handleRemoveAdmin(m.id)} title="Retirer admin" className="remove-admin-btn">👑❌</button>}
                  <button onClick={() => handleRemoveMember(m.id)} title="Retirer du groupe" className="remove-member-btn">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {showAddMember && (
          <div className="add-member-section">
            <h4>Ajouter un membre</h4>
            {availableContacts.length === 0 ? (
              <p style={{ color: '#6a6a85', fontSize: 13, padding: '8px 0' }}>Tous tes contacts sont déjà dans le groupe</p>
            ) : (
              availableContacts.map(c => (
                <div key={c.id} className="group-member-item" onClick={() => handleAddMember(c.id)} style={{ cursor: 'pointer' }}>
                  <UserAvatar user={c} size={36} />
                  <div className="group-member-info">
                    <span className="group-member-name">{c.nickname || c.full_name || c.username}</span>
                    <span className="group-member-phone">{c.phone || ''}</span>
                  </div>
                  <span style={{ color: '#2ecc71', fontWeight: 700, fontSize: 20 }}>＋</span>
                </div>
              ))
            )}
            <button className="cancel-add-member" onClick={() => setShowAddMember(false)}>Annuler</button>
          </div>
        )}
        <div className="group-info-actions">
          <button className="add-member-btn" onClick={() => setShowAddMember(!showAddMember)}>👥 Ajouter un membre</button>
          <button className="leave-group-btn" onClick={() => { onLeaveGroup(); onClose(); }}>🚪 Quitter le groupe</button>
          {isAdmin && (
            <button className="delete-group-btn" onClick={() => { if (window.confirm('Supprimer ce groupe définitivement ?')) { onDeleteGroup(); onClose(); } }}>🗑 Supprimer le groupe</button>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({ src, onClose }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <img src={src} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
    </div>
  );
}

function VideoLightbox({ src, onClose }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <video src={src} className="lightbox-video" controls autoPlay onClick={e => e.stopPropagation()} />
    </div>
  );
}

function ProfileViewer({ user, onClose }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <div className="profile-viewer" onClick={e => e.stopPropagation()}>
        {user.profile_pic ? (
          <img src={picUrl(user.profile_pic)} alt="" className="profile-viewer-img" />
        ) : (
          <div className="profile-viewer-placeholder">{(user.full_name || user.username || '?')[0].toUpperCase()}</div>
        )}
        <h3>{user.full_name || user.username}</h3>
        {user.phone && <p>{user.phone}</p>}
      </div>
    </div>
  );
}

export default function ChatWindow({ messages, currentUser, selectedUser, selectedGroup, onlineUsers, typing, onBack, onDeleteMessage, onReply, onReaction, onRemoveReaction, onLeaveGroup, onDeleteGroup, onBlockUser, token, users }) {
  const bottomRef = useRef(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const bgFileRef = useRef(null);
  const [chatBgs, setChatBgs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chatBgs') || '{}'); } catch { return {}; }
  });
  const [customBgImages, setCustomBgImages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('customBgImages') || '{}'); } catch { return {}; }
  });
  const [msgColors, setMsgColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('msgColors') || '{}'); } catch { return {}; }
  });
  const [recvBubbleColors, setRecvBubbleColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('recvBubbleColors') || '{}'); } catch { return {}; }
  });

  const [contextMenu, setContextMenu] = useState(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [lightboxVideo, setLightboxVideo] = useState(null);
  const [profileView, setProfileView] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!contextMenu) return;
    function handleScroll() { setContextMenu(null); }
    const container = document.querySelector('.messages-container');
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [contextMenu]);

  const chatKey = selectedGroup ? `g-${selectedGroup.id}` : selectedUser ? `u-${selectedUser.id}` : null;

  function setBg(bgId) {
    if (!chatKey) return;
    if (bgId === 'custom') { bgFileRef.current?.click(); return; }
    const updated = { ...chatBgs, [chatKey]: bgId };
    setChatBgs(updated);
    localStorage.setItem('chatBgs', JSON.stringify(updated));
    setShowBgPicker(false);
  }

  function setMsgColor(colorId) {
    if (!chatKey) return;
    const updated = { ...msgColors, [chatKey]: colorId };
    setMsgColors(updated);
    localStorage.setItem('msgColors', JSON.stringify(updated));
  }

  function setRecvBubbleColor(colorId) {
    if (!chatKey) return;
    const updated = { ...recvBubbleColors, [chatKey]: colorId };
    setRecvBubbleColors(updated);
    localStorage.setItem('recvBubbleColors', JSON.stringify(updated));
  }

  function handleCustomBg(e) {
    if (!chatKey) return;
    const file = e.target.files[0];
    if (!file || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const updatedImages = { ...customBgImages, [chatKey]: reader.result };
      setCustomBgImages(updatedImages);
      localStorage.setItem('customBgImages', JSON.stringify(updatedImages));
      const updatedBgs = { ...chatBgs, [chatKey]: 'custom-image' };
      setChatBgs(updatedBgs);
      localStorage.setItem('chatBgs', JSON.stringify(updatedBgs));
      setShowBgPicker(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleContextMenu(e, msg, isSent) {
    e.preventDefault();
    if (msg.deleted) return;
    setContextMenu({ x: e.clientX, y: e.clientY, msg, isSent });
  }

  function handleTouchStart(e, msg, isSent) {
    if (msg.deleted) return;
    longPressTriggered.current = false;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setContextMenu({ x: touch.clientX, y: touch.clientY, msg, isSent });
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  function handleTouchMove() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  if (!selectedUser && !selectedGroup) {
    return (
      <div className="chat-window empty-chat">
        <div className="empty-chat-content">
          <div className="empty-chat-icon"><img src="/dragon-logo.svg" alt="HereToChat" style={{ width: 100, height: 100 }} /></div>
          <h2>HereToChat</h2>
          <p>Sélectionne une conversation pour commencer</p>
        </div>
      </div>
    );
  }

  const isGroup = !!selectedGroup;
  const isOnline = !isGroup && onlineUsers.includes(selectedUser.id);
  const currentBgId = chatBgs[chatKey] || 'default';
  const currentBg = BG_OPTIONS.find(b => b.id === currentBgId);
  let bgStyle = {};
  if (currentBgId === 'custom-image' && customBgImages[chatKey]) {
    bgStyle = { backgroundImage: `url(${customBgImages[chatKey]})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  } else if (currentBg?.value && currentBg.value !== 'custom') {
    bgStyle = { background: currentBg.value };
  }

  const currentMsgColorId = msgColors[chatKey] || 'rainbow';
  const rainbowColors = [
    'linear-gradient(135deg, #e74c3c, #c0392b)',
    'linear-gradient(135deg, #f39c12, #e67e22)',
    'linear-gradient(135deg, #f1c40f, #f39c12)',
    'linear-gradient(135deg, #2ecc71, #27ae60)',
    'linear-gradient(135deg, #3498db, #2980b9)',
    'linear-gradient(135deg, #9b59b6, #8e44ad)',
    'linear-gradient(135deg, #fd79a8, #e84393)',
    'linear-gradient(135deg, #00cec9, #0984e3)',
  ];
  const fixedColor = currentMsgColorId !== 'rainbow'
    ? MSG_COLOR_OPTIONS.find(c => c.id === currentMsgColorId)?.color : null;

  const currentRecvBubbleColorId = recvBubbleColors[chatKey] || 'default';
  const recvBubbleColor = RECEIVED_BUBBLE_COLORS.find(c => c.id === currentRecvBubbleColorId)?.color || 'rgba(255,255,255,0.85)';

  const headerName = isGroup ? selectedGroup.name : (selectedUser.nickname || selectedUser.full_name || selectedUser.username);
  const headerStatus = isGroup ? 'Groupe' : typing ? 'écrit...' : isOnline ? 'en ligne' : 'hors ligne';

  const msgById = {};
  messages.forEach(m => { msgById[m.id] = m; });

  // Build user lookup for group avatars
  const usersById = {};
  if (users) users.forEach(u => { usersById[u.id] = u; });
  if (currentUser) usersById[currentUser.id] = currentUser;
  // Also populate from message sender data (group messages include sender_pic)
  if (isGroup) {
    messages.forEach(m => {
      if (m.sender_id && !usersById[m.sender_id]) {
        usersById[m.sender_id] = { id: m.sender_id, username: m.sender_name || '?', full_name: m.sender_full_name || m.sender_name || '?', profile_pic: m.sender_pic || '' };
      }
    });
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>←</button>
        {isGroup ? (
          selectedGroup.pic ? (
            <img src={picUrl(selectedGroup.pic)} alt={selectedGroup.name} className="avatar group-avatar" style={{ width: 42, height: 42, objectFit: 'cover', cursor: 'pointer' }} onClick={() => setShowGroupInfo(true)} />
          ) : (
            <div className="avatar group-avatar" style={{ width: 42, height: 42, fontSize: 20, cursor: 'pointer' }} onClick={() => setShowGroupInfo(true)}>
              {selectedGroup.name[0].toUpperCase()}
            </div>
          )
        ) : (
          <UserAvatar user={selectedUser} onClick={() => setProfileView(selectedUser)} />
        )}
        <div className="chat-header-info" onClick={() => isGroup ? setShowGroupInfo(true) : setProfileView(selectedUser)} style={{ cursor: 'pointer', flex: 1 }}>
          <span className="chat-header-name">{headerName}</span>
          <span className={`chat-header-status ${isOnline || typing ? 'online' : 'offline'}`}>{headerStatus}</span>
        </div>
        {!isGroup && onBlockUser && (
          <button className="block-btn" onClick={() => { if (window.confirm(`Bloquer ${headerName} ?`)) onBlockUser(selectedUser.id); }} title="Bloquer">🚫</button>
        )}
        {isGroup && (
          <button className="group-info-btn" onClick={() => setShowGroupInfo(true)} title="Info groupe">ℹ️</button>
        )}
        <button className="bg-picker-btn" onClick={() => setShowBgPicker(!showBgPicker)} title="Changer le fond">🎨</button>
      </div>
      {showBgPicker && (
        <div className="bg-picker">
          <input ref={bgFileRef} type="file" accept="image/*" onChange={handleCustomBg} style={{ display: 'none' }} />
          {BG_OPTIONS.map(opt => {
            const isCustomImage = opt.id === 'custom';
            const previewStyle = isCustomImage
              ? { background: '#2a2a3e', border: '2px dashed rgba(255,255,255,0.2)' }
              : { background: opt.value || '#1c1c2e' };
            const isActive = opt.id === 'custom' ? currentBgId === 'custom-image' : currentBgId === opt.id;
            return (
              <button key={opt.id} className={`bg-option ${isActive ? 'active' : ''}`} onClick={() => setBg(opt.id)} style={previewStyle}>
                <span>{opt.label}</span>
              </button>
            );
          })}
          <div className="color-separator">Couleur messages</div>
          {MSG_COLOR_OPTIONS.map(opt => {
            const currentColorId = msgColors[chatKey] || 'rainbow';
            const previewBg = opt.id === 'rainbow' ? 'linear-gradient(135deg, #e74c3c, #f39c12, #f1c40f, #2ecc71, #3498db)' : opt.color;
            return (
              <button key={'mc-' + opt.id} className={`bg-option msg-color-option ${currentColorId === opt.id ? 'active' : ''}`} onClick={() => setMsgColor(opt.id)} style={{ background: previewBg }}>
                <span>{opt.label}</span>
              </button>
            );
          })}
          <div className="color-separator">Couleur bulle reçue</div>
          {RECEIVED_BUBBLE_COLORS.map(opt => {
            const currentBubbleId = recvBubbleColors[chatKey] || 'default';
            return (
              <button key={'rb-' + opt.id} className={`bg-option msg-color-option ${currentBubbleId === opt.id ? 'active' : ''}`} onClick={() => setRecvBubbleColor(opt.id)} style={{ background: opt.color }}>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="messages-container" style={bgStyle}>
        <div className="messages">
          {messages.map((msg, idx) => {
            const isSent = msg.sender_id === currentUser.id;
            const bubbleColor = fixedColor || rainbowColors[idx % rainbowColors.length];
            const bubbleStyle = isSent && !msg.deleted ? { background: bubbleColor } : {};
            const recvStyle = {};
            const recvBubbleStyle = !isSent && !msg.deleted ? { background: recvBubbleColor } : {};
            const msgType = msg.type || 'text';
            const repliedMsg = msg.reply_to ? msgById[msg.reply_to] : null;
            const reactions = msg.reactions || [];
            const senderUser = isGroup && !isSent ? usersById[msg.sender_id] : null;

            if (msg.deleted) {
              return (
                <div key={`${msg.id}-${msg.group_id || ''}`} className={`message ${isSent ? 'sent' : 'received'}`}>
                  {isGroup && !isSent && <div className="msg-avatar-spacer" />}
                  <div className="message-bubble deleted-bubble">
                    <span className="deleted-message-text">🚫 Ce message a été supprimé</span>
                    <span className="message-time">
                      {(() => { try { const ts = msg.timestamp; return new Date(ts && !ts.endsWith('Z') ? ts + 'Z' : ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`${msg.id}-${msg.group_id || ''}`}
                className={`message ${isSent ? 'sent' : 'received'}`}
                onContextMenu={(e) => handleContextMenu(e, msg, isSent)}
                onTouchStart={(e) => handleTouchStart(e, msg, isSent)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
              >
                {isGroup && !isSent && (
                  <div className="msg-avatar" onClick={() => senderUser && setProfileView(senderUser)}>
                    <UserAvatar user={senderUser || { username: msg.sender_name || '?', full_name: msg.sender_full_name || msg.sender_name || '?' }} size={30} />
                  </div>
                )}
                <div className="message-bubble" style={{ ...bubbleStyle, ...recvBubbleStyle }}>
                  {isGroup && !isSent && (
                    <div className="group-sender-name">{msg.sender_full_name || msg.sender_name}</div>
                  )}
                  {repliedMsg && (
                    <div className="reply-preview">
                      <div className="reply-preview-name">{repliedMsg.sender_id === currentUser.id ? 'Toi' : (repliedMsg.sender_full_name || repliedMsg.sender_name)}</div>
                      <div className="reply-preview-text">{repliedMsg.content || (repliedMsg.type === 'voice' ? 'Message vocal' : repliedMsg.file_name || 'Fichier')}</div>
                    </div>
                  )}
                  {msgType === 'voice' && <VoiceMessage src={msg.file_url} />}
                  {msgType === 'image' && (
                    <img src={picUrl(msg.file_url)} alt="image" className="image-message" onClick={() => setLightboxImg(picUrl(msg.file_url))} style={{ cursor: 'pointer' }} />
                  )}
                  {msgType === 'video' && <VideoMessage url={msg.file_url} onFullscreen={(u) => setLightboxVideo(u)} />}
                  {msgType === 'file' && <FileMessage url={msg.file_url} name={msg.file_name} />}
                  {msgType === 'text' && <span className="message-text" style={recvStyle}>{msg.content}</span>}
                  <span className="message-time">
                    {(() => { try { const ts = msg.timestamp; return new Date(ts && !ts.endsWith('Z') ? ts + 'Z' : ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}
                  </span>
                </div>
                {reactions.length > 0 && (
                  <div className="reactions-bar">
                    {Object.entries(reactions.reduce((acc, r) => {
                      acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, users: [] };
                      acc[r.emoji].users.push(r);
                      return acc;
                    }, {})).map(([emoji, data]) => (
                      <button
                        key={emoji}
                        className={`reaction-chip ${data.users.some(u => u.user_id === currentUser.id) ? 'my-reaction' : ''}`}
                        onClick={() => {
                          const mine = data.users.some(u => u.user_id === currentUser.id);
                          if (mine) onRemoveReaction(msg.id, emoji, isGroup);
                          else onReaction(msg.id, emoji, isGroup);
                        }}
                        title={data.users.map(u => u.full_name).join(', ')}
                      >
                        {emoji} {data.users.length > 1 ? data.users.length : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x} y={contextMenu.y}
          msg={contextMenu.msg} isSent={contextMenu.isSent}
          isGroup={isGroup} onClose={() => setContextMenu(null)}
          onDelete={onDeleteMessage} onCopy={() => {}} onReply={onReply}
          onReact={onReaction}
        />
      )}
      {lightboxImg && <ImageLightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />}
      {lightboxVideo && <VideoLightbox src={lightboxVideo} onClose={() => setLightboxVideo(null)} />}
      {profileView && <ProfileViewer user={profileView} onClose={() => setProfileView(null)} />}
      {showGroupInfo && selectedGroup && (
        <GroupInfoPanel
          group={selectedGroup} currentUser={currentUser} token={token}
          contacts={users}
          onClose={() => setShowGroupInfo(false)}
          onLeaveGroup={onLeaveGroup} onDeleteGroup={onDeleteGroup}
          onGroupUpdated={(updatedGroup) => {
            // Update the selectedGroup pic in parent
            if (typeof window !== 'undefined') {
              selectedGroup.pic = updatedGroup.pic;
            }
          }}
        />
      )}
    </div>
  );
}
