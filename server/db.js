const path = require('path');
const fs = require('fs');

// Use PostgreSQL if DATABASE_URL is set (Render), otherwise use SQLite (local dev)
const usePostgres = !!process.env.DATABASE_URL;

let pool; // pg pool
let sqliteDb; // sql.js db

const DB_PATH = path.join(__dirname, 'chat.db');

async function initDb() {
  if (usePostgres) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        profile_pic TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'text',
        file_url TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL DEFAULT '',
        deleted INTEGER NOT NULL DEFAULT 0,
        reply_to INTEGER DEFAULT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        contact_id INTEGER NOT NULL REFERENCES users(id),
        nickname TEXT NOT NULL DEFAULT '',
        UNIQUE(user_id, contact_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups_ (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        pic TEXT NOT NULL DEFAULT '',
        creator_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups_(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, user_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups_(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'text',
        file_url TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL DEFAULT '',
        deleted INTEGER NOT NULL DEFAULT 0,
        reply_to INTEGER DEFAULT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_group_messages ON group_messages(group_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_group_members ON group_members(group_id, user_id)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'dm',
        user_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, message_type, user_id, emoji)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reactions ON reactions(message_id, message_type)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        endpoint TEXT NOT NULL UNIQUE,
        subscription TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL,
        blocked_id INTEGER NOT NULL,
        UNIQUE(blocker_id, blocked_id)
      )
    `);
    console.log('PostgreSQL connected');
    return pool;
  } else {
    // SQLite for local dev
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      sqliteDb = new SQL.Database(buffer);
    } else {
      sqliteDb = new SQL.Database();
    }
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', profile_pic TEXT NOT NULL DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL, content TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (sender_id) REFERENCES users(id), FOREIGN KEY (receiver_id) REFERENCES users(id))`);
    sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id)`);
    try { sqliteDb.run(`ALTER TABLE messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text'`); } catch(e) {}
    try { sqliteDb.run(`ALTER TABLE messages ADD COLUMN file_url TEXT NOT NULL DEFAULT ''`); } catch(e) {}
    try { sqliteDb.run(`ALTER TABLE messages ADD COLUMN file_name TEXT NOT NULL DEFAULT ''`); } catch(e) {}
    try { sqliteDb.run(`ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`); } catch(e) {}
    try { sqliteDb.run(`ALTER TABLE messages ADD COLUMN reply_to INTEGER DEFAULT NULL`); } catch(e) {}
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, contact_id INTEGER NOT NULL, nickname TEXT NOT NULL DEFAULT '', FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (contact_id) REFERENCES users(id), UNIQUE(user_id, contact_id))`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS groups_ (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pic TEXT NOT NULL DEFAULT '', creator_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (creator_id) REFERENCES users(id))`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS group_members (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'member', joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_id) REFERENCES groups_(id), FOREIGN KEY (user_id) REFERENCES users(id), UNIQUE(group_id, user_id))`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS group_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, content TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'text', file_url TEXT NOT NULL DEFAULT '', file_name TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0, reply_to INTEGER DEFAULT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_id) REFERENCES groups_(id), FOREIGN KEY (sender_id) REFERENCES users(id))`);
    sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_group_messages ON group_messages(group_id)`);
    sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_group_members ON group_members(group_id, user_id)`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL, message_type TEXT NOT NULL DEFAULT 'dm', user_id INTEGER NOT NULL, emoji TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(message_id, message_type, user_id, emoji))`);
    sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_reactions ON reactions(message_id, message_type)`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, subscription TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))`);
    sqliteDb.run(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`);
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS blocked (id INTEGER PRIMARY KEY AUTOINCREMENT, blocker_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, UNIQUE(blocker_id, blocked_id))`);
    saveSqlite();
    console.log('SQLite loaded');
    return sqliteDb;
  }
}

function saveSqlite() {
  if (!sqliteDb) return;
  const data = sqliteDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Convert $1, $2... to ? for SQLite
function toSqlite(sql) {
  return sql.replace(/\$\d+/g, '?');
}

// === Helper: run query and return rows ===
async function query(sql, params = []) {
  if (usePostgres) {
    const res = await pool.query(sql, params);
    return res.rows;
  } else {
    const stmt = sqliteDb.prepare(toSqlite(sql));
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) { rows.push(stmt.getAsObject()); }
    stmt.free();
    return rows;
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  if (usePostgres) {
    await pool.query(sql, params);
  } else {
    sqliteDb.run(toSqlite(sql), params);
    saveSqlite();
  }
}

async function runReturningId(sql, params = []) {
  if (usePostgres) {
    const res = await pool.query(sql + ' RETURNING id', params);
    return { lastInsertRowid: res.rows[0].id };
  } else {
    sqliteDb.run(toSqlite(sql), params);
    const result = sqliteDb.exec('SELECT last_insert_rowid() as id');
    saveSqlite();
    return { lastInsertRowid: result[0].values[0][0] };
  }
}

// === USERS ===

async function createUser(username, passwordHash, fullName, phone, profilePic) {
  return runReturningId(
    'INSERT INTO users (username, password_hash, full_name, phone, profile_pic) VALUES ($1, $2, $3, $4, $5)',
    [username, passwordHash, fullName, phone, profilePic]
  );
}

async function getUserByUsername(username) {
  return queryOne('SELECT * FROM users WHERE username = $1', [username]);
}

async function getUserById(id) {
  return queryOne('SELECT id, username, full_name, phone, profile_pic, created_at FROM users WHERE id = $1', [id]);
}

async function getAllUsers(excludeId) {
  return query('SELECT id, username, full_name, phone, profile_pic FROM users WHERE id != $1', [excludeId]);
}

async function getUserByPhone(phone) {
  return queryOne('SELECT id, username, full_name, phone, profile_pic FROM users WHERE phone = $1', [phone]);
}

// === MESSAGES ===

async function saveMessage(senderId, receiverId, content, type, fileUrl, fileName, replyTo) {
  return runReturningId(
    'INSERT INTO messages (sender_id, receiver_id, content, type, file_url, file_name, reply_to) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [senderId, receiverId, content || '', type || 'text', fileUrl || '', fileName || '', replyTo || null]
  );
}

async function getMessages(userId1, userId2) {
  return query(
    `SELECT m.*, u.username as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1) ORDER BY m.timestamp ASC`,
    [userId1, userId2]
  );
}

async function deleteMessage(messageId, userId) {
  await run("UPDATE messages SET deleted = 1, content = '', file_url = '', file_name = '' WHERE id = $1 AND sender_id = $2", [messageId, userId]);
}

async function deleteGroupMessage(messageId, userId) {
  await run("UPDATE group_messages SET deleted = 1, content = '', file_url = '', file_name = '' WHERE id = $1 AND sender_id = $2", [messageId, userId]);
}

// === CONTACTS ===

async function addContact(userId, contactId, nickname) {
  if (usePostgres) {
    await pool.query('INSERT INTO contacts (user_id, contact_id, nickname) VALUES ($1, $2, $3) ON CONFLICT (user_id, contact_id) DO NOTHING', [userId, contactId, nickname || '']);
  } else {
    sqliteDb.run('INSERT OR IGNORE INTO contacts (user_id, contact_id, nickname) VALUES (?, ?, ?)', [userId, contactId, nickname || '']);
    saveSqlite();
  }
}

async function renameContact(userId, contactId, nickname) {
  await run('UPDATE contacts SET nickname = $1 WHERE user_id = $2 AND contact_id = $3', [nickname, userId, contactId]);
}

async function getContacts(userId) {
  return query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.profile_pic, c.nickname FROM contacts c JOIN users u ON c.contact_id = u.id WHERE c.user_id = $1`,
    [userId]
  );
}

