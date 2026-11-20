# OpenClaw Rocket.Chat Channel Plugin

[![CI](https://github.com/WwagnerPO/openclaw-channel-rocketchat/actions/workflows/ci.yml/badge.svg)](https://github.com/WwagnerPO/openclaw-channel-rocketchat/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Neutral, self-host friendly Rocket.Chat channel plugin for **OpenClaw**.

> ## ⚠️ This is a community fork
>
> Fork of [`cloudrise-network/openclaw-channel-rocketchat`](https://github.com/cloudrise-network/openclaw-channel-rocketchat),
> which has had no npm release since v0.6.1 (Feb 2026). **v0.6.1 does not work on OpenClaw 2026.11.x**
> (`ERR_PACKAGE_PATH_NOT_EXPORTED`, `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, or the channel
> silently hangs at `starting Rocket.Chat channel`).
>
> | | |
> |---|---|
> | Fork version | **0.8.1** |
> | Tested with | OpenClaw **2026.11.6**, Node **24**, Rocket.Chat self-hosted |
> | Install | from git (not published to npm, see [Install](#install)) |
> | Changes vs upstream | see [CHANGELOG.md](CHANGELOG.md#080---2026-11-20-wwagnerpo-fork) |
>
> The package name is kept as `@cloudrise/openclaw-channel-rocketchat` and the plugin id as
> `openclaw-channel-rocketchat`, so existing configs and paths keep working: the fork is a drop-in replacement.

- **Inbound:** Rocket.Chat Realtime (DDP/WebSocket) subscribe to `stream-room-messages`
- **Outbound:** Rocket.Chat REST `chat.postMessage`

> **Note:** OpenClaw uses JSON configuration (`~/.openclaw/openclaw.json`). All examples below use JSON format.

## Upgrade notices

### v0.8.0 (fork) - OpenClaw 2026.11 / Node 24

- Install from git instead of npm (see [Install](#install)); config and plugin id are unchanged.
- Connection failures are now logged (`realtime connect failed: <reason>`) instead of hanging silently.
- The token can live outside `openclaw.json` (`authTokenFile` or `OPENCLAW_ROCKETCHAT_AUTH_TOKEN`).
  If you keep `authToken` in `openclaw.json`, it takes precedence: update it when you regenerate the token.

### v0.3.0 - DM pairing support

Added support for OpenClaw's DM pairing flow. Default behavior unchanged (`dmPolicy: "open"`), but you can now enable `dmPolicy: "pairing"` for per-user approval.

### v0.2.0+ - plugin id change

The plugin id changed from `rocketchat` to `openclaw-channel-rocketchat` to align with OpenClaw's package-derived id convention and eliminate the "plugin id mismatch" warning.

**Update your config** (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "entries": {
      "openclaw-channel-rocketchat": {
        "enabled": true
      }
    }
  },
  "channels": {
    "rocketchat": {
      "...": "stays the same (channel id ≠ plugin id)"
    }
  }
}
```

### Clawdbot → OpenClaw migration

If you were using the old Clawdbot-era package:

- Old: `@cloudrise/clawdbot-channel-rocketchat`
- New: `@cloudrise/openclaw-channel-rocketchat`

## Authors

- Chad (AI assistant running in OpenClaw) - primary implementer
- Marshal Morse - project owner, requirements, infrastructure, and testing
- WwagnerPO - fork maintainer (OpenClaw 2026.11 compatibility, v0.8.0+)

## Quickstart (5-10 minutes)

1) **Create a Rocket.Chat bot user** (or a dedicated user account) and obtain:
   - `userId`
   - `authToken` (treat like a password)

2) **Add the bot user to the rooms** you want it to monitor (channels/private groups). For DMs, ensure users can message the bot.

3) **Install the plugin from git** (see [Install](#install)), then **enable it** in `~/.openclaw/openclaw.json`

```json
{
  "plugins": {
    "entries": {
      "openclaw-channel-rocketchat": {
        "enabled": true
      }
    }
  },
  "channels": {
    "rocketchat": {
      "baseUrl": "https://chat.example.com",
      "userId": "<ROCKETCHAT_USER_ID>",
      "authToken": "<ROCKETCHAT_AUTH_TOKEN>",
      "replyMode": "auto",
      "rooms": {
        "GENERAL": {
          "requireMention": true
        }
      }
    }
  }
}
```

4) **Restart the gateway**.

5) **Test** by @mentioning the bot in a room it's a member of.

### Example chat commands (reply to a room + model switching)

In Rocket.Chat you can send a normal message, or you can switch the session's model first.

**Switch model, then ask a question**:

Rocket.Chat treats messages starting with `/` as Rocket.Chat slash-commands.
So for model switching, either:

- put the directive *after* an @mention (works on most servers/clients), or
- use the plugin's alternate `--model` / `--<alias>` syntax.

```text
# Option A: use /model after an @mention
@Chad /model qwen3
@Chad write a 5-line summary of our incident in plain English

# Option B: alternate syntax (avoids Rocket.Chat /commands)
@Chad --model qwen3
@Chad write a 5-line summary of our incident in plain English

# Option C: shorthand alias form
@Chad --qwen3
@Chad write a 5-line summary of our incident in plain English
```

**Example output** (with `messages.responsePrefix: "({model}) "` enabled):

```text
(mlx-qwen/mlx-community/Qwen3-14B-4bit) Here's a 5-line summary...
...
```

**Send a one-off message to a specific Rocket.Chat room** (from the gateway host):

```bash
openclaw message send --channel rocketchat --to room:GENERAL --message "Hello from OpenClaw"
```

**Send using a specific model for that one message**:

```bash
openclaw message send --channel rocketchat --to room:GENERAL --message "/model qwen3 Hello from Qwen3"
```

---

## Install

### Install from git (this fork)

The npm package `@cloudrise/openclaw-channel-rocketchat` is the old upstream release (v0.6.1) and
**does not work on OpenClaw 2026.11+**. Install this fork from git instead. `dist/` is committed, so
nothing is compiled on install:

```bash
cd ~/.openclaw/workspace   # wherever OpenClaw resolves plugins from
# Pin a release tag (recommended)
npm install git+https://github.com/WwagnerPO/openclaw-channel-rocketchat.git#v0.8.1
# or follow the main branch
npm install git+https://github.com/WwagnerPO/openclaw-channel-rocketchat.git
```

Check what got installed:

```bash
jq -r '.version, .main' node_modules/@cloudrise/openclaw-channel-rocketchat/package.json
# 0.8.0
# dist/index.js
```

> Node 24 refuses to strip TypeScript types inside `node_modules`, so the plugin must be loaded
> from the compiled `dist/index.js` (which `package.json` already points to).

### Configure OpenClaw to load the plugin

You need to tell OpenClaw to load the installed plugin.

**Option A (recommended): installed in the OpenClaw workspace + enabled**

If you ran `npm install git+…` inside the directory OpenClaw resolves plugins from
(e.g. `~/.openclaw/workspace`), enabling the entry is enough:

```json
{
  "plugins": {
    "entries": {
      "openclaw-channel-rocketchat": {
        "enabled": true
      }
    }
  }
}
```

> Do **not** use `plugins.installs` with `"source": "npm", "spec": "@cloudrise/openclaw-channel-rocketchat"`:
> that pulls the old upstream v0.6.1 from npm, which is broken on OpenClaw 2026.11+.

**Option B: load from a local path**

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/absolute/path/to/node_modules/@cloudrise/openclaw-channel-rocketchat"
      ]
    },
    "entries": {
      "openclaw-channel-rocketchat": {
        "enabled": true
      }
    }
  }
}
```

Then restart the gateway.

## Features

- **Inbound attachments**: receives images, PDFs/documents, and audio; forwards them to OpenClaw for vision/document understanding and transcription.
- **Outbound attachments**: can send local file paths as real Rocket.Chat uploads (inline previews when supported).
- **Reactions**: can react to messages with emoji (via `chat.react`).

- **File attachments**: receives images, PDFs, documents, audio uploaded to Rocket.Chat and passes them to the vision model.
- **Model prefix**: honors `messages.responsePrefix` (e.g. `({model}) `) so replies can include the model name.

## Model switching

There are two parts:

1) **Switching models in chat** (temporary, per-session) via `/model ...`
2) **Defining short aliases** like `qwen3` so you don't have to type the full `provider/model`

### Switching models in chat (`/model`)

In any chat where OpenClaw slash-commands are enabled, you can switch the current session's model:

```text
/model
/model list
/model status
/model openai/gpt-5.2
/model qwen3
```

Tip: on Rocket.Chat you'll often be writing something like:

```text
@Chad /model qwen3
@Chad what do you think about ...
```

### Model aliases (shortcuts like `qwen3`)

OpenClaw supports **model aliases** so you can type a short name (like `qwen3`) instead of a full `provider/model` ref.

**Option A: define aliases in config**

Aliases come from `agents.defaults.models.<modelId>.alias`.

```json
{
  "agents": {
    "defaults": {
      "models": {
        "mlx-qwen/mlx-community/qwen3-14b-4bit": {
          "alias": "qwen3"
        }
      }
    }
  }
}
```

**Option B: use the CLI**

```bash
openclaw models aliases add qwen3 mlx-qwen/mlx-community/Qwen3-14B-4bit
openclaw models aliases list
```

Notes:
- Model refs are normalized to lowercase.
- If you define the same alias in config and via CLI, your config value wins.

## Configuration

> Use the room **rid** (e.g. `GENERAL`) for per-room settings.

### Minimal (single account)

```json
{
  "channels": {
    "rocketchat": {
      "baseUrl": "https://chat.example.com",
      "userId": "<ROCKETCHAT_USER_ID>",
      "authToken": "<ROCKETCHAT_AUTH_TOKEN>"
    }
  }
}
```

### Keeping the token out of `openclaw.json` (recommended)

The token is resolved in this order (first match wins):

1. `channels.rocketchat.authToken` in `openclaw.json`
2. `channels.rocketchat.authTokenFile`: path to a file containing only the token (e.g. `chmod 600`)
3. Environment (default account only): `ROCKETCHAT_AUTH_TOKEN` or `OPENCLAW_ROCKETCHAT_AUTH_TOKEN`

`userId` and `baseUrl` also fall back to `ROCKETCHAT_USER_ID` / `OPENCLAW_ROCKETCHAT_USER_ID` and
`ROCKETCHAT_URL` / `OPENCLAW_ROCKETCHAT_URL`.

> ⚠️ If `authToken` is present in `openclaw.json` it **always wins**. A stale token left there
> after you regenerate it is the most common cause of `DDP login failed: User not found [401]`.

Example with systemd (gateway running as a user service):

```ini
# ~/.config/systemd/user/openclaw-gateway.service.d/secrets-env.conf
[Service]
EnvironmentFile=/root/.openclaw/secrets.env
```

```bash
# /root/.openclaw/secrets.env  (chmod 600)
OPENCLAW_ROCKETCHAT_AUTH_TOKEN=<token>
```

and remove `authToken` from the config:

```bash
jq 'del(.channels.rocketchat.authToken)' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json
```

### Multiple accounts / multiple Rocket.Chat servers

You can configure multiple Rocket.Chat "accounts" under `channels.rocketchat.accounts` and choose which one to use via `accountId` when sending.

```json
{
  "channels": {
    "rocketchat": {
      "accounts": {
        "prod": {
          "name": "Prod RC",
          "baseUrl": "https://chat.example.com",
          "userId": "<PROD_USER_ID>",
          "authToken": "<PROD_AUTH_TOKEN>"
        },
        "staging": {
          "name": "Staging RC",
          "baseUrl": "https://chat-staging.example.com",
          "userId": "<STAGING_USER_ID>",
          "authToken": "<STAGING_AUTH_TOKEN>"
        }
      }
    }
  }
}
```

Notes:
- The legacy single-account format (top-level `baseUrl/userId/authToken`) still works and is treated as `accountId: default`.
- Per-room settings live under each account (e.g. `channels.rocketchat.accounts.prod.rooms`).

### Reply routing (thread vs channel)

```json
{
  "channels": {
    "rocketchat": {
      "replyMode": "auto",
      "rooms": {
        "GENERAL": {
          "requireMention": false,
          "replyMode": "channel"
        }
      }
    }
  }
}
```

Options for `replyMode`: `"thread"` | `"channel"` | `"auto"`

**Auto rules** (deterministic):
- If the inbound message is already in a thread (`tmid` exists) → reply in that thread
- Else if the inbound message is "long" (≥280 chars or contains a newline) → reply in a thread
- Else → reply in channel

### Per-message overrides

Prefix your message:
- `!thread ...` → force the reply to be posted as a thread reply
- `!channel ...` → force the reply to be posted in the channel

(The prefix is stripped before the message is sent to the agent.)

### Typing indicator

```json
{
  "channels": {
    "rocketchat": {
      "typingDelayMs": 500
    }
  }
}
```

(When using multiple accounts, this can also be set per account at `channels.rocketchat.accounts.<accountId>.typingDelayMs`.)

Typing indicators are emitted via DDP `stream-notify-room` using `<RID>/user-activity`.
- Channel replies emit typing without `tmid` → shows under channel composer
- Thread replies include `{ tmid: ... }` → shows under thread composer

## Development

```bash
git clone https://github.com/WwagnerPO/openclaw-channel-rocketchat.git
cd openclaw-channel-rocketchat
npm ci --ignore-scripts

