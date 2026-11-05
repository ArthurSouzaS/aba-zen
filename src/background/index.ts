/**
 * Service worker do Aba Zen.
 *
 * Responsabilidades:
 * 1. Controlar a sessão de foco (início, pausa, fim) com `chrome.alarms`.
 * 2. Ativar/desativar as regras de bloqueio do `declarativeNetRequest`.
 * 3. Levar abas bloqueadas para a página "Respire".
 * 4. Medir o tempo por site na aba ativa (somente local).
 *
 * Todos os listeners são registrados no topo do módulo, como exige o MV3.
 */
import { findBlockingDomain, planRuleUpdate } from '../lib/blocking';
import { dayKey } from '../lib/dates';
import type { Message, MessageResponse } from '../lib/messages';
import { closeSlice, openSlice, pruneStats } from '../lib/stats';
import {
  getFocusLog,
  getSettings,
  getSlice,
  getStats,
  getTimer,
  KEYS,
  saveFocusLog,
  saveSlice,
  saveStats,
  saveTimer,
} from '../lib/storage';
import {
  formatBadge,
  getRemainingMs,
  isBlockingActive,
  startTimer,
  stopTimer,
  tick,
  toggleTimer,
  type TimerState,
} from '../lib/timer';

const ALARM_FOCUS_END = 'focus-end';
const ALARM_HEARTBEAT = 'heartbeat';
const BLOCKED_PAGE = chrome.runtime.getURL('blocked/index.html');
const GREEN = '#34d399';
const AMBER = '#fbbf24';

/* ------------------------------------------------------------------ */
/* Fila: serializa operações para evitar condições de corrida no storage */
/* ------------------------------------------------------------------ */

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/* ------------------------------ Foco ------------------------------ */

async function applyTimer(state: TimerState): Promise<void> {
  const now = Date.now();
  await saveTimer(state);

  await chrome.alarms.clear(ALARM_FOCUS_END);
  if (state.status === 'running') {
    await chrome.alarms.create(ALARM_FOCUS_END, { when: state.endsAt });
  }

  await syncBlockRules(state, now);
  await updateBadge(state, now);

  if (isBlockingActive(state, now)) await redirectOpenTabs();
}

async function syncBlockRules(state: TimerState, now: number): Promise<void> {
  const { blocklist } = await getSettings();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const { removeRuleIds, addRules } = planRuleUpdate(
    existing.map((r) => r.id),
    blocklist,
    isBlockingActive(state, now),
  );
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: addRules as chrome.declarativeNetRequest.Rule[],
  });
}

async function updateBadge(state: TimerState, now: number): Promise<void> {
  const text = state.status === 'idle' ? '' : formatBadge(getRemainingMs(state, now));
  await chrome.action.setBadgeText({ text: state.status === 'paused' ? '❚❚' : text });
  await chrome.action.setBadgeBackgroundColor({ color: state.status === 'paused' ? AMBER : GREEN });
  await chrome.action.setBadgeTextColor?.({ color: '#0b0d12' });
  await chrome.action.setTitle({
    title:
      state.status === 'running'
        ? 'Aba Zen — foco em andamento'
        : state.status === 'paused'
          ? 'Aba Zen — foco pausado'
          : 'Aba Zen',
  });
}

/** Encerra a sessão se o tempo acabou. Chamado pelo alarme e ao acordar. */
async function checkTimer(): Promise<TimerState> {
  const now = Date.now();
  const current = await getTimer();
  const result = tick(current, now);
  if (result.completed) {
    const log = await getFocusLog();
    const today = dayKey(now);
    await saveFocusLog({ ...log, [today]: (log[today] ?? 0) + result.focusedMinutes });
    await applyTimer(result.state);
    return result.state;
  }
  await updateBadge(current, now);
  return current;
}

async function handleMessage(message: Message): Promise<MessageResponse> {
  const now = Date.now();
  const current = await getTimer();
  let next: TimerState = current;

  switch (message.type) {
    case 'focus:start': {
      const minutes = message.minutes ?? (await getSettings()).focusMinutes;
      next = startTimer(minutes, now);
      break;
    }
    case 'focus:toggle':
      next = current.status === 'idle' ? current : toggleTimer(current, now);
      break;
    case 'focus:stop':
      next = stopTimer();
      break;
  }

  await applyTimer(next);
  return { ok: true, timer: next };
}

/* ---------------------------- Bloqueio ---------------------------- */

function blockedPageUrl(domain: string, original: string): string {
  const params = new URLSearchParams({ site: domain, url: original });
  return `${BLOCKED_PAGE}?${params}`;
}

async function maybeRedirect(tabId: number, url: string | undefined): Promise<void> {
  if (!url || url.startsWith(BLOCKED_PAGE)) return;
  const state = await getTimer();
  if (!isBlockingActive(state, Date.now())) return;
  const { blocklist } = await getSettings();
  const domain = findBlockingDomain(url, blocklist);
  if (domain) {
    await chrome.tabs.update(tabId, { url: blockedPageUrl(domain, url) }).catch(() => undefined);
  }
}

async function redirectOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => (tab.id === undefined ? null : maybeRedirect(tab.id, tab.url))));
}

/* -------------------------- Estatísticas -------------------------- */

/** Fecha o trecho atual e abre um novo para a aba ativa (se houver). */
async function refreshTracking(): Promise<void> {
  const now = Date.now();
  const settings = await getSettings();
  const previous = await getSlice();

  if (previous) {
    const stats = pruneStats(closeSlice(await getStats(), previous, now), now);
    await saveStats(stats);
  }

  if (!settings.trackingEnabled) {
    await saveSlice(null);
    return;
  }

  const idleState = await chrome.idle.queryState(60);
  if (idleState !== 'active') {
    await saveSlice(null);
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const win = tab ? await chrome.windows.get(tab.windowId).catch(() => null) : null;
  const url = tab?.url;
  const counted = win?.focused && url && !url.startsWith(BLOCKED_PAGE);
  await saveSlice(counted ? openSlice(url, now) : null);
}

const track = () => serial(refreshTracking).catch(console.error);

/* ---------------------------- Listeners --------------------------- */

chrome.runtime.onInstalled.addListener(() => {
  void ensureHeartbeat();
  void serial(async () => applyTimer(await getTimer()));
});

chrome.runtime.onStartup.addListener(() => {
  void ensureHeartbeat();
  // Trecho aberto antes de fechar o navegador não deve ser contado.
  void saveSlice(null);
  void serial(checkTimer);
});

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  serial(() => handleMessage(message))
    .then(sendResponse)
    .catch((error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true; // resposta assíncrona
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_FOCUS_END) void serial(checkTimer);
  if (alarm.name === ALARM_HEARTBEAT) {
    void serial(checkTimer);
    track();
  }
});

chrome.tabs.onActivated.addListener(track);
chrome.windows.onFocusChanged.addListener(track);
chrome.idle.onStateChanged.addListener(track);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) void maybeRedirect(tabId, changeInfo.url);
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) track();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(KEYS.settings in changes)) return;
  // Lista de sites ou preferência de rastreamento mudou.
  void serial(async () => {
    const state = await getTimer();
    await syncBlockRules(state, Date.now());
    if (isBlockingActive(state, Date.now())) await redirectOpenTabs();
  });
  track();
});

async function ensureHeartbeat(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_HEARTBEAT);
  if (!existing) await chrome.alarms.create(ALARM_HEARTBEAT, { periodInMinutes: 1 });
}

// Ao acordar por qualquer evento, garante o alarme e o intervalo de inatividade.
chrome.idle.setDetectionInterval(60);
void ensureHeartbeat();
