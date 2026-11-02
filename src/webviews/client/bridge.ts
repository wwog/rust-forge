/** Message bridge for the webview side. */
import type { WebviewMessage } from '../protocol.js';

let sender: ((message: WebviewMessage) => void) | undefined;

export function setSender(fn: (message: WebviewMessage) => void): void {
  sender = fn;
}

export function send(message: WebviewMessage): void {
  sender?.(message);
}
