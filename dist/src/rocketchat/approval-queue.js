/**
 * Approval Queue for Owner Approval Flow
 *
 * Manages pending approval requests with memory + file persistence.
 * Survives gateway restarts.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
// In-memory cache
let cache = null;
function resolveStorePath() {
    return path.join(os.homedir(), ".openclaw", "credentials", "rocketchat-approval-queue.json");
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
            pending: Array.isArray(parsed.pending) ? parsed.pending : [],
        };
        return cache;
    }
    catch {
        cache = { version: 1, pending: [] };
        return cache;
    }
}
async function saveStore(store) {
    cache = store;
    await ensureDir(path.dirname(resolveStorePath()));
    await fs.writeFile(resolveStorePath(), JSON.stringify(store, null, 2), { mode: 0o600 });
}
/**
 * Create a new pending approval request.
 */
export async function createApproval(params) {
    const store = await loadStore();
    const now = Date.now();
    // Check for existing pending approval for same target
    const existing = store.pending.find((p) => p.targetId === params.targetId && p.type === params.type && p.status === "pending");
    if (existing) {
        // Update last notified time
        existing.lastNotifiedAt = now;
        await saveStore(store);
        return existing;
    }
    const approval = {
        id: crypto.randomUUID().slice(0, 8),
        type: params.type,
        targetId: params.targetId,
        targetName: params.targetName,
        targetUsername: params.targetUsername,
        requesterId: params.requesterId,
        requesterName: params.requesterName,
        requesterUsername: params.requesterUsername,
        replyRoomId: params.replyRoomId,
        createdAt: now,
        lastNotifiedAt: now,
        expiresAt: params.timeoutMs ? now + params.timeoutMs : undefined,
        status: "pending",
    };
    store.pending.push(approval);
    await saveStore(store);
    return approval;
}
/**
 * Get all pending approvals.
 */
export async function listPendingApprovals() {
    const store = await loadStore();
    return store.pending.filter((p) => p.status === "pending");
}
/**
 * Find a pending approval by target (user ID, username, or room ID).
 */
export async function findPendingApproval(target, type) {
    const store = await loadStore();
    const normalized = target.toLowerCase().replace(/^@/, "");
    return store.pending.find((p) => {
        if (p.status !== "pending")
            return false;
        if (type && p.type !== type)
            return false;
        // Match by ID
        if (p.targetId === target)
            return true;
        if (p.id === target)
            return true;
        // Match by username (case-insensitive)
        if (p.targetUsername?.toLowerCase() === normalized)
            return true;
        // Match by room name for room approvals
        if (p.type === "room" && p.targetName?.toLowerCase() === normalized)
            return true;
        return false;
    }) ?? null;
}
/**
 * Approve a pending request.
 */
export async function approveRequest(target, decidedBy, type) {
    const store = await loadStore();
    const approval = await findPendingApproval(target, type);
    if (!approval)
        return null;
    approval.status = "approved";
    approval.decidedBy = decidedBy;
    approval.decidedAt = Date.now();
    await saveStore(store);
    return approval;
}
/**
 * Deny a pending request.
 */
export async function denyRequest(target, decidedBy, type) {
    const store = await loadStore();
    const approval = await findPendingApproval(target, type);
    if (!approval)
        return null;
    approval.status = "denied";
    approval.decidedBy = decidedBy;
    approval.decidedAt = Date.now();
    await saveStore(store);
    return approval;
}
/**
 * Check if a user/room is already approved (in allowlist).
 */
export async function isApproved(targetId) {
    const store = await loadStore();
    return store.pending.some((p) => p.targetId === targetId && p.status === "approved");
}
/**
 * Get expired approvals and mark them.
 */
export async function processExpiredApprovals() {
    const store = await loadStore();
    const now = Date.now();
    const expired = [];
    for (const approval of store.pending) {
        if (approval.status === "pending" && approval.expiresAt && approval.expiresAt < now) {
            approval.status = "expired";
            expired.push(approval);
        }
    }
    if (expired.length > 0) {
        await saveStore(store);
    }
    return expired;
}
/**
 * Clean up old completed/expired approvals (keep last 100).
 */
export async function cleanupOldApprovals() {
    const store = await loadStore();
    const pending = store.pending.filter((p) => p.status === "pending");
    const completed = store.pending
        .filter((p) => p.status !== "pending")
        .sort((a, b) => (b.decidedAt ?? b.createdAt) - (a.decidedAt ?? a.createdAt))
        .slice(0, 100);
    store.pending = [...pending, ...completed];
    await saveStore(store);
}
/**
 * Update the notification message IDs for an approval.
 * Called after sending notifications to track which messages can receive reactions.
 */
export async function updateApprovalNotifyMessages(approvalId, notifyMessageIds) {
    const store = await loadStore();
    const approval = store.pending.find((p) => p.id === approvalId);
    if (approval) {
        approval.notifyMessageIds = notifyMessageIds;
        await saveStore(store);
    }
}
/**
 * Find a pending approval by notification message ID.
 * Used for reaction-based approval - when a user reacts to a notification message.
 */
export async function findApprovalByMessageId(messageId) {
    const store = await loadStore();
    return store.pending.find((p) => {
        if (p.status !== "pending")
            return false;
        if (!p.notifyMessageIds)
            return false;
        return p.notifyMessageIds.some((m) => m.messageId === messageId);
    }) ?? null;
}
/**
 * Get all notification message IDs for pending approvals.
 * Used to know which messages to watch for reactions.
 */
export async function getAllPendingNotifyMessageIds() {
    const store = await loadStore();
    const messageIds = [];
    for (const approval of store.pending) {
        if (approval.status === "pending" && approval.notifyMessageIds) {
            for (const m of approval.notifyMessageIds) {
                messageIds.push(m.messageId);
            }
        }
    }
    return messageIds;
}
//# sourceMappingURL=approval-queue.js.map