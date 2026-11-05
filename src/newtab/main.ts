import { dayKey } from '../lib/dates';
import { $, h, uid } from '../lib/dom';
import { formatDate, formatTime, greeting } from '../lib/greeting';
import { send } from '../lib/messages';
import { quoteOfTheDay, randomQuote } from '../lib/quotes';
import type { Settings } from '../lib/settings';
import { formatDuration, summarize, totalMs } from '../lib/stats';
import {
  getFocusLog,
  getSettings,
  getStats,
  getTasks,
  getTimer,
  KEYS,
  onKeyChange,
  saveTasks,
} from '../lib/storage';
import { addTask, clearDone, removeTask, toggleTask, type TaskList } from '../lib/tasks';
import { formatClock, getProgress, getRemainingMs, type TimerState } from '../lib/timer';

let settings: Settings;
let timer: TimerState = { status: 'idle' };
let tasks: TaskList;

/* ------------------------------ Relógio ----------------------------- */

function renderClock(): void {
  const now = new Date();
  $('#clock').textContent = formatTime(now);
  $('#date').textContent = formatDate(now);
  $('#greeting').textContent = greeting(now, settings?.name);
}

/* ------------------------------- Foco ------------------------------- */

function renderFocus(): void {
  const now = Date.now();
  const card = $('.focus');
  card.dataset.status = timer.status;
  const main = $<HTMLButtonElement>('#focus-main');
  const stop = $<HTMLButtonElement>('#focus-stop');

  if (timer.status === 'idle') {
    $('#focus-time').textContent = formatClock(settings.focusMinutes * 60_000);
    $('#focus-status').textContent = `${settings.blocklist.length} sites serão bloqueados`;
    main.textContent = 'Iniciar foco';
    stop.hidden = true;
  } else {
    $('#focus-time').textContent = formatClock(getRemainingMs(timer, now));
    $('#focus-status').textContent = timer.status === 'running' ? 'Focando — distrações bloqueadas' : 'Pausado';
    main.textContent = timer.status === 'running' ? 'Pausar' : 'Retomar';
    stop.hidden = false;
  }
  $('#focus-progress').style.width = `${getProgress(timer, now) * 100}%`;
}

async function renderSummary(): Promise<void> {
  const today = dayKey();
  const [log, stats] = await Promise.all([getFocusLog(), getStats()]);
  const focused = log[today] ?? 0;
  const parts = [`Foco hoje: ${focused} min`];
  if (settings.trackingEnabled) parts.push(`Navegação hoje: ${formatDuration(totalMs(summarize(stats, [today])))}`);
  $('#focus-summary').textContent = parts.join(' · ');
}

$('#focus-main').addEventListener('click', async () => {
  const res = await send(timer.status === 'idle' ? { type: 'focus:start' } : { type: 'focus:toggle' });
  if (res.ok) {
    timer = res.timer;
    renderFocus();
  }
});

$('#focus-stop').addEventListener('click', async () => {
  const res = await send({ type: 'focus:stop' });
  if (res.ok) {
    timer = res.timer;
    renderFocus();
  }
});

/* ------------------------------ Tarefas ----------------------------- */

function renderTasks(): void {
  const list = $('#task-list');
  list.replaceChildren(
    ...tasks.items.map((task) => {
      const checkbox = h('input', { type: 'checkbox', id: `t-${task.id}` });
      checkbox.checked = task.done;
      checkbox.addEventListener('change', () => update(toggleTask(tasks, task.id)));
      return h(
        'li',
        { class: task.done ? 'task done' : 'task' },
        h('label', { for: `t-${task.id}` }, checkbox, h('span', {}, task.text)),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-icon remove',
            type: 'button',
            title: 'Remover',
            'aria-label': `Remover "${task.text}"`,
            onclick: () => update(removeTask(tasks, task.id)),
          },
          '×',
        ),
      );
    }),
  );
  if (tasks.items.length === 0) {
    list.append(h('li', { class: 'empty' }, 'Nenhuma tarefa ainda. Que tal escolher uma só para hoje?'));
  }
  const done = tasks.items.filter((t) => t.done).length;
  $('#tasks-count').textContent = tasks.items.length ? `${done} de ${tasks.items.length}` : '';
  $('#clear-done').hidden = done === 0;
}

async function update(next: TaskList): Promise<void> {
  tasks = next;
  renderTasks();
  await saveTasks(next);
}

$('#task-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $<HTMLInputElement>('#task-input');
  void update(addTask(tasks, input.value, Date.now(), uid()));
  input.value = '';
});

$('#clear-done').addEventListener('click', () => update(clearDone(tasks)));

/* ------------------------------- Frase ------------------------------ */

function renderQuote(): void {
  $('#quote-box').hidden = !settings.showQuote;
  $('#quote').textContent = quoteOfTheDay(new Date());
}

$('#quote-next').addEventListener('click', () => {
  const el = $('#quote');
  el.textContent = randomQuote(el.textContent ?? '');
});

/* ------------------------------- Início ----------------------------- */

async function init(): Promise<void> {
  [settings, timer, tasks] = await Promise.all([getSettings(), getTimer(), getTasks()]);
  renderClock();
  renderFocus();
  renderTasks();
  renderQuote();
  void renderSummary();
  // Se o dia virou, persiste a lista já "rolada".
  void saveTasks(tasks);

  setInterval(() => {
    renderClock();
    if (timer.status === 'running') renderFocus();
  }, 1000);

  onKeyChange(KEYS.timer, async () => {
    timer = await getTimer();
    renderFocus();
    void renderSummary();
  });
  onKeyChange(KEYS.settings, async () => {
    settings = await getSettings();
    renderClock();
    renderFocus();
    renderQuote();
  });
  onKeyChange(KEYS.tasks, async () => {
    tasks = await getTasks();
    renderTasks();
  });
}

void init();
