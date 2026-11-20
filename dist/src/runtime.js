/**
 * Runtime context for Rocket.Chat plugin.
 *
 * OpenClaw >= 2026.11 passes a `PluginRuntime` (api.runtime) to plugins.
 * It exposes `config`, `logging`, `channel`, ... — not the CLI `RuntimeEnv`
 * (log/error/exit). Typing it as `RuntimeEnv` hid API drift behind `?.`.
 */
let rocketChatRuntime = null;
export function setRocketChatRuntime(runtime) {
    rocketChatRuntime = runtime;
}
export function getRocketChatRuntime() {
    if (!rocketChatRuntime) {
        throw new Error("[rocketchat] plugin runtime not initialized (register() not called)");
    }
    return rocketChatRuntime;
}
//# sourceMappingURL=runtime.js.map