/** Componentes de UI reaproveitados entre popup, nova aba e opções. */
import { h } from './dom';
import { formatDuration, type SiteTotal } from './stats';

export function renderSiteList(list: HTMLElement, totals: readonly SiteTotal[], emptyText: string): void {
  if (totals.length === 0) {
    list.replaceChildren(h('li', { class: 'empty' }, emptyText));
    return;
  }
  const max = totals[0]?.ms ?? 1;
  list.replaceChildren(
    ...totals.map((t) => {
      const bar = h('span');
      bar.style.width = `${Math.max(2, (t.ms / max) * 100)}%`;
      return h(
        'li',
        { class: 'site-row' },
        h('span', { class: 'domain', title: t.domain }, t.domain),
        h('span', { class: 'time' }, formatDuration(t.ms)),
        h('span', { class: 'bar', 'aria-hidden': 'true' }, bar),
      );
    }),
  );
}