npm run typecheck   # tsc against the openclaw version pinned in package-lock (devDependency)
npm run build       # writes dist/ — commit it! CI fails if dist/ is out of date
npm test            # node:test suite (fake DDP server, token resolution, dedupe, approvals)
```

When OpenClaw changes its plugin SDK again, bump the `openclaw` devDependency and run
`npm run typecheck`: the type errors are the migration map.

Local smoke tests (uses env vars; see `.env.example`):

```bash
# REST send
node test-chad.mjs

# Realtime receive
node test-realtime.mjs
```

## Releasing (fork)

This fork is **not published to npm** (the `@cloudrise` scope belongs to upstream). To release:

1. Bump `version` in `package.json` and `openclaw.plugin.json`, add a `CHANGELOG.md` entry.
2. `npm run build` and commit `dist/`.
3. Merge to `main`. `.github/workflows/auto-release.yml` creates the `vX.Y.Z` tag and GitHub Release.
4. Users install with `npm install git+https://github.com/WwagnerPO/openclaw-channel-rocketchat.git#vX.Y.Z`.

Never commit real tokens. Quick scan before pushing:

```bash
grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude=package-lock.json -E "npm_[A-Za-z0-9]+|ghp_[A-Za-z0-9]+|xox[baprs]-|authToken\s*[:=]\s*\"[A-Za-z0-9_-]{20,}" .
```

