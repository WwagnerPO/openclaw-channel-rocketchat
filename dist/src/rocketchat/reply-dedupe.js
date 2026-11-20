/**
 * Guard against duplicate buffered deliveries for the same inbound turn.
 *
 * Some runtimes can emit the exact same final text more than once when a
 * session is resuming or finalizing. Identical consecutive payloads in the
 * same reply cycle are treated as duplicates and suppressed.
 *
 * Ported from cloudrise-network/openclaw-channel-rocketchat#9 by @ggruber4711.
 */
export function createRocketChatReplyDeduper() {
    let lastText = null;
    return {
        shouldDeliver(text) {
            const normalized = String(text ?? "").trim();
            if (!normalized)
                return false;
            if (normalized === lastText)
                return false;
            lastText = normalized;
            return true;
        },
    };
}
//# sourceMappingURL=reply-dedupe.js.map