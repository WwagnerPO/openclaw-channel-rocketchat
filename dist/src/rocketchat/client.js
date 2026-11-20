/**
 * Rocket.Chat REST API client
 */
export function createRocketChatClient(opts) {
    const baseUrl = normalizeRocketChatBaseUrl(opts.baseUrl);
    if (!baseUrl)
        throw new Error("Invalid Rocket.Chat baseUrl");
    return {
        baseUrl,
        userId: opts.userId,
        authToken: opts.authToken,
        fetch: globalThis.fetch,
    };
}
export function normalizeRocketChatBaseUrl(url) {
    if (!url)
        return null;
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!trimmed)
        return null;
    try {
        const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        return `${parsed.protocol}//${parsed.host}`;
    }
    catch {
        return null;
    }
}
export class RocketChatRateLimitError extends Error {
    /** Seconds the server asked us to wait (from Retry-After header or response body). */
    retryAfterSecs;
    constructor(retryAfterSecs, detail) {
        super(`Rocket.Chat 429 Too Many Requests (retry after ${retryAfterSecs}s)${detail ? `: ${detail}` : ""}`);
        this.name = "RocketChatRateLimitError";
        this.retryAfterSecs = retryAfterSecs;
    }
}
async function rcFetch(client, path, opts = {}) {
    const url = `${client.baseUrl}${path}`;
    const headers = {
        "X-Auth-Token": client.authToken,
        "X-User-Id": client.userId,
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
    };
    const res = await client.fetch(url, { ...opts, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Surface 429 with parsed retry-after so callers can gate properly.
        if (res.status === 429) {
            let retryAfter = 60; // conservative default
            const raHeader = res.headers.get("retry-after");
            if (raHeader && Number.isFinite(Number(raHeader))) {
                retryAfter = Math.max(1, Math.ceil(Number(raHeader)));
            }
            else {
                // Rocket.Chat often embeds the wait in the JSON body
                try {
                    const body = JSON.parse(text);
                    if (body.timeToReset && Number.isFinite(body.timeToReset)) {
                        retryAfter = Math.max(1, Math.ceil(body.timeToReset / 1000));
                    }
                }
                catch { /* ignore parse failure */ }
            }
            throw new RocketChatRateLimitError(retryAfter, text);
        }
        throw new Error(`Rocket.Chat API error ${res.status}: ${text}`);
    }
    return res.json();
}
export async function fetchRocketChatMe(client) {
    const res = await rcFetch(client, "/api/v1/me");
    return { _id: res._id, username: res.username, name: res.name };
}
export async function fetchRocketChatUser(client, userId) {
    const res = await rcFetch(client, `/api/v1/users.info?userId=${encodeURIComponent(userId)}`);
    return res.user;
}
export async function fetchRocketChatUserByUsername(client, username) {
    const res = await rcFetch(client, `/api/v1/users.info?username=${encodeURIComponent(username)}`);
    return res.user;
}
export async function fetchRocketChatRoom(client, roomId) {
    const res = await rcFetch(client, `/api/v1/rooms.info?roomId=${encodeURIComponent(roomId)}`);
    return res.room;
}
export async function fetchRocketChatChannels(client) {
    const res = await rcFetch(client, "/api/v1/channels.list.joined");
    return res.channels;
}
/**
 * Fetch a channel's info by name (for resolving room ID).
 */
export async function fetchRocketChatChannelByName(client, channelName) {
    try {
        const res = await rcFetch(client, `/api/v1/channels.info?roomName=${encodeURIComponent(channelName)}`);
        return res.channel ?? null;
    }
    catch {
        // Try groups (private channels) if channel lookup fails
        try {
            const res = await rcFetch(client, `/api/v1/groups.info?roomName=${encodeURIComponent(channelName)}`);
            return res.group ?? null;
        }
        catch {
            return null;
        }
    }
}
export async function fetchRocketChatSubscriptions(client) {
    const res = await rcFetch(client, "/api/v1/subscriptions.get");
    return res.update ?? [];
}
export async function createRocketChatDirectMessage(client, username) {
    const res = await rcFetch(client, "/api/v1/im.create", {
        method: "POST",
        body: JSON.stringify({ username }),
    });
    return { rid: res.room.rid };
}
export async function postRocketChatMessage(client, opts) {
    const payload = {
        text: opts.text,
    };
    if (opts.roomId)
        payload.roomId = opts.roomId;
    if (opts.channel)
        payload.channel = opts.channel;
    if (opts.tmid)
        payload.tmid = opts.tmid;
    if (opts.attachments)
        payload.attachments = opts.attachments;
    const res = await rcFetch(client, "/api/v1/chat.postMessage", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return res.message;
}
export async function sendRocketChatTyping(client, roomId, isTyping) {
    // Rocket.Chat exposes a REST endpoint for typing state in most deployments.
    // If the server doesn't support it (or it changes), callers should treat
    // failures as non-fatal.
    await rcFetch(client, "/api/v1/typing", {
        method: "POST",
        body: JSON.stringify({ roomId, typing: Boolean(isTyping) }),
    });
}
/**
 * Upload a file to a Rocket.Chat room.
 * RC 8.x uses a two-step process:
 *   1. POST /api/v1/rooms.media/{roomId} → returns file._id
 *   2. POST /api/v1/rooms.mediaConfirm/{roomId}/{fileId} → creates displayable message
 */
export async function uploadRocketChatFile(client, opts) {
    // Step 1: Upload file to rooms.media
    const uploadUrl = `${client.baseUrl}/api/v1/rooms.media/${opts.roomId}`;
    // Build FormData manually for Node.js
    const boundary = `----OpenClawBoundary${Date.now()}`;
    const parts = [];
    // Add file part
    const fileHeader = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${opts.fileName}"`,
        `Content-Type: ${opts.mimeType ?? "application/octet-stream"}`,
        "",
        "",
    ].join("\r\n");
    parts.push(Buffer.from(fileHeader));
    parts.push(opts.file);
    parts.push(Buffer.from("\r\n"));
    // End boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const uploadBody = Buffer.concat(parts);
    const uploadRes = await client.fetch(uploadUrl, {
        method: "POST",
        headers: {
            "X-Auth-Token": client.authToken,
            "X-User-Id": client.userId,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": String(uploadBody.length),
        },
        body: uploadBody,
    });
    if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "");
        throw new Error(`Rocket.Chat media upload error ${uploadRes.status}: ${text}`);
    }
    const uploadData = await uploadRes.json();
    if (!uploadData.success || !uploadData.file?._id) {
        throw new Error("Rocket.Chat media upload failed: no file ID returned");
    }
    // Step 2: Confirm media upload (generates thumbnail, dimensions, etc.)
    const confirmUrl = `${client.baseUrl}/api/v1/rooms.mediaConfirm/${opts.roomId}/${uploadData.file._id}`;
    const confirmPayload = {};
    if (opts.description)
        confirmPayload.msg = opts.description;
    if (opts.tmid)
        confirmPayload.tmid = opts.tmid;
    const confirmRes = await client.fetch(confirmUrl, {
        method: "POST",
        headers: {
            "X-Auth-Token": client.authToken,
            "X-User-Id": client.userId,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(confirmPayload),
    });
    if (!confirmRes.ok) {
        const text = await confirmRes.text().catch(() => "");
        throw new Error(`Rocket.Chat media confirm error ${confirmRes.status}: ${text}`);
    }
    const confirmData = await confirmRes.json();
    return {
        _id: confirmData.message._id,
        rid: confirmData.message.rid,
        ts: confirmData.message.ts,
    };
}
/**
 * React to a message with an emoji.
 * @param emoji - Emoji name (e.g., "thumbsup", ":rocket:", or unicode "🚀")
 * @param shouldReact - true to add reaction, false to remove (default: true)
 */
export async function reactRocketChatMessage(client, messageId, emoji, shouldReact = true) {
    // Normalize emoji format - RC accepts "thumbsup", ":thumbsup:", or unicode
    const normalizedEmoji = emoji.startsWith(":") ? emoji : `:${emoji.replace(/:/g, "")}:`;
    const res = await rcFetch(client, "/api/v1/chat.react", {
        method: "POST",
        body: JSON.stringify({
            messageId,
            emoji: normalizedEmoji,
            shouldReact,
        }),
    });
    if (!res.success) {
        throw new Error("Rocket.Chat reaction failed");
    }
}
//# sourceMappingURL=client.js.map