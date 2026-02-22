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

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
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
  const selectedUserRef = useRef(null);
  const selectedGroupRef = useRef(null);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) { setToken(savedToken); setUser(JSON.parse(savedUser)); }
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
      } catch {}
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
      if (msg.sender_id !== Number(JSON.parse(localStorage.getItem('user') || '{}').id)) {
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
      const currentUserId = Number(JSON.parse(localStorage.getItem('user') || '{}').id);
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

    return () => disconnectSocket();
  }, [token]);

  // Fetch contacts
  useEffect(() => {
    if (!token) return;
    const f = () => fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setUsers).catch(() => {});
    f();
    const i = setInterval(f, 5000);
    return () => clearInterval(i);
  }, [token]);

  // Fetch groups
  useEffect(() => {
    if (!token) return;
    const f = () => fetch(apiUrl('/api/groups'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setGroups).catch(() => {});
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
  function handleLogout() { disconnectSocket(); setUser(null); setToken(null); setSelectedUser(null); setSelectedGroup(null); setMessages([]); localStorage.removeItem('token'); localStorage.removeItem('user'); }

  async function handleAddContact(phone, nickname) {
    const res = await fetch(apiUrl('/api/contacts/add'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone, nickname }) });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    const r2 = await fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } });
    setUsers(await r2.json());
    return data;
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
    </div>
  );
}
