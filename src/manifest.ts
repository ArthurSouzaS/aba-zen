/**
 * Manifest V3 do Aba Zen. Mantido em TypeScript para que a versão seja
 * sincronizada com o package.json durante o build.
 *
 * Permissões (todas explicadas no README):
 * - storage: salvar tarefas, configurações e estatísticas no próprio navegador.
 * - alarms: encerrar a sessão de foco no horário certo e medir o tempo por site.
 * - declarativeNetRequest: bloquear os sites da lista durante o foco.
 * - tabs: ler a URL da aba ativa (estatísticas) e redirecionar abas bloqueadas.
 * - idle: não contar tempo quando você está longe do computador.
 */
export function createManifest(version: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'Aba Zen',
    short_name: 'Aba Zen',
    description:
      'Nova aba minimalista com tarefas do dia, sessões de foco, bloqueio de distrações e estatísticas 100% locais.',
    version,
    minimum_chrome_version: '120',
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    action: {
      default_title: 'Aba Zen',
      default_popup: 'popup/index.html',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
      },
    },
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    chrome_url_overrides: {
      newtab: 'newtab/index.html',
    },
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
    permissions: ['storage', 'alarms', 'declarativeNetRequest', 'tabs', 'idle'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  };
}
