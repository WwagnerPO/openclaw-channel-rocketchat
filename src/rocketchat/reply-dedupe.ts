/**
 * Guard against duplicate buffered deliveries for the same inbound turn.
 *
 * Some runtimes can emit the exact same final text more than once when a
 * session is resuming or finalizing. Identical consecutive payloads in the
 * same reply cycle are treated as duplicates and suppressed.
 *
 * Ported from cloudrise-network/openclaw-channel-rocketchat#9 by @ggruber4711.
 */

export type RocketChatReplyDeduper = {
  /** True if `text` should be sent (non-empty and not identical to the previous delivery). */
  shouldDeliver(text: unknown): boolean;
};

export function createRocketChatReplyDeduper(): RocketChatReplyDeduper {
  let lastText: string | null = null;
  return {
    shouldDeliver(text: unknown): boolean {
      const normalized = String(text ?? "").trim();
      if (!normalized) return false;
      if (normalized === lastText) return false;
      lastText = normalized;
      return true;
    },
  };
}