## DM Access Control

The plugin supports multiple DM access control modes, including a unique **Owner Channel Approval** flow.

### DM Policies

```json
{
  "channels": {
    "rocketchat": {
      "dmPolicy": "owner-approval"
    }
  }
}
```

Options: `"open"` | `"owner-approval"` | `"pairing"` | `"allowlist"` | `"disabled"`

| Policy | Behavior |
|--------|----------|
| `open` | **(Default)** All DMs allowed. Rocket.Chat server-level auth is the only gate. |
| `owner-approval` | **🆕** Unknown senders trigger approval request to owner channel. No CLI needed! |
| `pairing` | Unknown senders get a pairing code. Owner approves via CLI. |
| `allowlist` | Only users in `allowFrom` can DM. Others are silently blocked. |
| `disabled` | All DMs blocked. |

---

### Owner Channel Approval (Recommended)

Approve or deny users **directly in Rocket.Chat** - no CLI needed!

```json
{
  "channels": {
    "rocketchat": {
      "dmPolicy": "owner-approval",
      "ownerApproval": {
        "enabled": true,
        "notifyChannels": [
          "@admin",
          "room:APPROVERS"
        ],
        "approvers": [
          "@marshal",
          "role:admin",
          "role:moderator"
        ],
        "notifyOnApprove": true,
        "notifyOnDeny": true,
        "timeout": 3600,
        "onTimeout": "pending"
      }
    }
  }
}
```

