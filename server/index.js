const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { generateToken, verifyToken, authMiddleware } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: '15mb' }));

// Serve uploaded profile pics
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// --- REST API ---

app.post('/api/register', (req, res) => {
  const { username, password, fullName, phone, profilePic } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom et mot de passe requis' });
  }
  if (username.length < 2 || password.length < 4) {
    return res.status(400).json({ error: 'Nom min 2 caractères, mot de passe min 4' });
  }
  const existing = db.getUserByUsername(username);
  if (existing) {
    return res.status(409).json({ error: 'Ce username existe déjà' });
  }

  // Save profile pic if provided (base64)
  let picPath = '';
  if (profilePic) {
    const matches = profilePic.match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
      const ext = matches[1];
      const data = Buffer.from(matches[2], 'base64');
      const filename = `${Date.now()}-${username}.${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), data);
      picPath = `/uploads/${filename}`;
    }
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.createUser(username, hash, fullName || username, phone || '', picPath);
  const user = { id: result.lastInsertRowid, username, full_name: fullName || username, phone: phone || '', profile_pic: picPath };
  const token = generateToken({ id: user.id, username });
  res.json({ user, token });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Username ou mot de passe incorrect' });
  }
  const token = generateToken({ id: user.id, username: user.username });
  res.json({
    user: { id: user.id, username: user.username, full_name: user.full_name, phone: user.phone, profile_pic: user.profile_pic },
    token
  });
});

app.get('/api/users', authMiddleware, (req, res) => {
  const contacts = db.getContacts(req.user.id);
  res.json(contacts);
});

app.post('/api/contacts/add', authMiddleware, (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Numéro de téléphone requis' });
  }
  const contact = db.getUserByPhone(phone.trim());
  if (!contact) {
    return res.status(404).json({ error: 'Aucun utilisateur avec ce numéro' });
  }
  if (Number(contact.id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même' });
  }
  const nickname = req.body.nickname || '';
  db.addContact(req.user.id, contact.id, nickname);
  res.json({ id: contact.id, username: contact.username, full_name: contact.full_name, profile_pic: contact.profile_pic, nickname });
});

app.post('/api/profile-pic', authMiddleware, (req, res) => {
  const { profilePic } = req.body;
  if (!profilePic) {
    return res.status(400).json({ error: 'Photo requise' });
  }
  const matches = profilePic.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: 'Format image invalide' });
  }
  const ext = matches[1];
  const data = Buffer.from(matches[2], 'base64');
  const filename = `${Date.now()}-${req.user.id}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), data);
  const picPath = `/uploads/${filename}`;
  db.updateUserProfile(req.user.id, null, null, picPath);
  res.json({ profile_pic: picPath });
});

// Rename a contact
app.post('/api/contacts/rename', authMiddleware, (req, res) => {
  const { contactId, nickname } = req.body;
  if (!contactId) return res.status(400).json({ error: 'Contact requis' });
  db.renameContact(req.user.id, Number(contactId), nickname || '');
  res.json({ ok: true });
});