// === PROFILE ===

async function updateUserProfile(id, fullName, phone, profilePic) {
  if (profilePic && !fullName && !phone) {
    await run('UPDATE users SET profile_pic = $1 WHERE id = $2', [profilePic, id]);
  } else {
    await run('UPDATE users SET full_name = $1, phone = $2, profile_pic = $3 WHERE id = $4', [fullName, phone, profilePic, id]);
  }
}

// === REACTIONS ===

async function addReaction(messageId, messageType, userId, emoji) {
  if (usePostgres) {
    await pool.query('INSERT INTO reactions (message_id, message_type, user_id, emoji) VALUES ($1, $2, $3, $4) ON CONFLICT (message_id, message_type, user_id, emoji) DO NOTHING', [messageId, messageType, userId, emoji]);
  } else {
    sqliteDb.run('INSERT OR IGNORE INTO reactions (message_id, message_type, user_id, emoji) VALUES (?, ?, ?, ?)', [messageId, messageType, userId, emoji]);
    saveSqlite();
  }
}

async function removeReaction(messageId, messageType, userId, emoji) {
  await run('DELETE FROM reactions WHERE message_id = $1 AND message_type = $2 AND user_id = $3 AND emoji = $4', [messageId, messageType, userId, emoji]);
}

async function getReactions(messageId, messageType) {
  return query(
    `SELECT r.emoji, r.user_id, u.username, u.full_name FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.message_id = $1 AND r.message_type = $2`,
    [messageId, messageType]
  );
}

