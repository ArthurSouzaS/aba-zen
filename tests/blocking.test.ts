import { describe, expect, it } from 'vitest';
import {
  buildBlockRules,
  DEFAULT_BLOCKLIST,
  findBlockingDomain,
  hostnameOf,
  isSubdomainOf,
  isUrlBlocked,
  normalizeDomain,
  parseBlocklist,
  planRuleUpdate,
  RULE_ID_BASE,
} from '../src/lib/blocking';

describe('normalizeDomain', () => {
  it.each([
    ['youtube.com', 'youtube.com'],
    ['  YouTube.COM  ', 'youtube.com'],
    ['https://www.youtube.com/watch?v=abc', 'youtube.com'],
    ['http://m.facebook.com:8080/feed', 'm.facebook.com'],
    ['*.reddit.com', 'reddit.com'],
    ['.reddit.com.', 'reddit.com'],
    ['user:senha@twitter.com/home', 'twitter.com'],
    ['news.ycombinator.com#top', 'news.ycombinator.com'],
    ['exemplo.com.br', 'exemplo.com.br'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(['', '   ', 'localhost', 'sem espaço.com', '-ruim.com', 'ruim-.com', 'a..b.com', '1.2.3.4', 'ftp://'])(
    'rejeita "%s"',
    (input) => {
      expect(normalizeDomain(input)).toBeNull();
    },
  );
});

describe('parseBlocklist', () => {
  it('aceita texto com um site por linha ou separado por vírgulas', () => {
    const { domains, invalid } = parseBlocklist('youtube.com\ninstagram.com, x.com;\n\n tiktok.com\n');
    expect(domains).toEqual(['instagram.com', 'tiktok.com', 'x.com', 'youtube.com']);
    expect(invalid).toEqual([]);
  });

  it('remove duplicatas e subdomínios já cobertos', () => {
    const { domains } = parseBlocklist(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com']);
    expect(domains).toEqual(['youtube.com']);
  });

  it('mantém subdomínio quando o domínio pai não está na lista', () => {
    expect(parseBlocklist(['mail.google.com']).domains).toEqual(['mail.google.com']);
  });

  it('separa entradas inválidas para avisar o usuário', () => {
    const { domains, invalid } = parseBlocklist(['reddit.com', 'isso não é site', 'localhost']);
    expect(domains).toEqual(['reddit.com']);
    expect(invalid).toEqual(['isso não é site', 'localhost']);
  });

  it('a lista padrão já está normalizada', () => {
    expect(parseBlocklist(DEFAULT_BLOCKLIST).domains).toEqual([...DEFAULT_BLOCKLIST].sort());
  });
});

describe('correspondência de URLs', () => {
  const list = ['youtube.com', 'x.com', 'mail.google.com'];

  it('bloqueia o domínio e seus subdomínios', () => {
    expect(isUrlBlocked('https://youtube.com/', list)).toBe(true);
    expect(isUrlBlocked('https://www.youtube.com/watch?v=1', list)).toBe(true);
    expect(isUrlBlocked('https://m.youtube.com', list)).toBe(true);
    expect(isUrlBlocked('http://x.com/home', list)).toBe(true);
    expect(findBlockingDomain('https://www.youtube.com/', list)).toBe('youtube.com');
  });

  it('não bloqueia domínios parecidos', () => {
    expect(isUrlBlocked('https://notyoutube.com', list)).toBe(false);
    expect(isUrlBlocked('https://youtube.com.br', list)).toBe(false);
    expect(isUrlBlocked('https://box.com', list)).toBe(false);
    expect(isUrlBlocked('https://google.com', list)).toBe(false);
    expect(isUrlBlocked('https://drive.google.com', list)).toBe(false);
  });

  it('ignora URLs que não são http(s) ou inválidas', () => {
    expect(isUrlBlocked('chrome://extensions', list)).toBe(false);
    expect(isUrlBlocked('chrome-extension://abc/blocked/index.html', list)).toBe(false);
    expect(isUrlBlocked('file:///home/youtube.com', list)).toBe(false);
    expect(isUrlBlocked('não é url', list)).toBe(false);
    expect(isUrlBlocked(undefined, list)).toBe(false);
  });

  it('lista vazia não bloqueia nada', () => {
    expect(isUrlBlocked('https://youtube.com', [])).toBe(false);
  });

  it('helpers básicos', () => {
    expect(hostnameOf('https://WWW.Exemplo.com./a')).toBe('www.exemplo.com');
    expect(isSubdomainOf('a.b.com', 'b.com')).toBe(true);
    expect(isSubdomainOf('ab.com', 'b.com')).toBe(false);
  });
});

describe('regras do declarativeNetRequest', () => {
  it('gera uma regra "block" por domínio com IDs sequenciais', () => {
    const rules = buildBlockRules(['youtube.com', 'x.com']);
    expect(rules).toEqual([
      {
        id: RULE_ID_BASE,
        priority: 1,
        action: { type: 'block' },
        condition: { requestDomains: ['youtube.com'], resourceTypes: ['main_frame', 'sub_frame'] },
      },
      {
        id: RULE_ID_BASE + 1,
        priority: 1,
        action: { type: 'block' },
        condition: { requestDomains: ['x.com'], resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ]);
  });

  it('com foco ativo remove as regras antigas e adiciona as novas', () => {
    const plan = planRuleUpdate([RULE_ID_BASE, RULE_ID_BASE + 1], ['reddit.com'], true);
    expect(plan.removeRuleIds).toEqual([RULE_ID_BASE, RULE_ID_BASE + 1]);
    expect(plan.addRules.map((r) => r.condition.requestDomains[0])).toEqual(['reddit.com']);
  });

  it('sem foco ativo apenas remove as regras', () => {
    const plan = planRuleUpdate([RULE_ID_BASE], ['reddit.com'], false);
    expect(plan).toEqual({ removeRuleIds: [RULE_ID_BASE], addRules: [] });
  });

  it('não mexe em regras com IDs fora da faixa da extensão', () => {
    expect(planRuleUpdate([1, 2, RULE_ID_BASE + 3], [], false).removeRuleIds).toEqual([RULE_ID_BASE + 3]);
  });
});
