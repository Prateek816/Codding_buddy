// app.js – Core logic for the Colorful Modern Todo application
// The script runs in the global scope (deferred via <script defer>)
// No module exports; functions are attached to window.todoApp for testing.

(() => {
  // ------------------------------------------------------------
  // 1. DOM Selectors & Constants
  // ------------------------------------------------------------
  const taskForm = document.getElementById('task-form');
  const newTaskInput = document.getElementById('new-task-input');
  const taskList = document.getElementById('task-list');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const themeSelect = document.getElementById('theme-select');
  const clearCompletedBtn = document.getElementById('clear-completed');

  const FILTER = { ALL: 'all', ACTIVE: 'active', COMPLETED: 'completed' };
  let currentFilter = FILTER.ALL;

  // ------------------------------------------------------------
  // 2. Data Model
  // ------------------------------------------------------------
  class Task {
    constructor(id, text, completed = false, order = Date.now()) {
      this.id = id;
      this.text = text;
      this.completed = completed;
      this.order = order;
    }
  }

  let tasks = [];
  const STORAGE_KEY = 'todo-app-tasks';
  const THEME_KEY = 'todo-app-theme';
  const FILTER_KEY = 'todo-app-filter';

  function loadTasks() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        tasks = parsed.map(t => new Task(t.id, t.text, t.completed, t.order));
      } catch (e) {
        console.error('Failed to parse tasks from storage', e);
        tasks = [];
      }
    } else {
      tasks = [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  // ------------------------------------------------------------
  // 3. Accessibility Helpers
  // ------------------------------------------------------------
  let statusEl = document.getElementById('status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'status';
    statusEl.className = 'sr-only';
    statusEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(statusEl);
  }
  function announce(message) {
    statusEl.textContent = '';
    // Small timeout to ensure screen readers notice change
    setTimeout(() => {
      statusEl.textContent = message;
    }, 100);
  }

  // ------------------------------------------------------------
  // 4. Rendering Logic
  // ------------------------------------------------------------
  function renderTasks() {
    // Sort by order (ascending)
    const sorted = [...tasks].sort((a, b) => a.order - b.order);
    // Apply filter
    const filtered = sorted.filter(task => {
      if (currentFilter === FILTER.ALL) return true;
      if (currentFilter === FILTER.ACTIVE) return !task.completed;
      if (currentFilter === FILTER.COMPLETED) return task.completed;
      return true;
    });

    const html = filtered.map(task => {
      const completedClass = task.completed ? ' completed' : '';
      const escapedText = task.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <li class="task-item" data-id="${task.id}" draggable="true" aria-grabbed="false" role="listitem">
          <svg class="icon drag-handle" aria-hidden="true"><use href="assets/icons.svg#icon-drag"></use></svg>
          <span class="task-text${completedClass}" tabindex="0">${escapedText}</span>
          <div class="task-actions">
            <button class="edit-btn" aria-label="Edit task"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#icon-edit"></use></svg></button>
            <button class="complete-btn" aria-label="Toggle complete"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#icon-complete"></use></svg></button>
            <button class="delete-btn" aria-label="Delete task"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#icon-delete"></use></svg></button>
          </div>
        </li>`;
    }).join('');

    taskList.innerHTML = html;
    attachTaskEventListeners();
  }

  // ------------------------------------------------------------
  // 5. Drag‑and‑Drop Helpers
  // ------------------------------------------------------------
  function attachTaskEventListeners() {
    const items = taskList.querySelectorAll('.task-item');
    items.forEach(item => {
      // Drag events
      item.addEventListener('dragstart', onDragStart);
      item.addEventListener('dragover', onDragOver);
      item.addEventListener('drop', onDrop);
      item.addEventListener('dragend', onDragEnd);
    });
  }

  function onDragStart(e) {
    const li = e.currentTarget;
    const taskId = li.dataset.id;
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    li.classList.add('dragging');
    li.setAttribute('aria-grabbed', 'true');
  }

  function onDragOver(e) {
    e.preventDefault(); // Necessary to allow drop
    e.dataTransfer.dropEffect = 'move';
    const li = e.currentTarget;
    li.classList.add('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    const targetLi = e.currentTarget;
    targetLi.classList.remove('drag-over');
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetId = targetLi.dataset.id;
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = tasks.findIndex(t => t.id === draggedId);
    const targetIndex = tasks.findIndex(t => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedTask] = tasks.splice(draggedIndex, 1);
    // Insert before the target if dragging downwards, otherwise after
    const insertAt = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    tasks.splice(insertAt, 0, draggedTask);

    // Re‑assign order values to maintain stable sorting
    const now = Date.now();
    tasks.forEach((t, i) => (t.order = now + i));
    saveTasks();
    renderTasks();
    announce('Task reordered');
  }

  function onDragEnd(e) {
    const li = e.currentTarget;
    li.classList.remove('dragging');
    li.setAttribute('aria-grabbed', 'false');
    // Clean any stray drag‑over class
    taskList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  // ------------------------------------------------------------
  // 6. Task Manipulation Functions
  // ------------------------------------------------------------
  function addTask(text) {
    if (!text) return;
    const id = crypto.randomUUID();
    const task = new Task(id, text);
    tasks.push(task);
    saveTasks();
    renderTasks();
    announce('Task added');
    // Return focus to input for rapid entry
    newTaskInput.focus();
  }

  function editTask(id, newText) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.text = newText;
    saveTasks();
    renderTasks();
    announce('Task edited');
  }

  function deleteTask(id) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
    announce('Task deleted');
  }

  function toggleComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
    announce(task.completed ? 'Task completed' : 'Task marked as active');
  }

  function clearCompleted() {
    const before = tasks.length;
    tasks = tasks.filter(t => !t.completed);
    if (tasks.length !== before) {
      saveTasks();
      renderTasks();
      announce('Completed tasks cleared');
    }
  }

  // ------------------------------------------------------------
  // 7. Event Handlers
  // ------------------------------------------------------------
  // Form submission – add new task
  taskForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = newTaskInput.value.trim();
    if (text) {
      addTask(text);
      newTaskInput.value = '';
    }
  });

  // Click delegation for task actions
  taskList.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const li = btn.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    if (btn.classList.contains('edit-btn')) {
      const current = li.querySelector('.task-text').textContent;
      const newText = prompt('Edit task', current);
      if (newText !== null) {
        editTask(id, newText.trim());
      }
    } else if (btn.classList.contains('delete-btn')) {
      if (confirm('Delete this task?')) {
        deleteTask(id);
      }
    } else if (btn.classList.contains('complete-btn')) {
      toggleComplete(id);
    }
  });

  // Filter button clicks
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      if (!filter) return;
      currentFilter = filter;
      localStorage.setItem(FILTER_KEY, currentFilter);
      // Update aria-pressed
      filterButtons.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      renderTasks();
    });
  });

  // Theme selector change
  themeSelect.addEventListener('change', () => {
    const value = themeSelect.value;
    if (value === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
    localStorage.setItem(THEME_KEY, value);
    announce(`${value.charAt(0).toUpperCase() + value.slice(1)} theme selected`);
  });

  // Clear completed button
  clearCompletedBtn.addEventListener('click', () => {
    clearCompleted();
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    const activeEl = document.activeElement;
    // Enter on input – add task (handled by form submit, but we also support here)
    if (activeEl === newTaskInput && e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const txt = newTaskInput.value.trim();
      if (txt) {
        addTask(txt);
        newTaskInput.value = '';
      }
      return;
    }

    // Determine if a task element is focused (either the li or its inner span)
    const taskLi = activeEl.closest && activeEl.closest('li.task-item');
    if (taskLi) {
      const taskId = taskLi.dataset.id;
      // Ctrl+Enter – toggle complete
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        toggleComplete(taskId);
        return;
      }
      // Ctrl+E – edit
      if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        const current = taskLi.querySelector('.task-text').textContent;
        const newText = prompt('Edit task', current);
        if (newText !== null) {
          editTask(taskId, newText.trim());
        }
        return;
      }
      // Delete key – delete task
      if (e.key === 'Delete') {
        e.preventDefault();
        if (confirm('Delete this task?')) {
          deleteTask(taskId);
        }
        return;
      }
    }

    // Alt+1/2/3 – switch filter
    if (e.altKey && !e.shiftKey && !e.ctrlKey) {
      if (e.key === '1') {
        e.preventDefault();
        setFilter(FILTER.ALL);
      } else if (e.key === '2') {
        e.preventDefault();
        setFilter(FILTER.ACTIVE);
      } else if (e.key === '3') {
        e.preventDefault();
        setFilter(FILTER.COMPLETED);
      }
    }
  });

  function setFilter(filter) {
    currentFilter = filter;
    localStorage.setItem(FILTER_KEY, currentFilter);
    filterButtons.forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.filter === filter ? 'true' : 'false');
    });
    renderTasks();
    announce(`${filter.charAt(0).toUpperCase() + filter.slice(1)} filter applied`);
  }

  // ------------------------------------------------------------
  // 8. Initialization
  // ------------------------------------------------------------
  function initApp() {
    // Theme
    const savedTheme = localStorage.getItem(THEME_KEY) || 'vibrant';
    themeSelect.value = savedTheme;
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    }

    // Load tasks
    loadTasks();

    // Filter
    const savedFilter = localStorage.getItem(FILTER_KEY) || FILTER.ALL;
    currentFilter = savedFilter;
    filterButtons.forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.filter === currentFilter ? 'true' : 'false');
    });

    // Initial render
    renderTasks();
  }

  // Run the app
  initApp();

  // ------------------------------------------------------------
  // 9. Testing Hook
  // ------------------------------------------------------------
  window.todoApp = { addTask, editTask, deleteTask, toggleComplete, clearCompleted, tasks };
})();