async function getReactionsForMessages(messageIds, messageType) {
  if (!messageIds.length) return {};
  if (usePostgres) {
    const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
    const res = await pool.query(
      `SELECT r.message_id, r.emoji, r.user_id, u.full_name FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.message_id IN (${placeholders}) AND r.message_type = $${messageIds.length + 1}`,
      [...messageIds, messageType]
    );
    const map = {};
    for (const row of res.rows) {
      if (!map[row.message_id]) map[row.message_id] = [];
      map[row.message_id].push({ emoji: row.emoji, user_id: row.user_id, full_name: row.full_name });
    }
    return map;
  } else {
    const placeholders = messageIds.map(() => '?').join(',');
    const stmt = sqliteDb.prepare(`SELECT r.message_id, r.emoji, r.user_id, u.full_name FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.message_id IN (${placeholders}) AND r.message_type = ?`);
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
}

// === GROUPS ===

async function createGroup(name, creatorId, memberIds, pic) {
  const result = await runReturningId('INSERT INTO groups_ (name, creator_id, pic) VALUES ($1, $2, $3)', [name, creatorId, pic || '']);
  const groupId = result.lastInsertRowid;
  if (usePostgres) {
    await pool.query('INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (group_id, user_id) DO NOTHING', [groupId, creatorId, 'admin']);
    for (const mid of memberIds) {
      await pool.query('INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (group_id, user_id) DO NOTHING', [groupId, Number(mid), 'member']);
    }
  } else {
    sqliteDb.run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, creatorId, 'admin']);
    for (const mid of memberIds) {
      sqliteDb.run('INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, Number(mid), 'member']);
    }
    saveSqlite();
  }
  return { id: groupId, name, pic: pic || '', creator_id: creatorId };
}

async function getGroupsForUser(userId) {
  return query(
    `SELECT g.id, g.name, g.pic, g.creator_id, g.created_at FROM groups_ g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = $1 ORDER BY g.created_at DESC`,
    [userId]
  );
}

