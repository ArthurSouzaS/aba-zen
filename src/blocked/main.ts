import { hostnameOf } from '../lib/blocking';
import { $ } from '../lib/dom';
import { quoteOfTheDay } from '../lib/quotes';
import { getTimer, KEYS, onKeyChange } from '../lib/storage';
import { formatClock, getRemainingMs, isBlockingActive, type TimerState } from '../lib/timer';

const params = new URLSearchParams(location.search);
const site = params.get('site');
const original = params.get('url');
// Só aceitamos voltar para URLs http(s), nunca outros esquemas.
const safeOriginal = original && hostnameOf(original) ? original : null;

if (site) $('#site').textContent = site;
$('#quote').textContent = quoteOfTheDay(new Date());

let timer: TimerState = { status: 'idle' };

function render(): void {
  const now = Date.now();
  const active = isBlockingActive(timer, now);
  const cont = $<HTMLAnchorElement>('#continue');
  $('#lead').textContent = active
    ? 'está bloqueado durante a sua sessão de foco.'
    : 'estava bloqueado durante a sua sessão de foco.';
  if (active) {
    $('#remaining').textContent = `Faltam ${formatClock(getRemainingMs(timer, now))} para o fim da sessão.`;
    cont.hidden = true;
  } else {
    $('#remaining').textContent =
      timer.status === 'paused' ? 'Sessão pausada — o site está liberado.' : 'A sessão de foco terminou.';
    cont.hidden = !safeOriginal;
    if (safeOriginal) cont.href = safeOriginal;
  }
}

async function refresh(): Promise<void> {
  timer = await getTimer();
  render();
}

void refresh();
setInterval(render, 1000);
onKeyChange(KEYS.timer, () => void refresh());
