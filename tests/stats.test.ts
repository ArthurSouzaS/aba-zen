import { describe, expect, it } from 'vitest';
import { dayKey, lastDays } from '../src/lib/dates';
import {
  addTime,
  closeSlice,
  formatDuration,
  MAX_SLICE_MS,
  openSlice,
  pruneStats,
  sliceDuration,
  statsDomain,
  summarize,
  totalMs,
  type SiteStats,
} from '../src/lib/stats';

const T0 = new Date(2026, 10, 5, 10, 0, 0).getTime();
const TODAY = dayKey(T0);

describe('estatísticas por site', () => {
  it('usa o hostname sem www e ignora páginas internas', () => {
    expect(statsDomain('https://www.github.com/arthur')).toBe('github.com');
    expect(statsDomain('chrome://newtab')).toBeNull();
    expect(openSlice('about:blank', T0)).toBeNull();
  });

  it('soma o tempo de um trecho ao dia em que começou', () => {
    const slice = openSlice('https://github.com', T0)!;
    const stats = closeSlice({}, slice, T0 + 60_000);
    expect(stats).toEqual({ [TODAY]: { 'github.com': 60_000 } });
    expect(closeSlice(stats, slice, T0 + 30_000)[TODAY]!['github.com']).toBe(90_000);
  });

  it('limita trechos longos (computador dormindo) e ignora relógio voltando', () => {
    const slice = { domain: 'a.com', startedAt: T0 };
    expect(sliceDuration(slice, T0 + 8 * 3_600_000)).toBe(MAX_SLICE_MS);
    expect(sliceDuration(slice, T0 - 1000)).toBe(0);
    expect(addTime({}, TODAY, 'a.com', 0)).toEqual({});
  });

  it('remove dias fora da retenção', () => {
    const old = dayKey(new Date(2026, 9, 1));
    const stats: SiteStats = { [TODAY]: { 'a.com': 1 }, [old]: { 'b.com': 1 } };
    expect(Object.keys(pruneStats(stats, T0, 30))).toEqual([TODAY]);
  });

  it('resume vários dias ordenando do mais usado', () => {
    const [d0, d1] = lastDays(2, T0) as [string, string];
    const stats: SiteStats = { [d0]: { 'a.com': 1000, 'b.com': 5000 }, [d1]: { 'a.com': 6000 } };
    const totals = summarize(stats, [d0, d1]);
    expect(totals).toEqual([
      { domain: 'a.com', ms: 7000 },
      { domain: 'b.com', ms: 5000 },
    ]);
    expect(totalMs(totals)).toBe(12_000);
    expect(summarize(stats, [d0], 1)).toEqual([{ domain: 'b.com', ms: 5000 }]);
  });

  it('formata durações', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(30_000)).toBe('< 1 min');
    expect(formatDuration(12 * 60_000)).toBe('12 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05 min');
  });

  it('lastDays atravessa a virada de mês', () => {
    expect(lastDays(3, new Date(2026, 2, 1))).toEqual(['2026-03-01', '2026-02-28', '2026-02-27']);
  });
});
