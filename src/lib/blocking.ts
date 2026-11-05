/**
 * Regras de bloqueio: normalização da lista digitada pelo usuário, teste de
 * URLs e conversão para regras do `chrome.declarativeNetRequest`.
 *
 * Cada entrada da lista é um domínio ("youtube.com"). Um domínio bloqueia
 * também todos os seus subdomínios ("www.youtube.com", "m.youtube.com"),
 * mas não domínios que apenas terminam com o mesmo texto ("notyoutube.com").
 */

export const DEFAULT_BLOCKLIST: readonly string[] = [
  'youtube.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'reddit.com',
];

/** IDs das regras dinâmicas começam aqui (evita conflito com futuras regras estáticas). */
export const RULE_ID_BASE = 1000;
/** Limite de segurança bem abaixo do máximo de regras dinâmicas do Chrome. */
export const MAX_BLOCKED_SITES = 500;

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/**
 * Converte o que o usuário digitou em um domínio limpo, ou `null` se inválido.
 * Aceita URLs completas, "www.", portas, caminhos e o prefixo "*.".
 */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;

  // Remove protocolo (http://, https://, etc.).
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  // Remove credenciais, caminho, query e fragmento.
  s = s.replace(/^[^@/]*@/, '');
  s = s.split(/[/?#]/, 1)[0] ?? '';
  // Remove porta.
  s = s.replace(/:\d+$/, '');
  // "*.site.com" e ".site.com" equivalem a "site.com" (subdomínios já são incluídos).
  s = s.replace(/^\*\./, '').replace(/^\.+/, '').replace(/\.+$/, '');
  // "www." é redundante, já que subdomínios são bloqueados.
  s = s.replace(/^www\./, '');

  if (s.length === 0 || s.length > 253) return null;
  const labels = s.split('.');
  if (labels.length < 2) return null;
  if (!labels.every((label) => LABEL.test(label))) return null;
  // O TLD não pode ser só números (evita "1.2.3.4" parcialmente válidos).
  if (/^\d+$/.test(labels[labels.length - 1] ?? '')) return null;
  return s;
}

export interface ParsedBlocklist {
  domains: string[];
  invalid: string[];
}

/**
 * Normaliza uma lista (ou texto com um site por linha, ou separados por vírgula),
 * remove duplicatas e entradas cobertas por outra mais ampla
 * ("m.youtube.com" é redundante se "youtube.com" já está na lista).
 */
export function parseBlocklist(input: string | readonly string[]): ParsedBlocklist {
  const raw = typeof input === 'string' ? input.split(/[\n,;]+/) : [...input];
  const invalid: string[] = [];
  const set = new Set<string>();

  for (const entry of raw) {
    if (!entry.trim()) continue;
    const domain = normalizeDomain(entry);
    if (domain) set.add(domain);
    else invalid.push(entry.trim());
  }

  const domains = [...set]
    .filter((d) => ![...set].some((other) => other !== d && isSubdomainOf(d, other)))
    .sort()
    .slice(0, MAX_BLOCKED_SITES);

  return { domains, invalid };
}

/** `host` é igual a `domain` ou é um subdomínio dele. */
export function isSubdomainOf(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Extrai o hostname de uma URL http(s); `null` para outros esquemas. */
export function hostnameOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname.toLowerCase().replace(/\.$/, '') || null;
  } catch {
    return null;
  }
}

/** Retorna o domínio da lista que bloqueia a URL, ou `null`. */
export function findBlockingDomain(
  url: string | undefined | null,
  blocklist: readonly string[],
): string | null {
  const host = hostnameOf(url);
  if (!host) return null;
  return blocklist.find((domain) => isSubdomainOf(host, domain)) ?? null;
}

export function isUrlBlocked(url: string | undefined | null, blocklist: readonly string[]): boolean {
  return findBlockingDomain(url, blocklist) !== null;
}

/** Subconjunto tipado de `chrome.declarativeNetRequest.Rule` usado aqui. */
export interface BlockRule {
  id: number;
  priority: number;
  action: { type: 'block' };
  condition: {
    requestDomains: string[];
    resourceTypes: ['main_frame', 'sub_frame'];
  };
}

/**
 * Gera uma regra "block" por domínio. Usamos `block` (e não `redirect`)
 * porque redirecionar exigiria permissão de acesso a todos os sites; a
 * troca para a página "Respire" é feita pelo service worker via `tabs`.
 */
export function buildBlockRules(blocklist: readonly string[]): BlockRule[] {
  return blocklist.slice(0, MAX_BLOCKED_SITES).map((domain, index) => ({
    id: RULE_ID_BASE + index,
    priority: 1,
    action: { type: 'block' },
    condition: {
      requestDomains: [domain],
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  }));
}

/**
 * Calcula o que mudar nas regras dinâmicas: remove todas as regras nossas
 * existentes e adiciona as novas (ou nenhuma, se o bloqueio estiver inativo).
 */
export function planRuleUpdate(
  existingRuleIds: readonly number[],
  blocklist: readonly string[],
  active: boolean,
): { removeRuleIds: number[]; addRules: BlockRule[] } {
  return {
    removeRuleIds: existingRuleIds.filter((id) => id >= RULE_ID_BASE),
    addRules: active ? buildBlockRules(blocklist) : [],
  };
}
