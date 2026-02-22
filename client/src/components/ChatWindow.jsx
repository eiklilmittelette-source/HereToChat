import React, { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../api';

function picUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return apiUrl(path);
}

function UserAvatar({ user, size }) {
  const s = size || 42;
  if (user.profile_pic) {
    return <img src={picUrl(user.profile_pic)} alt={user.username} className="avatar" style={{ width: s, height: s, objectFit: 'cover' }} />;
  }
  return (
    <div className="avatar" style={{ width: s, height: s, fontSize: s * 0.43 }}>
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

function ImageMessage({ url }) {
  return (
    <a href={picUrl(url)} target="_blank" rel="noopener noreferrer">
      <img src={picUrl(url)} alt="image" className="image-message" />
    </a>
  );
}

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

function MessageContextMenu({ x, y, msg, isSent, isGroup, onClose, onDelete, onCopy, onReply }) {
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

  // Adjust position to stay in viewport
  const style = { position: 'fixed', top: y, left: x, zIndex: 300 };

  return (
    <div className="msg-context-menu" style={style} ref={menuRef}>
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

export default function ChatWindow({ messages, currentUser, selectedUser, selectedGroup, onlineUsers, typing, onBack, onDeleteMessage, onReply }) {
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

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, msg, isSent }
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close context menu on scroll
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

  // Right-click handler (PC)
  function handleContextMenu(e, msg, isSent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msg, isSent });
  }

  // Long press handlers (mobile)
  function handleTouchStart(e, msg, isSent) {
    longPressTriggered.current = false;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setContextMenu({ x: touch.clientX, y: touch.clientY, msg, isSent });
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTouchMove() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  if (!selectedUser && !selectedGroup) {
    return (
      <div className="chat-window empty-chat">
        <div className="empty-chat-content">
          <div className="empty-chat-icon">💬</div>
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

  const headerName = isGroup ? selectedGroup.name : (selectedUser.nickname || selectedUser.full_name || selectedUser.username);
  const headerStatus = isGroup ? 'Groupe' : typing ? 'écrit...' : isOnline ? 'en ligne' : 'hors ligne';

  // Build a map of messages by ID for reply lookups
  const msgById = {};
  messages.forEach(m => { msgById[m.id] = m; });

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>←</button>
        {isGroup ? (
          <div className="avatar group-avatar" style={{ width: 42, height: 42, fontSize: 20 }}>
            {selectedGroup.name[0].toUpperCase()}
          </div>
        ) : (
          <UserAvatar user={selectedUser} />
        )}
        <div className="chat-header-info">
          <span className="chat-header-name">{headerName}</span>
          <span className="chat-header-status">{headerStatus}</span>
        </div>
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
        </div>
      )}
      <div className="messages-container" style={bgStyle}>
        <div className="messages">
          {messages.map((msg, idx) => {
            const isSent = msg.sender_id === currentUser.id;
            const bubbleColor = fixedColor || rainbowColors[idx % rainbowColors.length];
            const bubbleStyle = isSent ? { background: bubbleColor } : {};
            const msgType = msg.type || 'text';
            const repliedMsg = msg.reply_to ? msgById[msg.reply_to] : null;

            return (
              <div
                key={`${msg.id}-${msg.group_id || ''}`}
                className={`message ${isSent ? 'sent' : 'received'}`}
                onContextMenu={(e) => handleContextMenu(e, msg, isSent)}
                onTouchStart={(e) => handleTouchStart(e, msg, isSent)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
              >
                <div className="message-bubble" style={bubbleStyle}>
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
                  {msgType === 'image' && <ImageMessage url={msg.file_url} />}
                  {msgType === 'file' && <FileMessage url={msg.file_url} name={msg.file_name} />}
                  {msgType === 'text' && <span className="message-text">{msg.content}</span>}
                  <span className="message-time">
                    {(() => {
                      try {
                        const ts = msg.timestamp;
                        return new Date(ts && !ts.endsWith('Z') ? ts + 'Z' : ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                      } catch { return ''; }
                    })()}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          msg={contextMenu.msg}
          isSent={contextMenu.isSent}
          isGroup={isGroup}
          onClose={() => setContextMenu(null)}
          onDelete={onDeleteMessage}
          onCopy={() => {}}
          onReply={onReply}
        />
      )}
    </div>
  );
}
