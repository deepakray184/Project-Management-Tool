const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const host = '0.0.0.0';
const port = Number(process.env.PORT) || 8000;
const root = __dirname;
const dbPath = path.join(root, 'data.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const statuses = ['todo', 'inprogress', 'review', 'done'];
const priorities = ['highest', 'high', 'medium', 'low'];

const assignees = [
  { id: 'elena', name: 'Elena' },
  { id: 'ravi', name: 'Ravi' },
  { id: 'sara', name: 'Sara' },
  { id: 'david', name: 'David' },
  { id: 'omar', name: 'Omar' },
];

const baseTasks = [
  ['1. SALES & PRE-SALES', 'First Customer Call', 'SOC Presentation of capabilities'],
  ['1. SALES & PRE-SALES', 'Collect Source Details', 'Share sheet to collect source details'],
  ['2. ONBOARDING & ACCESS', 'Share Process Docs', 'Customer process docs for Azure Lighthouse & FreshService'],
  ['3. INTEGRATION', 'Content Hub Connectors', 'Install all data connectors'],
  ['4. CONFIGURATION & USE CASES', 'Enable Use Cases', 'Prefix Customer_SOC(DeviceName)'],
  ['5. AUTOMATION & RESPONSE', 'Enable Playbooks', 'Activate standard response playbooks'],
  ['6. GO LIVE & SUSTAIN', 'Go Live Mail', 'Send formal project completion mail'],
];

const sessions = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function normalizeTask(task, i = 0) {
  return {
    id: task.id || crypto.randomUUID(),
    phase: String(task.phase || 'Uncategorized').trim(),
    title: String(task.title || 'Untitled').trim(),
    description: String(task.description || '').trim(),
    status: statuses.includes(task.status) ? task.status : 'todo',
    priority: priorities.includes(task.priority) ? task.priority : priorities[i % priorities.length],
    assigneeId: assignees.some((a) => a.id === task.assigneeId) ? task.assigneeId : assignees[0].id,
    comments: Array.isArray(task.comments)
      ? task.comments.map((c) => ({
          id: c.id || crypto.randomUUID(),
          text: String(c.text || '').trim(),
          authorId: c.authorId || 'unknown',
          authorName: c.authorName || 'Unknown',
          createdAt: c.createdAt || new Date().toISOString(),
        }))
      : [],
    updatedAt: task.updatedAt || new Date().toISOString(),
  };
}

function defaultDb() {
  const tasks = baseTasks.map(([phase, title, description], i) =>
    normalizeTask({
      phase,
      title,
      description,
      status: i % 5 === 0 ? 'inprogress' : i % 7 === 0 ? 'done' : 'todo',
      priority: priorities[i % priorities.length],
      assigneeId: assignees[i % assignees.length].id,
    }),
  );

  const users = [
    { id: 'u-elena', name: 'Elena', email: 'elena@soc.local', passwordHash: hashPassword('password123') },
    { id: 'u-ravi', name: 'Ravi', email: 'ravi@soc.local', passwordHash: hashPassword('password123') },
  ];

  return { users, tasks };
}

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb(), null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((t, i) => normalizeTask(t, i)) : [],
    };
  } catch {
    const fallback = defaultDb();
    fs.writeFileSync(dbPath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function safeJoin(base, target) {
  const targetPath = path.posix.normalize(target).replace(/^\/+/, '');
  const resolved = path.resolve(base, targetPath);
  return resolved.startsWith(base) ? resolved : null;
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function authUser(req, db) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
}

async function handleApi(req, res, requestPath) {
  const db = readDb();

  if (req.method === 'POST' && requestPath === '/api/auth/signup') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!name || !email || password.length < 6) {
      sendJson(res, 400, { error: 'Name, email and password(6+) are required.' });
      return;
    }
    if (db.users.some((u) => u.email === email)) {
      sendJson(res, 409, { error: 'Email already exists.' });
      return;
    }
    const user = { id: `u-${crypto.randomUUID()}`, name, email, passwordHash: hashPassword(password) };
    db.users.push(user);
    writeDb(db);

    const token = crypto.randomUUID();
    sessions.set(token, user.id);
    sendJson(res, 201, { token, user: { id: user.id, name: user.name, email: user.email } });
    return;
  }

  if (req.method === 'POST' && requestPath === '/api/auth/login') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find((u) => u.email === email && u.passwordHash === hashPassword(password));
    if (!user) {
      sendJson(res, 401, { error: 'Invalid credentials.' });
      return;
    }
    const token = crypto.randomUUID();
    sessions.set(token, user.id);
    sendJson(res, 200, { token, user: { id: user.id, name: user.name, email: user.email } });
    return;
  }

  const user = authUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (req.method === 'GET' && requestPath === '/api/me') {
    sendJson(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
    return;
  }

  if (req.method === 'GET' && requestPath === '/api/users') {
    sendJson(res, 200, { users: db.users.map((u) => ({ id: u.id, name: u.name, email: u.email })) });
    return;
  }

  if (req.method === 'GET' && requestPath === '/api/tasks') {
    sendJson(res, 200, { tasks: db.tasks });
    return;
  }

  if (req.method === 'POST' && requestPath === '/api/tasks') {
    const body = await readBody(req);
    const task = normalizeTask({
      id: crypto.randomUUID(),
      phase: body.phase,
      title: body.title,
      description: body.description,
      status: 'todo',
      priority: body.priority,
      assigneeId: body.assigneeId,
      comments: [],
      updatedAt: new Date().toISOString(),
    });
    db.tasks.unshift(task);
    writeDb(db);
    sendJson(res, 201, { task });
    return;
  }

  const taskMatch = requestPath.match(/^\/api\/tasks\/([^/]+)$/);
  if (req.method === 'PUT' && taskMatch) {
    const taskId = taskMatch[1];
    const idx = db.tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    const body = await readBody(req);
    db.tasks[idx] = normalizeTask({
      ...db.tasks[idx],
      ...body,
      id: taskId,
      updatedAt: new Date().toISOString(),
    });
    writeDb(db);
    sendJson(res, 200, { task: db.tasks[idx] });
    return;
  }

  const commentMatch = requestPath.match(/^\/api\/tasks\/([^/]+)\/comments$/);
  if (req.method === 'POST' && commentMatch) {
    const taskId = commentMatch[1];
    const idx = db.tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    const body = await readBody(req);
    const text = String(body.text || '').trim();
    if (!text) {
      sendJson(res, 400, { error: 'Comment text is required.' });
      return;
    }
    const comment = {
      id: crypto.randomUUID(),
      text,
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };
    db.tasks[idx].comments = db.tasks[idx].comments || [];
    db.tasks[idx].comments.push(comment);
    db.tasks[idx].updatedAt = new Date().toISOString();
    writeDb(db);
    sendJson(res, 201, { task: db.tasks[idx], comment });
    return;
  }

  sendJson(res, 404, { error: 'API route not found.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const requestPath = req.url ? req.url.split('?')[0] : '/';
    if (requestPath.startsWith('/api/')) {
      await handleApi(req, res, requestPath);
      return;
    }

    const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
    const candidatePath = safeJoin(root, normalizedPath);

    if (!candidatePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(candidatePath, (error, stats) => {
      if (!error && stats.isFile()) {
        sendFile(candidatePath, res);
        return;
      }

      const fallbackIndex = path.join(root, 'index.html');
      fs.stat(fallbackIndex, (indexError, indexStats) => {
        if (!indexError && indexStats.isFile()) {
          sendFile(fallbackIndex, res);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      });
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
});

server.listen(port, host, () => {
  console.log(`Kanban dashboard running at http://localhost:${port}`);
});
