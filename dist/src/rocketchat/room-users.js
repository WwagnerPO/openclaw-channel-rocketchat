/**
 * Per-Room User Access Control
 *
 * Manages which users can interact with the bot in specific rooms.
 * Separate from global approval — this is room-level granular control.
 *
 * Storage: ~/.openclaw/credentials/rocketchat-room-users.json
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
// In-memory cache
let cache = null;
function resolveStorePath() {
    return path.join(os.homedir(), ".openclaw", "credentials", "rocketchat-room-users.json");
}
async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
}
async function loadStore() {
    if (cache)
        return cache;
    try {
        const data = await fs.readFile(resolveStorePath(), "utf-8");
        const parsed = JSON.parse(data);
        cache = {
            version: parsed.version ?? 1,
            rooms: parsed.rooms ?? {},
        };
        return cache;
    }
    catch {
        cache = { version: 1, rooms: {} };
        return cache;
    }
}
async function saveStore(store) {
    cache = store;
    await ensureDir(path.dirname(resolveStorePath()));
    await fs.writeFile(resolveStorePath(), JSON.stringify(store, null, 2), { mode: 0o600 });
}
/**
 * Get all approved users for a room.
 */
export async function getRoomApprovedUsers(roomId) {
    const store = await loadStore();
    return store.rooms[roomId]?.approved ?? [];
}
/**
 * Check if a user is approved for a specific room.
 */
export async function isRoomUserApproved(roomId, userId, username) {
    const approved = await getRoomApprovedUsers(roomId);
    const normalizedUsername = username?.toLowerCase();
    return approved.some((entry) => entry.userId === userId ||
        (normalizedUsername && entry.username?.toLowerCase() === normalizedUsername));
}
/**
 * Add a user to a room's approved list.
 */
export async function addRoomUser(params) {
    const store = await loadStore();
    if (!store.rooms[params.roomId]) {
        store.rooms[params.roomId] = { approved: [] };
    }
    const room = store.rooms[params.roomId];
    const normalizedUsername = params.username?.toLowerCase();
    // Check if already approved
    const existing = room.approved.find((entry) => entry.userId === params.userId ||
        (normalizedUsername && entry.username?.toLowerCase() === normalizedUsername));
    if (existing) {
        return { added: false, existing: true };
    }
    room.approved.push({
        userId: params.userId,
        username: params.username,
        approvedBy: params.approvedBy,
        approvedAt: new Date().toISOString(),
    });
    await saveStore(store);
    return { added: true, existing: false };
}
/**
 * Remove a user from a room's approved list.
 */
export async function removeRoomUser(params) {
    const store = await loadStore();
    const room = store.rooms[params.roomId];
    if (!room) {
        return { removed: false };
    }
    const normalizedUsername = params.username?.toLowerCase();
    const index = room.approved.findIndex((entry) => (params.userId && entry.userId === params.userId) ||
        (normalizedUsername && entry.username?.toLowerCase() === normalizedUsername));
    if (index === -1) {
        return { removed: false };
    }
    const [removed] = room.approved.splice(index, 1);
    await saveStore(store);
    return { removed: true, entry: removed };
}
/**
 * Format room users list for display.
 */
export function formatRoomUsersList(users) {
    if (users.length === 0) {
        return "No users approved for this room.";
    }
    const lines = users.map((u) => {
        const who = u.username ? `@${u.username}` : u.userId;
        const when = new Date(u.approvedAt).toLocaleDateString();
        return `• ${who} (by ${u.approvedBy}, ${when})`;
    });
    return `**Approved users (${users.length})**\n${lines.join("\n")}`;
}
/**
 * Clear the cache (useful for testing).
 */
export function clearRoomUsersCache() {
    cache = null;
}
//# sourceMappingURL=room-users.js.map