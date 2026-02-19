const statuses = [
  { id: 'todo', label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'review', label: 'In QA' },
  { id: 'done', label: 'Done' },
];

const priorities = ['highest', 'high', 'medium', 'low'];

const assignees = [
  { id: 'elena', name: 'Elena', initials: 'EL', color: '#0ea5e9' },
  { id: 'ravi', name: 'Ravi', initials: 'RV', color: '#6366f1' },
  { id: 'sara', name: 'Sara', initials: 'SR', color: '#14b8a6' },
  { id: 'david', name: 'David', initials: 'DV', color: '#f59e0b' },
  { id: 'omar', name: 'Omar', initials: 'OM', color: '#ef4444' },
];

const baseTasks = [
  ['1. SALES & PRE-SALES', 'First Customer Call', 'SOC Presentation of capabilities'],
  ['1. SALES & PRE-SALES', 'Collect Source Details', 'Share sheet to collect source details'],
  ['1. SALES & PRE-SALES', 'Estimate Size & Cost', 'Calculate SOC cost based on EPS/GB'],
  ['2. ONBOARDING & ACCESS', 'Share Process Docs', 'Customer process docs for Azure Lighthouse & FreshService'],
  ['2. ONBOARDING & ACCESS', 'Customer Accepts Lighthouse', 'Wait for customer approval on Azure'],
  ['3. INTEGRATION', 'Content Hub Connectors', 'Install all data connectors'],
  ['3. INTEGRATION', 'Server Integration', 'Onboard all Linux and Windows servers'],
  ['4. CONFIGURATION & USE CASES', 'Enable Use Cases', 'Prefix Customer_SOC(DeviceName)'],
  ['4. CONFIGURATION & USE CASES', 'Custom Workbooks', 'Build custom visualizations'],
  ['5. AUTOMATION & RESPONSE', 'Enable Playbooks', 'Activate standard response playbooks'],
  ['5. AUTOMATION & RESPONSE', 'Email Notifications', 'Configure alert routing'],
  ['6. GO LIVE & SUSTAIN', 'Go Live Mail', 'Send formal project completion mail'],
];

const initialTasks = baseTasks.map(([phase, title, description], index) => ({
  id: crypto.randomUUID(),
  phase,
  title,
  description,
  status: index % 6 === 0 ? 'inprogress' : index % 9 === 0 ? 'done' : index % 4 === 0 ? 'review' : 'todo',
  priority: priorities[index % priorities.length],
  assigneeId: assignees[index % assignees.length].id,
}));

const storageKey = 'soc-kanban-tasks-v3';
const themeKey = 'soc-kanban-theme';

const board = document.getElementById('kanbanBoard');
const phaseFilter = document.getElementById('phaseFilter');
const priorityFilter = document.getElementById('priorityFilter');
const searchInput = document.getElementById('searchInput');
const summary = document.getElementById('summaryCards');
const taskTemplate = document.getElementById('taskCardTemplate');
const dialog = document.getElementById('taskDialog');
const assigneeInput = document.getElementById('assigneeInput');
const themeToggle = document.getElementById('themeToggle');

function assigneeById(assigneeId) {
  return assignees.find((member) => member.id === assigneeId) || assignees[0];
}

function normalizeTask(task, index = 0) {
  return {
    id: task.id || crypto.randomUUID(),
    phase: (task.phase || 'Uncategorized').trim(),
    title: (task.title || 'Untitled Task').trim(),
    description: (task.description || '').trim(),
    status: statuses.some((item) => item.id === task.status) ? task.status : 'todo',
    priority: priorities.includes(task.priority) ? task.priority : priorities[index % priorities.length],
    assigneeId: assigneeById(task.assigneeId).id,
  };
}

function loadTasks() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return initialTasks;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return initialTasks;
    return parsed.map((task, index) => normalizeTask(task, index));
  } catch {
    return initialTasks;
  }
}

