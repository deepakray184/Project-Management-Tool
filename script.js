const statuses = [
  { id: 'todo', label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'review', label: 'In QA' },
  { id: 'done', label: 'Done' },
];
const priorities = ['highest', 'high', 'medium', 'low'];

const themeKey = 'soc-kanban-theme';
const tokenKey = 'soc-kanban-token';

const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const authForm = document.getElementById('authForm');
const authMessage = document.getElementById('authMessage');
const authSubmit = document.getElementById('authSubmit');
const showLogin = document.getElementById('showLogin');
const showSignup = document.getElementById('showSignup');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const currentUserBadge = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');

const board = document.getElementById('kanbanBoard');
const phaseFilter = document.getElementById('phaseFilter');
const priorityFilter = document.getElementById('priorityFilter');
const searchInput = document.getElementById('searchInput');
const summary = document.getElementById('summaryCards');
const taskTemplate = document.getElementById('taskCardTemplate');
const dialog = document.getElementById('taskDialog');
const taskForm = document.getElementById('taskForm');
const dialogTitle = document.getElementById('dialogTitle');
const editingTaskIdInput = document.getElementById('editingTaskId');
const statusField = document.getElementById('statusField');
const createNote = document.getElementById('createNote');
const statusInput = document.getElementById('statusInput');
const priorityInput = document.getElementById('priorityInput');
const assigneeInput = document.getElementById('assigneeInput');
const commentInput = document.getElementById('commentInput');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const themeToggle = document.getElementById('themeToggle');
const phaseInput = document.getElementById('phaseInput');
const taskInput = document.getElementById('taskInput');
const descriptionInput = document.getElementById('descriptionInput');

let authMode = 'login';
let token = localStorage.getItem(tokenKey) || '';
let currentUser = null;
let users = [];
let tasks = [];

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Request failed');
    return body;
  });
}

function setAuthMode(mode) {
  authMode = mode;
  authSubmit.textContent = mode === 'login' ? 'Login' : 'Create Account';
  nameInput.parentElement.classList.toggle('hidden', mode === 'login');
  showLogin.classList.toggle('secondary', mode !== 'login');
  showSignup.classList.toggle('secondary', mode !== 'signup');
  authMessage.textContent = '';
}

function setAppVisibility(isLoggedIn) {
  authView.classList.toggle('hidden', isLoggedIn);
  appView.classList.toggle('hidden', !isLoggedIn);
}

function getPhases() {
  return [...new Set(tasks.map((task) => task.phase))].sort((a, b) => a.localeCompare(b));
}

function populateSelectOptions() {
  const selectedPhase = phaseFilter.value || 'all';
  const selectedAssignee = assigneeInput.value || (users[0] ? users[0].id : '');

  phaseFilter.innerHTML = '';
  [['all', 'All Phases'], ...getPhases().map((phase) => [phase, phase])].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    phaseFilter.append(option);
  });
  phaseFilter.value = getPhases().includes(selectedPhase) || selectedPhase === 'all' ? selectedPhase : 'all';

  assigneeInput.innerHTML = '';
  users.forEach((person) => {
    const option = document.createElement('option');
    option.value = person.id;
    option.textContent = `${person.name} (${person.email})`;
    assigneeInput.append(option);
  });
  assigneeInput.value = users.some((person) => person.id === selectedAssignee) ? selectedAssignee : users[0]?.id || '';
}

function getVisibleTasks() {
  const phase = phaseFilter.value;
  const priority = priorityFilter.value;
  const searchTerm = searchInput.value.trim().toLowerCase();

  return tasks.filter((task) => {
    const assignee = users.find((user) => user.id === task.assigneeId);
    const matchesPhase = phase === 'all' || task.phase === phase;
    const matchesPriority = priority === 'all' || task.priority === priority;
    const searchable = `${task.phase} ${task.title} ${task.description} ${(assignee && assignee.name) || ''}`.toLowerCase();
    const matchesSearch = !searchTerm || searchable.includes(searchTerm);
    return matchesPhase && matchesPriority && matchesSearch;
  });
}

