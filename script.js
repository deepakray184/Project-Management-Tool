const statuses = [
  { id: 'todo', label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Completed' },
];

const initialTasks = [
  ['1. SALES & PRE-SALES', 'First Customer Call', 'SOC Presentation of capabilities'],
  ['1. SALES & PRE-SALES', 'Collect Source Details', 'Share sheet to collect source details'],
  ['1. SALES & PRE-SALES', 'Estimate Size & Cost', 'Calculate SOC cost based on EPS/GB'],
  ['1. SALES & PRE-SALES', 'BDM Share Cost', 'Business Development Manager shares proposal'],
  ['1. SALES & PRE-SALES', 'PO Signed', 'Customer signs Purchase Order'],
  ['1. SALES & PRE-SALES', 'Project Start Announced', 'Internal kickoff announcement'],
  ['2. ONBOARDING & ACCESS', 'Share Process Docs', 'Customer process docs for Azure Lighthouse & FreshService'],
  ['2. ONBOARDING & ACCESS', 'Email Elena', 'SOC shares mail for Lighthouse & FreshService setup'],
  ['2. ONBOARDING & ACCESS', 'Customer Accepts Lighthouse', 'Wait for customer approval on Azure'],
  ['2. ONBOARDING & ACCESS', 'XDR Portal Access', 'SOC shares user list for access'],
  ['3. INTEGRATION', 'Content Hub Connectors', 'Install all data connectors'],
  ['3. INTEGRATION', 'Microsoft Products', 'Connect 365, Azure AD, Defender, etc.'],
  ['3. INTEGRATION', 'Collector Configuration', 'Assist in collector setup'],
  ['3. INTEGRATION', 'Server Integration', 'Onboard all Linux and Windows Servers'],
  ['3. INTEGRATION', 'Network Integration', 'Configure Firewalls and Network Devices'],
  ['3. INTEGRATION', 'Other Sources', 'Connect remaining log sources'],
  ['4. CONFIGURATION & USE CASES', 'Enable Use Cases', 'Prefix Customer_SOC(DeviceName)'],
  ['4. CONFIGURATION & USE CASES', 'Custom Use Cases', 'Configure specific customer scenarios'],
  ['4. CONFIGURATION & USE CASES', 'Enable Workbooks', 'Activate standard dashboard workbooks'],
  ['4. CONFIGURATION & USE CASES', 'Custom Workbooks', 'Build custom visualizations'],
  ['5. AUTOMATION & RESPONSE', 'Enable Playbooks', 'Activate standard response playbooks'],
  ['5. AUTOMATION & RESPONSE', 'FreshService Playbooks', 'Ticket creation automation'],
  ['5. AUTOMATION & RESPONSE', 'Email Notifications', 'Configure alert routing'],
  ['5. AUTOMATION & RESPONSE', 'Investigation Automations', 'Auto-enrichment rules'],
  ['6. GO LIVE & SUSTAIN', 'Go Live Mail', 'Send formal project completion mail'],
  ['6. GO LIVE & SUSTAIN', 'Start Monitoring', 'SOC Team begins 24/7 watch'],
  ['6. GO LIVE & SUSTAIN', 'Continuous Fine-tuning', 'Ongoing rule adjustment'],
].map(([phase, title, description], index) => ({
  id: crypto.randomUUID(),
  phase,
  title,
  description,
  status: index % 6 === 0 ? 'inprogress' : index % 9 === 0 ? 'done' : 'todo',
}));

const storageKey = 'soc-kanban-tasks';
const board = document.getElementById('kanbanBoard');
const phaseFilter = document.getElementById('phaseFilter');
const summary = document.getElementById('summaryCards');
const taskTemplate = document.getElementById('taskCardTemplate');
const dialog = document.getElementById('taskDialog');

function loadTasks() {
  const raw = localStorage.getItem(storageKey);
  return raw ? JSON.parse(raw) : initialTasks;
}

function saveTasks(tasks) {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

let tasks = loadTasks();

function getPhases() {
  return [...new Set(tasks.map((task) => task.phase))];
}

function populatePhaseFilter() {
  const selected = phaseFilter.value || 'all';
  phaseFilter.innerHTML = '';
  [['all', 'All Phases'], ...getPhases().map((phase) => [phase, phase])].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    phaseFilter.append(option);
  });
  phaseFilter.value = selected;
}

function getVisibleTasks() {
  return phaseFilter.value === 'all' ? tasks : tasks.filter((task) => task.phase === phaseFilter.value);
}

function renderSummary(visibleTasks) {
  const doneCount = visibleTasks.filter((task) => task.status === 'done').length;
  const progress = visibleTasks.length ? Math.round((doneCount / visibleTasks.length) * 100) : 0;

  const cards = [
    ['Total Tasks', visibleTasks.length],
    ...statuses.map((status) => [status.label, visibleTasks.filter((task) => task.status === status.id).length]),
    ['Progress', `${progress}%`],
  ];

  summary.innerHTML = cards
    .map(
      ([title, value]) =>
        `<article class="summary-card"><h2>${title}</h2><p>${value}</p></article>`,
    )
    .join('');
}

function onDeleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks(tasks);
  renderBoard();
}

function createTaskCard(task) {
  const node = taskTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = task.id;
  node.dataset.status = task.status;
  node.querySelector('h3').textContent = task.title;
  node.querySelector('.phase').textContent = task.phase;
  node.querySelector('.description').textContent = task.description;
  node.querySelector('.delete').addEventListener('click', () => onDeleteTask(task.id));

  node.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/plain', task.id);
  });

  return node;
}

function renderBoard() {
  populatePhaseFilter();
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
    visibleTasks
      .filter((task) => task.status === status.id)
      .forEach((task) => list.append(createTaskCard(task)));

    board.append(column);
  });
}

function attachEventListeners() {
  phaseFilter.addEventListener('change', renderBoard);

  document.getElementById('addTaskBtn').addEventListener('click', () => {
    dialog.showModal();
  });

  document.getElementById('cancelDialog').addEventListener('click', () => dialog.close());

  document.getElementById('taskForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const phase = document.getElementById('phaseInput').value.trim();
    const title = document.getElementById('taskInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();
    const status = document.getElementById('statusInput').value;

    if (!phase || !title || !description) return;

    tasks.unshift({ id: crypto.randomUUID(), phase, title, description, status });
    saveTasks(tasks);
    event.target.reset();
    dialog.close();
    renderBoard();
  });

  document.getElementById('resetBoard').addEventListener('click', () => {
    tasks = [...initialTasks];
    saveTasks(tasks);
    renderBoard();
  });
}

attachEventListeners();
renderBoard();
