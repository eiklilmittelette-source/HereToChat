const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const webpush = require('web-push');
const db = require('./db');
const { generateToken, verifyToken, authMiddleware } = require('./auth');

// VAPID keys for push notifications
const VAPID_PUBLIC = process.env.VAPID_PUBLIC || 'BNg_6K3VX7iLgivMYbQcKvwfglDQ_bKCsd-_UpS185prwBEtXdpu_Tyd3eWrbYPpQkwdFEXYOUfPAfmp-TNyoVM';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'IdrwwzaDwC7aKsy3m2r-_9daZ4ZYtSDFedJQ3XNYw9Q';
webpush.setVapidDetails('mailto:heretochat@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

// Push subscriptions stored in database (see db.js)

// Normalize phone numbers: remove spaces, dashes, dots, handle +33/0
function normalizePhone(p) {
  if (!p || typeof p !== 'string') return '';
  let n = p.replace(/[\s\-\.\(\)]/g, '');
  // Convert +33 to 0 (French numbers)
  if (n.startsWith('+33')) n = '0' + n.slice(3);
  // Convert 0033 to 0
  if (n.startsWith('0033')) n = '0' + n.slice(4);
  return n;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: '25mb' }));

// Serve uploaded profile pics
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// --- REST API ---

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, fullName, phone, profilePic, invitedBy } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom et mot de passe requis' });
    }
    if (username.length < 2 || password.length < 4) {
      return res.status(400).json({ error: 'Nom min 2 caractères, mot de passe min 4' });
    }
    // Validate phone number
    if (phone) {
      const cleaned = phone.trim().replace(/[\s\-\.\(\)]/g, '');
      if (!/^\+?\d{6,15}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide' });
      }
    }
    const existing = await db.getUserByUsername(username);
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
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : '';
    const result = await db.createUser(username, hash, fullName || username, normalizedPhone, picPath);
    const user = { id: result.lastInsertRowid, username, full_name: fullName || username, phone: normalizedPhone, profile_pic: picPath };
    // Auto-add inviter as contact
    if (invitedBy) {
      const inviterId = Number(invitedBy);
      if (inviterId && inviterId !== user.id) {
        await db.addContact(user.id, inviterId, '');
        await db.addContact(inviterId, user.id, '');
      }
    }
    const token = generateToken({ id: user.id, username });
    res.json({ user, token });
  } catch (err) {
    console.error('[register] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password, phone } = req.body;
    // Support login by phone or username
    let user = null;
    if (phone) {
      user = await db.getUserByPhone(phone.trim());
      if (!user) user = await db.getUserByPhone(normalizePhone(phone.trim()));
      if (!user) {
        const all = await db.getAllUsers(0);
        const norm = normalizePhone(phone.trim());
        const found = all.find(u => normalizePhone(u.phone || '') === norm);
        if (found) user = found;
      }
      if (!user) user = await db.getUserByUsername(phone.trim());
      if (user) user = await db.getUserByUsername(user.username);
    } else if (username) {
      user = await db.getUserByUsername(username);
    }
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Numéro ou mot de passe incorrect' });
    }
    const token = generateToken({ id: user.id, username: user.username });
    res.json({
      user: { id: user.id, username: user.username, full_name: user.full_name, phone: user.phone, profile_pic: user.profile_pic },
      token
    });
  } catch (err) {
    console.error('[login] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const contacts = await db.getContacts(req.user.id);
    res.json(contacts);
  } catch (err) {
    console.error('[users] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/contacts/add', authMiddleware, async (req, res) => {
  try {
    const { phone } = req.body;
    console.log('[contacts/add] user:', req.user.id, 'phone:', phone);
    if (!phone) {
      return res.status(400).json({ error: 'Numéro de téléphone requis' });
    }
    const normalized = normalizePhone(phone.trim());
    // Try exact match by phone, then normalized, then username, then full search
    let contact = await db.getUserByPhone(phone.trim());
    if (!contact) contact = await db.getUserByPhone(normalized);
    if (!contact) contact = await db.getUserByUsername(phone.trim());
    if (!contact) {
      const all = await db.getAllUsers(0);
      contact = all.find(u => normalizePhone(u.phone || '') === normalized || normalizePhone(u.username || '') === normalized);
    }
    if (!contact) {
      console.log('[contacts/add] not found:', phone, '→', normalized);
      return res.status(404).json({ error: 'Aucun utilisateur avec ce numéro' });
    }
    // Permettre de s'ajouter soi-même (notes personnelles)
    const nickname = req.body.nickname || '';
    await db.addContact(req.user.id, contact.id, nickname);
    console.log('[contacts/add] success:', req.user.id, '→', contact.id);
    res.json({ id: contact.id, username: contact.username, full_name: contact.full_name, profile_pic: contact.profile_pic, nickname });
  } catch (err) {
    console.error('[contacts/add] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/profile-pic', authMiddleware, async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic) return res.status(400).json({ error: 'Photo requise' });
    const matches = profilePic.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Format image invalide' });
    const ext = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const filename = `${Date.now()}-${req.user.id}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), data);
    const picPath = `/uploads/${filename}`;
    await db.updateUserProfile(req.user.id, null, null, picPath);
    res.json({ profile_pic: picPath });
  } catch (err) {
    console.error('[profile-pic] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rename a contact
app.post('/api/contacts/rename', authMiddleware, async (req, res) => {
  try {
    const { contactId, nickname } = req.body;
    if (!contactId) return res.status(400).json({ error: 'Contact requis' });
    await db.renameContact(req.user.id, Number(contactId), nickname || '');
    res.json({ ok: true });
  } catch (err) {
    console.error('[contacts/rename] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Update profile (name and/or pic)
app.post('/api/profile', authMiddleware, async (req, res) => {
  try {
    const { fullName, profilePic } = req.body;
    const user = await db.getUserById(req.user.id);
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
    await db.updateUserProfile(req.user.id, newName, user.phone, picPath);
    res.json({ full_name: newName, profile_pic: picPath });
  } catch (err) {
    console.error('[profile] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload file (voice, image, document)
app.post('/api/upload', authMiddleware, (req, res) => {
  try {
    const { fileData, fileName, fileType } = req.body;
    if (!fileData) return res.status(400).json({ error: 'Fichier requis' });

    let ext = 'bin';
    let folder = 'files';
    const dataMatch = fileData.match(/^data:([^;,]+(?:;[^;,]+)*);base64,(.+)$/);
    if (dataMatch) {
      const fullMime = dataMatch[1];
      const mime = fullMime.split(';')[0];
      const data = Buffer.from(dataMatch[2], 'base64');
      if (data.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'Fichier trop volumineux (max 15MB)' });
      if (mime.startsWith('audio/')) {
        ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'm4a' : mime.includes('aac') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : 'webm';
        folder = 'voice';
      } else if (mime.startsWith('image/')) {
        ext = mime.split('/')[1].replace('jpeg', 'jpg');
        folder = 'images';
      } else if (mime.startsWith('video/')) {
        ext = mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : mime.includes('quicktime') ? 'mov' : fileName ? fileName.split('.').pop() : 'mp4';
        folder = 'videos';
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
  } catch (err) {
    console.error('[upload] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


app.get('/api/messages/:userId', authMiddleware, async (req, res) => {
  try {
    const messages = await db.getMessages(req.user.id, parseInt(req.params.userId));
    const ids = messages.map(m => m.id);
    const reactionsMap = await db.getReactionsForMessages(ids, 'dm');
    messages.forEach(m => { m.reactions = reactionsMap[m.id] || []; });
    res.json(messages);
  } catch (err) {
    console.error('[messages] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/messages/delete', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'ID message requis' });
    await db.deleteMessage(Number(messageId), req.user.id);
    res.json({ ok: true, messageId: Number(messageId) });
  } catch (err) {
    console.error('[messages/delete] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/messages/delete', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'ID message requis' });
    await db.deleteGroupMessage(Number(messageId), req.user.id);
    res.json({ ok: true, messageId: Number(messageId) });
  } catch (err) {
    console.error('[groups/messages/delete] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/reactions/add', authMiddleware, async (req, res) => {
  try {
    const { messageId, messageType, emoji } = req.body;
    if (!messageId || !emoji) return res.status(400).json({ error: 'Données manquantes' });
    await db.addReaction(Number(messageId), messageType || 'dm', req.user.id, emoji);
    res.json({ ok: true });
  } catch (err) {
    console.error('[reactions/add] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/reactions/remove', authMiddleware, async (req, res) => {
  try {
    const { messageId, messageType, emoji } = req.body;
    if (!messageId || !emoji) return res.status(400).json({ error: 'Données manquantes' });
    await db.removeReaction(Number(messageId), messageType || 'dm', req.user.id, emoji);
    res.json({ ok: true });
  } catch (err) {
    console.error('[reactions/remove] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// === GROUP ROUTES ===

app.post('/api/groups/create', authMiddleware, async (req, res) => {
  try {
    const { name, memberIds, pic } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom du groupe requis' });
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) return res.status(400).json({ error: 'Ajoute au moins 1 membre' });
    let picPath = '';
    if (pic) {
      const matches = pic.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const subDir = path.join(uploadsDir, 'groups');
        if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
        const filename = `group-${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(subDir, filename), data);
        picPath = `/uploads/groups/${filename}`;
      }
    }
    const group = await db.createGroup(name.trim(), req.user.id, memberIds, picPath);
    const members = await db.getGroupMembers(group.id);
    res.json({ ...group, members });
  } catch (err) {
    console.error('[groups/create] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/groups', authMiddleware, async (req, res) => {
  try {
    const groups = await db.getGroupsForUser(req.user.id);
    res.json(groups);
  } catch (err) {
    console.error('[groups] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/groups/:groupId', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!await db.isGroupMember(groupId, req.user.id)) return res.status(403).json({ error: 'Pas membre' });
    const members = await db.getGroupMembers(groupId);
    res.json({ members });
  } catch (err) {
    console.error('[groups/members] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!await db.isGroupMember(groupId, req.user.id)) return res.status(403).json({ error: 'Pas membre' });
    const messages = await db.getGroupMessages(groupId);
    const ids = messages.map(m => m.id);
    const reactionsMap = await db.getReactionsForMessages(ids, 'group');
    messages.forEach(m => { m.reactions = reactionsMap[m.id] || []; });
    res.json(messages);
  } catch (err) {
    console.error('[groups/messages] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/:groupId/add-member', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { userId } = req.body;
    if (!await db.isGroupMember(groupId, req.user.id)) return res.status(403).json({ error: 'Pas membre' });
    await db.addGroupMember(groupId, Number(userId));
    res.json({ ok: true });
  } catch (err) {
    console.error('[groups/add-member] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/:groupId/leave', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    await db.removeGroupMember(groupId, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[groups/leave] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/:groupId/set-admin', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!await db.isGroupAdmin(groupId, req.user.id)) return res.status(403).json({ error: 'Tu n\'es pas admin' });
    const { userId } = req.body;
    await db.setGroupAdmin(groupId, Number(userId));
    res.json({ ok: true });
  } catch (err) {
    console.error('[groups/set-admin] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/:groupId/update-pic', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!await db.isGroupAdmin(groupId, req.user.id)) return res.status(403).json({ error: 'Tu n\'es pas admin' });
    const { pic } = req.body;
    if (!pic) return res.status(400).json({ error: 'Photo requise' });
    const matches = pic.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Format invalide' });
    const ext = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const subDir = path.join(uploadsDir, 'groups');
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    const filename = `group-${groupId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(subDir, filename), data);
    const picPath = `/uploads/groups/${filename}`;
    await db.updateGroupPic(groupId, picPath);
    res.json({ ok: true, pic: picPath });
  } catch (err) {
    console.error('[groups/update-pic] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/:groupId/remove-admin', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!await db.isGroupAdmin(groupId, req.user.id)) return res.status(403).json({ error: 'Tu n\'es pas admin' });
    const { userId } = req.body;
    await db.removeGroupAdmin(groupId, Number(userId));
    res.json({ ok: true });
  } catch (err) {
    console.error('[groups/remove-admin] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/:groupId/remove-member', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!await db.isGroupAdmin(groupId, req.user.id)) return res.status(403).json({ error: 'Tu n\'es pas admin' });
    const { userId } = req.body;
    await db.removeGroupMember(groupId, Number(userId));
    res.json({ ok: true });
  } catch (err) {
    console.error('[groups/remove-member] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/groups/:groupId/delete', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!await db.isGroupAdmin(groupId, req.user.id)) return res.status(403).json({ error: 'Tu n\'es pas admin' });
    await db.deleteGroup(groupId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[groups/delete] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/block', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User requis' });
    await db.blockUser(req.user.id, Number(userId));
    res.json({ ok: true });
  } catch (err) {
    console.error('[block] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/unblock', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User requis' });
    await db.unblockUser(req.user.id, Number(userId));
    res.json({ ok: true });
  } catch (err) {
    console.error('[unblock] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/blocked', authMiddleware, async (req, res) => {
  try {
    const list = await db.getBlockedUsers(req.user.id);
    res.json(list);
  } catch (err) {
    console.error('[blocked] error:', err);
    res.json([]);
  }
});

// --- PUSH NOTIFICATIONS ---

app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

app.post('/api/push/subscribe', authMiddleware, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription requise' });
  await db.savePushSubscription(req.user.id, subscription);
  res.json({ ok: true });
});

async function sendPushToUser(userId, payload) {
  const subs = await db.getPushSubscriptions(userId);
  if (!subs || subs.length === 0) return;
  const data = JSON.stringify(payload);
  for (const sub of subs) {
    webpush.sendNotification(sub, data).catch(async (err) => {
      console.error('[push] error for', sub.endpoint?.slice(0, 50), ':', err.statusCode || err.message);
      await db.removePushSubscription(sub.endpoint);
    });
  }
}

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

io.on('connection', async (socket) => {
  const userId = Number(socket.user.id);
  onlineUsers.set(userId, socket.id);

  io.emit('online-users', Array.from(onlineUsers.keys()));
  console.log(`${socket.user.username} connecté (id=${userId}, socket=${socket.id})`);

  // Auto-join all group rooms
  const userGroups = await db.getGroupsForUser(userId);
  for (const g of userGroups) {
    socket.join(`group-${g.id}`);
  }

  socket.on('send-message', async (data) => {
    try {
      const { receiverId, content, type, fileUrl, fileName, replyTo } = data;
      if ((!content && !fileUrl) || !receiverId) {
        socket.emit('message-error', { error: 'Données manquantes' });
        return;
      }

      const rid = Number(receiverId);
      const blocked = await db.getBlockedUsers(rid);
      if (blocked.some(b => b.blocked_id === userId)) {
        socket.emit('message-error', { error: 'Vous êtes bloqué par cet utilisateur' });
        return;
      }
      const blocked2 = await db.getBlockedUsers(userId);
      if (blocked2.some(b => b.blocked_id === rid)) {
        socket.emit('message-error', { error: 'Vous avez bloqué cet utilisateur' });
        return;
      }
      await db.addContact(userId, rid, '');
      await db.addContact(rid, userId, '');
      const result = await db.saveMessage(userId, rid, content || '', type || 'text', fileUrl || '', fileName || '', replyTo || null);
      const message = {
        id: Number(result.lastInsertRowid),
        sender_id: userId,
        receiver_id: rid,
        content: content || '',
        type: type || 'text',
        file_url: fileUrl || '',
        file_name: fileName || '',
        reply_to: replyTo || null,
        sender_name: socket.user.username,
        timestamp: new Date().toISOString()
      };

      const receiverSocket = onlineUsers.get(rid);
      if (rid !== userId && receiverSocket) {
        io.to(receiverSocket).emit('receive-message', message);
      }
      socket.emit('receive-message', message);

      const senderUser = await db.getUserById(userId);
      const senderName = senderUser ? senderUser.full_name : socket.user.username;
      await sendPushToUser(rid, {
        title: senderName,
        body: content || (type === 'voice' ? 'Message vocal' : type === 'image' ? 'Photo' : type === 'video' ? 'Vidéo' : fileName || 'Fichier'),
        tag: `dm-${userId}`
      });
    } catch (err) {
      console.error('[send-message] error:', err);
    }
  });

  socket.on('typing', (receiverId) => {
    const receiverSocket = onlineUsers.get(Number(receiverId));
    if (receiverSocket) {
      io.to(receiverSocket).emit('user-typing', userId);
    }
  });

  socket.on('stop-typing', (receiverId) => {
    const receiverSocket = onlineUsers.get(Number(receiverId));
    if (receiverSocket) {
      io.to(receiverSocket).emit('user-stop-typing', userId);
    }
  });

  socket.on('send-group-message', async (data) => {
    try {
      const { groupId, content, type, fileUrl, fileName, replyTo } = data;
      if ((!content && !fileUrl) || !groupId) return;
      const gid = Number(groupId);
      if (!await db.isGroupMember(gid, userId)) return;

      const result = await db.saveGroupMessage(gid, userId, content || '', type || 'text', fileUrl || '', fileName || '', replyTo || null);
      const user = await db.getUserById(userId);
      const message = {
        id: Number(result.lastInsertRowid),
        group_id: gid,
        sender_id: userId,
        content: content || '',
        type: type || 'text',
        file_url: fileUrl || '',
        file_name: fileName || '',
        reply_to: replyTo || null,
        sender_name: user ? user.username : socket.user.username,
        sender_full_name: user ? user.full_name : '',
        sender_pic: user ? user.profile_pic : '',
        timestamp: new Date().toISOString()
      };

      io.to(`group-${gid}`).emit('receive-group-message', message);

      const groupMembers = await db.getGroupMembers(gid);
      const groupInfo = await db.queryOne('SELECT name FROM groups_ WHERE id = $1', [gid]);
      const groupName = groupInfo ? groupInfo.name : 'Groupe';
      const senderName2 = user ? user.full_name : socket.user.username;
      for (const member of groupMembers) {
        if (member.id !== userId) {
          await sendPushToUser(member.id, {
            title: `${senderName2} (${groupName})`,
            body: content || (type === 'voice' ? 'Message vocal' : type === 'image' ? 'Photo' : type === 'video' ? 'Vidéo' : fileName || 'Fichier'),
            tag: `group-${gid}`
          });
        }
      }
    } catch (err) {
      console.error('[send-group-message] error:', err);
    }
  });

  // Group typing
  socket.on('group-typing', (groupId) => {
    socket.to(`group-${Number(groupId)}`).emit('group-user-typing', { groupId: Number(groupId), userId });
  });

  socket.on('group-stop-typing', (groupId) => {
    socket.to(`group-${Number(groupId)}`).emit('group-user-stop-typing', { groupId: Number(groupId), userId });
  });

  // Join group room
  socket.on('join-group', (groupId) => {
    socket.join(`group-${Number(groupId)}`);
  });

  socket.on('add-reaction', async (data) => {
    try {
      const { messageId, messageType, emoji } = data;
      await db.addReaction(Number(messageId), messageType || 'dm', userId, emoji);
      const reaction = { messageId: Number(messageId), messageType, emoji, user_id: userId, full_name: socket.user.username };
      if (messageType === 'group' && data.groupId) {
        io.to(`group-${Number(data.groupId)}`).emit('reaction-added', reaction);
      } else if (data.receiverId) {
        const receiverSocket = onlineUsers.get(Number(data.receiverId));
        if (receiverSocket) io.to(receiverSocket).emit('reaction-added', reaction);
        socket.emit('reaction-added', reaction);
      }
    } catch (err) {
      console.error('[add-reaction] error:', err);
    }
  });

  socket.on('remove-reaction', async (data) => {
    try {
      const { messageId, messageType, emoji } = data;
      await db.removeReaction(Number(messageId), messageType || 'dm', userId, emoji);
      const reaction = { messageId: Number(messageId), messageType, emoji, user_id: userId };
      if (messageType === 'group' && data.groupId) {
        io.to(`group-${Number(data.groupId)}`).emit('reaction-removed', reaction);
      } else if (data.receiverId) {
        const receiverSocket = onlineUsers.get(Number(data.receiverId));
        if (receiverSocket) io.to(receiverSocket).emit('reaction-removed', reaction);
        socket.emit('reaction-removed', reaction);
      }
    } catch (err) {
      console.error('[remove-reaction] error:', err);
    }
  });

  // --- APPELS ---
  socket.on('call-user', async (data) => {
    try {
      const { receiverId, callType } = data;
      const rid = Number(receiverId);
      const receiverSocket = onlineUsers.get(rid);
      const caller = await db.getUserById(userId);
      if (!receiverSocket) {
        socket.emit('call-failed', { reason: 'offline' });
        return;
      }
      io.to(receiverSocket).emit('incoming-call', {
        callerId: userId,
        callerName: caller ? caller.full_name : socket.user.username,
        callerPic: caller ? caller.profile_pic : '',
        callerPhone: caller ? caller.phone : '',
        callType: callType || 'audio'
      });
      // Push notification too
      const senderName = caller ? caller.full_name : socket.user.username;
      await sendPushToUser(rid, {
        title: `${senderName} vous appelle`,
        body: callType === 'video' ? 'Appel vidéo entrant' : 'Appel vocal entrant',
        tag: `call-${userId}`
      });
    } catch (err) {
      console.error('[call-user] error:', err);
    }
  });

  socket.on('call-response', async (data) => {
    try {
      const { callerId, response } = data;
      const callerSocket = onlineUsers.get(Number(callerId));
      if (!callerSocket) return;
      const responder = await db.getUserById(userId);
      if (response === 'accept') {
        io.to(callerSocket).emit('call-accepted', {
          receiverId: userId,
          receiverPhone: responder ? responder.phone : ''
        });
      } else {
        io.to(callerSocket).emit('call-declined', { receiverId: userId });
      }
    } catch (err) {
      console.error('[call-response] error:', err);
    }
  });

  socket.on('call-cancel', (data) => {
    try {
      const { receiverId } = data;
      const receiverSocket = onlineUsers.get(Number(receiverId));
      if (receiverSocket) {
        io.to(receiverSocket).emit('call-cancelled', { callerId: userId });
      }
    } catch (err) {
      console.error('[call-cancel] error:', err);
    }
  });

  socket.on('delete-message', async (data) => {
    try {
      const { messageId, messageType, groupId, receiverId } = data;
      if (messageType === 'group') {
        await db.deleteGroupMessage(Number(messageId), userId);
        io.to(`group-${Number(groupId)}`).emit('message-deleted', { messageId: Number(messageId), sender_name: socket.user.username });
      } else {
        await db.deleteMessage(Number(messageId), userId);
        const receiverSocket = onlineUsers.get(Number(receiverId));
        const deleteData = { messageId: Number(messageId), sender_name: socket.user.username };
        if (receiverSocket) io.to(receiverSocket).emit('message-deleted', deleteData);
        socket.emit('message-deleted', deleteData);
      }
    } catch (err) {
      console.error('[delete-message] error:', err);
    }
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
  // No cache for sw.js, manifest.json, and index.html
  app.get('/sw.js', (req, res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.sendFile(path.join(clientDist, 'sw.js')); });
  app.get('/manifest.json', (req, res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.sendFile(path.join(clientDist, 'manifest.json')); });
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
