/**
 * Estatísticas de tempo por site. Tudo fica em `chrome.storage.local`;
 * nenhum dado sai do navegador.
 *
 * Funcionamento: o service worker mantém um "trecho" aberto (`Slice`) com o
 * domínio da aba ativa e o instante em que começou. A cada troca de aba,
 * mudança de URL, perda de foco da janela, inatividade ou batida do alarme,
 * o trecho é fechado e o tempo é somado ao dia.
 */

import { hostnameOf } from './blocking';
import { dayKey, lastDays } from './dates';

/** day -> domínio -> ms */
export type SiteStats = Record<string, Record<string, number>>;

export interface Slice {
  domain: string;
  startedAt: number;
}

/** Mantemos no máximo este número de dias de histórico. */
export const RETENTION_DAYS = 30;
/**
 * Um trecho nunca vale mais que isso. Protege contra o computador ter
 * dormido ou o navegador ter sido fechado com um trecho aberto
 * (o alarme fecha trechos a cada minuto, então trechos legítimos são curtos).
 */
export const MAX_SLICE_MS = 3 * 60_000;

/** Domínio usado nas estatísticas: hostname sem "www.". */
export function statsDomain(url: string | undefined | null): string | null {
  const host = hostnameOf(url);
  return host ? host.replace(/^www\./, '') : null;
}

export function openSlice(url: string | undefined | null, now: number): Slice | null {
  const domain = statsDomain(url);
  return domain ? { domain, startedAt: now } : null;
}

/** Duração aproveitável do trecho (0 se o relógio andou para trás). */
export function sliceDuration(slice: Slice, now: number): number {
  const elapsed = now - slice.startedAt;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.min(elapsed, MAX_SLICE_MS);
}

/** Soma `ms` ao domínio no dia indicado, sem mutar o objeto original. */
export function addTime(stats: SiteStats, day: string, domain: string, ms: number): SiteStats {
  if (ms <= 0) return stats;
  const dayStats = stats[day] ?? {};
  return { ...stats, [day]: { ...dayStats, [domain]: (dayStats[domain] ?? 0) + Math.round(ms) } };
}

/** Fecha o trecho e contabiliza o tempo no dia em que ele começou. */
export function closeSlice(stats: SiteStats, slice: Slice | null, now: number): SiteStats {
  if (!slice) return stats;
  return addTime(stats, dayKey(slice.startedAt), slice.domain, sliceDuration(slice, now));
}

/** Remove dias mais antigos que a retenção. */
export function pruneStats(stats: SiteStats, now: number, keepDays = RETENTION_DAYS): SiteStats {
  const keep = new Set(lastDays(keepDays, now));
  return Object.fromEntries(Object.entries(stats).filter(([day]) => keep.has(day)));
}

export interface SiteTotal {
  domain: string;
  ms: number;
}

/** Soma os dias pedidos e ordena do site mais usado para o menos usado. */
export function summarize(stats: SiteStats, days: readonly string[], limit = Infinity): SiteTotal[] {
  const totals = new Map<string, number>();
  for (const day of days) {
    for (const [domain, ms] of Object.entries(stats[day] ?? {})) {
      totals.set(domain, (totals.get(domain) ?? 0) + ms);
    }
  }
  return [...totals]
    .map(([domain, ms]) => ({ domain, ms }))
    .sort((a, b) => b.ms - a.ms || a.domain.localeCompare(b.domain))
    .slice(0, limit);
}

export function totalMs(totals: readonly SiteTotal[]): number {
  return totals.reduce((sum, t) => sum + t.ms, 0);
}

/** "1 h 05 min", "12 min", "< 1 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return ms > 0 ? '< 1 min' : '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