// Update profile (name and/or pic)
app.post('/api/profile', authMiddleware, (req, res) => {
  const { fullName, profilePic } = req.body;
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  let picPath = user.profile_pic;
  if (profilePic) {
    const matches = profilePic.match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
      const ext = matches[1];
      const data = Buffer.from(matches[2], 'base64');
      const filename = `${Date.now()}-${req.user.id}.${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), data);
      picPath = `/uploads/${filename}`;
    }
  }

  const newName = fullName && fullName.trim() ? fullName.trim() : user.full_name;
  db.updateUserProfile(req.user.id, newName, user.phone, picPath);
  res.json({ full_name: newName, profile_pic: picPath });
});

// Upload file (voice, image, document)
app.post('/api/upload', authMiddleware, (req, res) => {
  const { fileData, fileName, fileType } = req.body;
  if (!fileData) return res.status(400).json({ error: 'Fichier requis' });

  let ext = 'bin';
  let folder = 'files';
  const dataMatch = fileData.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    const mime = dataMatch[1];
    const data = Buffer.from(dataMatch[2], 'base64');
    if (mime.startsWith('audio/')) {
      ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      folder = 'voice';
    } else if (mime.startsWith('image/')) {
      ext = mime.split('/')[1].replace('jpeg', 'jpg');
      folder = 'images';
    } else {
      ext = fileName ? fileName.split('.').pop() : 'bin';
      folder = 'files';
    }
    const subDir = path.join(uploadsDir, folder);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    const storedName = `${Date.now()}-${req.user.id}.${ext}`;
    fs.writeFileSync(path.join(subDir, storedName), data);
    const fileUrl = `/uploads/${folder}/${storedName}`;
    res.json({ fileUrl, fileName: fileName || storedName });
  } else {
    res.status(400).json({ error: 'Format invalide' });
  }
});

// Debug route - voir tous les utilisateurs
app.get('/api/debug/users', (req, res) => {
  const stmt = db.getDb().prepare('SELECT id, username, full_name, phone FROM users');
  const users = [];
  while (stmt.step()) { users.push(stmt.getAsObject()); }
  stmt.free();
  res.json(users);
});

app.get('/api/messages/:userId', authMiddleware, (req, res) => {
  const messages = db.getMessages(req.user.id, parseInt(req.params.userId));
  res.json(messages);
});

// Delete a DM message (only sender can delete)
app.post('/api/messages/delete', authMiddleware, (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: 'ID message requis' });
  db.deleteMessage(Number(messageId), req.user.id);
  res.json({ ok: true });
});

// Delete a group message (only sender can delete)
app.post('/api/groups/messages/delete', authMiddleware, (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: 'ID message requis' });
  db.deleteGroupMessage(Number(messageId), req.user.id);
  res.json({ ok: true });
});

// === GROUP ROUTES ===

// Create a group
app.post('/api/groups/create', authMiddleware, (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nom du groupe requis' });
  }
  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'Ajoute au moins 1 membre' });
  }
  const group = db.createGroup(name.trim(), req.user.id, memberIds);
  const members = db.getGroupMembers(group.id);
  res.json({ ...group, members });
});

// Get user's groups
app.get('/api/groups', authMiddleware, (req, res) => {
  const groups = db.getGroupsForUser(req.user.id);
  res.json(groups);
});

// Get group details + members
app.get('/api/groups/:groupId', authMiddleware, (req, res) => {
  const groupId = parseInt(req.params.groupId);
  if (!db.isGroupMember(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Pas membre de ce groupe' });
  }
  const members = db.getGroupMembers(groupId);
  res.json({ members });
});

// Get group messages
app.get('/api/groups/:groupId/messages', authMiddleware, (req, res) => {
  const groupId = parseInt(req.params.groupId);
  if (!db.isGroupMember(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Pas membre de ce groupe' });
  }
  const messages = db.getGroupMessages(groupId);
  res.json(messages);
});

// Add member to group
app.post('/api/groups/:groupId/add-member', authMiddleware, (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const { userId } = req.body;
  if (!db.isGroupMember(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Pas membre de ce groupe' });
  }
  db.addGroupMember(groupId, Number(userId));
  res.json({ ok: true });
});

// Leave group
app.post('/api/groups/:groupId/leave', authMiddleware, (req, res) => {
  const groupId = parseInt(req.params.groupId);
  db.removeGroupMember(groupId, req.user.id);
  res.json({ ok: true });
});

// --- SOCKET.IO ---

const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const user = verifyToken(token);
  if (!user) {
    return next(new Error('Authentication error'));
  }
  socket.user = user;
  next();
});

io.on('connection', (socket) => {
  const userId = Number(socket.user.id);
  onlineUsers.set(userId, socket.id);

  io.emit('online-users', Array.from(onlineUsers.keys()));
  console.log(`${socket.user.username} connecté (id=${userId}, socket=${socket.id})`);

  // Auto-join all group rooms
  const userGroups = db.getGroupsForUser(userId);
  for (const g of userGroups) {
    socket.join(`group-${g.id}`);
  }

  socket.on('send-message', (data) => {
    const { receiverId, content, type, fileUrl, fileName } = data;
    if ((!content && !fileUrl) || !receiverId) return;

    const rid = Number(receiverId);
    // Auto-add contact both ways if not already contacts
    db.addContact(userId, rid, '');
    db.addContact(rid, userId, '');
    const result = db.saveMessage(userId, rid, content || '', type || 'text', fileUrl || '', fileName || '');
    const message = {
      id: Number(result.lastInsertRowid),
      sender_id: userId,
      receiver_id: rid,
      content: content || '',
      type: type || 'text',
      file_url: fileUrl || '',
      file_name: fileName || '',
      sender_name: socket.user.username,
      timestamp: new Date().toISOString()
    };

    console.log(`Message de ${userId} vers ${rid}, en ligne: ${JSON.stringify([...onlineUsers.entries()])}`);

    const receiverSocket = onlineUsers.get(rid);
    if (receiverSocket) {
      console.log(`-> envoyé au socket ${receiverSocket}`);
      io.to(receiverSocket).emit('receive-message', message);
    } else {
      console.log(`-> destinataire ${rid} pas en ligne`);
    }
    socket.emit('receive-message', message);
  });

  socket.on('typing', (receiverId) => {
    const receiverSocket = onlineUsers.get(Number(receiverId));
    if (receiverSocket) {
      io.to(receiverSocket).emit('user-typing', userId);
    }
  });

  socket.on('stop-typing', (receiverId) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('user-stop-typing', userId);
    }
  });

  // Group message
  socket.on('send-group-message', (data) => {
    const { groupId, content, type, fileUrl, fileName } = data;
    if ((!content && !fileUrl) || !groupId) return;
    const gid = Number(groupId);
    if (!db.isGroupMember(gid, userId)) return;

    const result = db.saveGroupMessage(gid, userId, content || '', type || 'text', fileUrl || '', fileName || '');
    const user = db.getUserById(userId);
    const message = {
      id: Number(result.lastInsertRowid),
      group_id: gid,
      sender_id: userId,
      content: content || '',
      type: type || 'text',
      file_url: fileUrl || '',
      file_name: fileName || '',
      sender_name: user ? user.username : socket.user.username,
      sender_full_name: user ? user.full_name : '',
      timestamp: new Date().toISOString()
    };

    io.to(`group-${gid}`).emit('receive-group-message', message);
  });

  // Group typing
  socket.on('group-typing', (groupId) => {
    socket.to(`group-${Number(groupId)}`).emit('group-user-typing', { groupId: Number(groupId), userId });
  });

  socket.on('group-stop-typing', (groupId) => {
    socket.to(`group-${Number(groupId)}`).emit('group-user-stop-typing', { groupId: Number(groupId), userId });
  });

  // Join group room (when creating/joining a group)
  socket.on('join-group', (groupId) => {
    socket.join(`group-${Number(groupId)}`);
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('online-users', Array.from(onlineUsers.keys()));
    console.log(`${socket.user.username} déconnecté`);
  });
});

// Serve built frontend
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 3001;

db.initDb().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur init DB:', err);
  process.exit(1);
});
