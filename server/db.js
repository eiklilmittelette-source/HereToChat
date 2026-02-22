const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'chat.db');

let db;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      profile_pic TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id)`);

  // Add columns (safe to run multiple times)
  try { db.run(`ALTER TABLE messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text'`); } catch(e) {}
  try { db.run(`ALTER TABLE messages ADD COLUMN file_url TEXT NOT NULL DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE messages ADD COLUMN file_name TEXT NOT NULL DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      contact_id INTEGER NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (contact_id) REFERENCES users(id),
      UNIQUE(user_id, contact_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS groups_ (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pic TEXT NOT NULL DEFAULT '',
      creator_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups_(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(group_id, user_id)
    )
  `);

  // Add role column for admin
  try { db.run(`ALTER TABLE group_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`); } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'text',
      file_url TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL DEFAULT '',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups_(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )
  `);

  try { db.run(`ALTER TABLE group_messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`); } catch(e) {}

  // Reactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'dm',
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, message_type, user_id, emoji)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_group_messages ON group_messages(group_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_group_members ON group_members(group_id, user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reactions ON reactions(message_id, message_type)`);

  // Push subscriptions table
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      subscription TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`);

  save();
  return db;
}

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function createUser(username, passwordHash, fullName, phone, profilePic) {
  db.run('INSERT INTO users (username, password_hash, full_name, phone, profile_pic) VALUES (?, ?, ?, ?, ?)',
    [username, passwordHash, fullName, phone, profilePic]);
  const result = db.exec('SELECT last_insert_rowid() as id');
  save();
  return { lastInsertRowid: result[0].values[0][0] };
}

function getUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  stmt.bind([username]);
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
  stmt.free();
  return null;
}

function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, full_name, phone, profile_pic, created_at FROM users WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
  stmt.free();
  return null;
}

function getAllUsers(excludeId) {
  const stmt = db.prepare('SELECT id, username, full_name, phone, profile_pic FROM users WHERE id != ?');
  stmt.bind([excludeId]);
  const users = [];
  while (stmt.step()) { users.push(stmt.getAsObject()); }
  stmt.free();
  return users;
}

function saveMessage(senderId, receiverId, content, type, fileUrl, fileName) {
  db.run('INSERT INTO messages (sender_id, receiver_id, content, type, file_url, file_name) VALUES (?, ?, ?, ?, ?, ?)',
    [senderId, receiverId, content || '', type || 'text', fileUrl || '', fileName || '']);
  const result = db.exec('SELECT last_insert_rowid() as id');
  save();
  return { lastInsertRowid: result[0].values[0][0] };
}

function getMessages(userId1, userId2) {
  const stmt = db.prepare(`
    SELECT m.*, u.username as sender_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.timestamp ASC
  `);
  stmt.bind([userId1, userId2, userId2, userId1]);
  const messages = [];
  while (stmt.step()) { messages.push(stmt.getAsObject()); }
  stmt.free();
  return messages;
}

function getUserByPhone(phone) {
  const stmt = db.prepare('SELECT id, username, full_name, phone, profile_pic FROM users WHERE phone = ?');
  stmt.bind([phone]);
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
  stmt.free();
  return null;
}

function addContact(userId, contactId, nickname) {
  db.run('INSERT OR IGNORE INTO contacts (user_id, contact_id, nickname) VALUES (?, ?, ?)', [userId, contactId, nickname || '']);
  save();
}

function renameContact(userId, contactId, nickname) {
  db.run('UPDATE contacts SET nickname = ? WHERE user_id = ? AND contact_id = ?', [nickname, userId, contactId]);
  save();
}

function getContacts(userId) {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.phone, u.profile_pic, c.nickname
    FROM contacts c
    JOIN users u ON c.contact_id = u.id
    WHERE c.user_id = ?
  `);
  stmt.bind([userId]);
  const contacts = [];
  while (stmt.step()) { contacts.push(stmt.getAsObject()); }
  stmt.free();
  return contacts;
}

function updateUserProfile(id, fullName, phone, profilePic) {
  if (profilePic && !fullName && !phone) {
    db.run('UPDATE users SET profile_pic = ? WHERE id = ?', [profilePic, id]);
  } else {
    db.run('UPDATE users SET full_name = ?, phone = ?, profile_pic = ? WHERE id = ?',
      [fullName, phone, profilePic, id]);
  }
  save();
}

// Soft delete - mark as deleted instead of removing
function deleteMessage(messageId, userId) {
  db.run('UPDATE messages SET deleted = 1, content = \'\', file_url = \'\', file_name = \'\' WHERE id = ? AND sender_id = ?', [messageId, userId]);
  save();
}

function deleteGroupMessage(messageId, userId) {
  db.run('UPDATE group_messages SET deleted = 1, content = \'\', file_url = \'\', file_name = \'\' WHERE id = ? AND sender_id = ?', [messageId, userId]);
  save();
}

// === REACTIONS ===

function addReaction(messageId, messageType, userId, emoji) {
  db.run('INSERT OR IGNORE INTO reactions (message_id, message_type, user_id, emoji) VALUES (?, ?, ?, ?)',
    [messageId, messageType, userId, emoji]);
  save();
}

