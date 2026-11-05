/** Mensagens que as páginas enviam ao service worker. */
import type { TimerState } from './timer';

export type Message =
  | { type: 'focus:start'; minutes?: number }
  | { type: 'focus:toggle' }
  | { type: 'focus:stop' };

export type MessageResponse = { ok: true; timer: TimerState } | { ok: false; error: string };

export async function send(message: Message): Promise<MessageResponse> {
  try {
    return (await chrome.runtime.sendMessage(message)) as MessageResponse;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
