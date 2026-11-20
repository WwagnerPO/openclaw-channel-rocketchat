// DDP connect/login behaviour of RocketChatRealtime against a fake Rocket.Chat server.
// Regression tests for the "stuck at starting Rocket.Chat channel" bug fixed in v0.8.0.
// Run after `npm run build` (imports dist/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { RocketChatRealtime } from "../dist/src/rocketchat/realtime.js";

/** mode: "ok" | "badlogin" | "silent" */
async function startFakeServer(mode) {
  const wss = new WebSocketServer({ port: 0, path: "/websocket" });
  await new Promise((r) => wss.on("listening", r));
  wss.on("connection", (ws) =>
    ws.on("message", (data) => {
      const m = JSON.parse(data.toString());
      if (m.msg === "connect" && mode !== "silent") {
        ws.send(JSON.stringify({ msg: "connected", session: "s1" }));
      }
      if (m.msg === "method" && m.method === "login") {
        if (mode === "ok") ws.send(JSON.stringify({ msg: "result", id: m.id, result: { id: "u1" } }));
        if (mode === "badlogin") {
          ws.send(JSON.stringify({ msg: "result", id: m.id, error: { error: 401, reason: "User not found" } }));
        }
      }
    }),
  );
  return { wss, baseUrl: `http://127.0.0.1:${wss.address().port}` };
}

function client(baseUrl, extra = {}) {
  return new RocketChatRealtime({ baseUrl, userId: "u1", authToken: "t", ...extra });
}

test("connect resolves after DDP connected + successful login", async () => {
  const { wss, baseUrl } = await startFakeServer("ok");
  const rt = client(baseUrl);
  try {
    await rt.connect();
  } finally {
    rt.disconnect();
    wss.close();
  }
});

test("failed login rejects connect with the server reason (no silent hang)", async () => {
  const { wss, baseUrl } = await startFakeServer("badlogin");
  const rt = client(baseUrl);
  try {
    await assert.rejects(rt.connect(), /DDP login failed: User not found/);
  } finally {
    rt.disconnect();
    wss.close();
  }
});

test("silent server: connect rejects after connectTimeoutMs", async () => {
  const { wss, baseUrl } = await startFakeServer("silent");
  const rt = client(baseUrl, { connectTimeoutMs: 300 });
  const t0 = Date.now();
  try {
    await assert.rejects(rt.connect(), /timed out after 0.3s/);
    assert.ok(Date.now() - t0 < 2000, "should time out quickly");
  } finally {
    rt.disconnect();
    wss.close();
  }
});

test("disconnect() during connect aborts it immediately", async () => {
  const { wss, baseUrl } = await startFakeServer("silent");
  const rt = client(baseUrl, { connectTimeoutMs: 10_000 });
  const t0 = Date.now();
  setTimeout(() => rt.disconnect(), 100);
  try {
    await assert.rejects(rt.connect());
    assert.ok(Date.now() - t0 < 2000, "abort should not wait for the timeout");
  } finally {
    wss.close();
  }
});
