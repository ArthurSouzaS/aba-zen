/** Chave do dia no fuso local, no formato "AAAA-MM-DD". */
export function dayKey(date: Date | number = Date.now()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** As últimas `count` chaves de dia, da mais recente para a mais antiga. */
export function lastDays(count: number, from: Date | number = Date.now()): string[] {
  const base = typeof from === 'number' ? new Date(from) : new Date(from.getTime());
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i, 12);
    keys.push(dayKey(d));
  }
  return keys;
}
