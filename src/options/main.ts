import { DEFAULT_BLOCKLIST, parseBlocklist } from '../lib/blocking';
import { lastDays } from '../lib/dates';
import { $ } from '../lib/dom';
import { formatDuration, summarize, totalMs } from '../lib/stats';
import { clearStats, getFocusLog, getSettings, getStats, KEYS, onKeyChange, saveSettings } from '../lib/storage';
import { clampMinutes } from '../lib/timer';
import { renderSiteList } from '../lib/ui';

const nameInput = $<HTMLInputElement>('#name');
const minutesInput = $<HTMLInputElement>('#focus-minutes');
const quoteInput = $<HTMLInputElement>('#show-quote');
const blocklistInput = $<HTMLTextAreaElement>('#blocklist');
const blocklistMsg = $('#blocklist-msg');
const trackingInput = $<HTMLInputElement>('#tracking');

let period = 1;
let toastTimer: number | undefined;

function toast(message: string): void {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1800);
}

async function load(): Promise<void> {
  const s = await getSettings();
  nameInput.value = s.name;
  minutesInput.value = String(s.focusMinutes);
  quoteInput.checked = s.showQuote;
  trackingInput.checked = s.trackingEnabled;
  blocklistInput.value = s.blocklist.join('\n');
  $('#version').textContent = `v${chrome.runtime.getManifest().version}`;
}

/* ------------------------------- Geral ------------------------------ */

nameInput.addEventListener('change', async () => {
  await saveSettings({ name: nameInput.value });
  toast('Nome salvo');
});

minutesInput.addEventListener('change', async () => {
  const minutes = clampMinutes(Number(minutesInput.value));
  minutesInput.value = String(minutes);
  await saveSettings({ focusMinutes: minutes });
  toast(`Foco padrão: ${minutes} min`);
});

quoteInput.addEventListener('change', async () => {
  await saveSettings({ showQuote: quoteInput.checked });
  toast(quoteInput.checked ? 'Frase ativada' : 'Frase desativada');
});

/* ----------------------------- Bloqueio ----------------------------- */

function previewBlocklist(): void {
  const { domains, invalid } = parseBlocklist(blocklistInput.value);
  blocklistMsg.classList.toggle('error', invalid.length > 0);
  blocklistMsg.textContent =
    invalid.length > 0
      ? `Não reconhecido como site: ${invalid.join(', ')}`
      : `${domains.length} ${domains.length === 1 ? 'site' : 'sites'} na lista.`;
}

blocklistInput.addEventListener('input', previewBlocklist);

$('#save-blocklist').addEventListener('click', async () => {
  const { domains, invalid } = parseBlocklist(blocklistInput.value);
  const saved = await saveSettings({ blocklist: domains });
  blocklistInput.value = saved.blocklist.join('\n');
  previewBlocklist();
  toast(invalid.length ? 'Lista salva (entradas inválidas ignoradas)' : 'Lista salva');
});

$('#restore-blocklist').addEventListener('click', () => {
  blocklistInput.value = DEFAULT_BLOCKLIST.join('\n');
  previewBlocklist();
});

/* --------------------------- Estatísticas --------------------------- */

async function renderStats(): Promise<void> {
  const days = lastDays(period);
  const [stats, log, settings] = await Promise.all([getStats(), getFocusLog(), getSettings()]);
  const totals = summarize(stats, days);
  const focus = days.reduce((sum, d) => sum + (log[d] ?? 0), 0);
  $('#total-time').textContent = formatDuration(totalMs(totals));
  $('#total-focus').textContent = formatDuration(focus * 60_000);
  renderSiteList(
    $('#stats-list'),
    totals.slice(0, 15),
    settings.trackingEnabled ? 'Nenhum tempo registrado neste período.' : 'O registro está desativado.',
  );
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-days]')) {
  button.addEventListener('click', () => {
    period = Number(button.dataset.days);
    for (const b of document.querySelectorAll('[data-days]')) {
      b.setAttribute('aria-pressed', String(b === button));
    }
    void renderStats();
  });
}

trackingInput.addEventListener('change', async () => {
  await saveSettings({ trackingEnabled: trackingInput.checked });
  toast(trackingInput.checked ? 'Registro ativado' : 'Registro desativado');
  void renderStats();
});

$('#clear-stats').addEventListener('click', async () => {
  if (!confirm('Apagar todas as estatísticas de tempo e de foco? Isso não pode ser desfeito.')) return;
  await clearStats();
  toast('Estatísticas apagadas');
  void renderStats();
});

/* ------------------------------- Início ----------------------------- */

void load().then(() => {
  previewBlocklist();
  void renderStats();
});
onKeyChange(KEYS.stats, () => void renderStats());
