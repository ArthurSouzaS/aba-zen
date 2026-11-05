/** Lista de tarefas do dia. Tarefas pendentes passam para o dia seguinte. */

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface TaskList {
  day: string;
  items: Task[];
}

export const MAX_TASK_LENGTH = 140;
export const MAX_TASKS = 50;

export function emptyList(day: string): TaskList {
  return { day, items: [] };
}

/**
 * Ao virar o dia, as tarefas concluídas saem da lista e as pendentes
 * continuam (afinal, ainda precisam ser feitas).
 */
export function rollover(list: TaskList | undefined, today: string): TaskList {
  if (!list || !Array.isArray(list.items)) return emptyList(today);
  if (list.day === today) return list;
  return { day: today, items: list.items.filter((t) => !t.done) };
}

export function addTask(list: TaskList, text: string, now: number, id: string): TaskList {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TASK_LENGTH);
  if (!clean || list.items.length >= MAX_TASKS) return list;
  return { ...list, items: [...list.items, { id, text: clean, done: false, createdAt: now }] };
}

export function toggleTask(list: TaskList, id: string): TaskList {
  return { ...list, items: list.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) };
}

export function removeTask(list: TaskList, id: string): TaskList {
  return { ...list, items: list.items.filter((t) => t.id !== id) };
}

export function clearDone(list: TaskList): TaskList {
  return { ...list, items: list.items.filter((t) => !t.done) };
}
