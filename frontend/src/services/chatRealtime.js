import { api, token } from "./api";
import { wsClient } from "./ws";

const subbedGroups = new Set();
const subbedDirect = new Set();
let syncPromise = null;

export function ensureGroupSubscribed(groupId) {
    const gid = Number(groupId || 0);
    if (!gid) return;
    subbedGroups.add(gid);
    wsClient.subscribe("group", gid);
}

export function ensureDirectSubscribed(chatId) {
    const cid = Number(chatId || 0);
    if (!cid) return;
    subbedDirect.add(cid);
    wsClient.subscribe("direct", cid);
}

export async function syncAllChatSubscriptions() {
    if (!token()) return;
    wsClient.ensureConnected();
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
        try {
            const [groups, directs] = await Promise.all([
                api("/api/v1/groups/my", { auth: true }).catch(() => []),
                api("/api/v1/direct-chats", { auth: true }).catch(() => []),
            ]);
            for (const g of Array.isArray(groups) ? groups : []) {
                ensureGroupSubscribed(g.id);
            }
            for (const c of Array.isArray(directs) ? directs : []) {
                ensureDirectSubscribed(c.id);
            }
        } catch {
            // ignore
        } finally {
            syncPromise = null;
        }
    })();

    return syncPromise;
}

export function resubscribeAllChats() {
    for (const gid of subbedGroups) {
        wsClient.subscribe("group", gid);
    }
    for (const cid of subbedDirect) {
        wsClient.subscribe("direct", cid);
    }
}

export function resetChatSubscriptionCache() {
    subbedGroups.clear();
    subbedDirect.clear();
}

export function initChatRealtime() {
    if (!token()) {
        resetChatSubscriptionCache();
        return () => {};
    }

    wsClient.ensureConnected();
    syncAllChatSubscriptions();

    const offConnect = wsClient.onConnect(() => {
        resubscribeAllChats();
        syncAllChatSubscriptions();
    });

    return () => {
        offConnect();
    };
}
