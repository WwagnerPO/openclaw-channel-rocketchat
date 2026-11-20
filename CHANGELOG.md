# Changelog

## [0.8.1] - 2026-11-20 (WwagnerPO fork)

### Added

- **Reply de-duplication**: identical consecutive reply payloads within the same inbound turn are
  dropped, so the bot no longer posts the same answer twice when a session resumes/finalizes.
  Ported from [cloudrise-network/openclaw-channel-rocketchat#9](https://github.com/cloudrise-network/openclaw-channel-rocketchat/pull/9) by @ggruber4711.
- `RealtimeOpts.connectTimeoutMs` (default 30000) to tune the DDP connect + login timeout.
- Test suite (`npm test`, `node:test`, runs in CI):
  - `realtime-connect`: fake DDP server — successful login, rejected login (reason surfaced),
    silent server (timeout) and abort during connect.
  - `accounts-token`: token resolution order (config > `authTokenFile` > env) and env fallbacks.
  - `reply-dedupe`.

## [0.8.0] - 2026-11-20 (WwagnerPO fork)

Compatibility with OpenClaw 2026.11.6 / Node 24. Based on the upstream branch
`chore/sdk-2026.6-migration` (v0.7.1), which was never released. Tested in production
(OpenClaw 2026.11.6 + self-hosted Rocket.Chat): connects, subscribes, replies to DMs.

### Fixed

- **Runtime typed as `RuntimeEnv`**: `api.runtime` is a `PluginRuntime`. The wrong type hid SDK
  API drift behind `?.` optional calls, so they silently returned `undefined`.
- **`runtime.config.loadConfig()` no longer exists** → `runtime.config.current()`. Previously the
  config fell back to `{}` and outbound sends could not resolve the account.
- **DM routing**: `peer.kind` `"dm"` → `"direct"` (new SDK `ChatType`).
- **DDP `connect()` could hang forever**: a failed resume-token login was swallowed as
  "Failed to parse message" (debug level) and there was no timeout, so the channel stayed at
  `starting Rocket.Chat channel` with no error. Now a failed login rejects `connect()` with the
  server's reason, and connect + login time out after 30 s.
- **Gateway stop/restart stuck in `deactivating`**: abort now interrupts an in-flight `connect()`.
- DDP error messages fall back to `reason` / `error` when `message` is missing.
- Removed SDK subpaths: `plugin-sdk/config-types` → `plugin-sdk/core`;
  `plugin-sdk/channel-message` → `plugin-sdk/channel-outbound`.
- `ChannelAccountSnapshot.authTokenSource` → `tokenSource`; `lastDisconnect.reason` → `lastDisconnect.error`.
- `IncomingMessage.mentions` declared (sent by Rocket.Chat DDP); approver check used `user._id`
  instead of `user.userId`.
- `readSessionUpdatedAt` (deprecated, removed in Jan 2027) → `readSessionUpdatedAtAsync`.
- Duplicate `RocketChatAttachment` export in `src/rocketchat/index.ts`.

### Added

- `authTokenFile` is now actually read (it was declared in the config schema but ignored).
- Environment fallbacks with `OPENCLAW_` prefix: `OPENCLAW_ROCKETCHAT_AUTH_TOKEN`,
  `OPENCLAW_ROCKETCHAT_USER_ID`, `OPENCLAW_ROCKETCHAT_URL` (default account, only when not set in config).
- Monitor logs go through the gateway's `ctx.log` (visible in `journalctl`), including
  `connecting realtime (DDP) to …` and `realtime connect failed: …`.
- CI workflow: typecheck, build, `dist/` up-to-date check, import smoke test, unit tests.

### Changed

- Shipped compiled: `main` and `openclaw.extensions` point to `dist/index.js` (Node 24 does not
  strip types inside `node_modules`). `dist/` is committed so the plugin can be installed from git.
- `build` / `typecheck` scripts and `tsconfig.json`; `openclaw` added as devDependency for types.
- `peerDependencies.openclaw` → `>=2026.11.6`.
- Not published to npm (the `@cloudrise` scope belongs to upstream): install from git tags.
  The npm publish workflow was removed; `auto-release.yml` only creates the tag and GitHub Release.

## [0.7.1] - 2026-06-19

### Changed

- **SDK import migration**: Migrated all imports from the deprecated `openclaw/plugin-sdk` barrel to focused `openclaw/plugin-sdk/<subpath>` entry points, clearing the `OPENCLAW_PLUGIN_SDK_COMPAT_DEPRECATED` warning under OpenClaw 2026.6.8. Also renamed `OpenclawPluginApi`/`OpenclawConfig` to the current `OpenClawPluginApi`/`OpenClawConfig` symbol names.
- **channelConfigs metadata**: Added `channelConfigs.rocketchat` (with `schema`) to `openclaw.plugin.json`, reusing the existing Rocket.Chat config schema. Clears the "channel plugin manifest declares rocketchat without channelConfigs metadata" warning so the config schema and setup surfaces are available before runtime load.


## [0.6.1] - 2026-02-15

### Added

- **Reaction-based approval**: Approve or deny requests by reacting to notification messages
  - ✅ (`:white_check_mark:`) or 👍 (`:thumbsup:`) to approve
  - ❌ (`:x:`) or 👎 (`:thumbsdown:`) to deny
  - Works for both DM and room approval requests
  - Approvers no longer need to type commands — just react!

### Changed

- Approval notification messages now include reaction instructions
- Commands now use `--` prefix (e.g., `--approve`) to avoid Rocket.Chat `/slash` command conflicts

## [0.6.0] - 2026-02-15

> ⚠️ **Beta Features**: The approval flows (owner-approval, per-room ACL) in 0.5.0+ are functional but should be considered beta. Additional testing recommended before production use.

### Added

- **Per-Room User Access Control**: Fine-grained control over who can interact with the bot in each room
  - `rooms.<roomId>.canInteract` — static list of users/roles who can interact
  - `rooms.<roomId>.roomApprovers` — who can approve others for this room
  - `rooms.<roomId>.responseMode` — "always" or "mention-only" for approved users
  - `rooms.<roomId>.onMentionUnauthorized` — "ignore" or "reply" when unauthorized user @mentions bot
- **Room-level commands** for roomApprovers:
  - `room-approve @user` — approve user for current room only
  - `room-deny @user` — remove user from room's approved list
  - `room-list` — list approved users for current room
- **Dynamic room user storage**: `~/.openclaw/credentials/rocketchat-room-users.json`

### Example Config

```yaml
rooms:
  GENERAL:
    responseMode: "mention-only"   # Only respond when @mentioned
    canInteract:                   # Static approved users
      - "role:admin"
      - "@marshal"
    roomApprovers:                 # Who can approve others
      - "role:owner"
      - "role:moderator"
    onMentionUnauthorized: "ignore"
```

## [0.5.0] - 2026-02-15

### Added

- **Channel/Room Approval**: New `groupPolicy: "owner-approval"` for controlling which channels the bot responds in
  - Bot sends "pending approval" message on first message in unapproved channels
  - Approve with `approve room:ROOMID`, deny with `deny room:ROOMID`
  - Separate allowlist for rooms (`groupAllowFrom` config or `rocketchat-rooms-allowFrom.json`)
- **Bootstrapping documentation**: Clear instructions to pre-approve approvers and main channels to avoid lockout

### Fixed

- **Approver bypass**: Approvers are now correctly allowed through both DM and group access gates. Previously, approvers would get stuck in the "pending approval" flow.

## [0.4.0] - 2026-02-15

### Added

- **Owner Channel Approval**: New `dmPolicy: "owner-approval"` mode for in-channel approval flow
  - No CLI needed — approve/deny via Rocket.Chat messages
  - Configure `ownerApproval.notifyChannels` for where to receive requests
  - Configure `ownerApproval.approvers` with usernames or Rocket.Chat roles (`role:admin`, `role:moderator`)
  - Commands: `approve @user`, `deny @user`, `approve room:ID`, `pending`
  - Requester gets notified when approved/denied
- **Rocket.Chat Role Integration**: Approvers can be defined by RC roles (admin, moderator, etc.)

### Example Config

```yaml
channels:
  rocketchat:
    dmPolicy: "owner-approval"
    ownerApproval:
      enabled: true
      notifyChannels:
        - "@admin"
        - "room:APPROVERS"
      approvers:
        - "@marshal"
        - "role:admin"
      notifyOnApprove: true
      notifyOnDeny: true
```

## [0.3.0] - 2026-02-15

### Added

- **DM Pairing support**: Implements OpenClaw's standard pairing flow for DM access control
  - `dmPolicy: "pairing"` - unknown senders get a code, owner approves via `openclaw pairing approve rocketchat <code>`
  - `dmPolicy: "allowlist"` - only pre-configured `allowFrom` users can DM
  - `dmPolicy: "disabled"` - block all DMs
  - `dmPolicy: "open"` (default) - all DMs allowed (Rocket.Chat server auth is the gate)
- **Pairing notifications**: When a user is approved, they receive a confirmation message
- **Full config schema**: Added JSON Schema validation for all config options

### Changed

- `pairing.idLabel` now shows "Rocket.Chat User ID" in CLI output
- Improved logging for pairing requests and access control decisions

## [0.2.0] - 2026-02-15

### ⚠️ Breaking Changes

- **Plugin id changed** from `rocketchat` to `openclaw-channel-rocketchat` to align with OpenClaw's package-derived id convention and fix the "plugin id mismatch" warning spam ([#1](https://github.com/cloudrise-network/openclaw-channel-rocketchat/issues/1))

  **Required config update:**
  ```yaml
  plugins:
    entries:
      openclaw-channel-rocketchat:  # ← was "rocketchat"
        enabled: true
  
  channels:
    rocketchat:  # ← stays the same
      ...
  ```

## [0.1.16] - 2026-02-08

- DM delivery fix: subscribe to all rooms including DMs (removed `open !== false` filter)
- Various stability improvements

## [0.1.0] - 2026-01-31

- Initial OpenClaw release (ported from @cloudrise/clawdbot-channel-rocketchat)
