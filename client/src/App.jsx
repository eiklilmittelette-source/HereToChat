import React, { useState, useEffect, useCallback, useRef } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import { connectSocket, getSocket, disconnectSocket } from './socket';
import { apiUrl } from './api';
import './App.css';

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
  const selectedUserRef = useRef(null);
  const selectedGroupRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Connect socket when logged in
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    socket.on('online-users', (ids) => setOnlineUsers(ids));

    socket.on('receive-message', (msg) => {
      const sel = selectedUserRef.current;
      const grp = selectedGroupRef.current;
      // Only add to current DM chat if message belongs to this conversation
      if (!grp && sel && (msg.sender_id === sel.id || msg.receiver_id === sel.id)) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on('receive-group-message', (msg) => {
      const grp = selectedGroupRef.current;
      if (grp && msg.group_id === grp.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id && m.group_id)) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on('user-typing', (userId) => {
      setTyping(prev => userId);
    });

    socket.on('user-stop-typing', () => {
      setTyping(false);
    });

    return () => disconnectSocket();
  }, [token]);

  // Fetch contacts
  useEffect(() => {
    if (!token) return;
    function fetchContacts() {
      fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setUsers).catch(() => {});
    }
    fetchContacts();
    const interval = setInterval(fetchContacts, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Fetch groups
  useEffect(() => {
    if (!token) return;
    function fetchGroups() {
      fetch(apiUrl('/api/groups'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setGroups).catch(() => {});
    }
    fetchGroups();
    const interval = setInterval(fetchGroups, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Fetch DM messages when selecting a user
  useEffect(() => {
    if (!token || !selectedUser || selectedGroup) return;
    fetch(apiUrl(`/api/messages/${selectedUser.id}`), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setMessages)
      .catch(() => {});
  }, [token, selectedUser, selectedGroup]);

  // Fetch group messages when selecting a group
  useEffect(() => {
    if (!token || !selectedGroup) return;
    fetch(apiUrl(`/api/groups/${selectedGroup.id}/messages`), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setMessages)
      .catch(() => {});
  }, [token, selectedGroup]);

  function handleLogin(userData, tokenData) {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('token', tokenData);
    localStorage.setItem('user', JSON.stringify(userData));
  }

  function handleLogout() {
    disconnectSocket();
    setUser(null);
    setToken(null);
    setSelectedUser(null);
    setSelectedGroup(null);
    setMessages([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async function handleAddContact(phone, nickname) {
    const res = await fetch(apiUrl('/api/contacts/add'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, nickname })
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    const usersRes = await fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } });
    const usersData = await usersRes.json();
    setUsers(usersData);
    return data;
  }

  async function handleRenameContact(contactId, nickname) {
    const res = await fetch(apiUrl('/api/contacts/rename'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contactId, nickname })
    });
    if (res.ok) {
      const usersRes = await fetch(apiUrl('/api/users'), { headers: { Authorization: `Bearer ${token}` } });
      const usersData = await usersRes.json();
      setUsers(usersData);
    }
  }

  async function handleCreateGroup(name, memberIds) {
    const res = await fetch(apiUrl('/api/groups/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, memberIds })
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    // Refresh groups
    const grpRes = await fetch(apiUrl('/api/groups'), { headers: { Authorization: `Bearer ${token}` } });
    const grpData = await grpRes.json();
    setGroups(grpData);
    // Join socket room
    const socket = getSocket();
    if (socket) socket.emit('join-group', data.id);
    return data;
  }

  async function handleUpdateProfile(fullName, profilePicBase64) {
    const body = { fullName };
    if (profilePicBase64) body.profilePic = profilePicBase64;
    const res = await fetch(apiUrl('/api/profile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      const updated = { ...user, full_name: data.full_name, profile_pic: data.profile_pic };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  }

  function handleSelectUser(u) {
    setSelectedGroup(null);
    setSelectedUser(u);
    setMessages([]);
  }

  function handleSelectGroup(g) {
    setSelectedUser(null);
    setSelectedGroup(g);
    setMessages([]);
  }

  function handleSend(content, reply) {
    const socket = getSocket();
    if (!socket) return;
    if (selectedGroup) {
      socket.emit('send-group-message', { groupId: selectedGroup.id, content, replyTo: reply?.id || null });
    } else if (selectedUser) {
      socket.emit('send-message', { receiverId: selectedUser.id, content, replyTo: reply?.id || null });
    }
  }

  function handleSendFile(type, fileUrl, fileName) {
    const socket = getSocket();
    if (!socket) return;
    if (selectedGroup) {
      socket.emit('send-group-message', { groupId: selectedGroup.id, content: '', type, fileUrl, fileName });
    } else if (selectedUser) {
      socket.emit('send-message', { receiverId: selectedUser.id, content: '', type, fileUrl, fileName });
    }
  }

  function handleTyping() {
    const socket = getSocket();
    if (!socket) return;
    if (selectedGroup) socket.emit('group-typing', selectedGroup.id);
    else if (selectedUser) socket.emit('typing', selectedUser.id);
  }

  function handleStopTyping() {
    const socket = getSocket();
    if (!socket) return;
    if (selectedGroup) socket.emit('group-stop-typing', selectedGroup.id);
    else if (selectedUser) socket.emit('stop-typing', selectedUser.id);
  }

  const [replyTo, setReplyTo] = useState(null);

  async function handleDeleteMessage(msgId, isGroupMsg) {
    const url = isGroupMsg ? '/api/groups/messages/delete' : '/api/messages/delete';
    const res = await fetch(apiUrl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId: msgId })
    });
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    }
  }

  function handleReply(msg) {
    setReplyTo(msg);
  }

  function handleBack() {
    setSelectedUser(null);
    setSelectedGroup(null);
    setMessages([]);
    setReplyTo(null);
  }

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth <= 768); }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const hasSelection = selectedUser || selectedGroup;

  return (
    <div className="app">
      <Sidebar
        className={isMobile && hasSelection ? 'hidden-mobile' : ''}
        users={users}
        groups={groups}
        onlineUsers={onlineUsers}
        currentUser={user}
        selectedUser={selectedUser}
        selectedGroup={selectedGroup}
        onSelectUser={handleSelectUser}
        onSelectGroup={handleSelectGroup}
        onLogout={handleLogout}
        onAddContact={handleAddContact}
        onUpdateProfile={handleUpdateProfile}
        onRenameContact={handleRenameContact}
        onCreateGroup={handleCreateGroup}
      />
      <div className={`chat-panel ${isMobile && !hasSelection ? 'hidden-mobile' : ''}`}>
        <ChatWindow
          messages={messages}
          currentUser={user}
          selectedUser={selectedUser}
          selectedGroup={selectedGroup}
          onlineUsers={onlineUsers}
          typing={typing === selectedUser?.id}
          onBack={handleBack}
          onDeleteMessage={handleDeleteMessage}
          onReply={handleReply}
          onForward={(msg) => {/* future */}}
          users={users}
          token={token}
        />
        {hasSelection && (
          <MessageInput
            onSend={(content) => {
              handleSend(content, replyTo);
              setReplyTo(null);
            }}
            onSendFile={handleSendFile}
            onTyping={handleTyping}
            onStopTyping={handleStopTyping}
            disabled={!hasSelection}
            token={token}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        )}
      </div>
    </div>
  );
}