**Flow:**
1. Unknown user sends a DM
2. Bot notifies owner channel: `"🔔 New DM request from @user123"`
3. Owner replies: `approve @user123` or `deny @user123`
4. Requester gets notified: `"✅ You've been approved!"`
5. Future messages are processed normally

**Commands (in owner channel or DM to bot):**
```
approve @user123           # approve a user
deny @user123              # deny a user
approve room:GENERAL       # approve a room
pending                    # list pending requests
```

---

### Channel/Room Approval (groupPolicy)

Control which channels the bot responds in:

```json
{
  "channels": {
    "rocketchat": {
      "groupPolicy": "owner-approval"
    }
  }
}
```

Options: `"open"` | `"owner-approval"` | `"allowlist"` | `"disabled"`

| Policy | Behavior |
|--------|----------|
| `open` | **(Default)** Bot responds in any channel it's added to. |
| `owner-approval` | Bot sends "pending approval" on first message in new channels. |
| `allowlist` | Only channels in `groupAllowFrom` receive responses. |
| `disabled` | Bot ignores all channel messages. |

**With `groupPolicy: "owner-approval"`:**
- When invited to a new channel, first message triggers approval request
- Approvers receive: `"🔔 Bot invited to #channel-name by @user"`
- Approve with: `approve room:ROOMID`

