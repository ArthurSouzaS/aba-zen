import { describe, expect, it } from 'vitest';
import {
  clampMinutes,
  DEFAULT_FOCUS_MINUTES,
  formatBadge,
  formatClock,
  getProgress,
  getRemainingMs,
  IDLE,
  isBlockingActive,
  isExpired,
  MAX_FOCUS_MINUTES,
  parseTimerState,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  tick,
  TimerError,
  toggleTimer,
} from '../src/lib/timer';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

describe('startTimer', () => {
  it('cria uma sessão rodando com fim calculado a partir de agora', () => {
    const state = startTimer(25, T0);
    expect(state).toEqual({ status: 'running', durationMs: 25 * MIN, endsAt: T0 + 25 * MIN, startedAt: T0 });
  });

  it('limita a duração entre 1 e 180 minutos e arredonda', () => {
    expect(clampMinutes(0)).toBe(1);
    expect(clampMinutes(-10)).toBe(1);
    expect(clampMinutes(999)).toBe(MAX_FOCUS_MINUTES);
    expect(clampMinutes(24.6)).toBe(25);
    expect(clampMinutes(Number.NaN)).toBe(DEFAULT_FOCUS_MINUTES);
  });
});

describe('pausa e retomada', () => {
  it('pausar guarda o tempo restante e congela a contagem', () => {
    const running = startTimer(25, T0);
    const paused = pauseTimer(running, T0 + 10 * MIN);
    expect(paused).toMatchObject({ status: 'paused', remainingMs: 15 * MIN });
    // Mesmo muito tempo depois, o restante não muda enquanto pausado.
    expect(getRemainingMs(paused, T0 + 999 * MIN)).toBe(15 * MIN);
  });

  it('retomar recalcula o fim a partir do momento da retomada', () => {
    const paused = pauseTimer(startTimer(25, T0), T0 + 10 * MIN);
    const resumed = resumeTimer(paused, T0 + 60 * MIN);
    expect(resumed).toMatchObject({ status: 'running', endsAt: T0 + 75 * MIN, startedAt: T0 });
    expect(getRemainingMs(resumed, T0 + 70 * MIN)).toBe(5 * MIN);
  });

  it('toggle alterna entre rodando e pausado', () => {
    const running = startTimer(10, T0);
    const paused = toggleTimer(running, T0 + MIN);
    expect(paused.status).toBe('paused');
    expect(toggleTimer(paused, T0 + 2 * MIN).status).toBe('running');
  });

  it('rejeita transições inválidas', () => {
    expect(() => pauseTimer(IDLE, T0)).toThrow(TimerError);
    expect(() => resumeTimer(startTimer(5, T0), T0)).toThrow(TimerError);
    expect(() => toggleTimer(IDLE, T0)).toThrow(TimerError);
  });

  it('pausar depois do fim não gera tempo negativo', () => {
    const paused = pauseTimer(startTimer(1, T0), T0 + 5 * MIN);
    expect(paused).toMatchObject({ remainingMs: 0 });
  });
});

describe('fim da sessão', () => {
  it('tick não faz nada antes do fim', () => {
    const state = startTimer(25, T0);
    expect(tick(state, T0 + 24 * MIN)).toEqual({ state, completed: false, focusedMinutes: 0 });
  });

  it('tick encerra a sessão exatamente no fim e informa os minutos focados', () => {
    const result = tick(startTimer(25, T0), T0 + 25 * MIN);
    expect(result).toEqual({ state: IDLE, completed: true, focusedMinutes: 25 });
  });

  it('sessão pausada nunca expira', () => {
    const paused = pauseTimer(startTimer(1, T0), T0);
    expect(isExpired(paused, T0 + 999 * MIN)).toBe(false);
    expect(tick(paused, T0 + 999 * MIN).completed).toBe(false);
  });

  it('stopTimer volta para ocioso', () => {
    expect(stopTimer()).toEqual({ status: 'idle' });
    expect(getRemainingMs(stopTimer(), T0)).toBe(0);
  });
});

describe('bloqueio x estado do timer', () => {
  it('bloqueia apenas com a sessão rodando e dentro do prazo', () => {
    const running = startTimer(25, T0);
    expect(isBlockingActive(running, T0 + MIN)).toBe(true);
    expect(isBlockingActive(running, T0 + 25 * MIN)).toBe(false);
    expect(isBlockingActive(pauseTimer(running, T0 + MIN), T0 + MIN)).toBe(false);
    expect(isBlockingActive(IDLE, T0)).toBe(false);
  });
});

describe('progresso e formatação', () => {
  it('calcula o progresso entre 0 e 1', () => {
    const state = startTimer(10, T0);
    expect(getProgress(state, T0)).toBe(0);
    expect(getProgress(state, T0 + 5 * MIN)).toBe(0.5);
    expect(getProgress(state, T0 + 50 * MIN)).toBe(1);
    expect(getProgress(IDLE, T0)).toBe(0);
  });

  it('formata o relógio arredondando segundos para cima', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(90 * MIN)).toBe('1:30:00');
  });

  it('formata o badge em minutos', () => {
    expect(formatBadge(25 * MIN)).toBe('25m');
    expect(formatBadge(61_000)).toBe('2m');
    expect(formatBadge(30_000)).toBe('<1m');
    expect(formatBadge(0)).toBe('');
  });
});

describe('parseTimerState', () => {
  it('aceita estados válidos', () => {
    const running = startTimer(5, T0);
    expect(parseTimerState(running)).toEqual(running);
    const paused = pauseTimer(running, T0 + MIN);
    expect(parseTimerState(paused)).toEqual(paused);
  });

  it('volta para ocioso com dados ausentes ou corrompidos', () => {
    expect(parseTimerState(undefined)).toEqual(IDLE);
    expect(parseTimerState('lixo')).toEqual(IDLE);
    expect(parseTimerState({ status: 'running', endsAt: 'amanhã' })).toEqual(IDLE);
    expect(parseTimerState({ status: 'desconhecido' })).toEqual(IDLE);
  });
});
