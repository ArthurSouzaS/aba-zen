/**
 * Lógica pura do timer de foco. Não depende das APIs do Chrome, então pode
 * ser testada isoladamente e usada tanto pelo service worker quanto pelas
 * páginas (popup e nova aba) para calcular o tempo restante.
 *
 * O estado guarda instantes absolutos (`endsAt`) em vez de "segundos
 * restantes", porque o service worker do MV3 pode ser suspenso a qualquer
 * momento: ao acordar, basta comparar `endsAt` com o relógio.
 */

export const MIN_FOCUS_MINUTES = 1;
export const MAX_FOCUS_MINUTES = 180;
export const DEFAULT_FOCUS_MINUTES = 25;

const MINUTE = 60_000;

export type TimerState =
  | { status: 'idle' }
  | {
      status: 'running';
      /** Duração total planejada da sessão, em ms. */
      durationMs: number;
      /** Instante (epoch ms) em que a sessão termina. */
      endsAt: number;
      /** Instante em que a sessão começou (para estatísticas). */
      startedAt: number;
    }
  | {
      status: 'paused';
      durationMs: number;
      /** Tempo que faltava quando a sessão foi pausada. */
      remainingMs: number;
      startedAt: number;
    };

export const IDLE: TimerState = Object.freeze({ status: 'idle' }) as TimerState;

export class TimerError extends Error {}

/** Garante uma duração inteira dentro dos limites permitidos. */
export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_FOCUS_MINUTES;
  return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.round(minutes)));
}

export function startTimer(minutes: number, now: number): TimerState {
  const durationMs = clampMinutes(minutes) * MINUTE;
  return { status: 'running', durationMs, endsAt: now + durationMs, startedAt: now };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') {
    throw new TimerError('Só é possível pausar uma sessão em andamento.');
  }
  return {
    status: 'paused',
    durationMs: state.durationMs,
    remainingMs: Math.max(0, state.endsAt - now),
    startedAt: state.startedAt,
  };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') {
    throw new TimerError('Só é possível retomar uma sessão pausada.');
  }
  return {
    status: 'running',
    durationMs: state.durationMs,
    endsAt: now + state.remainingMs,
    startedAt: state.startedAt,
  };
}

/** Alterna entre pausado e rodando (botão único do popup). */
export function toggleTimer(state: TimerState, now: number): TimerState {
  if (state.status === 'running') return pauseTimer(state, now);
  if (state.status === 'paused') return resumeTimer(state, now);
  throw new TimerError('Nenhuma sessão para pausar ou retomar.');
}

export function stopTimer(): TimerState {
  return IDLE;
}

/** Tempo restante em ms (0 quando ocioso ou já encerrado). */
export function getRemainingMs(state: TimerState, now: number): number {
  switch (state.status) {
    case 'idle':
      return 0;
    case 'paused':
      return state.remainingMs;
    case 'running':
      return Math.max(0, state.endsAt - now);
  }
}

/** Fração concluída, entre 0 e 1 — usada na barra/anel de progresso. */
export function getProgress(state: TimerState, now: number): number {
  if (state.status === 'idle' || state.durationMs <= 0) return 0;
  const done = state.durationMs - getRemainingMs(state, now);
  return Math.min(1, Math.max(0, done / state.durationMs));
}

export function isExpired(state: TimerState, now: number): boolean {
  return state.status === 'running' && now >= state.endsAt;
}

/** O bloqueio só vale enquanto a sessão está rodando (a pausa é um respiro). */
export function isBlockingActive(state: TimerState, now: number): boolean {
  return state.status === 'running' && now < state.endsAt;
}

export interface TickResult {
  state: TimerState;
  /** Verdadeiro quando esta chamada encerrou a sessão. */
  completed: boolean;
  /** Minutos de foco concluídos (apenas quando `completed`). */
  focusedMinutes: number;
}

/** Avança o timer: encerra a sessão se o tempo acabou. */
export function tick(state: TimerState, now: number): TickResult {
  if (isExpired(state, now) && state.status === 'running') {
    return { state: IDLE, completed: true, focusedMinutes: Math.round(state.durationMs / MINUTE) };
  }
  return { state, completed: false, focusedMinutes: 0 };
}

/** Formata ms como "MM:SS" (ou "H:MM:SS" acima de uma hora), arredondando para cima. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Texto curto para o badge do ícone: "25m", "3m", "<1m". */
export function formatBadge(ms: number): string {
  if (ms <= 0) return '';
  return ms < MINUTE ? '<1m' : `${Math.ceil(ms / MINUTE)}m`;
}

/** Valida um estado vindo do storage (pode estar corrompido ou ser de outra versão). */
export function parseTimerState(value: unknown): TimerState {
  if (!value || typeof value !== 'object') return IDLE;
  const v = value as Record<string, unknown>;
  const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (v.status === 'running' && num(v.durationMs) && num(v.endsAt) && num(v.startedAt)) {
    return { status: 'running', durationMs: v.durationMs, endsAt: v.endsAt, startedAt: v.startedAt };
  }
  if (v.status === 'paused' && num(v.durationMs) && num(v.remainingMs) && num(v.startedAt)) {
    return {
      status: 'paused',
      durationMs: v.durationMs,
      remainingMs: v.remainingMs,
      startedAt: v.startedAt,
    };
  }
  return IDLE;
}
