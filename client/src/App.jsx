import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import { connectSocket, getSocket, disconnectSocket } from './socket';
import { apiUrl } from './api';
import './App.css';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const notifAudio = new Audio('/notif.wav');
notifAudio.volume = 1.0;

const ringtoneAudio = new Audio('/notif.wav');
ringtoneAudio.volume = 1.0;
ringtoneAudio.loop = true;

function playNotifSound() {
  try {
    notifAudio.currentTime = 0;
    notifAudio.play().catch(() => {});
  } catch {}
}

function startRingtone() {
  try { ringtoneAudio.currentTime = 0; ringtoneAudio.play().catch(() => {}); } catch {}
}

function stopRingtone() {
  try { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; } catch {}
}

function IncomingCallOverlay({ call, onAccept, onDecline }) {
  useEffect(() => {
    startRingtone();
    return () => stopRingtone();
  }, []);

  // Auto-decline after 30s
  useEffect(() => {
    const t = setTimeout(() => onDecline(), 30000);
    return () => clearTimeout(t);
  }, [onDecline]);

  return (
    <div className="call-overlay">
      <div className="call-card">
        <div className="call-avatar-ring">
          {call.callerPic ? (
            <img src={call.callerPic.startsWith('http') ? call.callerPic : apiUrl(call.callerPic)} alt="" className="call-avatar-img" />
          ) : (
            <div className="call-avatar-placeholder">{(call.callerName || '?')[0].toUpperCase()}</div>
          )}
        </div>
        <h2 className="call-name">{call.callerName || 'Inconnu'}</h2>
        <p className="call-type">{call.callType === 'video' ? 'Appel vidéo entrant...' : 'Appel vocal entrant...'}</p>
        <div className="call-buttons">
          <button className="decline-call-btn" onClick={onDecline}>
            <span>📵</span>
            <span>Refuser</span>
          </button>
          <button className="accept-call-btn" onClick={onAccept}>
            <span>📞</span>
            <span>Accepter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function OutgoingCallOverlay({ call, onCancel }) {
  // Auto-cancel after 30s
  useEffect(() => {
    const t = setTimeout(() => onCancel(), 30000);
    return () => clearTimeout(t);
  }, [onCancel]);

  return (
    <div className="call-overlay">
      <div className="call-card">
        <div className="call-avatar-ring outgoing">
          {call.receiverPic ? (
            <img src={call.receiverPic.startsWith('http') ? call.receiverPic : apiUrl(call.receiverPic)} alt="" className="call-avatar-img" />
          ) : (
            <div className="call-avatar-placeholder">{(call.receiverName || '?')[0].toUpperCase()}</div>
          )}
        </div>
        <h2 className="call-name">{call.receiverName || 'Inconnu'}</h2>
        <p className="call-type">{call.callType === 'video' ? 'Appel vidéo...' : 'Appel vocal...'}</p>
        <div className="call-buttons">
          <button className="decline-call-btn" onClick={onCancel}>
            <span>📵</span>
            <span>Annuler</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [callToast, setCallToast] = useState(null);
  const outgoingCallRef = useRef(null);
  const selectedUserRef = useRef(null);
  const selectedGroupRef = useRef(null);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);
  useEffect(() => { outgoingCallRef.current = outgoingCall; }, [outgoingCall]);

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) { setToken(savedToken); setUser(JSON.parse(savedUser)); }
  }, []);

  // Unlock audio on first user gesture (required on mobile)
  useEffect(() => {
    function unlockAudio() {
      notifAudio.play().then(() => { notifAudio.pause(); notifAudio.currentTime = 0; }).catch(() => {});
      ringtoneAudio.play().then(() => { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; }).catch(() => {});
    }
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    return () => { document.removeEventListener('click', unlockAudio); document.removeEventListener('touchstart', unlockAudio); };
  }, []);

  // Listen for service worker messages (push notification sound)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function onSwMessage(event) {
      if (event.data?.type === 'PLAY_NOTIF_SOUND') playNotifSound();
    }
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, []);

  // Register push notifications
  useEffect(() => {
    if (!token) return;
    async function setupPush() {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;
        // Get VAPID public key from server
        const keyRes = await fetch(apiUrl('/api/push/vapid-key'));
        const { publicKey } = await keyRes.json();
        const applicationServerKey = urlBase64ToUint8Array(publicKey);

        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
          subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        }
        // Send subscription to server
        await fetch(apiUrl('/api/push/subscribe'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subscription })
        });
      } catch (err) {
        console.error('Push setup error:', err);
      }
    }
    setupPush();
  }, [token]);

  function showNotification(title, body) {
    if (!document.hidden) return;
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, icon: '/icon-192.png', tag: 'message', renotify: true });
      }).catch(() => {});
    }
  }

  // Connect socket
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    socket.on('online-users', (ids) => setOnlineUsers(ids));

    socket.on('receive-message', (msg) => {
      const sel = selectedUserRef.current;
      const grp = selectedGroupRef.current;
      if (!grp && sel && (msg.sender_id === sel.id || msg.receiver_id === sel.id)) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id && !m.group_id)) return prev;
          return [...prev, { ...msg, reactions: msg.reactions || [] }];
        });
      }
      // Notification for incoming DM + refresh contacts
      if (msg.sender_id !== Number(JSON.parse(localStorage.getItem('user') || '{}').id || 0)) {
        playNotifSound();
        showNotification(msg.sender_name || 'Nouveau message', msg.content || 'Fichier');
        // Refresh contacts list (sender auto-added as contact on server)
        fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setUsers).catch(() => {});
      }
    });

    socket.on('receive-group-message', (msg) => {
      const grp = selectedGroupRef.current;
      if (grp && msg.group_id === grp.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id && m.group_id)) return prev;
          return [...prev, { ...msg, reactions: msg.reactions || [] }];
        });
      }
      // Notification for group message
      const currentUserId = Number(JSON.parse(localStorage.getItem('user') || '{}').id || 0);
      if (msg.sender_id !== currentUserId) {
        playNotifSound();
        showNotification(msg.sender_full_name || msg.sender_name || 'Groupe', msg.content || 'Fichier');
      }
    });

    socket.on('user-typing', (userId) => setTyping(userId));
    socket.on('user-stop-typing', () => setTyping(false));

    // Real-time soft delete
    socket.on('message-deleted', (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, deleted: 1, content: '', file_url: '', file_name: '', sender_name: data.sender_name } : m
      ));
    });

    // Real-time reactions
    socket.on('reaction-added', (data) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          const reactions = [...(m.reactions || [])];
          if (!reactions.some(r => r.user_id === data.user_id && r.emoji === data.emoji)) {
            reactions.push({ emoji: data.emoji, user_id: data.user_id, full_name: data.full_name });
          }
          return { ...m, reactions };
        }
        return m;
      }));
    });

    socket.on('reaction-removed', (data) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          return { ...m, reactions: (m.reactions || []).filter(r => !(r.user_id === data.user_id && r.emoji === data.emoji)) };
        }
        return m;
      }));
    });

    // --- Call events ---
    socket.on('incoming-call', (data) => {
      setIncomingCall(data);
    });

    socket.on('call-accepted', (data) => {
      const call = outgoingCallRef.current;
      setOutgoingCall(null);
      if (call) {
        const phone = data.receiverPhone || call.receiverPhone;
        if (call.callType === 'video') {
          window.location.href = `facetime:${phone}`;
        } else {
          window.location.href = `tel:${phone}`;
        }
      }
    });

    socket.on('call-declined', () => {
      setOutgoingCall(null);
      setCallToast('Appel refusé');
      setTimeout(() => setCallToast(null), 3000);
    });

    socket.on('call-cancelled', () => {
      setIncomingCall(null);
      stopRingtone();
    });

    socket.on('call-failed', (data) => {
      setOutgoingCall(null);
      if (data.reason === 'offline') {
        setCallToast('Utilisateur hors ligne');
        setTimeout(() => setCallToast(null), 3000);
      }
    });

    return () => disconnectSocket();
  }, [token]);

  // Fetch contacts (avec cache localStorage pour mode hors-ligne)
  useEffect(() => {
    if (!token) return;
    // Charger le cache en premier
    try { const cached = localStorage.getItem('cached_contacts'); if (cached) setUsers(JSON.parse(cached)); } catch {}
    const f = () => fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setUsers(data); localStorage.setItem('cached_contacts', JSON.stringify(data)); })
      .catch(() => {});
    f();
    const i = setInterval(f, 5000);
    return () => clearInterval(i);
  }, [token]);

  // Fetch groups (avec cache localStorage pour mode hors-ligne)
  useEffect(() => {
    if (!token) return;
    try { const cached = localStorage.getItem('cached_groups'); if (cached) setGroups(JSON.parse(cached)); } catch {}
    const f = () => fetch(apiUrl('/api/groups'), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setGroups(data); localStorage.setItem('cached_groups', JSON.stringify(data)); })
      .catch(() => {});
    f();
    const i = setInterval(f, 5000);
    return () => clearInterval(i);
  }, [token]);

  // Fetch DM messages
  useEffect(() => {
    if (!token || !selectedUser || selectedGroup) return;
    fetch(apiUrl(`/api/messages/${selectedUser.id}`), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages).catch(() => {});
  }, [token, selectedUser, selectedGroup]);

  // Fetch group messages
  useEffect(() => {
    if (!token || !selectedGroup) return;
    fetch(apiUrl(`/api/groups/${selectedGroup.id}/messages`), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages).catch(() => {});
  }, [token, selectedGroup]);

  function handleLogin(u, t) { setUser(u); setToken(t); localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); }
  function handleLogout() { disconnectSocket(); setUser(null); setToken(null); setSelectedUser(null); setSelectedGroup(null); setMessages([]); localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('cached_contacts'); localStorage.removeItem('cached_groups'); }

  async function handleAddContact(phone, nickname) {
    try {
      const res = await fetch(apiUrl('/api/contacts/add'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone, nickname }) });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Erreur serveur' };
      const r2 = await fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } });
      setUsers(await r2.json());
      return data;
    } catch (err) {
      console.error('handleAddContact error:', err);
      return { error: 'Erreur de connexion au serveur' };
    }
  }

  async function handleRenameContact(contactId, nickname) {
    const res = await fetch(apiUrl('/api/contacts/rename'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ contactId, nickname }) });
    if (res.ok) { const r2 = await fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } }); setUsers(await r2.json()); }
  }

  async function handleCreateGroup(name, memberIds, pic) {
    const res = await fetch(apiUrl('/api/groups/create'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, memberIds, pic }) });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    const r2 = await fetch(apiUrl('/api/groups'), { headers: { Authorization: `Bearer ${token}` } });
    setGroups(await r2.json());
    const socket = getSocket();
    if (socket) socket.emit('join-group', data.id);
    return data;
  }

  async function handleUpdateProfile(fullName, profilePicBase64) {
    const body = { fullName };
    if (profilePicBase64) body.profilePic = profilePicBase64;
    const res = await fetch(apiUrl('/api/profile'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { const updated = { ...user, full_name: data.full_name, profile_pic: data.profile_pic }; setUser(updated); localStorage.setItem('user', JSON.stringify(updated)); }
  }

  function handleSelectUser(u) { setSelectedGroup(null); setSelectedUser(u); setMessages([]); setReplyTo(null); }
  function handleSelectGroup(g) { setSelectedUser(null); setSelectedGroup(g); setMessages([]); setReplyTo(null); }

  function handleSend(content, reply) {
    const socket = getSocket();
    if (!socket) return;
    if (selectedGroup) socket.emit('send-group-message', { groupId: selectedGroup.id, content, replyTo: reply?.id || null });
    else if (selectedUser) socket.emit('send-message', { receiverId: selectedUser.id, content, replyTo: reply?.id || null });
  }

  function handleSendFile(type, fileUrl, fileName) {
    const socket = getSocket();
    if (!socket) return;
    if (selectedGroup) socket.emit('send-group-message', { groupId: selectedGroup.id, content: '', type, fileUrl, fileName });
    else if (selectedUser) socket.emit('send-message', { receiverId: selectedUser.id, content: '', type, fileUrl, fileName });
  }

  function handleTyping() { const s = getSocket(); if (!s) return; if (selectedGroup) s.emit('group-typing', selectedGroup.id); else if (selectedUser) s.emit('typing', selectedUser.id); }
  function handleStopTyping() { const s = getSocket(); if (!s) return; if (selectedGroup) s.emit('group-stop-typing', selectedGroup.id); else if (selectedUser) s.emit('stop-typing', selectedUser.id); }

  function handleDeleteMessage(msgId, isGroupMsg) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('delete-message', {
      messageId: msgId,
      messageType: isGroupMsg ? 'group' : 'dm',
      groupId: selectedGroup?.id,
      receiverId: selectedUser?.id
    });
  }

  function handleReaction(msgId, emoji, isGroupMsg) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('add-reaction', {
      messageId: msgId,
      messageType: isGroupMsg ? 'group' : 'dm',
      emoji,
      groupId: selectedGroup?.id,
      receiverId: selectedUser?.id
    });
  }

  function handleRemoveReaction(msgId, emoji, isGroupMsg) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('remove-reaction', {
      messageId: msgId,
      messageType: isGroupMsg ? 'group' : 'dm',
      emoji,
      groupId: selectedGroup?.id,
      receiverId: selectedUser?.id
    });
  }

  async function handleLeaveGroup() {
    if (!selectedGroup) return;
    await fetch(apiUrl(`/api/groups/${selectedGroup.id}/leave`), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setSelectedGroup(null); setMessages([]);
    const r = await fetch(apiUrl('/api/groups'), { headers: { Authorization: `Bearer ${token}` } });
    setGroups(await r.json());
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return;
    await fetch(apiUrl(`/api/groups/${selectedGroup.id}/delete`), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setSelectedGroup(null); setMessages([]);
    const r = await fetch(apiUrl('/api/groups'), { headers: { Authorization: `Bearer ${token}` } });
    setGroups(await r.json());
  }

  async function handleBlockUser(userId) {
    await fetch(apiUrl('/api/block'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId }) });
    setSelectedUser(null); setMessages([]);
    const r = await fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } });
    setUsers(await r.json());
  }

  function handleCall(targetUser, callType) {
    const socket = getSocket();
    if (!socket) return;
    setOutgoingCall({
      receiverId: targetUser.id,
      receiverName: targetUser.nickname || targetUser.full_name || targetUser.username,
      receiverPic: targetUser.profile_pic || '',
      receiverPhone: targetUser.phone || '',
      callType
    });
    socket.emit('call-user', { receiverId: targetUser.id, callType });
  }

  function handleAcceptCall() {
    const call = incomingCall;
    setIncomingCall(null);
    stopRingtone();
    const socket = getSocket();
    if (socket && call) {
      socket.emit('call-response', { callerId: call.callerId, response: 'accept' });
      // Open native call
      if (call.callType === 'video') {
        window.location.href = `facetime:${call.callerPhone}`;
      } else {
        window.location.href = `tel:${call.callerPhone}`;
      }
    }
  }

  function handleDeclineCall() {
    const call = incomingCall;
    setIncomingCall(null);
    stopRingtone();
    const socket = getSocket();
    if (socket && call) {
      socket.emit('call-response', { callerId: call.callerId, response: 'decline' });
    }
  }

  function handleCancelCall() {
    const call = outgoingCall;
    setOutgoingCall(null);
    const socket = getSocket();
    if (socket && call) {
      socket.emit('call-cancel', { receiverId: call.receiverId });
    }
  }

  function handleBack() { setSelectedUser(null); setSelectedGroup(null); setMessages([]); setReplyTo(null); }

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => { function h() { setIsMobile(window.innerWidth <= 768); } window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);

  if (!user) return <Login onLogin={handleLogin} />;

  const hasSelection = selectedUser || selectedGroup;

  return (
    <div className="app">
      <Sidebar
        className={isMobile && hasSelection ? 'hidden-mobile' : ''}
        users={users} groups={groups} onlineUsers={onlineUsers}
        currentUser={user} selectedUser={selectedUser} selectedGroup={selectedGroup}
        onSelectUser={handleSelectUser} onSelectGroup={handleSelectGroup}
        onLogout={handleLogout} onAddContact={handleAddContact}
        onUpdateProfile={handleUpdateProfile} onRenameContact={handleRenameContact}
        onCreateGroup={handleCreateGroup} token={token}
      />
      <div className={`chat-panel ${isMobile && !hasSelection ? 'hidden-mobile' : ''}`}>
        <ChatWindow
          messages={messages} currentUser={user}
          selectedUser={selectedUser} selectedGroup={selectedGroup}
          onlineUsers={onlineUsers} typing={typing === selectedUser?.id}
          onBack={handleBack} onDeleteMessage={handleDeleteMessage}
          onReply={(msg) => setReplyTo(msg)}
          onReaction={handleReaction} onRemoveReaction={handleRemoveReaction}
          onLeaveGroup={handleLeaveGroup} onDeleteGroup={handleDeleteGroup}
          onBlockUser={handleBlockUser}
          onCall={handleCall}
          token={token} users={users}
        />
        {hasSelection && (
          <MessageInput
            onSend={(content) => { handleSend(content, replyTo); setReplyTo(null); }}
            onSendFile={handleSendFile} onTyping={handleTyping} onStopTyping={handleStopTyping}
            disabled={!hasSelection} token={token}
            replyTo={replyTo} onCancelReply={() => setReplyTo(null)}
          />
        )}
      </div>
      {incomingCall && (
        <IncomingCallOverlay call={incomingCall} onAccept={handleAcceptCall} onDecline={handleDeclineCall} />
      )}
      {outgoingCall && (
        <OutgoingCallOverlay call={outgoingCall} onCancel={handleCancelCall} />
      )}
      {callToast && (
        <div className="call-toast">{callToast}</div>
      )}
    </div>
  );
}
