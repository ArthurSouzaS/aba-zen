/** Saudação conforme a hora local. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function greeting(date: Date, name?: string): string {
  const base = greetingFor(date.getHours());
  const clean = name?.trim();
  return clean ? `${base}, ${clean}` : base;
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

export function formatDate(date: Date): string {
  const text = dateFormat.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
