/**
 * Acesso tipado ao `chrome.storage.local`. Todas as chaves usadas pela
 * extensão estão aqui, para ficar fácil auditar o que é guardado.
 */
import { normalizeSettings, type Settings } from './settings';
import type { SiteStats, Slice } from './stats';
import { rollover, type TaskList } from './tasks';
import { parseTimerState, type TimerState } from './timer';
import { dayKey } from './dates';

export const KEYS = {
  settings: 'settings',
  timer: 'timer',
  tasks: 'tasks',
  stats: 'siteStats',
  focusLog: 'focusLog',
  slice: 'currentSlice',
} as const;

/** dia -> minutos de foco concluídos */
export type FocusLog = Record<string, number>;

async function get<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await get(KEYS.settings));
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await getSettings()), ...patch });
  await set(KEYS.settings, next);
  return next;
}

export async function getTimer(): Promise<TimerState> {
  return parseTimerState(await get(KEYS.timer));
}

export async function saveTimer(state: TimerState): Promise<void> {
  await set(KEYS.timer, state);
}

export async function getTasks(now = Date.now()): Promise<TaskList> {
  return rollover(await get<TaskList>(KEYS.tasks), dayKey(now));
}

export async function saveTasks(list: TaskList): Promise<void> {
  await set(KEYS.tasks, list);
}

export async function getStats(): Promise<SiteStats> {
  return (await get<SiteStats>(KEYS.stats)) ?? {};
}

export async function saveStats(stats: SiteStats): Promise<void> {
  await set(KEYS.stats, stats);
}

export async function getFocusLog(): Promise<FocusLog> {
  return (await get<FocusLog>(KEYS.focusLog)) ?? {};
}

export async function saveFocusLog(log: FocusLog): Promise<void> {
  await set(KEYS.focusLog, log);
}

/** O trecho aberto fica no storage de sessão: some quando o navegador fecha. */
export async function getSlice(): Promise<Slice | null> {
  const result = await chrome.storage.session.get(KEYS.slice);
  return (result[KEYS.slice] as Slice | undefined) ?? null;
}

export async function saveSlice(slice: Slice | null): Promise<void> {
  if (slice) await chrome.storage.session.set({ [KEYS.slice]: slice });
  else await chrome.storage.session.remove(KEYS.slice);
}

export async function clearStats(): Promise<void> {
  await chrome.storage.local.remove([KEYS.stats, KEYS.focusLog]);
  await chrome.storage.session.remove(KEYS.slice);
}

/** Observa mudanças de uma chave do storage local. */
export function onKeyChange(key: string, callback: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && key in changes) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
