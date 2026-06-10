import { useEffect, useMemo, useRef, useState } from "react";
import { api, token } from "../services/api";
import { wsClient } from "../services/ws";
import { normalizePhoto as normalizeAvatarPhoto } from "../utils/doctorPhoto";

function parseJwt(t) {
    try {
        const base = t.split(".")[1];
        const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
        return null;
    }
}

export default function Groups() {
    const t = token();
    const payload = parseJwt(t || "") || {};
    const role = (payload?.role || "").toLowerCase();
    const myUserId = Number(payload?.user_id || payload?.id || 0);
    const directChatsStorageKey = `groups_direct_chats_${myUserId || "guest"}`;
    const seenDirectStorageKey = `groups_direct_seen_${myUserId || "guest"}`; // legacy fallback
    const isTherapist = !!payload?.is_therapist;
    const canManage = role === "doctor" || role === "admin" || role === "super_admin";

    const [myGroups, setMyGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState(0);
    const selectedGroupIdRef = useRef(0);
    const [messages, setMessages] = useState([]);
    const [directChats, setDirectChats] = useState([]);
    const [activeDirect, setActiveDirect] = useState(null);
    const [directMessages, setDirectMessages] = useState([]);
    const [directText, setDirectText] = useState("");
    const [unreadByChat, setUnreadByChat] = useState({}); // { [chatId]: number }
    const [toastText, setToastText] = useState("");
    const lastNotifiedUnreadRef = useRef({}); // { [chatId]: number } to avoid repeated toasts
    const wsGroupSubsRef = useRef(new Set());
    const wsDirectSubsRef = useRef(new Set());
    const [members, setMembers] = useState([]);
    const [msgText, setMsgText] = useState("");
    const [status, setStatus] = useState("");
    const [sideTab, setSideTab] = useState("groups"); // "groups" | "direct"

    const [newGroup, setNewGroup] = useState({ name: "", diagnosis_type: "", description: "", photo_url: "" });
    const [newGroupMembers, setNewGroupMembers] = useState([]);
    const [createMemberRole, setCreateMemberRole] = useState("patient");
    const [createMemberUserIds, setCreateMemberUserIds] = useState([]);
    const [createCandidateUsers, setCreateCandidateUsers] = useState([]);
    const [memberForm, setMemberForm] = useState({ user_id: "", role_in_group: "patient" });
    const [candidateUsers, setCandidateUsers] = useState([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [createMembersOpen, setCreateMembersOpen] = useState(false);
    const [groupInfoOpen, setGroupInfoOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsForm, setSettingsForm] = useState({ name: "", diagnosis_type: "", description: "", photo_url: "" });
    const [groupPhotoUploading, setGroupPhotoUploading] = useState(false);
    const seenDirectRef = useRef({});
    const groupMessagesScrollRef = useRef(null);
    const groupMessagesEndRef = useRef(null);
    const directMessagesScrollRef = useRef(null);
    const directMessagesEndRef = useRef(null);
    const initialGroupScrollDoneRef = useRef(false);
    const initialDirectScrollDoneRef = useRef(false);
    const groupAutoScrollOnceRef = useRef(false);
    const directAutoScrollOnceRef = useRef(false);
    const didAutoSelectOnceRef = useRef(false);

    const [peerProfileOpen, setPeerProfileOpen] = useState(false);
    const [peerProfileLoading, setPeerProfileLoading] = useState(false);
    const [peerProfileError, setPeerProfileError] = useState("");
    const [peerProfile, setPeerProfile] = useState(null);

    const peerAvatarReqIdRef = useRef(0);
    const membersRef = useRef([]);
    const sideTabRef = useRef("groups");
    const activeDirectIdRef = useRef(0);
    const myGroupsRef = useRef([]);

    function scrollToBottom(container, end, behavior = "auto") {
        if (!container || !end) return;
        // Run after paint to avoid "jump to top" on first render.
        requestAnimationFrame(() => {
            try {
                end.scrollIntoView({ behavior, block: "end" });
                // Some browsers/layouts need an explicit scrollTop set.
                container.scrollTop = container.scrollHeight;
            } catch {
                // ignore
            }
        });
    }

    useEffect(() => {
        selectedGroupIdRef.current = selectedGroupId;
    }, [selectedGroupId]);

    useEffect(() => {
        sideTabRef.current = sideTab;
    }, [sideTab]);

    useEffect(() => {
        activeDirectIdRef.current = Number(activeDirect?.id || 0);
    }, [activeDirect?.id]);

    function roleLabel(role) {
        const v = (role || "").toLowerCase();
        if (v === "doctor") return "Дәрігер";
        if (v === "admin") return "Админ";
        if (v === "super_admin") return "Сүпер админ";
        if (v === "patient") return "Пациент";
        if (v === "volunteer") return "Волонтёр";
        if (v === "psychologist") return "Психолог";
        if (v === "head_psychologist") return "Бас психолог";
        return role || "—";
    }

    function normalizePhoto(url) {
        return normalizeAvatarPhoto(url);
    }

    function directChatTime(c) {
        const t = Date.parse(c?.last_at || "");
        return Number.isFinite(t) ? t : 0;
    }

    function sortDirectChats(list) {
        return [...(list || [])].sort((a, b) => directChatTime(b) - directChatTime(a));
    }

    function patchDirectChat(list, chatId, patch) {
        const cid = Number(chatId || 0);
        if (!cid) return sortDirectChats(list);
        return sortDirectChats(
            (list || []).map((c) => (Number(c.id) === cid ? { ...c, ...patch } : c))
        );
    }

    function directAvatarSrc(chat) {
        return normalizePhoto(chat?.photo_url || "");
    }

    async function uploadFileToServer(file) {
        if (!file) return "";
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/v1/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${token()}` },
            body: fd,
        });

        const text = await res.text();
        if (!res.ok) throw new Error(text || "Upload failed");

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = {};
        }
        return data.url || "";
    }

    async function openPeerProfile(peerUserId) {
        const id = Number(peerUserId || 0);
        if (!id) return;
        setPeerProfileError("");
        setPeerProfileLoading(true);
        setPeerProfileOpen(true);
        try {
            const data = await api(`/api/v1/users/${id}`, { auth: true });
            setPeerProfile(data || null);
        } catch (e) {
            setPeerProfileError(e.message || "Қате");
        } finally {
            setPeerProfileLoading(false);
        }
    }

    function closePeerProfile() {
        setPeerProfileOpen(false);
        setPeerProfileError("");
        setPeerProfileLoading(false);
    }

    // Direct chat header үшін аватар фотоны әр ашылғанда (қажет болса) жүктейміз.
    useEffect(() => {
        if (!activeDirect?.peer_user_id) return;
        const peerID = Number(activeDirect.peer_user_id);
        if (!peerID) return;

        // Егер фото бар болса, қайта сұрамаймыз.
        if (activeDirect.photo_url) return;

        const reqID = ++peerAvatarReqIdRef.current;
        api(`/api/v1/users/${peerID}`, { auth: true })
            .then((u) => {
                if (!u || reqID !== peerAvatarReqIdRef.current) return;
                setActiveDirect((prev) => {
                    if (!prev || Number(prev.peer_user_id) !== peerID) return prev;
                    return { ...prev, photo_url: u.photo_url || "" };
                });
            })
            .catch(() => {});
    }, [activeDirect?.peer_user_id, activeDirect?.photo_url]);

    const selectedGroup = useMemo(
        () => myGroups.find((g) => g.id === selectedGroupId) || null,
        [myGroups, selectedGroupId]
    );

    const lastOwnGroupMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m?.is_system) continue;
            if (Number(m?.sender_id) === myUserId) return Number(m.id || 0);
        }
        return 0;
    }, [messages, myUserId]);

    const lastOwnDirectMessageId = useMemo(() => {
        for (let i = directMessages.length - 1; i >= 0; i--) {
            const m = directMessages[i];
            if (Number(m?.sender_id) === myUserId) return Number(m.id || 0);
        }
        return 0;
    }, [directMessages, myUserId]);

    function fmtChatWhen(dt) {
        if (!dt) return "";
        try {
            const d = new Date(dt);
            const now = new Date();
            const sameDay = d.toDateString() === now.toDateString();
            if (sameDay) return d.toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
            return d.toLocaleDateString("kk-KZ", { month: "short", day: "2-digit" });
        } catch {
            return "";
        }
    }

    function groupSubtitle(g) {
        const msg = (g.last_message || "").trim();
        if (msg && !msg.startsWith("📎") && msg.length <= 90) return msg;
        if (g.diagnosis_type) return g.diagnosis_type;
        if (g.description) return g.description;
        return "Топтық чат";
    }

    function memberName(userId, fallback = "") {
        const uid = Number(userId || 0);
        if (!uid) return fallback || "Қатысушы";
        const fromList = (membersRef.current || []).find((m) => Number(m.user_id) === uid);
        return (fromList?.full_name || fallback || "").trim() || "Қатысушы";
    }

    function groupPeerReaders(readers) {
        return (Array.isArray(readers) ? readers : [])
            .filter((r) => Number(r.user_id) !== myUserId)
            .map((r) => ({
                ...r,
                full_name: memberName(r.user_id, r.full_name),
            }));
    }

    function isGroupChatOpen(groupId) {
        const gid = Number(groupId || 0);
        if (!gid) return false;
        return Number(activeDirectIdRef.current) === 0 && Number(selectedGroupIdRef.current) === gid;
    }

    function isDirectChatOpen(chatId) {
        const cid = Number(chatId || 0);
        if (!cid) return false;
        return Number(activeDirectIdRef.current) === cid;
    }

    function parseGroupWsPayload(evt) {
        if (evt?.payload && typeof evt.payload === "object") return evt.payload;
        const m = evt?.message;
        if (!m || typeof m !== "object") return null;
        return {
            id: m.id ?? m.ID,
            group_id: m.group_id ?? m.GroupID,
            sender_id: m.sender_id ?? m.SenderID,
            sender_name: m.sender_name ?? m.SenderUser?.FullName ?? m.sender_user?.full_name ?? "",
            body: m.body ?? m.Body ?? "",
            is_system: Boolean(m.is_system ?? m.IsSystem),
            created_at: m.created_at ?? m.CreatedAt,
            readers: Array.isArray(m.readers) ? m.readers : [],
        };
    }

    function parseDirectWsPayload(evt) {
        if (evt?.payload && typeof evt.payload === "object") return evt.payload;
        const m = evt?.message;
        if (!m || typeof m !== "object") return null;
        return {
            id: m.id ?? m.ID,
            sender_id: m.sender_id ?? m.SenderUserID,
            sender_name: m.sender_name ?? m.SenderUser?.FullName ?? "",
            body: m.body ?? m.Body ?? "",
            created_at: m.created_at ?? m.CreatedAt,
        };
    }

    function appendDirectMessage(list, msg) {
        const next = Array.isArray(list) ? [...list] : [];
        const mid = Number(msg?.id || 0);
        if (mid && next.some((m) => Number(m.id) === mid)) return next;
        next.push(msg);
        return next;
    }

    function groupMessagesNeedRefresh(prev, next) {
        if (!Array.isArray(next) || next.length === 0) return false;
        if (!Array.isArray(prev) || prev.length === 0) return true;
        if (prev.length !== next.length) return true;
        for (let i = 0; i < prev.length; i++) {
            if (Number(prev[i]?.id) !== Number(next[i]?.id)) return true;
            if (JSON.stringify(prev[i]?.readers || []) !== JSON.stringify(next[i]?.readers || [])) return true;
        }
        return false;
    }

    function directMessagesNeedRefresh(prev, next) {
        if (!Array.isArray(next) || next.length === 0) return false;
        if (!Array.isArray(prev) || prev.length === 0) return true;
        if (prev.length !== next.length) return true;
        for (let i = 0; i < prev.length; i++) {
            if (Number(prev[i]?.id) !== Number(next[i]?.id)) return true;
            if (Number(prev[i]?.sender_id) === myUserId) {
                if (Boolean(prev[i]?.is_read_by_peer) !== Boolean(next[i]?.is_read_by_peer)) return true;
                if (String(prev[i]?.read_at_by_peer || "") !== String(next[i]?.read_at_by_peer || "")) return true;
            }
        }
        return false;
    }

    function bumpGroupInList(list, groupId, patch) {
        const gid = Number(groupId || 0);
        if (!gid) return list || [];
        let updated = null;
        const rest = [];
        for (const g of list || []) {
            if (Number(g.id) === gid) updated = { ...g, ...patch };
            else rest.push(g);
        }
        if (!updated) return list || [];
        return [updated, ...rest];
    }

    function groupNameById(groupId) {
        const gid = Number(groupId || 0);
        return (myGroupsRef.current || []).find((g) => Number(g.id) === gid)?.name || "Топ";
    }

    function notifyIncomingGroupMessage(groupId, payload, senderId) {
        if (!senderId || senderId === myUserId) return;
        if (isGroupChatOpen(groupId)) return;
        const preview = String(payload?.body || "").trim().slice(0, 80);
        const groupName = groupNameById(groupId);
        const sender = String(payload?.sender_name || "").trim();
        const who = sender ? `${groupName} · ${sender}` : groupName;
        setToastText(`${who}: ${preview || "Жаңа хабарлама"}`);
    }

    function applyGroupReadReceipt(list, readerId, lastMessageId, readAt) {
        const rid = Number(readerId || 0);
        const lastId = Number(lastMessageId || 0);
        if (!rid || !lastId) return list;
        const name = memberName(rid);
        return (Array.isArray(list) ? list : []).map((m) => {
            const mid = Number(m.id || 0);
            if (!mid || mid > lastId) return m;
            const cur = Array.isArray(m.readers) ? m.readers : [];
            const exists = cur.some((x) => Number(x.user_id) === rid);
            const nextReaders = exists
                ? cur.map((x) =>
                      Number(x.user_id) === rid
                          ? { ...x, full_name: name || x.full_name, read_at: readAt || x.read_at }
                          : x
                  )
                : [...cur, { user_id: rid, full_name: name, read_at: readAt, read_by_me: rid === myUserId }];
            return { ...m, readers: nextReaders };
        });
    }

    function appendGroupMessage(list, msg) {
        const next = Array.isArray(list) ? [...list] : [];
        const mid = Number(msg?.id || 0);
        if (mid && next.some((m) => Number(m.id) === mid)) return next;
        next.push(msg);
        return next;
    }

    function resolveReaderName(readerId) {
        const rid = Number(readerId || 0);
        if (!rid) return;
        const known = memberName(rid);
        if (known && known !== "Қатысушы") return;
        api(`/api/v1/users/${rid}`, { auth: true })
            .then((u) => {
                if (!u?.full_name) return;
                setMembers((prev) => {
                    const list = Array.isArray(prev) ? prev : [];
                    if (list.some((m) => Number(m.user_id) === rid)) {
                        return list.map((m) =>
                            Number(m.user_id) === rid ? { ...m, full_name: u.full_name } : m
                        );
                    }
                    return [...list, { user_id: rid, full_name: u.full_name, role: u.role || "" }];
                });
                setMessages((prev) =>
                    (Array.isArray(prev) ? prev : []).map((m) => {
                        const cur = Array.isArray(m.readers) ? m.readers : [];
                        if (!cur.some((x) => Number(x.user_id) === rid)) return m;
                        return {
                            ...m,
                            readers: cur.map((x) =>
                                Number(x.user_id) === rid ? { ...x, full_name: u.full_name } : x
                            ),
                        };
                    })
                );
            })
            .catch(() => {});
    }

    function groupMemberInitials(name) {
        const parts = String(name || "Т").split(/\s+/).filter(Boolean);
        return parts.slice(0, 3).map((p) => (p[0] || "").toUpperCase()).filter(Boolean);
    }

    function readStoredDirectChats() {
        try {
            const raw = localStorage.getItem(directChatsStorageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function writeStoredDirectChats(list) {
        try {
            localStorage.setItem(directChatsStorageKey, JSON.stringify(Array.isArray(list) ? list : []));
        } catch {
            // ignore storage write errors
        }
    }
    function readSeenDirectMap() {
        try {
            const raw = localStorage.getItem(seenDirectStorageKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }
    function writeSeenDirectMap(map) {
        try {
            localStorage.setItem(seenDirectStorageKey, JSON.stringify(map || {}));
        } catch {
            // ignore storage write errors
        }
    }
    const canEditSelected = Boolean(
        selectedGroup && (
            role === "admin" ||
            role === "super_admin" ||
            isTherapist ||
            (role === "doctor" && Number(selectedGroup.created_by) === myUserId)
        )
    );

    useEffect(() => {
        if (!t) return;
        wsClient.ensureConnected();
        const stored = readStoredDirectChats();
        if (stored.length) setDirectChats(sortDirectChats(stored));
        seenDirectRef.current = readSeenDirectMap();
        loadMyGroups();
        loadDirectChats();
        const offConnect = wsClient.onConnect(() => {
            for (const gid of wsGroupSubsRef.current) {
                wsClient.subscribe("group", gid);
            }
            for (const cid of wsDirectSubsRef.current) {
                wsClient.subscribe("direct", cid);
            }
            const openGid = Number(selectedGroupIdRef.current || 0);
            const openDid = Number(activeDirectIdRef.current || 0);
            if (openGid) wsClient.subscribe("group", openGid);
            if (openDid) wsClient.subscribe("direct", openDid);
        });
        return () => offConnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!t) return;
        // WebSocket realtime listeners
        const off = wsClient.on((evt) => {
            if (!evt || !evt.type) return;

            // Group message events
            if (evt.channel === "group") {
                const gid = Number(evt.id || 0);
                if (!gid) return;
                if (evt.type === "message:new") {
                    const p = parseGroupWsPayload(evt);
                    if (!p) return;
                    const senderId = Number(p.sender_id || 0);
                    // If currently viewing this group (and not in direct chat), append; otherwise bump unread in list.
                    if (isGroupChatOpen(gid)) {
                        // mark read immediately if I'm currently in this group chat and message is from someone else
                        if (senderId && senderId !== myUserId) {
                            api(`/api/v1/groups/${gid}/read`, {
                                method: "POST",
                                auth: true,
                                body: { last_message_id: Number(p.id || 0) },
                            }).catch(() => {});
                        }
                        setMessages((prev) =>
                            appendGroupMessage(prev, {
                                id: p.id,
                                group_id: gid,
                                sender_id: senderId,
                                sender_name: p.sender_name,
                                body: p.body,
                                is_system: Boolean(p.is_system),
                                created_at: p.created_at,
                                readers: Array.isArray(p.readers) ? p.readers : [],
                            })
                        );
                        groupAutoScrollOnceRef.current = true;
                        setMyGroups((prev) => (prev || []).map((g) => (
                            Number(g.id) === gid
                                ? { ...g, last_message: p.body || g.last_message || "", unread_count: 0 }
                                : g
                        )));
                    } else {
                        setMyGroups((prev) =>
                            bumpGroupInList(prev, gid, {
                                last_message: p.body || "",
                                last_at: p.created_at || new Date().toISOString(),
                                unread_count:
                                    Number((prev || []).find((g) => Number(g.id) === gid)?.unread_count || 0) +
                                    (senderId && senderId !== myUserId ? 1 : 0),
                            })
                        );
                        notifyIncomingGroupMessage(gid, p, senderId);
                    }
                }
                if (evt.type === "message:read" && evt.payload) {
                    const { reader_user_id, last_message_id, read_at } = evt.payload || {};
                    const rid = Number(reader_user_id || 0);
                    const lastId = Number(last_message_id || 0);
                    if (!rid || !lastId) return;
                    if (Number(selectedGroupIdRef.current) === gid && Number(activeDirectIdRef.current) === 0) {
                        setMessages((prev) => applyGroupReadReceipt(prev, rid, lastId, read_at));
                        resolveReaderName(rid);
                    }
                }
            }

            // Direct chat message events
            if (evt.channel === "direct") {
                const cid = Number(evt.id || 0);
                if (!cid) return;
                if (evt.type === "message:new") {
                    const p = parseDirectWsPayload(evt);
                    if (!p) return;
                    const senderId = Number(p.sender_id || 0);
                    if (isDirectChatOpen(cid)) {
                        // mark read immediately if I'm currently in this chat and message is from peer
                        if (senderId && senderId !== myUserId) {
                            api(`/api/v1/direct-chats/${cid}/read`, {
                                method: "POST",
                                auth: true,
                                body: { last_message_id: Number(p.id || 0) },
                            }).catch(() => {});
                        }
                        setDirectMessages((prev) =>
                            appendDirectMessage(prev, {
                                id: p.id,
                                sender_id: senderId,
                                sender_name: p.sender_name,
                                body: p.body,
                                created_at: p.created_at,
                                is_read_by_peer: false,
                                read_at_by_peer: null,
                            })
                        );
                        directAutoScrollOnceRef.current = true;
                        setUnreadByChat((u) => ({ ...u, [cid]: 0 }));
                        lastNotifiedUnreadRef.current = { ...lastNotifiedUnreadRef.current, [cid]: 0 };
                        setDirectChats((prev) => {
                            const next = patchDirectChat(prev, cid, {
                                last_message: p.body || "",
                                last_at: p.created_at || new Date().toISOString(),
                            });
                            writeStoredDirectChats(next);
                            return next;
                        });
                    } else {
                        // update list + unread
                        setDirectChats((prev) => {
                            const next = patchDirectChat(prev, cid, {
                                last_message: p.body || "",
                                last_at: p.created_at || new Date().toISOString(),
                            });
                            writeStoredDirectChats(next);
                            return next;
                        });
                        setUnreadByChat((u) => {
                            const prevCnt = Number(u[cid] || 0);
                            const nextCnt = prevCnt + (senderId && senderId !== myUserId ? 1 : 0);
                            const prevNotified = Number(lastNotifiedUnreadRef.current[cid] || 0);
                            if (nextCnt > prevNotified) {
                                setToastText(`${p.sender_name || "Қатысушы"}: ${nextCnt} жаңа хабарлама`);
                                lastNotifiedUnreadRef.current = { ...lastNotifiedUnreadRef.current, [cid]: nextCnt };
                            }
                            return { ...u, [cid]: nextCnt };
                        });
                    }
                }
                if (evt.type === "message:read" && evt.payload) {
                    const { reader_user_id, last_message_id, read_at } = evt.payload || {};
                    const rid = Number(reader_user_id || 0);
                    const lastId = Number(last_message_id || 0);
                    if (!rid || !lastId) return;
                    // peer read receipts for active direct chat
                    if (isDirectChatOpen(cid) && rid !== myUserId) {
                        setDirectMessages((prev) =>
                            (Array.isArray(prev) ? prev : []).map((m) => {
                                const mid = Number(m.id || 0);
                                if (!mid || mid > lastId) return m;
                                if (Number(m.sender_id) === myUserId) {
                                    return { ...m, is_read_by_peer: true, read_at_by_peer: read_at || m.read_at_by_peer || new Date().toISOString() };
                                }
                                return m;
                            })
                        );
                    }
                }
            }
        });
        return () => off();
    }, [t, myUserId]);

    useEffect(() => {
        membersRef.current = members;
    }, [members]);

    useEffect(() => {
        myGroupsRef.current = myGroups;
    }, [myGroups]);

    useEffect(() => {
        if (!toastText) return;
        const tmr = setTimeout(() => setToastText(""), 3500);
        return () => clearTimeout(tmr);
    }, [toastText]);

    useEffect(() => {
        if (!myUserId) return;
        writeStoredDirectChats(directChats || []);
    }, [directChats, directChatsStorageKey, myUserId]);

    useEffect(() => {
        if (!selectedGroupId) {
            setMessages([]);
            setMembers([]);
            setGroupInfoOpen(false);
            setSettingsOpen(false);
            return;
        }
        setActiveDirect(null);
        setMessages([]);
        initialGroupScrollDoneRef.current = false;
        groupAutoScrollOnceRef.current = false;
        loadMessages(selectedGroupId);
        loadMembers(selectedGroupId);
        setGroupInfoOpen(false);
        setSettingsOpen(false);
        const gid = Number(selectedGroupId || 0);
        if (gid) {
            wsGroupSubsRef.current.add(gid);
            wsClient.subscribe("group", gid);
        }
    }, [selectedGroupId]);

    // Switch reset: next time we mount/receive messages, scroll to bottom like WhatsApp.
    useEffect(() => {
        initialGroupScrollDoneRef.current = false;
    }, [selectedGroupId, activeDirect?.id]);

    useEffect(() => {
        initialDirectScrollDoneRef.current = false;
    }, [activeDirect?.id]);

    useEffect(() => {
        // Group chat auto-scroll (only when not in direct chat).
        if (activeDirect?.id) return;
        const container = groupMessagesScrollRef.current;
        const end = groupMessagesEndRef.current;
        if (!container || !end) return;

        if (!initialGroupScrollDoneRef.current) {
            scrollToBottom(container, end, "auto");
            initialGroupScrollDoneRef.current = true;
            return;
        }
        if (!groupAutoScrollOnceRef.current) return;
        scrollToBottom(container, end, "smooth");
        groupAutoScrollOnceRef.current = false;
    }, [messages.length, selectedGroupId, activeDirect?.id]);

    useEffect(() => {
        // Direct chat auto-scroll inside groups page.
        if (!activeDirect?.id) return;
        const container = directMessagesScrollRef.current;
        const end = directMessagesEndRef.current;
        if (!container || !end) return;

        if (!initialDirectScrollDoneRef.current) {
            scrollToBottom(container, end, "auto");
            initialDirectScrollDoneRef.current = true;
            return;
        }
        if (!directAutoScrollOnceRef.current) return;
        scrollToBottom(container, end, "smooth");
        directAutoScrollOnceRef.current = false;
    }, [directMessages.length, activeDirect?.id]);

    // No direct-messages polling; WS updates after initial REST load.

    useEffect(() => {
        if (!canManage) return;
        loadCandidates(memberForm.role_in_group);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memberForm.role_in_group, canManage]);

    useEffect(() => {
        if (!canManage || !createMembersOpen) return;
        loadCreateCandidates(createMemberRole);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createMemberRole, canManage, createMembersOpen]);

    async function loadMyGroups() {
        try {
            const data = await api("/api/v1/groups/my", { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setMyGroups(arr);
            // subscribe to groups for realtime
            for (const g of arr) {
                const gid = Number(g.id || 0);
                if (!gid) continue;
                wsGroupSubsRef.current.add(gid);
                wsClient.subscribe("group", gid);
            }
            // Only auto-select the first group ONCE ever.
            // Polling must not reset user's current selection.
            if (!didAutoSelectOnceRef.current && arr.length > 0 && selectedGroupIdRef.current === 0) {
                didAutoSelectOnceRef.current = true;
                setSelectedGroupId(arr[0].id);
            }
        } catch (e) {
            setStatus("Топтарды жүктеу қатесі: " + (e.message || ""));
        }
    }

    async function loadCandidates(roleInGroup) {
        try {
            const data = await api(`/api/v1/groups/candidates?role=${encodeURIComponent(roleInGroup)}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setCandidateUsers(arr);
            if (arr.length > 0 && !arr.some((u) => String(u.id) === String(memberForm.user_id))) {
                setMemberForm((p) => ({ ...p, user_id: String(arr[0].id) }));
            } else if (arr.length === 0) {
                setMemberForm((p) => ({ ...p, user_id: "" }));
            }
        } catch (e) {
            setCandidateUsers([]);
            setStatus("Қатысушы тізімін жүктеу қатесі: " + (e.message || ""));
        }
    }

    async function loadCreateCandidates(roleInGroup) {
        try {
            const data = await api(`/api/v1/groups/candidates?role=${encodeURIComponent(roleInGroup)}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setCreateCandidateUsers(arr);
            setCreateMemberUserIds([]);
        } catch {
            setCreateCandidateUsers([]);
            setCreateMemberUserIds([]);
        }
    }

    async function loadMembers(groupId) {
        try {
            const data = await api(`/api/v1/groups/${groupId}/members`, { auth: true });
            setMembers(Array.isArray(data) ? data : []);
        } catch {
            setMembers([]);
        }
    }

    async function loadDirectChats() {
        try {
            const data = await api(`/api/v1/direct-chats?ts=${Date.now()}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setDirectChats((prev) => {
                // Бекенд уақытша бос/кеш жауап берсе, UI-ды бос қылып жібермейміз.
                const map = new Map();
                for (const c of readStoredDirectChats()) map.set(Number(c.id), c);
                for (const c of prev || []) map.set(Number(c.id), c);
                for (const c of arr || []) map.set(Number(c.id), c);
                let next = Array.from(map.values());
                if (next.length === 0 && prev.length > 0) {
                    next = prev;
                }
                if (activeDirect?.id && !next.some((c) => Number(c.id) === Number(activeDirect.id))) {
                    next = [activeDirect, ...next];
                }
                next = sortDirectChats(next);
                writeStoredDirectChats(next);
                return next;
            });
            setUnreadByChat((prevUnread) => {
                const nextUnread = { ...prevUnread };
                for (const c of arr) {
                    const cid = Number(c.id);
                    const isActive = Number(activeDirect?.id || 0) === cid;
                    const cnt = Number(c.unread_count || 0);
                    nextUnread[cid] = isActive ? 0 : cnt;

                    // Show toast only when unread count increases (new messages),
                    // not on every poll or when switching groups.
                    const prevNotified = Number(lastNotifiedUnreadRef.current[cid] || 0);
                    if (!isActive && cnt > prevNotified) {
                        setToastText(`${c.peer_name || "Қатысушы"}: ${cnt} жаңа хабарлама`);
                        lastNotifiedUnreadRef.current = { ...lastNotifiedUnreadRef.current, [cid]: cnt };
                    }
                    // reset when cleared
                    if (cnt === 0 && prevNotified !== 0) {
                        lastNotifiedUnreadRef.current = { ...lastNotifiedUnreadRef.current, [cid]: 0 };
                    }
                }
                return nextUnread;
            });

            // subscribe to direct conversations for realtime
            for (const c of arr) {
                const cid = Number(c.id || 0);
                if (!cid) continue;
                wsDirectSubsRef.current.add(cid);
                wsClient.subscribe("direct", cid);
            }
        } catch (e) {
            // Ескі серверде endpoint болмауы мүмкін (Not found) — UI-да артық қате көрсетпейміз.
            if (!String(e.message || "").toLowerCase().includes("not found")) {
                setStatus((s) => s || ("Жеке чаттар жүктеу қатесі: " + (e.message || "")));
            }
            const stored = readStoredDirectChats();
            if (stored.length) {
                setDirectChats((prev) => (prev.length ? prev : stored));
            }
        }
    }

    async function loadDirectMessages(chatID) {
        try {
            const data = await api(`/api/v1/direct-chats/${chatID}/messages?ts=${Date.now()}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setDirectMessages(arr);
            requestAnimationFrame(() => {
                const container = directMessagesScrollRef.current;
                const end = directMessagesEndRef.current;
                if (!container || !end) return;
                scrollToBottom(container, end, "auto");
                initialDirectScrollDoneRef.current = true;
            });
            // backend ListMessages already marks as seen
            setUnreadByChat((p) => ({ ...p, [Number(chatID)]: 0 }));
            lastNotifiedUnreadRef.current = { ...lastNotifiedUnreadRef.current, [Number(chatID)]: 0 };
            if (arr.length > 0) {
                const last = arr[arr.length - 1];
                const cid = Number(chatID);
                setDirectChats((prev) => {
                    const next = patchDirectChat(prev, cid, {
                        last_message: last.body || "",
                        last_at: last.created_at || new Date().toISOString(),
                    });
                    writeStoredDirectChats(next);
                    return next;
                });
            }
        } catch {
            setDirectMessages([]);
        }
    }

    async function refreshDirectMessagesQuiet(chatID) {
        try {
            const cid = Number(chatID || 0);
            if (!cid) return;
            const data = await api(`/api/v1/direct-chats/${cid}/messages?ts=${Date.now()}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setDirectMessages((prev) => {
                if (!directMessagesNeedRefresh(prev, arr)) return prev;
                const prevLast = Number(prev[prev.length - 1]?.id || 0);
                const nextLast = Number(arr[arr.length - 1]?.id || 0);
                if (nextLast > prevLast) directAutoScrollOnceRef.current = true;
                return arr;
            });
        } catch {
            /* ignore */
        }
    }

    async function loadMessages(groupId) {
        try {
            const data = await api(`/api/v1/groups/${groupId}/messages?ts=${Date.now()}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setMessages(arr);
            requestAnimationFrame(() => {
                const container = groupMessagesScrollRef.current;
                const end = groupMessagesEndRef.current;
                if (!container || !end) return;
                scrollToBottom(container, end, "auto");
                initialGroupScrollDoneRef.current = true;
            });
            if (arr.length > 0) {
                const last = arr[arr.length - 1];
                const gid = Number(groupId);
                setMyGroups((prev) => (prev || []).map((g) => (
                    Number(g.id) === gid
                        ? { ...g, last_message: last.body || g.last_message || "", unread_count: 0 }
                        : g
                )));
            } else {
                const gid = Number(groupId);
                setMyGroups((prev) => (prev || []).map((g) => (
                    Number(g.id) === gid ? { ...g, unread_count: 0 } : g
                )));
            }
        } catch (e) {
            setMessages([]);
            setStatus("Чат жүктеу қатесі: " + (e.message || ""));
        }
    }

    async function refreshGroupMessagesQuiet(groupId) {
        try {
            const gid = Number(groupId || 0);
            if (!gid) return;
            const data = await api(`/api/v1/groups/${gid}/messages?ts=${Date.now()}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setMessages((prev) => {
                if (!groupMessagesNeedRefresh(prev, arr)) return prev;
                const prevLast = Number(prev[prev.length - 1]?.id || 0);
                const nextLast = Number(arr[arr.length - 1]?.id || 0);
                if (nextLast > prevLast) groupAutoScrollOnceRef.current = true;
                return arr;
            });
        } catch {
            /* ignore */
        }
    }

    async function refreshMyGroupsQuiet() {
        try {
            const data = await api("/api/v1/groups/my", { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setMyGroups((prev) => {
                const prevMap = new Map((prev || []).map((g) => [Number(g.id), g]));
                let changed = prev?.length !== arr.length;
                const next = arr.map((g) => {
                    const old = prevMap.get(Number(g.id));
                    if (
                        !old ||
                        Number(old.unread_count || 0) !== Number(g.unread_count || 0) ||
                        String(old.last_message || "") !== String(g.last_message || "")
                    ) {
                        changed = true;
                    }
                    return g;
                });
                return changed ? next : prev;
            });
        } catch {
            /* ignore */
        }
    }

    useEffect(() => {
        if (!t) return;
        const tick = () => {
            if (document.hidden) return;
            const gid = Number(selectedGroupIdRef.current || 0);
            const did = Number(activeDirectIdRef.current || 0);
            if (did) {
                refreshDirectMessagesQuiet(did);
            } else {
                if (gid) refreshGroupMessagesQuiet(gid);
                refreshMyGroupsQuiet();
            }
        };
        const id = setInterval(tick, 2500);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]);

    useEffect(() => {
        const cid = Number(activeDirect?.id || 0);
        if (!cid) return;
        wsDirectSubsRef.current.add(cid);
        wsClient.subscribe("direct", cid);
    }, [activeDirect?.id]);

    async function createGroup(e) {
        e.preventDefault();
        setStatus("");
        try {
            const g = await api("/api/v1/groups", {
                method: "POST",
                auth: true,
                body: newGroup,
            });
            const gid = Number(g?.id || 0);
            if (gid && newGroupMembers.length > 0) {
                for (const m of newGroupMembers) {
                    // eslint-disable-next-line no-await-in-loop
                    await api(`/api/v1/groups/${gid}/members`, {
                        method: "POST",
                        auth: true,
                        body: { user_id: Number(m.user_id), role_in_group: m.role_in_group },
                    });
                }
            }
            setNewGroup({ name: "", diagnosis_type: "", description: "", photo_url: "" });
            setGroupPhotoUploading(false);
            setNewGroupMembers([]);
            setToastText("Топ құрылды ✅");
            setCreateOpen(false);
            setCreateMembersOpen(false);
            loadMyGroups();
        } catch (e2) {
            setStatus("Топ құру қатесі: " + (e2.message || ""));
        }
    }

    function addCreateMembers() {
        if (!createMemberUserIds.length) return;
        setNewGroupMembers((prev) => {
            let next = [...prev];
            for (const idStr of createMemberUserIds) {
                const uid = Number(idStr);
                if (!uid) continue;
                const user = createCandidateUsers.find((u) => Number(u.id) === uid);
                if (!user) continue;
                const exists = next.some((m) => Number(m.user_id) === uid);
                if (exists) {
                    next = next.map((m) => (Number(m.user_id) === uid ? { ...m, role_in_group: createMemberRole } : m));
                } else {
                    next.push({ user_id: uid, full_name: user.full_name || `User ${uid}`, role_in_group: createMemberRole });
                }
            }
            return next;
        });
        setCreateMemberUserIds([]);
    }

    function removeCreateMember(uid) {
        setNewGroupMembers((prev) => prev.filter((m) => Number(m.user_id) !== Number(uid)));
    }

    async function addMember(e) {
        e.preventDefault();
        setStatus("");
        const uid = Number(memberForm.user_id);
        if (!selectedGroupId || !uid) {
            setStatus("Қолданушыны таңдаңыз.");
            return;
        }
        try {
            await api(`/api/v1/groups/${selectedGroupId}/members`, {
                method: "POST",
                auth: true,
                body: { user_id: uid, role_in_group: memberForm.role_in_group },
            });
            setToastText("Қолданушы топқа қосылды ✅");
            setMemberForm((p) => ({ ...p, user_id: "" }));
            loadMembers(selectedGroupId);
            loadMyGroups();
        } catch (e2) {
            setStatus("Қосу қатесі: " + (e2.message || ""));
        }
    }

    async function removeMember(uid) {
        uid = Number(uid);
        if (!selectedGroupId || !uid) return;
        const ok = window.confirm("Сіз шынымен де осы адамды топтан шығарғыңыз келе ме?");
        if (!ok) return;
        setStatus("");
        try {
            await api(`/api/v1/groups/${selectedGroupId}/members/${uid}`, {
                method: "DELETE",
                auth: true,
            });
            setToastText("Адам топтан шығарылды ✅");
            await loadMembers(selectedGroupId);
            await loadMyGroups();
        } catch (e2) {
            setStatus("Шығару қатесі: " + (e2.message || ""));
        }
    }

    async function updateGroup(e) {
        e.preventDefault();
        if (!selectedGroupId) return;
        try {
            await api(`/api/v1/groups/${selectedGroupId}`, {
                method: "PUT",
                auth: true,
                body: settingsForm,
            });
            setToastText("Топ ақпараты жаңартылды ✅");
            setSettingsOpen(false);
            loadMyGroups();
        } catch (e2) {
            setStatus("Топты жаңарту қатесі: " + (e2.message || ""));
        }
    }

    async function sendMessage(e) {
        e.preventDefault();
        if (!selectedGroupId || !msgText.trim()) return;
        try {
            const sent = msgText.trim();
            const created = await api(`/api/v1/groups/${selectedGroupId}/messages`, {
                method: "POST",
                auth: true,
                body: { body: sent },
            });
            setMsgText("");
            groupAutoScrollOnceRef.current = true;
            const gid = Number(selectedGroupId);
            const senderName =
                (membersRef.current || []).find((m) => Number(m.user_id) === myUserId)?.full_name ||
                payload?.full_name ||
                "Сіз";
            setMessages((prev) =>
                appendGroupMessage(prev, {
                    id: created?.id,
                    group_id: gid,
                    sender_id: myUserId,
                    sender_name: senderName,
                    body: created?.body || sent,
                    is_system: false,
                    created_at: created?.created_at || new Date().toISOString(),
                    readers: [],
                })
            );
            setMyGroups((prev) => (prev || []).map((g) => (
                Number(g.id) === gid
                    ? { ...g, last_message: sent, unread_count: 0 }
                    : g
            )));
        } catch (e2) {
            setStatus("Хабар жіберу қатесі: " + (e2.message || ""));
        }
    }

    async function startDirectChat(member) {
        const peerID = Number(member?.user_id || 0);
        if (!peerID || peerID === myUserId) return;
        try {
            const data = await api("/api/v1/direct-chats/start", {
                method: "POST",
                auth: true,
                body: { peer_user_id: peerID },
            });
            const cid = Number(data?.id || 0);
            if (!cid) {
                setStatus("Чат ашылмады.");
                return;
            }
            const next = {
                id: cid,
                peer_user_id: peerID,
                peer_name: member.full_name || "Қатысушы",
                last_message: "",
                photo_url: "",
            };
            setActiveDirect(next);
            setSideTab("direct");
            setDirectMessages([]);
            initialDirectScrollDoneRef.current = false;
            directAutoScrollOnceRef.current = false;
            // Load peer avatar (doctor photo) for the header.
            const reqID = ++peerAvatarReqIdRef.current;
            api(`/api/v1/users/${peerID}`, { auth: true })
                .then((u) => {
                    if (!u || reqID !== peerAvatarReqIdRef.current) return;
                    const photo = u.photo_url || "";
                    setActiveDirect((prev) => {
                        if (!prev || Number(prev.peer_user_id) !== peerID) return prev;
                        return { ...prev, photo_url: photo };
                    });
                    setDirectChats((prev) => {
                        const updated = patchDirectChat(prev, cid, { photo_url: photo });
                        writeStoredDirectChats(updated);
                        return updated;
                    });
                })
                .catch(() => {});
            setDirectChats((prev) => {
                const exists = prev.some((c) => Number(c.id) === cid);
                const result = sortDirectChats(exists ? prev : [next, ...prev]);
                writeStoredDirectChats(result);
                return result;
            });
            setDirectText("");
            setGroupInfoOpen(false);
            setSettingsOpen(false);
            await loadDirectChats();
            await loadDirectMessages(cid);
        } catch (e) {
            setStatus("Жеке чат ашу қатесі: " + (e.message || ""));
        }
    }

    async function sendDirectMessage(e) {
        e.preventDefault();
        const text = (directText || "").trim();
        if (!activeDirect?.id || !text) return;
        try {
            await api(`/api/v1/direct-chats/${activeDirect.id}/messages`, {
                method: "POST",
                auth: true,
                body: { body: text },
            });
            setDirectText("");
            directAutoScrollOnceRef.current = true;
            // UI-ды бірден жаңартамыз (WhatsApp сияқты).
            setDirectChats((prev) => {
                const cid = Number(activeDirect.id);
                const now = new Date().toISOString();
                const next = patchDirectChat(prev, cid, { last_message: text, last_at: now });
                writeStoredDirectChats(next);
                return next;
            });
            await loadDirectMessages(activeDirect.id);
            await loadDirectChats();
        } catch (e) {
            setStatus("Жеке чат хабарлама қатесі: " + (e.message || ""));
        }
    }

    if (!t) {
        return (
            <div className="page">
                <p className="form-error">Топтарға кіру үшін алдымен жүйеге кіріңіз.</p>
            </div>
        );
    }

    const totalDirectUnread = Object.values(unreadByChat).reduce((a, b) => a + Number(b || 0), 0);

    const hasResponsiveChatOpen =
        sideTab === "direct" ? !!activeDirect : selectedGroupId > 0;

    const showChatPlaceholder =
        sideTab === "direct" ? !activeDirect : !selectedGroup;

    function backToChatList() {
        if (sideTab === "direct") {
            setActiveDirect(null);
            setDirectMessages([]);
        } else {
            setSelectedGroupId(0);
            setGroupInfoOpen(false);
            setSettingsOpen(false);
        }
    }

    function ChatBackButton() {
        return (
            <button
                type="button"
                className="groups-chat__back"
                aria-label="Артқа"
                onClick={(e) => {
                    e.stopPropagation();
                    backToChatList();
                }}
            >
                <span aria-hidden="true">←</span>
            </button>
        );
    }

    return (
        <div className="page groups-page groups-page--premium">
            {toastText && (
                <div className="groups-toast" onClick={() => setToastText("")}>
                    {toastText}
                </div>
            )}
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Топтар</h2>
                    <p className="muted page-header__subtitle">Жалпы қолдау чаттары: пациенттер, дәрігерлер, волонтерлер.</p>
                </div>
            </div>

            {status && <p className="groups-status">{status}</p>}

            <div
                className={
                    "groups-chat-shell" +
                    (hasResponsiveChatOpen ? " groups-chat-shell--chat-open" : "")
                }
            >
                <aside className="groups-sidebar">
                    <div className="groups-sidebar__tabs">
                        <button
                            type="button"
                            className={`groups-sidebar__tab ${sideTab === "groups" ? "is-active" : ""}`}
                            onClick={() => setSideTab("groups")}
                            aria-label="Топтар"
                        >
                            <svg className="groups-tab-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
                                <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5M14.5 19c0-1.8 1.3-3.2 3-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            <span className="groups-sidebar__tab-count">{myGroups.length}</span>
                        </button>
                        <button
                            type="button"
                            className={`groups-sidebar__tab ${sideTab === "direct" ? "is-active" : ""}`}
                            onClick={() => setSideTab("direct")}
                            aria-label="Жеке чаттар"
                        >
                            <svg className="groups-tab-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            {totalDirectUnread > 0 && (
                                <span className="groups-sidebar__tab-badge">{totalDirectUnread}</span>
                            )}
                        </button>
                    </div>

                    {sideTab === "groups" && (
                    <>
                    {canManage && (
                        <div className="groups-sidebar__actions">
                            <button
                                type="button"
                                className="groups-sidebar__create groups-btn groups-btn--soft"
                                onClick={() => setCreateOpen((v) => !v)}
                            >
                                {createOpen ? "Жабу" : "+ Жаңа топ құру"}
                            </button>
                        </div>
                    )}
                    {canManage && createOpen && (
                        <form className="groups-create-inline groups-form-panel" onSubmit={createGroup}>
                            <input
                                className="input groups-field"
                                placeholder="Топ атауы"
                                value={newGroup.name}
                                onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))}
                                required
                            />
                            <input
                                className="input"
                                placeholder="Диагноз түрі"
                                value={newGroup.diagnosis_type}
                                onChange={(e) => setNewGroup((p) => ({ ...p, diagnosis_type: e.target.value }))}
                            />
                            <textarea
                                className="input"
                                rows={2}
                                placeholder="Сипаттама"
                                value={newGroup.description}
                                onChange={(e) => setNewGroup((p) => ({ ...p, description: e.target.value }))}
                            />
                            <div style={{ marginTop: 8 }}>
                                <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 700 }}>
                                    Фото (міндетті емес)
                                </div>
                                {newGroup.photo_url ? (
                                    <img
                                        src={normalizePhoto(newGroup.photo_url)}
                                        alt=""
                                        style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(148,163,184,.35)" }}
                                    />
                                ) : null}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="input"
                                    style={{ marginTop: 8, width: "100%" }}
                                    disabled={groupPhotoUploading}
                                    onChange={async (e) => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        try {
                                            setGroupPhotoUploading(true);
                                            const url = await uploadFileToServer(f);
                                            setNewGroup((p) => ({ ...p, photo_url: url || "" }));
                                        } catch (err) {
                                            setStatus("Фото жүктеу қатесі: " + (err.message || ""));
                                        } finally {
                                            setGroupPhotoUploading(false);
                                        }
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                className="groups-create-inline__toggle"
                                onClick={() => {
                                    const next = !createMembersOpen;
                                    setCreateMembersOpen(next);
                                    if (next) loadCreateCandidates(createMemberRole);
                                }}
                            >
                                {createMembersOpen ? "Қатысушыларды жасыру" : "Қатысушыларды қосу"}
                            </button>
                            {createMembersOpen && (
                                <>
                                    <label className="groups-create-inline__label">Қатысушыларды қосу (міндетті емес)</label>
                                    <div className="groups-create-member-picker">
                                        <select
                                            className="input"
                                            value={createMemberRole}
                                            onChange={(e) => setCreateMemberRole(e.target.value)}
                                        >
                                            <option value="patient">Пациент</option>
                                            <option value="doctor">Дәрігер</option>
                                            <option value="volunteer">Волонтёр</option>
                                        </select>
                                        <div className="groups-create-checklist">
                                            {createCandidateUsers.length === 0 ? (
                                                <div className="groups-create-checklist__empty">Қолданушы табылмады</div>
                                            ) : (
                                                createCandidateUsers.map((u) => {
                                                    const checked = createMemberUserIds.includes(String(u.id));
                                                    return (
                                                        <label key={u.id} className={`groups-create-check ${checked ? "is-checked" : ""}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(e) => {
                                                                    const idStr = String(u.id);
                                                                    if (e.target.checked) {
                                                                        setCreateMemberUserIds((prev) => (prev.includes(idStr) ? prev : [...prev, idStr]));
                                                                    } else {
                                                                        setCreateMemberUserIds((prev) => prev.filter((v) => v !== idStr));
                                                                    }
                                                                }}
                                                            />
                                                            <span className="groups-create-check__mark">{checked ? "✓" : ""}</span>
                                                            <span className="groups-create-check__text">
                                                                {u.full_name || "Қолданушы"}
                                                            </span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="groups-create-member-picker__add"
                                            onClick={addCreateMembers}
                                            disabled={!createMemberUserIds.length}
                                        >
                                            Белгіленгендерді қосу
                                        </button>
                                    </div>
                                    <div className="groups-create-members">
                                        {newGroupMembers.length === 0 ? (
                                            <span className="groups-create-members__empty">Әлі ешкім таңдалмады</span>
                                        ) : (
                                            newGroupMembers.map((m) => (
                                                <span key={m.user_id} className="groups-create-members__item">
                                                    {m.full_name} · {roleLabel(m.role_in_group)}
                                                    <button type="button" onClick={() => removeCreateMember(m.user_id)}>x</button>
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                            <button className="btn groups-btn groups-btn--primary" type="submit">
                                Топ құру
                            </button>
                        </form>
                    )}
                    {myGroups.length === 0 ? (
                        <p className="muted groups-sidebar__empty">Әзірге топқа қосылмағансыз.</p>
                    ) : (
                        <div className="groups-list">
                            {myGroups.map((g) => {
                                const initials = groupMemberInitials(g.name);
                                return (
                                <button
                                    key={g.id}
                                    className={`groups-list__item ${selectedGroupId === g.id ? "is-active" : ""}`}
                                    onClick={() => {
                                        didAutoSelectOnceRef.current = true;
                                        setActiveDirect(null);
                                        setSelectedGroupId(g.id);
                                    }}
                                >
                                    <span className="groups-card__avatar-wrap">
                                        <span className="groups-list__avatar">
                                            {g.photo_url ? (
                                                <img
                                                    src={normalizePhoto(g.photo_url)}
                                                    alt=""
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        objectFit: "cover",
                                                        display: "block",
                                                    }}
                                                />
                                            ) : (
                                                String(g.name || "Г")?.slice(0, 1)?.toUpperCase()
                                            )}
                                        </span>
                                    </span>
                                    <span className="groups-list__titleBlock">
                                        <span className="groups-list__name">{g.name}</span>
                                        <span className="groups-list__meta">{groupSubtitle(g)}</span>
                                        <span className="groups-card__members" aria-hidden="true">
                                            {initials.map((ch, i) => (
                                                <span key={i} className="groups-card__member-dot">{ch}</span>
                                            ))}
                                            <span className="groups-card__member-more">+{Math.max(0, initials.length * 8)}</span>
                                        </span>
                                    </span>
                                    <span className="groups-list__right">
                                        <span className="groups-list__time">{fmtChatWhen(g.created_at)}</span>
                                        {Number(g.unread_count || 0) > 0 ? (
                                            <span className="groups-list__badge">{Number(g.unread_count || 0)}</span>
                                        ) : (
                                            <span className="groups-card__chev" aria-hidden="true">›</span>
                                        )}
                                    </span>
                                </button>
                            );})}
                        </div>
                    )}
                    </>
                    )}

                    {sideTab === "direct" && (
                    <>
                    {directChats.length === 0 ? (
                        <p className="muted groups-sidebar__empty">Әзірге жеке чат жоқ.</p>
                    ) : (
                        <div className="groups-list groups-list--direct">
                            {directChats.map((c) => (
                                <button
                                    key={c.id}
                                    className={`groups-list__item ${activeDirect?.id === c.id ? "is-active" : ""}`}
                                    onClick={() => {
                                        setDirectMessages([]);
                                        initialDirectScrollDoneRef.current = false;
                                        directAutoScrollOnceRef.current = false;
                                        setActiveDirect(c);
                                        setGroupInfoOpen(false);
                                        setSettingsOpen(false);
                                        loadDirectMessages(c.id);
                                    }}
                                >
                                    <span className="groups-card__avatar-wrap">
                                        <span className="groups-list__avatar">
                                            <img
                                                src={directAvatarSrc(c)}
                                                alt=""
                                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                            />
                                        </span>
                                    </span>
                                    <span className="groups-list__left">
                                        <span className="groups-list__name">{c.peer_name || "Қатысушы"}</span>
                                        <span className="groups-list__meta">
                                            {(c.last_message || "").trim() ? c.last_message : "Хабарлама жоқ"}
                                        </span>
                                    </span>
                                    <span className="groups-list__right">
                                        <span className="groups-list__time">{fmtChatWhen(c.last_at)}</span>
                                        {Number(unreadByChat[c.id] || 0) > 0 ? (
                                            <span className="groups-list__badge">{Number(unreadByChat[c.id] || 0)}</span>
                                        ) : (
                                            <span className="groups-card__chev" aria-hidden="true">›</span>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    </>
                    )}
                </aside>

                <section className="groups-chat">
                    {showChatPlaceholder ? (
                        <div className="groups-chat__placeholder">
                            {sideTab === "direct"
                                ? "Жеке чатты сол жақтан таңдаңыз."
                                : "Сол жақтан топ таңдаңыз."}
                        </div>
                    ) : (
                        <>
                            {activeDirect ? (
                                <>
                                    <div
                                        className="groups-chat__head"
                                        style={{ cursor: "pointer" }}
                                        onClick={() => openPeerProfile(activeDirect.peer_user_id)}
                                    >
                                        <ChatBackButton />
                                        <div className="groups-chat__avatar">
                                            <img
                                                src={directAvatarSrc(activeDirect)}
                                                alt=""
                                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                            />
                                        </div>
                                        <div className="groups-chat__identity">
                                            <div className="groups-chat__title-btn">{activeDirect.peer_name || "Қатысушы"}</div>
                                            <div className="groups-chat__subtitle">Жеке чат</div>
                                        </div>
                                    </div>
                                    <div className="groups-chat__messages" ref={directMessagesScrollRef}>
                                        {directMessages.length === 0 ? (
                                            <p className="muted">Әзірге хабарламалар жоқ.</p>
                                        ) : (
                                            directMessages.map((m) => {
                                                const isMine = Number(m.sender_id) === myUserId;
                                                const showRead = isMine && Number(m.id) === lastOwnDirectMessageId;
                                                return (
                                                    <div
                                                        key={m.id}
                                                        className={`groups-msg ${Number(m.sender_id) === myUserId ? "is-own" : ""}`}
                                                    >
                                                        <div className="groups-msg__meta">
                                                            {m.sender_name || "—"} · {new Date(m.created_at).toLocaleString("kk-KZ")}
                                                        </div>
                                                        <div className="groups-msg__body">{m.body}</div>
                                                        {!m.is_system && showRead ? (
                                                            <div
                                                                className={`groups-msg__read${!m.is_read_by_peer ? " groups-msg__read--pending" : ""}`}
                                                            >
                                                                {m.is_read_by_peer && m.read_at_by_peer ? (
                                                                    <>
                                                                        Көрілді:{" "}
                                                                        {new Date(m.read_at_by_peer).toLocaleString("kk-KZ", {
                                                                            hour: "2-digit",
                                                                            minute: "2-digit",
                                                                        })}
                                                                    </>
                                                                ) : (
                                                                    "Оқылмады"
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={directMessagesEndRef} style={{ height: 1 }} />
                                    </div>
                                    <form onSubmit={sendDirectMessage} className="groups-chat__composer groups-composer">
                                        <input
                                            className="input groups-field groups-chat__input"
                                            placeholder="Жеке хабарлама..."
                                            value={directText}
                                            onChange={(e) => setDirectText(e.target.value)}
                                        />
                                        <button className="btn groups-btn groups-btn--primary groups-chat__send" type="submit">
                                            Жіберу
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <>
                            <div
                                className="groups-chat__head groups-chat__head--clickable"
                                role="button"
                                tabIndex={0}
                                onClick={() => setGroupInfoOpen((v) => !v)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setGroupInfoOpen((v) => !v);
                                    }
                                }}
                            >
                                <ChatBackButton />
                                <div className="groups-chat__avatar">
                                    {selectedGroup.photo_url ? (
                                        <img
                                            src={normalizePhoto(selectedGroup.photo_url)}
                                            alt=""
                                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                        />
                                    ) : (
                                        selectedGroup.name.slice(0, 1).toUpperCase()
                                    )}
                                </div>
                                <div className="groups-chat__identity">
                                    <div className="groups-chat__title-btn">
                                        {selectedGroup.name}
                                    </div>
                                    <div className="groups-chat__subtitle">Жалпы чат</div>
                                </div>
                                {canEditSelected && (
                                    <button
                                        type="button"
                                        className="groups-chat__edit-btn groups-btn groups-btn--soft"
                                        onClick={(e) => {
                                            // Header click-ті триггер етпейміз.
                                            e.stopPropagation();
                                            setSettingsForm({
                                                name: selectedGroup.name || "",
                                                diagnosis_type: selectedGroup.diagnosis_type || "",
                                                description: selectedGroup.description || "",
                                                photo_url: selectedGroup.photo_url || "",
                                            });
                                            setSettingsOpen((v) => !v);
                                        }}
                                    >
                                        {settingsOpen ? "Жабу" : "Өзгерту"}
                                    </button>
                                )}
                            </div>

                            {groupInfoOpen && !settingsOpen && (
                                <div className="groups-info-card">
                                    <div className="groups-info-card__row">
                                        <strong>{selectedGroup.name || "—"}</strong>
                                    </div>
                                    <div className="groups-info-card__row">
                                        <strong>{selectedGroup.diagnosis_type || "Көрсетілмеген"}</strong>
                                    </div>
                                    <div className="groups-info-card__desc">
                                        {selectedGroup.description || "Бұл қолдау тобының мақсаты - бір-біріне қолдау көрсету, ашық сөйлесу және мотивацияны сақтау."}
                                    </div>
                                    <div className="groups-info-card__members">
                                        <span className="groups-info-card__members-title">Қатысушылар ({members.length})</span>
                                        <div className="groups-members-mini">
                                            {members.length === 0 ? (
                                                <span className="groups-members-mini__item">Әзірше қатысушы жоқ</span>
                                            ) : (
                                                members.slice(0, 10).map((m) => (
                                                    Number(m.user_id) !== myUserId ? (
                                                        <button
                                                            key={m.user_id}
                                                            type="button"
                                                            className="groups-members-mini__item is-clickable"
                                                            onClick={() => startDirectChat(m)}
                                                        >
                                                            {m.full_name || "—"}
                                                        </button>
                                                    ) : (
                                                        <span key={m.user_id} className="groups-members-mini__item">
                                                            Сіз
                                                        </span>
                                                    )
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {canEditSelected && settingsOpen && (
                                <div
                                    className="groups-settings-modal__overlay"
                                    onClick={() => setSettingsOpen(false)}
                                    role="dialog"
                                    aria-modal="true"
                                >
                                    <div
                                        className="groups-settings-modal__panel"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="groups-settings-modal__topbar">
                                            <div className="groups-settings-modal__title">Топ баптаулары</div>
                                            <button
                                                type="button"
                                                className="groups-settings-modal__close"
                                                onClick={() => setSettingsOpen(false)}
                                            >
                                                Жабу
                                            </button>
                                        </div>

                                        <div className="groups-inline-settings groups-inline-settings--modal">
                                            <form className="groups-inline-settings__edit" onSubmit={updateGroup}>
                                                <div className="groups-inline-settings__title">Топ баптаулары</div>
                                                <input
                                                    className="input"
                                                    value={settingsForm.name}
                                                    onChange={(e) => setSettingsForm((p) => ({ ...p, name: e.target.value }))}
                                                    placeholder="Топ атауы"
                                                    required
                                                />
                                                <input
                                                    className="input"
                                                    value={settingsForm.diagnosis_type}
                                                    onChange={(e) => setSettingsForm((p) => ({ ...p, diagnosis_type: e.target.value }))}
                                                    placeholder="Диагноз түрі"
                                                />
                                                <textarea
                                                    className="input"
                                                    rows={2}
                                                    value={settingsForm.description}
                                                    onChange={(e) => setSettingsForm((p) => ({ ...p, description: e.target.value }))}
                                                    placeholder="Сипаттама"
                                                />
                                                <div style={{ marginTop: 8 }}>
                                                    <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 700 }}>
                                                        Фото (міндетті емес)
                                                    </div>
                                                    {settingsForm.photo_url ? (
                                                        <img
                                                            src={normalizePhoto(settingsForm.photo_url)}
                                                            alt=""
                                                            style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(148,163,184,.35)" }}
                                                        />
                                                    ) : null}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="input"
                                                        style={{ marginTop: 8 }}
                                                        disabled={groupPhotoUploading}
                                                        onChange={async (e) => {
                                                            const f = e.target.files?.[0];
                                                            if (!f) return;
                                                            try {
                                                                setGroupPhotoUploading(true);
                                                                const url = await uploadFileToServer(f);
                                                                setSettingsForm((p) => ({ ...p, photo_url: url || "" }));
                                                            } catch (err) {
                                                                setStatus("Фото жүктеу қатесі: " + (err.message || ""));
                                                            } finally {
                                                                setGroupPhotoUploading(false);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <button className="btn" type="submit">Атын өзгерту/сақтау</button>
                                            </form>

                                            <form className="groups-inline-settings__add" onSubmit={addMember}>
                                                <div className="groups-inline-settings__title">Топқа адам қосу</div>
                                                <select
                                                    className="input"
                                                    value={memberForm.role_in_group}
                                                    onChange={(e) => setMemberForm((p) => ({ ...p, role_in_group: e.target.value }))}
                                                >
                                                    <option value="patient">Пациент</option>
                                                    <option value="doctor">Дәрігер</option>
                                                    <option value="volunteer">Волонтёр</option>
                                                </select>
                                                <select
                                                    className="input"
                                                    value={memberForm.user_id}
                                                    onChange={(e) => setMemberForm((p) => ({ ...p, user_id: e.target.value }))}
                                                    required
                                                >
                                                    {candidateUsers.length === 0 ? (
                                                        <option value="">Қолданушы табылмады</option>
                                                    ) : (
                                                        candidateUsers.map((u) => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.full_name || "Қолданушы"}
                                                            </option>
                                                        ))
                                                    )}
                                                </select>
                                                <button className="btn" type="submit">Қосу</button>
                                                <div className="groups-members-mini">
                                                    {(members || []).slice(0, 8).map((m) => (
                                                        <span key={m.user_id} className="groups-members-mini__item">
                                                            {m.full_name}
                                                            {canEditSelected && Number(m.user_id) !== myUserId && (
                                                                <button
                                                                    type="button"
                                                                    className="groups-members-mini__remove"
                                                                    onClick={() => removeMember(m.user_id)}
                                                                    title="Топтан шығару"
                                                                >
                                                                    x
                                                                </button>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!settingsOpen && (
                                <div className="groups-chat__messages" ref={groupMessagesScrollRef}>
                                    {messages.length === 0 ? (
                                        <p className="muted">Әзірге хабарламалар жоқ.</p>
                                    ) : (
                                        messages.map((m) => {
                                            const isMine = Number(m.sender_id) === myUserId;
                                            const showRead = !m.is_system && isMine && Number(m.id) === lastOwnGroupMessageId;
                                            const peerReaders = groupPeerReaders(m.readers);
                                            return (
                                            <div
                                                key={m.id}
                                                className={`groups-msg ${m.is_system ? "is-system" : Number(m.sender_id) === myUserId ? "is-own" : ""}`}
                                            >
                                                {m.is_system ? (
                                                    <div className="groups-msg__system">{m.body}</div>
                                                ) : (
                                                <>
                                                <div className="groups-msg__meta">
                                                    {m.sender_name || "—"} · {new Date(m.created_at).toLocaleString("kk-KZ")}
                                                </div>
                                                <div className="groups-msg__body">{m.body}</div>
                                                </>
                                                )}
                                                {!m.is_system && showRead ? (
                                                    <div
                                                        className={`groups-msg__read${peerReaders.length === 0 ? " groups-msg__read--pending" : ""}`}
                                                    >
                                                        {peerReaders.length === 0 ? (
                                                            "Оқылмады"
                                                        ) : (
                                                            <>
                                                                Көрілді:{" "}
                                                                {peerReaders
                                                                    .slice(0, 5)
                                                                    .map((r) => r.full_name)
                                                                    .filter(Boolean)
                                                                    .join(", ")}
                                                                {peerReaders.length > 5 ? ` +${peerReaders.length - 5}` : ""}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                            );
                                        })
                                    )}
                                    <div ref={groupMessagesEndRef} style={{ height: 1 }} />
                                </div>
                            )}

                            {!settingsOpen && (
                                <form onSubmit={sendMessage} className="groups-chat__composer groups-composer">
                                    <input
                                        className="input groups-field groups-chat__input"
                                        placeholder="Хабарлама..."
                                        value={msgText}
                                        onChange={(e) => setMsgText(e.target.value)}
                                    />
                                    <button className="btn groups-btn groups-btn--primary groups-chat__send" type="submit">
                                        Жіберу
                                    </button>
                                </form>
                            )}
                                </>
                            )}
                        </>
                    )}
                </section>
            </div>

            {peerProfileOpen && (
                <div
                    className="peer-profile-modal__overlay"
                    onClick={() => closePeerProfile()}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="peer-profile-modal__card"
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <div className="peer-profile-modal__head">
                            <div className="peer-profile-modal__title">Профиль</div>
                            <button
                                type="button"
                                className="peer-profile-modal__close"
                                onClick={() => closePeerProfile()}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        {peerProfileLoading ? (
                            <p className="muted">Жүктелуде...</p>
                        ) : peerProfileError ? (
                            <p className="form-error">{peerProfileError}</p>
                        ) : peerProfile ? (
                            <>
                                <div className="peer-profile-modal__hero">
                                    <div className="peer-profile-modal__avatar" aria-hidden="true">
                                        <img
                                            src={normalizePhoto(peerProfile.photo_url || "")}
                                            alt=""
                                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "999px" }}
                                        />
                                    </div>
                                    <div className="peer-profile-modal__info">
                                        <div className="peer-profile-modal__name">{peerProfile.full_name || "—"}</div>
                                        <div className="peer-profile-modal__role">{roleLabel(peerProfile.role)}</div>
                                        {peerProfile.phone ? (
                                            <div className="peer-profile-modal__phone">Телефон: {peerProfile.phone}</div>
                                        ) : null}
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}