function renderSummary(visibleTasks) {
  const doneCount = visibleTasks.filter((task) => task.status === 'done').length;
  const progress = visibleTasks.length ? Math.round((doneCount / visibleTasks.length) * 100) : 0;
  const cards = [
    ['Total', visibleTasks.length],
    ...statuses.map((status) => [status.label, visibleTasks.filter((task) => task.status === status.id).length]),
    ['Completion', `${progress}%`],
  ];
  summary.innerHTML = cards
    .map(([title, value]) => `<article class="summary-card"><h2>${title}</h2><p>${value}</p></article>`)
    .join('');
}

function resetDialogToCreateMode() {
  editingTaskIdInput.value = '';
  dialogTitle.textContent = 'Add New Task';
  saveTaskBtn.textContent = 'Save Task';
  statusField.classList.add('hidden');
  createNote.classList.remove('hidden');
  statusInput.value = 'todo';
}

function openCreateDialog() {
  populateSelectOptions();
  taskForm.reset();
  commentInput.value = '';
  assigneeInput.value = users[0]?.id || '';
  resetDialogToCreateMode();
  dialog.showModal();
}

function openEditDialog(task) {
  populateSelectOptions();
  editingTaskIdInput.value = task.id;
  dialogTitle.textContent = 'Edit Task';
  saveTaskBtn.textContent = 'Update Task';
  statusField.classList.remove('hidden');
  createNote.classList.add('hidden');

  phaseInput.value = task.phase;
  taskInput.value = task.title;
  descriptionInput.value = task.description;
  priorityInput.value = task.priority;
  assigneeInput.value = task.assigneeId;
  statusInput.value = task.status;
  commentInput.value = '';

  dialog.showModal();
}

function renderComments(task, commentList) {
  commentList.innerHTML = '';
  const comments = Array.isArray(task.comments) ? task.comments.slice(-3).reverse() : [];
  if (!comments.length) {
    commentList.innerHTML = '<li class="comment-item muted">No comments yet</li>';
    return;
  }
  comments.forEach((comment) => {
    const li = document.createElement('li');
    li.className = 'comment-item';
    li.innerHTML = `<span>${comment.text}</span><small>— ${comment.authorName}</small>`;
    commentList.append(li);
  });
}

function createTaskCard(task) {
  const node = taskTemplate.content.firstElementChild.cloneNode(true);
  const assignee = users.find((user) => user.id === task.assigneeId);

  node.dataset.id = task.id;
  node.dataset.status = task.status;
  node.querySelector('h3').textContent = task.title;
  node.querySelector('.phase').textContent = task.phase;
  node.querySelector('.description').textContent = task.description;
  node.querySelector('.priority-chip').textContent = task.priority;
  node.querySelector('.priority-chip').dataset.priority = task.priority;
  node.querySelector('.assignee-name').textContent = assignee ? assignee.name : 'Unassigned';

  renderComments(task, node.querySelector('.comment-list'));

  node.querySelector('.edit').addEventListener('click', (event) => {
    event.stopPropagation();
    openEditDialog(task);
  });

  node.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', task.id);
  });

  return node;
}

