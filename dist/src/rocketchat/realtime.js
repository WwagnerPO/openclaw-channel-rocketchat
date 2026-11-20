/**
 * Rocket.Chat Realtime API (DDP/WebSocket) client
 *
 * Rocket.Chat uses DDP (Distributed Data Protocol) over WebSocket for realtime
 * features like message streaming, typing indicators, and presence.
 */
import WebSocket from "ws";
const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;
export class RocketChatRealtime {
    ws = null;
    opts;
    messageId = 0;
    pendingCalls = new Map();
    // Desired room subscriptions survive reconnects.
    desiredRoomIds = new Set();
    // Subscription ids are per-connection; re-created on each reconnect.
    activeSubIdsByRoom = new Map();
    subscriptions = new Map();
    pingInterval = null;
    reconnectTimeout = null;
    isConnected = false;
    shouldReconnect = true;
    reconnectDelayMs = 5_000;
    reconnectMaxDelayMs = 60_000;
    constructor(opts) {
        this.opts = opts;
    }
    getWsUrl() {
        const base = this.opts.baseUrl.replace(/^http/, "ws");
        return `${base}/websocket`;
    }
    nextId() {
        return String(++this.messageId);
    }
    send(msg) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    async connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.getWsUrl();
            this.opts.logger?.debug?.(`Connecting to ${wsUrl}`);
            // Reset per-connection state.
            this.isConnected = false;
            this.activeSubIdsByRoom.clear();
            // Create a new socket.
            this.ws = new WebSocket(wsUrl);
            let settled = false;
            const resolveOnce = () => {
                if (settled)
                    return;
                settled = true;
                resolve();
            };
            const rejectOnce = (err) => {
                if (settled)
                    return;
                settled = true;
                reject(err);
            };
            this.ws.on("open", () => {
                // Send DDP connect message
                this.send({ msg: "connect", version: "1", support: ["1"] });
            });
            // Never hang forever: fail connect() if DDP connect + login don't finish in time.
            const connectTimeoutMs = this.opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
            const connectTimer = setTimeout(() => {
                if (settled)
                    return;
                const err = new Error(`DDP connect/login timed out after ${connectTimeoutMs / 1000}s (${wsUrl})`);
                rejectOnce(err);
                try {
                    this.ws?.terminate();
                }
                catch { /* ignore */ }
            }, connectTimeoutMs);
            connectTimer.unref?.();
            this.ws.on("message", async (data) => {
                let msg;
                try {
                    msg = JSON.parse(data.toString());
                }
                catch (err) {
                    this.opts.logger?.debug?.(`Failed to parse message: ${err}`);
                    return;
                }
                try {
                    await this.handleMessage(msg, () => {
                        clearTimeout(connectTimer);
                        resolveOnce();
                    });
                }
                catch (err) {
                    const e = err instanceof Error ? err : new Error(String(err));
                    if (msg.msg === "connected" && !this.isConnected) {
                        // Login (resume token) failed: surface it instead of hanging.
                        clearTimeout(connectTimer);
                        rejectOnce(new Error(`DDP login failed: ${e.message}`));
                        try {
                            this.ws?.close();
                        }
                        catch { /* ignore */ }
                    }
                    else {
                        this.opts.onError?.(e);
                    }
                }
            });
            this.ws.on("close", (_code, reason) => {
                const reasonStr = reason?.toString();
                // If we never fully connected, fail the connect() call so callers can react.
                if (!this.isConnected) {
                    rejectOnce(new Error(reasonStr || "WebSocket closed before DDP connected"));
                }
                this.isConnected = false;
                this.opts.onDisconnect?.(reasonStr);
                this.stopPing();
                this.rejectAllPending(new Error(reasonStr || "Disconnected"));
                // Clear socket reference.
                this.ws = null;
                if (this.shouldReconnect) {
                    this.scheduleReconnect();
                }
            });
            this.ws.on("error", (err) => {
                this.opts.onError?.(err);
                // If we haven't connected yet, fail connect(); otherwise close handler will schedule reconnect.
                if (!this.isConnected) {
                    rejectOnce(err);
                }
            });
        });
    }
    async handleMessage(msg, onConnected) {
        switch (msg.msg) {
            case "connected":
                this.opts.logger?.debug?.("DDP connected, logging in...");
                await this.login();
                this.isConnected = true;
                // Reset reconnect delay after a successful connection.
                this.reconnectDelayMs = 5_000;
                this.startPing();
                // Re-subscribe to desired rooms after login.
                await this.resubscribeAll().catch((err) => {
                    this.opts.logger?.debug?.(`Resubscribe failed: ${String(err)}`);
                });
                this.opts.onConnect?.();
                onConnected?.();
                break;
            case "result":
                if (msg.id) {
                    const pending = this.pendingCalls.get(msg.id);
                    if (pending) {
                        this.pendingCalls.delete(msg.id);
                        if (msg.error) {
                            pending.reject(new Error(msg.error.message || msg.error.reason || String(msg.error.error ?? JSON.stringify(msg.error))));
                        }
                        else {
                            pending.resolve(msg.result);
                        }
                    }
                }
                break;
            case "changed": {
                if (msg.collection === "stream-room-messages") {
                    const fields = msg.fields;
                    const messages = fields?.args ?? [];
                    for (const m of messages) {
                        // Skip system messages
                        if (m.t)
                            continue;
                        this.opts.onMessage?.(m);
                    }
                    break;
                }
                // Other stream notifications
                if (msg.collection && msg.fields) {
                    const fields = msg.fields;
                    if (fields?.eventName || fields?.args) {
                        this.opts.onNotify?.({
                            collection: msg.collection,
                            eventName: fields.eventName,
                            args: fields.args,
                        });
                    }
                }
                break;
            }
            case "ping":
                this.send({ msg: "pong" });
                break;
            case "pong":
                // Response to our ping, connection is alive
                break;
            case "ready":
                // Subscription is ready
                this.opts.logger?.debug?.(`Subscription ready: ${msg.subs?.join(", ")}`);
                break;
            case "nosub":
                this.opts.logger?.debug?.(`Subscription failed: ${msg.id}`);
                break;
        }
    }
    async login() {
        await this.callMethod("login", [{ resume: this.opts.authToken }]);
    }
    async callMethod(method, params = []) {
        const id = this.nextId();
        return new Promise((resolve, reject) => {
            this.pendingCalls.set(id, { resolve, reject });
            this.send({
                msg: "method",
                method,
                id,
                params,
            });
        });
    }
    async subscribeToRoom(roomId) {
        const trimmed = roomId.trim();
        if (!trimmed)
            return;
        // Always remember desired subscriptions so they survive reconnects.
        this.desiredRoomIds.add(trimmed);
        // If we're not connected yet (or socket isn't open), we'll subscribe on connect.
        if (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN)
            return;
        // Avoid duplicate sub messages for this connection.
        if (this.activeSubIdsByRoom.has(trimmed))
            return;
        const id = this.nextId();
        this.activeSubIdsByRoom.set(trimmed, id);
        this.opts.logger?.debug?.(`Subscribing to room: ${trimmed} with sub id: ${id}`);
        this.send({
            msg: "sub",
            id,
            name: "stream-room-messages",
            params: [trimmed, false],
        });
    }
    async subscribeToRooms(roomIds) {
        for (const roomId of roomIds) {
            await this.subscribeToRoom(roomId);
        }
    }
    async subscribeToUserEvent(eventName) {
        const key = `user:${eventName}`;
        if (this.subscriptions.has(key))
            return;
        const id = this.nextId();
        this.subscriptions.set(key, id);
        this.opts.logger?.debug?.(`Subscribing to user event: ${eventName} with sub id: ${id}`);
        this.send({
            msg: "sub",
            id,
            name: "stream-notify-user",
            params: [eventName, false],
        });
    }
    startPing() {
        this.pingInterval = setInterval(() => {
            this.send({ msg: "ping" });
        }, 25000);
    }
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimeout)
            return;
        const delay = Math.min(this.reconnectDelayMs, this.reconnectMaxDelayMs);
        this.opts.logger?.debug?.(`Scheduling reconnect in ${Math.round(delay / 1000)}s...`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect().catch((err) => {
                // If connect fails, keep retrying (up to 60s cadence).
                this.opts.onError?.(err);
                if (this.shouldReconnect)
                    this.scheduleReconnect();
            });
        }, delay);
        // Backoff to a max of 60s.
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.reconnectMaxDelayMs);
    }
    disconnect() {
        this.shouldReconnect = false;
        this.stopPing();
        this.rejectAllPending(new Error("Disconnected"));
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    rejectAllPending(err) {
        for (const [, pending] of this.pendingCalls) {
            try {
                pending.reject(err);
            }
            catch {
                // ignore
            }
        }
        this.pendingCalls.clear();
    }
    async resubscribeAll() {
        if (!this.isConnected)
            return;
        // Reset per-connection subscription tracking.
        this.activeSubIdsByRoom.clear();
        const rooms = Array.from(this.desiredRoomIds);
        if (rooms.length) {
            this.opts.logger?.debug?.(`Re-subscribing to ${rooms.length} rooms...`);
        }
        for (const rid of rooms) {
            await this.subscribeToRoom(rid);
        }
    }
    get connected() {
        return this.isConnected;
    }
}
//# sourceMappingURL=realtime.js.map