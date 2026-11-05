/** Frases motivacionais locais (nada é buscado na internet). */
export const QUOTES: readonly string[] = [
  'Uma coisa de cada vez. É assim que tudo fica pronto.',
  'Comece pequeno. O importante é começar.',
  'Foco não é fazer mais; é fazer o que importa.',
  'Respire fundo. Você tem tempo para o essencial.',
  'Progresso, não perfeição.',
  'O próximo passo não precisa ser grande, só precisa ser dado.',
  'Feito é melhor do que perfeito.',
  'Seu futuro agradece os 25 minutos de agora.',
  'Disciplina é lembrar o que você quer.',
  'Silencie o ruído. Escute a tarefa.',
  'Pequenos hábitos, grandes resultados.',
  'Constância vence intensidade.',
  'Termine o que começou antes de começar outra coisa.',
  'A distração pode esperar. Você, não.',
  'Hoje é um bom dia para avançar um pouco.',
  'Calma não é lentidão; é direção.',
  'Escolha uma tarefa e dê a ela toda a sua atenção.',
  'Descansar também faz parte do trabalho bem feito.',
  'Você não precisa ver a escada inteira, só o próximo degrau.',
  'Menos abas, mais clareza.',
  'O tempo que você protege é o tempo que você aproveita.',
  'Concentração é um músculo: cada sessão o fortalece.',
  'Faça hoje algo que seu eu de amanhã vai agradecer.',
  'Devagar e sempre se vai longe.',
];

/** Frase do dia: estável ao longo do dia, muda à meia-noite. */
export function quoteOfTheDay(date: Date, quotes: readonly string[] = QUOTES): string {
  if (quotes.length === 0) return '';
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000);
  return quotes[(dayOfYear + date.getFullYear()) % quotes.length] ?? '';
}

/** Outra frase aleatória, diferente da atual. */
export function randomQuote(current: string, quotes: readonly string[] = QUOTES, rnd = Math.random): string {
  const others = quotes.filter((q) => q !== current);
  if (others.length === 0) return quotes[0] ?? '';
  return others[Math.floor(rnd() * others.length)] ?? others[0] ?? '';
}
