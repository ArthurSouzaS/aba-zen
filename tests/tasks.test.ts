import { describe, expect, it } from 'vitest';
import { addTask, clearDone, MAX_TASK_LENGTH, removeTask, rollover, toggleTask } from '../src/lib/tasks';
import { greetingFor } from '../src/lib/greeting';
import { quoteOfTheDay, randomQuote } from '../src/lib/quotes';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/lib/settings';

describe('tarefas do dia', () => {
  const base = { day: '2026-11-05', items: [] };

  it('adiciona, conclui e remove', () => {
    let list = addTask(base, '  Estudar   TypeScript ', 1, 'a');
    expect(list.items[0]).toMatchObject({ id: 'a', text: 'Estudar TypeScript', done: false });
    list = toggleTask(list, 'a');
    expect(list.items[0]!.done).toBe(true);
    expect(removeTask(list, 'a').items).toEqual([]);
  });

  it('ignora texto vazio e corta textos longos', () => {
    expect(addTask(base, '   ', 1, 'a')).toBe(base);
    expect(addTask(base, 'x'.repeat(500), 1, 'a').items[0]!.text).toHaveLength(MAX_TASK_LENGTH);
  });

  it('na virada do dia mantém só as pendentes', () => {
    let list = addTask(addTask(base, 'feita', 1, 'a'), 'pendente', 2, 'b');
    list = toggleTask(list, 'a');
    expect(rollover(list, '2026-11-05')).toBe(list);
    expect(rollover(list, '2026-11-06')).toEqual({ day: '2026-11-06', items: [list.items[1]] });
    expect(rollover(undefined, '2026-11-06')).toEqual({ day: '2026-11-06', items: [] });
    expect(clearDone(list).items.map((t) => t.id)).toEqual(['b']);
  });
});

describe('saudação, frases e configurações', () => {
  it('saúda conforme a hora', () => {
    expect(greetingFor(6)).toBe('Bom dia');
    expect(greetingFor(13)).toBe('Boa tarde');
    expect(greetingFor(20)).toBe('Boa noite');
    expect(greetingFor(2)).toBe('Boa noite');
  });

  it('frase do dia é estável e randomQuote sempre troca', () => {
    const d = new Date(2026, 10, 5, 8);
    expect(quoteOfTheDay(d)).toBe(quoteOfTheDay(new Date(2026, 10, 5, 23)));
    expect(randomQuote('a', ['a', 'b'], () => 0)).toBe('b');
  });

  it('normaliza configurações inválidas para os padrões', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ focusMinutes: 9999, blocklist: ['https://www.X.com/home', 42] })).toMatchObject({
      focusMinutes: 180,
      blocklist: ['x.com'],
    });
  });
});