async function getGroupMembers(groupId) {
  return query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.profile_pic, gm.role FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = $1`,
    [groupId]
  );
}

async function isGroupMember(groupId, userId) {
  const row = await queryOne('SELECT 1 as ok FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  return !!row;
}

async function isGroupAdmin(groupId, userId) {
  const row = await queryOne("SELECT 1 as ok FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'", [groupId, userId]);
  return !!row;
}

async function setGroupAdmin(groupId, userId) {
  await run("UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2", [groupId, userId]);
}

async function removeGroupAdmin(groupId, userId) {
  await run("UPDATE group_members SET role = 'member' WHERE group_id = $1 AND user_id = $2", [groupId, userId]);
}

async function saveGroupMessage(groupId, senderId, content, type, fileUrl, fileName, replyTo) {
  return runReturningId(
    'INSERT INTO group_messages (group_id, sender_id, content, type, file_url, file_name, reply_to) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [groupId, senderId, content || '', type || 'text', fileUrl || '', fileName || '', replyTo || null]
  );
}

async function getGroupMessages(groupId) {
  return query(
    `SELECT gm.*, u.username as sender_name, u.full_name as sender_full_name, u.profile_pic as sender_pic FROM group_messages gm JOIN users u ON gm.sender_id = u.id WHERE gm.group_id = $1 ORDER BY gm.timestamp ASC`,
    [groupId]
  );
}

async function addGroupMember(groupId, userId) {
  if (usePostgres) {
    await pool.query("INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (group_id, user_id) DO NOTHING", [groupId, userId]);
  } else {
    sqliteDb.run("INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')", [groupId, userId]);
    saveSqlite();
  }
}

async function removeGroupMember(groupId, userId) {
  await run('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
}

// === PUSH SUBSCRIPTIONS ===

async function savePushSubscription(userId, subscription) {
  const json = JSON.stringify(subscription);
  if (usePostgres) {
    await pool.query('INSERT INTO push_subscriptions (user_id, endpoint, subscription) VALUES ($1, $2, $3) ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, subscription = $3', [userId, subscription.endpoint, json]);
  } else {
    sqliteDb.run('INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, subscription) VALUES (?, ?, ?)', [userId, subscription.endpoint, json]);
    saveSqlite();
  }
}

async function getPushSubscriptions(userId) {
  const rows = await query('SELECT endpoint, subscription FROM push_subscriptions WHERE user_id = $1', [userId]);
  return rows.map(r => { try { return JSON.parse(r.subscription); } catch { return null; } }).filter(Boolean);
}

async function removePushSubscription(endpoint) {
  await run('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

// === BLOCKED USERS ===

async function blockUser(blockerId, blockedId) {
  if (usePostgres) {
    await pool.query('INSERT INTO blocked (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING', [blockerId, blockedId]);
  } else {
    sqliteDb.run('INSERT OR IGNORE INTO blocked (blocker_id, blocked_id) VALUES (?, ?)', [blockerId, blockedId]);
    saveSqlite();
  }
}

async function unblockUser(blockerId, blockedId) {
  await run('DELETE FROM blocked WHERE blocker_id = $1 AND blocked_id = $2', [blockerId, blockedId]);
}

async function getBlockedUsers(blockerId) {
  return query('SELECT b.blocked_id, u.username, u.full_name FROM blocked b JOIN users u ON b.blocked_id = u.id WHERE b.blocker_id = $1', [blockerId]);
}

async function updateGroupPic(groupId, picPath) {
  await run('UPDATE groups_ SET pic = $1 WHERE id = $2', [picPath, groupId]);
}

async function deleteGroup(groupId) {
  await run('DELETE FROM reactions WHERE message_type = $1 AND message_id IN (SELECT id FROM group_messages WHERE group_id = $2)', ['group', groupId]);
  await run('DELETE FROM group_members WHERE group_id = $1', [groupId]);
  await run('DELETE FROM group_messages WHERE group_id = $1', [groupId]);
  await run('DELETE FROM groups_ WHERE id = $1', [groupId]);
}

function getDb() {
  if (usePostgres) return pool;
  return sqliteDb;
}

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
  blockUser, unblockUser, getBlockedUsers,
  updateGroupPic, deleteGroup,
  getDb, run, query
};