function removeReaction(messageId, messageType, userId, emoji) {
  db.run('DELETE FROM reactions WHERE message_id = ? AND message_type = ? AND user_id = ? AND emoji = ?',
    [messageId, messageType, userId, emoji]);
  save();
}

function getReactions(messageId, messageType) {
  const stmt = db.prepare(`
    SELECT r.emoji, r.user_id, u.username, u.full_name
    FROM reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.message_id = ? AND r.message_type = ?
  `);
  stmt.bind([messageId, messageType]);
  const reactions = [];
  while (stmt.step()) { reactions.push(stmt.getAsObject()); }
  stmt.free();
  return reactions;
}

function getReactionsForMessages(messageIds, messageType) {
  if (!messageIds.length) return {};
  const placeholders = messageIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT r.message_id, r.emoji, r.user_id, u.full_name
    FROM reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.message_id IN (${placeholders}) AND r.message_type = ?
  `);
  stmt.bind([...messageIds, messageType]);
  const map = {};
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (!map[row.message_id]) map[row.message_id] = [];
    map[row.message_id].push({ emoji: row.emoji, user_id: row.user_id, full_name: row.full_name });
  }
  stmt.free();
  return map;
}

// === GROUPS ===

function createGroup(name, creatorId, memberIds, pic) {
  db.run('INSERT INTO groups_ (name, creator_id, pic) VALUES (?, ?, ?)', [name, creatorId, pic || '']);
  const result = db.exec('SELECT last_insert_rowid() as id');
  const groupId = result[0].values[0][0];
  db.run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, creatorId, 'admin']);
  for (const mid of memberIds) {
    db.run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, Number(mid), 'member']);
  }
  save();
  return { id: groupId, name, pic: pic || '', creator_id: creatorId };
}

function getGroupsForUser(userId) {
  const stmt = db.prepare(`
    SELECT g.id, g.name, g.pic, g.creator_id, g.created_at
    FROM groups_ g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `);
  stmt.bind([userId]);
  const groups = [];
  while (stmt.step()) { groups.push(stmt.getAsObject()); }
  stmt.free();
  return groups;
}

function getGroupMembers(groupId) {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.phone, u.profile_pic, gm.role
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `);
  stmt.bind([groupId]);
  const members = [];
  while (stmt.step()) { members.push(stmt.getAsObject()); }
  stmt.free();
  return members;
}

function isGroupMember(groupId, userId) {
  const stmt = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?');
  stmt.bind([groupId, userId]);
  const isMember = stmt.step();
  stmt.free();
  return isMember;
}

function isGroupAdmin(groupId, userId) {
  const stmt = db.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'admin'");
  stmt.bind([groupId, userId]);
  const isAdmin = stmt.step();
  stmt.free();
  return isAdmin;
}

function setGroupAdmin(groupId, userId) {
  db.run("UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?", [groupId, userId]);
  save();
}

function removeGroupAdmin(groupId, userId) {
  db.run("UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?", [groupId, userId]);
  save();
}

function saveGroupMessage(groupId, senderId, content, type, fileUrl, fileName) {
  db.run('INSERT INTO group_messages (group_id, sender_id, content, type, file_url, file_name) VALUES (?, ?, ?, ?, ?, ?)',
    [groupId, senderId, content || '', type || 'text', fileUrl || '', fileName || '']);
  const result = db.exec('SELECT last_insert_rowid() as id');
  save();
  return { lastInsertRowid: result[0].values[0][0] };
}

function getGroupMessages(groupId) {
  const stmt = db.prepare(`
    SELECT gm.*, u.username as sender_name, u.full_name as sender_full_name, u.profile_pic as sender_pic
    FROM group_messages gm
    JOIN users u ON gm.sender_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.timestamp ASC
  `);
  stmt.bind([groupId]);
  const messages = [];
  while (stmt.step()) { messages.push(stmt.getAsObject()); }
  stmt.free();
  return messages;
}

function addGroupMember(groupId, userId) {
  db.run("INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')", [groupId, userId]);
  save();
}

function removeGroupMember(groupId, userId) {
  db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
  save();
}

// === PUSH SUBSCRIPTIONS ===

function savePushSubscription(userId, subscription) {
  const json = JSON.stringify(subscription);
  db.run('INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, subscription) VALUES (?, ?, ?)',
    [userId, subscription.endpoint, json]);
  save();
}

function getPushSubscriptions(userId) {
  const stmt = db.prepare('SELECT endpoint, subscription FROM push_subscriptions WHERE user_id = ?');
  stmt.bind([userId]);
  const subs = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    try { subs.push(JSON.parse(row.subscription)); } catch {}
  }
  stmt.free();
  return subs;
}

function removePushSubscription(endpoint) {
  db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  save();
}

function getDb() { return db; }

module.exports = {
  initDb, createUser, getUserByUsername, getUserById, getAllUsers,
  saveMessage, getMessages, deleteMessage, deleteGroupMessage,
  updateUserProfile, getUserByPhone,
  addContact, renameContact, getContacts,
  addReaction, removeReaction, getReactions, getReactionsForMessages,
  createGroup, getGroupsForUser, getGroupMembers, isGroupMember,
  isGroupAdmin, setGroupAdmin, removeGroupAdmin,
  saveGroupMessage, getGroupMessages, addGroupMember, removeGroupMember,
  savePushSubscription, getPushSubscriptions, removePushSubscription,
  getDb
};