---

### 🔑 Auto-Approval (Important!)

**Approvers and notify channels are automatically allowed through access gates** - no manual pre-approval needed!

| `ownerApproval` Entry | DM Gate | Channel/Group Gate |
|-----------------------|---------|-------------------|
| `approvers: ["@user"]` | ✅ Auto-allowed | ✅ Auto-allowed (in any room) |
| `notifyChannels: ["room:ID"]` | N/A | ✅ Auto-allowed |

**Minimal recommended config (no lockout risk):**

```json
{
  "channels": {
    "rocketchat": {
      "dmPolicy": "owner-approval",
      "groupPolicy": "owner-approval",
      "ownerApproval": {
        "enabled": true,
        "approvers": ["@yourusername"],
        "notifyChannels": ["room:YOUR_MAIN_ROOM_ID"],
        "notifyOnApprove": true,
        "notifyOnDeny": true
      }
    }
  }
}
```

That's it! With this config:
- ✅ You can DM the bot (you're an approver)
- ✅ Your main room works (it's a notify channel)
- ✅ Approval commands work in your main room
- 🔒 Everyone else needs approval

---

### Manual Pre-Approval (Optional)

If you need to pre-approve additional users or rooms that aren't approvers/notifyChannels:

**In config:**
```json
{
  "channels": {
    "rocketchat": {
      "allowFrom": ["@alice", "@bob"],
      "groupAllowFrom": ["room:GENERAL", "#support"]
    }
  }
}
```

**Or via files:**
```bash
# Pre-approve DM users
echo '{"version":1,"entries":["alice","bob"]}' > ~/.openclaw/credentials/rocketchat-allowFrom.json

# Pre-approve rooms
echo '{"version":1,"entries":["GENERAL"]}' > ~/.openclaw/credentials/rocketchat-rooms-allowFrom.json
```

---

### Per-Room User Access Control

Control which users can interact with the bot **within each approved room**:

```json
{
  "channels": {
    "rocketchat": {
      "rooms": {
        "GENERAL": {
          "responseMode": "mention-only",
          "canInteract": ["@alice", "@bob", "role:admin", "role:moderator"],
          "roomApprovers": ["role:owner", "role:moderator", "@marshal"],
          "onMentionUnauthorized": "ignore"
        },
        "SUPPORT": {
          "responseMode": "always"
        }
      }
    }
  }
}
```

Options for `responseMode`: `"mention-only"` | `"always"` (default)
Options for `onMentionUnauthorized`: `"ignore"` | `"reply"`

**Room-level commands** (usable by `roomApprovers`):
```
room-approve @alice     # Approve alice for THIS room only
room-deny @alice        # Remove alice from this room's approved list
room-list               # Show who's approved in this room
```

**How it works:**
1. Room gets global approval (via `groupPolicy`)
2. Per-room user check: is sender in `canInteract`, `roomApprovers`, or dynamically approved?
3. If not approved:
   - Silent ignore (unless `onMentionUnauthorized: "reply"`)
4. If approved:
   - Check `responseMode` - respond always or only when @mentioned

**Storage:** `~/.openclaw/credentials/rocketchat-room-users.json`

**Note:** Global approvers (`ownerApproval.approvers`) can interact in ANY room, regardless of per-room settings.

---

### CLI-Based Pairing

If you prefer CLI-based approval:

```json
{
  "channels": {
    "rocketchat": {
      "dmPolicy": "pairing",
      "allowFrom": ["@admin"]
    }
  }
}
```

**Flow:**
1. Unknown user sends a DM
2. Bot replies with a pairing code: `"Pairing required. Code: ABC12345"`
3. Owner approves via CLI:
   ```bash
   openclaw pairing list rocketchat
   openclaw pairing approve rocketchat ABC12345
   ```
4. User is added to allowlist

---

### Why is the default "open"?

Unlike public platforms (Telegram, WhatsApp, Signal), Rocket.Chat is typically:
- Self-hosted with authenticated users
- Behind organizational access controls
- Already requires user accounts to message

So **server-level authentication acts as the primary gate**. Use `owner-approval` or `pairing` if you need per-user approval on top of that.

## Troubleshooting (OpenClaw 2026.11+)

Plugin logs show up in the gateway journal:

```bash
journalctl --user -u openclaw-gateway.service -f | grep -iE "rocket|ddp|realtime"
```

A healthy start looks like:

```
[rocketchat] [default] starting Rocket.Chat channel
[rocketchat] [default] connecting realtime (DDP) to http://chat.example.com as userId=...
[rocketchat] [default] Connected to Rocket.Chat realtime
[rocketchat] [default] Refresh subscriptions: subscribing to N rooms
```

| Symptom | Cause | Fix |
|---|---|---|
| `ERR_PACKAGE_PATH_NOT_EXPORTED ... './plugin-sdk'` | upstream v0.6.1 imports the removed SDK barrel | install this fork |
| `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` | raw `.ts` loaded from `node_modules` on Node 24 | install this fork (loads `dist/index.js`) |
| Stuck at `starting Rocket.Chat channel`, no error (≤ v0.7.x) | DDP login failure was swallowed and `connect()` never resolved | v0.8.0 logs the reason and times out after 30 s |
| `realtime connect failed: DDP login failed: User not found [401]` | wrong/old token (often a stale `authToken` in `openclaw.json`) | see [Keeping the token out of openclaw.json](#keeping-the-token-out-of-openclawjson-recommended) |
| `realtime connect failed: DDP connect/login timed out after 30s` | Rocket.Chat unreachable or websocket blocked by a proxy | check `baseUrl`, and that `ws(s)://<host>/websocket` is reachable |
| Gateway stuck in `deactivating (stop-sigterm)` on restart (≤ v0.7.x) | channel did not honour abort while connecting | fixed in v0.8.0; for a stuck process: `systemctl --user kill -s SIGKILL openclaw-gateway.service` |

Verify the token outside OpenClaw (should print `{"ok":"<userId>"}`):

```bash
node -e '
const WS=require("ws");const ws=new WS("ws://chat.example.com/websocket");
ws.on("open",()=>ws.send(JSON.stringify({msg:"connect",version:"1",support:["1"]})));
ws.on("message",d=>{const m=JSON.parse(d);if(m.msg==="ping")return ws.send("{\"msg\":\"pong\"}");
if(m.msg==="connected")ws.send(JSON.stringify({msg:"method",method:"login",id:"1",params:[{resume:process.env.ROCKETCHAT_AUTH_TOKEN}]}));
if(m.msg==="result"){console.log(JSON.stringify(m.error||{ok:m.result.id}));process.exit(0)}});
setTimeout(()=>{console.log("timeout");process.exit(1)},10000)'
```

## Troubleshooting (Upgrades from Early Versions)

If you're upgrading from Clawdbot or early OpenClaw versions, here are common issues:

### Plugin ID Mismatch / Duplicate Plugin Warning

**Symptom:** `plugin msteams: duplicate plugin id detected` or similar warnings.

**Cause:** The plugin ID changed from `rocketchat` to `openclaw-channel-rocketchat` in v0.2.0+.

**Fix:** Update your config to use the new plugin ID:

```json
{
  "plugins": {
    "entries": {
      "openclaw-channel-rocketchat": {
        "enabled": true
      }
    }
  }
}
```

### Broken Symlinks in Extensions

**Symptom:** Plugin fails to load, errors about missing files.

**Cause:** Old installs may have symlinks pointing to `.clawdbot/` paths that no longer exist.

**Fix:** Check for and remove broken symlinks:

```bash
# Check for broken symlinks
ls -la ~/.openclaw/extensions/

# Remove broken symlink
rm ~/.openclaw/extensions/rocketchat  # if it's a broken symlink

# Reinstall the plugin
openclaw doctor --fix
# or manually:
# (fork) install from git, see "Install from git" above
cd ~/.openclaw/workspace && npm install git+https://github.com/WwagnerPO/openclaw-channel-rocketchat.git#v0.8.1
```

### Config File Location Changed

**Symptom:** Config changes don't take effect.

**Cause:** OpenClaw uses `~/.openclaw/openclaw.json` (JSON), not `config.yaml`.

**Fix:** 
- Edit `~/.openclaw/openclaw.json` (not `config.yaml`)
- Ensure valid JSON syntax (use `jq . ~/.openclaw/openclaw.json` to validate)
- Restart gateway: `openclaw gateway restart`

### Sessions Using Wrong Model After Config Change

**Symptom:** Bot replies show old model in `({model})` prefix even after changing config.

**Cause:** Sessions cache the model they were created with.

**Fix:** Clear session model cache:

```bash
# View current sessions
cat ~/.openclaw/agents/main/sessions/sessions.json | jq 'to_entries[] | {key: .key, model: .value.model}'

# Clear all session model overrides
node -e "
const fs = require('fs');
const path = process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json';
const sessions = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const key of Object.keys(sessions)) {
  delete sessions[key].model;
}
fs.writeFileSync(path, JSON.stringify(sessions, null, 2));
console.log('Cleared model overrides from all sessions');
"

# Restart gateway
openclaw gateway restart
```

### Old Gateway Process Still Running

**Symptom:** Config changes don't take effect, or "port already in use" errors.

**Cause:** An old gateway process is still running.

**Fix:**

```bash
# Check for running gateway processes
pgrep -f 'openclaw.*gateway'

# Kill all gateway processes
pkill -f 'openclaw.*gateway'

# Start fresh
openclaw gateway start
```

### Auth Token Invalid After Migration

**Symptom:** `auto-restart attempt X/10` in logs, channel shows "configured" but doesn't connect.

**Cause:** Rocket.Chat auth tokens may have expired or been revoked.

**Fix:** Generate a new personal access token in Rocket.Chat:
1. Log in to Rocket.Chat as the bot user
2. Go to **My Account → Personal Access Tokens**
3. Generate a new token
4. Update the token **wherever it is resolved from** (`openclaw.json`, `authTokenFile` or the
   environment). Remember `authToken` in `openclaw.json` takes precedence over the environment:

```json
{
  "channels": {
    "rocketchat": {
      "authToken": "<NEW_TOKEN>"
    }
  }
}
```

### nvm / Node Version Issues (macOS)

**Symptom:** `openclaw` command not found, or wrong Node version.

**Cause:** nvm doesn't automatically load in non-interactive shells.

**Fix:** Source nvm before running openclaw:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && openclaw gateway restart
```

Or add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### Backup Files (.bak) Causing Confusion

**Symptom:** Unsure which config is active.

**Cause:** OpenClaw creates `.bak` files when configs change.

**Fix:** The active config is always `~/.openclaw/openclaw.json`. Backup files (`.bak`, `.bak.1`, etc.) are for recovery only:

```bash
# List all config files
ls -la ~/.openclaw/*.json*

# View active config
cat ~/.openclaw/openclaw.json | jq .
```

## Security

Treat Rocket.Chat `authToken` like a password.

This repository is intended to be publishable (no secrets committed).

## License

MIT