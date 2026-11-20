/**
 * Runtime context for Rocket.Chat plugin.
 *
 * OpenClaw >= 2026.11 passes a `PluginRuntime` (api.runtime) to plugins.
 * It exposes `config`, `logging`, `channel`, ... — not the CLI `RuntimeEnv`
 * (log/error/exit). Typing it as `RuntimeEnv` hid API drift behind `?.`.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk/core";

let rocketChatRuntime: PluginRuntime | null = null;

export function setRocketChatRuntime(runtime: PluginRuntime): void {
  rocketChatRuntime = runtime;
}

export function getRocketChatRuntime(): PluginRuntime {
  if (!rocketChatRuntime) {
    throw new Error("[rocketchat] plugin runtime not initialized (register() not called)");
  }
  return rocketChatRuntime;
}