function saveTasks(tasks) {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

let tasks = loadTasks();

function getPhases() {
  return [...new Set(tasks.map((task) => task.phase))].sort((a, b) => a.localeCompare(b));
}

function populateSelectOptions() {
  const selectedPhase = phaseFilter.value || 'all';
  const selectedAssignee = assigneeInput.value || assignees[0].id;

  phaseFilter.innerHTML = '';
  [['all', 'All Phases'], ...getPhases().map((phase) => [phase, phase])].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    phaseFilter.append(option);
  });
  phaseFilter.value = getPhases().includes(selectedPhase) || selectedPhase === 'all' ? selectedPhase : 'all';

  assigneeInput.innerHTML = '';
  assignees.forEach((person) => {
    const option = document.createElement('option');
    option.value = person.id;
    option.textContent = `${person.name} (${person.initials})`;
    assigneeInput.append(option);
  });
  assigneeInput.value = assignees.some((person) => person.id === selectedAssignee) ? selectedAssignee : assignees[0].id;
}

function getVisibleTasks() {
  const phase = phaseFilter.value;
  const priority = priorityFilter.value;
  const searchTerm = searchInput.value.trim().toLowerCase();

  return tasks.filter((task) => {
    const assignee = assigneeById(task.assigneeId);
    const matchesPhase = phase === 'all' || task.phase === phase;
    const matchesPriority = priority === 'all' || task.priority === priority;
    const searchable = `${task.phase} ${task.title} ${task.description} ${assignee.name}`.toLowerCase();
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

function onDeleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks(tasks);
  renderBoard();
}

function createTaskCard(task) {
  const node = taskTemplate.content.firstElementChild.cloneNode(true);
  const assignee = assigneeById(task.assigneeId);

  node.dataset.id = task.id;
  node.dataset.status = task.status;
  node.querySelector('h3').textContent = task.title;
  node.querySelector('.phase').textContent = task.phase;
  node.querySelector('.description').textContent = task.description;

  const chip = node.querySelector('.priority-chip');
  chip.dataset.priority = task.priority;
  chip.textContent = task.priority;

  const avatar = node.querySelector('.avatar');
  avatar.textContent = assignee.initials;
  avatar.style.background = assignee.color;
  node.querySelector('.assignee-name').textContent = assignee.name;

  node.querySelector('.delete').addEventListener('click', () => onDeleteTask(task.id));

  node.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', task.id);
  });

  return node;
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

    column.addEventListener('dragleave', () => {
      column.classList.remove('drop-target');
    });

    column.addEventListener('drop', (event) => {
      event.preventDefault();
      column.classList.remove('drop-target');
      const taskId = event.dataTransfer.getData('text/plain');
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      task.status = status.id;
      saveTasks(tasks);
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

function attachEventListeners() {
  phaseFilter.addEventListener('change', renderBoard);
  priorityFilter.addEventListener('change', renderBoard);
  searchInput.addEventListener('input', renderBoard);

  themeToggle.addEventListener('click', () => {
    const current = document.body.dataset.theme === 'light' ? 'light' : 'dark';
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  document.getElementById('addTaskBtn').addEventListener('click', () => {
    populateSelectOptions();
    dialog.showModal();
  });

  document.getElementById('cancelDialog').addEventListener('click', () => dialog.close());

  document.getElementById('taskForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const phase = document.getElementById('phaseInput').value.trim();
    const title = document.getElementById('taskInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();
    const priority = document.getElementById('priorityInput').value;
    const assigneeId = assigneeInput.value;

    if (!phase || !title || !description) return;

    tasks.unshift(
      normalizeTask({ id: crypto.randomUUID(), phase, title, description, status: 'todo', priority, assigneeId }),
    );

    saveTasks(tasks);
    event.target.reset();
    assigneeInput.value = assignees[0].id;
    phaseFilter.value = 'all';
    priorityFilter.value = 'all';
    searchInput.value = '';
    dialog.close();
    renderBoard();
  });

  document.getElementById('resetBoard').addEventListener('click', () => {
    tasks = [...initialTasks];
    phaseFilter.value = 'all';
    priorityFilter.value = 'all';
    searchInput.value = '';
    saveTasks(tasks);
    renderBoard();
  });
}

initializeTheme();
attachEventListeners();
renderBoard();
