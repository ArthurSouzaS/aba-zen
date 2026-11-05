import { dayKey } from '../lib/dates';
import { $ } from '../lib/dom';
import { send } from '../lib/messages';
import { summarize } from '../lib/stats';
import { getSettings, getStats, getTimer, KEYS, onKeyChange, saveSettings } from '../lib/storage';
import { clampMinutes, formatClock, getProgress, getRemainingMs, type TimerState } from '../lib/timer';
import { renderSiteList } from '../lib/ui';

const RING_LENGTH = 2 * Math.PI * 52;

let timer: TimerState = { status: 'idle' };
let minutes = 25;

const root = $('#popup');
const customInput = $<HTMLInputElement>('#custom-min');

function render(): void {
  const now = Date.now();
  root.dataset.status = timer.status;
  const remaining = timer.status === 'idle' ? minutes * 60_000 : getRemainingMs(timer, now);
  $('#time').textContent = formatClock(remaining);
  $('#status').textContent =
    timer.status === 'running' ? 'Focando' : timer.status === 'paused' ? 'Pausado' : 'Pronto';
  $('#ring').style.strokeDashoffset = String(RING_LENGTH * (1 - getProgress(timer, now)));
  $('#main').textContent =
    timer.status === 'running' ? 'Pausar' : timer.status === 'paused' ? 'Retomar' : 'Iniciar foco';
  $('#stop').hidden = timer.status === 'idle';

  for (const chip of document.querySelectorAll<HTMLButtonElement>('.chip[data-min]')) {
    chip.setAttribute('aria-pressed', String(Number(chip.dataset.min) === minutes));
  }
}

function selectMinutes(value: number): void {
  minutes = clampMinutes(value);
  void saveSettings({ focusMinutes: minutes });
  render();
}

for (const chip of document.querySelectorAll<HTMLButtonElement>('.chip[data-min]')) {
  chip.addEventListener('click', () => {
    customInput.value = '';
    selectMinutes(Number(chip.dataset.min));
  });
}

customInput.addEventListener('change', () => {
  if (customInput.value) selectMinutes(Number(customInput.value));
});

$('#main').addEventListener('click', async () => {
  const res = await send(timer.status === 'idle' ? { type: 'focus:start', minutes } : { type: 'focus:toggle' });
  if (res.ok) timer = res.timer;
  render();
});

$('#stop').addEventListener('click', async () => {
  const res = await send({ type: 'focus:stop' });
  if (res.ok) timer = res.timer;
  render();
});

$('#open-options').addEventListener('click', (event) => {
  event.preventDefault();
  void chrome.runtime.openOptionsPage();
});

async function renderStats(): Promise<void> {
  const settings = await getSettings();
  const n = settings.blocklist.length;
  $('#blocked-info').textContent =
    n === 0 ? 'Nenhum site na lista de bloqueio.' : `${n} ${n === 1 ? 'site bloqueado' : 'sites bloqueados'} durante o foco.`;
  if (!settings.trackingEnabled) {
    renderSiteList($('#sites'), [], 'Estatísticas desativadas nas opções.');
    return;
  }
  renderSiteList($('#sites'), summarize(await getStats(), [dayKey()], 3), 'Nada registrado hoje ainda.');
}

async function init(): Promise<void> {
  const [settings, state] = await Promise.all([getSettings(), getTimer()]);
  minutes = settings.focusMinutes;
  timer = state;
  if (![15, 25, 50].includes(minutes)) customInput.value = String(minutes);
  render();
  void renderStats();
  setInterval(render, 500);
  onKeyChange(KEYS.timer, async () => {
    timer = await getTimer();
    render();
  });
}

void init();