async function updateTask(taskId, patch) {
  const response = await api(`/api/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  const idx = tasks.findIndex((task) => task.id === taskId);
  if (idx >= 0) tasks[idx] = response.task;
}

async function addComment(taskId, text) {
  if (!text.trim()) return;
  const response = await api(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text: text.trim() }),
  });
  const idx = tasks.findIndex((task) => task.id === taskId);
  if (idx >= 0) tasks[idx] = response.task;
}

function renderBoard() {
  populateSelectOptions();
  const visibleTasks = getVisibleTasks();
  renderSummary(visibleTasks);

  board.innerHTML = '';

  statuses.forEach((status) => {
    const column = document.createElement('section');
    column.className = 'column';
    column.dataset.status = status.id;

    const count = visibleTasks.filter((task) => task.status === status.id).length;
    column.innerHTML = `
      <header class="column-header">
        <h2>${status.label}</h2>
        <small>${count} task${count === 1 ? '' : 's'}</small>
      </header>
      <div class="task-list"></div>
    `;

    column.addEventListener('dragover', (event) => {
      event.preventDefault();
      column.classList.add('drop-target');
    });

    column.addEventListener('dragleave', () => column.classList.remove('drop-target'));

    column.addEventListener('drop', async (event) => {
      event.preventDefault();
      column.classList.remove('drop-target');
      const taskId = event.dataTransfer.getData('text/plain');
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      await updateTask(taskId, { status: status.id });
      renderBoard();
    });

    const list = column.querySelector('.task-list');
    const tasksForStatus = visibleTasks.filter((task) => task.status === status.id);
    if (!tasksForStatus.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No tasks in this column';
      list.append(empty);
    } else {
      tasksForStatus.forEach((task) => list.append(createTaskCard(task)));
    }
    board.append(column);
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
  localStorage.setItem(themeKey, theme);
}

function initializeTheme() {
  const saved = localStorage.getItem(themeKey);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

async function bootstrapBoard() {
  const [userResponse, usersResponse, tasksResponse] = await Promise.all([
    api('/api/me'),
    api('/api/users'),
    api('/api/tasks'),
  ]);

  currentUser = userResponse.user;
  users = usersResponse.users;
  tasks = tasksResponse.tasks;

  currentUserBadge.textContent = `Signed in: ${currentUser.name}`;
  setAppVisibility(true);
  renderBoard();
}

function attachEventListeners() {
  showLogin.addEventListener('click', () => setAuthMode('login'));
  showSignup.addEventListener('click', () => setAuthMode('signup'));

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      authMessage.textContent = '';
      const payload = {
        email: emailInput.value.trim(),
        password: passwordInput.value,
      };
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      if (authMode === 'signup') payload.name = nameInput.value.trim();
      const response = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      token = response.token;
      localStorage.setItem(tokenKey, token);
      await bootstrapBoard();
    } catch (error) {
      authMessage.textContent = error.message;
    }
  });

  logoutBtn.addEventListener('click', () => {
    token = '';
    currentUser = null;
    localStorage.removeItem(tokenKey);
    setAppVisibility(false);
  });

  phaseFilter.addEventListener('change', renderBoard);
  priorityFilter.addEventListener('change', renderBoard);
  searchInput.addEventListener('input', renderBoard);
  themeToggle.addEventListener('click', () => applyTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light'));

  document.getElementById('addTaskBtn').addEventListener('click', openCreateDialog);
  document.getElementById('cancelDialog').addEventListener('click', () => dialog.close());

  taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      phase: phaseInput.value.trim(),
      title: taskInput.value.trim(),
      description: descriptionInput.value.trim(),
      status: statusInput.value,
      priority: priorityInput.value,
      assigneeId: assigneeInput.value,
    };

    if (!payload.phase || !payload.title || !payload.description) return;

    const editingTaskId = editingTaskIdInput.value;
    if (editingTaskId) {
      await updateTask(editingTaskId, payload);
      await addComment(editingTaskId, commentInput.value);
    } else {
      const response = await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      tasks.unshift(response.task);
      if (commentInput.value.trim()) {
        await addComment(response.task.id, commentInput.value);
      }
      phaseFilter.value = 'all';
      priorityFilter.value = 'all';
      searchInput.value = '';
    }

    dialog.close();
    taskForm.reset();
    resetDialogToCreateMode();
    renderBoard();
  });

  dialog.addEventListener('close', () => {
    resetDialogToCreateMode();
    taskForm.reset();
  });

  document.getElementById('resetBoard').addEventListener('click', async () => {
    phaseFilter.value = 'all';
    priorityFilter.value = 'all';
    searchInput.value = '';
    const tasksResponse = await api('/api/tasks');
    tasks = tasksResponse.tasks;
    renderBoard();
  });
}

initializeTheme();
setAuthMode('login');
setAppVisibility(false);
resetDialogToCreateMode();
attachEventListeners();

if (token) {
  bootstrapBoard().catch(() => {
    token = '';
    localStorage.removeItem(tokenKey);
    setAppVisibility(false);
  });
}
