/**
 * Rocket.Chat account resolution
 */
import { readFileSync } from "node:fs";
const DEFAULT_ACCOUNT_ID = "default";
function getRocketChatConfig(cfg) {
    return cfg.channels?.rocketchat;
}
export function listRocketChatAccountIds(cfg) {
    const rc = getRocketChatConfig(cfg);
    if (!rc)
        return [];
    const accounts = rc.accounts;
    if (accounts && typeof accounts === "object") {
        return Object.keys(accounts);
    }
    // Check for top-level config (legacy/default account)
    if (rc.baseUrl || rc.userId || rc.authToken) {
        return [DEFAULT_ACCOUNT_ID];
    }
    return [];
}
export function resolveDefaultRocketChatAccountId(cfg) {
    const ids = listRocketChatAccountIds(cfg);
    return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
export function resolveRocketChatAccount(opts) {
    const { cfg, accountId: rawAccountId } = opts;
    const accountId = rawAccountId?.trim() || resolveDefaultRocketChatAccountId(cfg);
    const rc = getRocketChatConfig(cfg) ?? {};
    const accounts = rc.accounts;
    const accountConfig = accounts?.[accountId];
    // Check for top-level config (default account)
    const isDefaultPath = accountId === DEFAULT_ACCOUNT_ID && !accountConfig;
    const config = accountConfig ?? (isDefaultPath ? rc : {});
    // Resolve auth token from config, env, or file
    let authToken = config.authToken;
    let authTokenSource = "none";
    if (authToken) {
        authTokenSource = "config";
    }
    else if (config.authTokenFile) {
        // Token stored in a file (e.g. chmod 600), keeps secrets out of openclaw.json.
        try {
            const fileToken = readFileSync(String(config.authTokenFile), "utf8").trim();
            if (fileToken) {
                authToken = fileToken;
                authTokenSource = "file";
            }
        }
        catch (err) {
            console.warn(`[rocketchat] cannot read authTokenFile "${config.authTokenFile}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    if (!authToken && accountId === DEFAULT_ACCOUNT_ID) {
        const envToken = process.env.ROCKETCHAT_AUTH_TOKEN || process.env.OPENCLAW_ROCKETCHAT_AUTH_TOKEN;
        if (envToken) {
            authToken = envToken;
            authTokenSource = "env";
        }
    }
    // Resolve user ID from config or env
    let userId = config.userId;
    if (!userId && accountId === DEFAULT_ACCOUNT_ID) {
        userId = process.env.ROCKETCHAT_USER_ID || process.env.OPENCLAW_ROCKETCHAT_USER_ID;
    }
    // Resolve base URL from config or env
    let baseUrl = config.baseUrl;
    if (!baseUrl && accountId === DEFAULT_ACCOUNT_ID) {
        baseUrl = process.env.ROCKETCHAT_URL || process.env.OPENCLAW_ROCKETCHAT_URL;
    }
    return {
        accountId,
        name: config.name,
        enabled: config.enabled !== false,
        baseUrl,
        userId,
        authToken,
        authTokenSource,
        config,
    };
}
//# sourceMappingURL=accounts.js.map