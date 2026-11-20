// Token / userId / baseUrl resolution order for the default account.
// config.authToken > config.authTokenFile > env (ROCKETCHAT_* or OPENCLAW_ROCKETCHAT_*).
// Run after `npm run build` (imports dist/).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRocketChatAccount } from "../dist/src/rocketchat/accounts.js";

const ENV_KEYS = [
  "ROCKETCHAT_AUTH_TOKEN", "OPENCLAW_ROCKETCHAT_AUTH_TOKEN",
  "ROCKETCHAT_USER_ID", "OPENCLAW_ROCKETCHAT_USER_ID",
  "ROCKETCHAT_URL", "OPENCLAW_ROCKETCHAT_URL",
];
beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

const dir = mkdtempSync(join(tmpdir(), "rc-token-"));
const tokenFile = join(dir, "token");
writeFileSync(tokenFile, "file-token\n");

const cfg = (rc) => ({ channels: { rocketchat: { baseUrl: "http://rc.local", userId: "u1", ...rc } } });

test("authToken in config wins over file and env", () => {
  process.env.OPENCLAW_ROCKETCHAT_AUTH_TOKEN = "env-token";
  const a = resolveRocketChatAccount({ cfg: cfg({ authToken: "cfg-token", authTokenFile: tokenFile }) });
  assert.equal(a.authToken, "cfg-token");
  assert.equal(a.authTokenSource, "config");
});

test("authTokenFile is read (trimmed) when no authToken", () => {
  process.env.OPENCLAW_ROCKETCHAT_AUTH_TOKEN = "env-token";
  const a = resolveRocketChatAccount({ cfg: cfg({ authTokenFile: tokenFile }) });
  assert.equal(a.authToken, "file-token");
  assert.equal(a.authTokenSource, "file");
});

test("OPENCLAW_ROCKETCHAT_AUTH_TOKEN is used when nothing in config", () => {
  process.env.OPENCLAW_ROCKETCHAT_AUTH_TOKEN = "env-token";
  const a = resolveRocketChatAccount({ cfg: cfg({}) });
  assert.equal(a.authToken, "env-token");
  assert.equal(a.authTokenSource, "env");
});

test("ROCKETCHAT_AUTH_TOKEN takes precedence over the OPENCLAW_ variant", () => {
  process.env.ROCKETCHAT_AUTH_TOKEN = "plain";
  process.env.OPENCLAW_ROCKETCHAT_AUTH_TOKEN = "prefixed";
  assert.equal(resolveRocketChatAccount({ cfg: cfg({}) }).authToken, "plain");
});

test("unreadable authTokenFile falls back to env instead of throwing", () => {
  process.env.OPENCLAW_ROCKETCHAT_AUTH_TOKEN = "env-token";
  const a = resolveRocketChatAccount({ cfg: cfg({ authTokenFile: join(dir, "missing") }) });
  assert.equal(a.authToken, "env-token");
});

test("no token anywhere -> source none", () => {
  const a = resolveRocketChatAccount({ cfg: cfg({}) });
  assert.equal(a.authToken, undefined);
  assert.equal(a.authTokenSource, "none");
});

test("userId and baseUrl fall back to OPENCLAW_ env vars", () => {
  process.env.OPENCLAW_ROCKETCHAT_USER_ID = "env-user";
  process.env.OPENCLAW_ROCKETCHAT_URL = "http://env.local";
  const a = resolveRocketChatAccount({ cfg: { channels: { rocketchat: {} } } });
  assert.equal(a.userId, "env-user");
  assert.equal(a.baseUrl, "http://env.local");
});
