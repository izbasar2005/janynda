import { useEffect, useMemo, useRef, useState } from "react";
import { api, token } from "../services/api";

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
    const [members, setMembers] = useState([]);
    const [msgText, setMsgText] = useState("");
    const [status, setStatus] = useState("");

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

    useEffect(() => {
        selectedGroupIdRef.current = selectedGroupId;
    }, [selectedGroupId]);

    function roleLabel(role) {
        const v = (role || "").toLowerCase();
        if (v === "doctor") return "Дәрігер";
        if (v === "admin") return "Админ";
        if (v === "super_admin") return "Сүпер админ";
        if (v === "patient") return "Пациент";
        return role || "—";
    }

    function normalizePhoto(url) {
        if (!url) return "";
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        if (url.startsWith("/")) return url;
        return "/" + url;
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
    function markDirectSeen(chatID, messageID) {
        const cid = Number(chatID);
        const mid = Number(messageID || 0);
        if (!cid || !mid) return;
        const prev = Number(seenDirectRef.current[cid] || 0);
        if (mid <= prev) return;
        const next = { ...seenDirectRef.current, [cid]: mid };
        seenDirectRef.current = next;
        writeSeenDirectMap(next);
        setUnreadByChat((p) => ({ ...p, [cid]: false }));
    }
    const canEditSelected = Boolean(
        selectedGroup && (
            role === "admin" ||
            role === "super_admin" ||
            (role === "doctor" && Number(selectedGroup.created_by) === myUserId)
        )
    );

    useEffect(() => {
        if (!t) return;
        const stored = readStoredDirectChats();
        if (stored.length) setDirectChats(stored);
        seenDirectRef.current = readSeenDirectMap();
        loadMyGroups();
        loadDirectChats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!t) return;
        const timer = setInterval(() => {
            // Groups list unread_count (GroupChatRead) серверде есептеледі,
            // сондықтан біз оны мезгіл-мезгіл қайта жүктеп тұрамыз.
            loadMyGroups();
        }, 5000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]);

    useEffect(() => {
        if (!t) return;
        const timer = setInterval(() => {
            loadDirectChats();
        }, 5000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t, myUserId]);

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
        loadMessages(selectedGroupId);
        loadMembers(selectedGroupId);
        setGroupInfoOpen(false);
        setSettingsOpen(false);
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
            end.scrollIntoView({ behavior: "auto", block: "end" });
            initialGroupScrollDoneRef.current = true;
            return;
        }
        if (!groupAutoScrollOnceRef.current) return;
        end.scrollIntoView({ behavior: "smooth", block: "end" });
        groupAutoScrollOnceRef.current = false;
    }, [messages.length, selectedGroupId, activeDirect?.id]);

    useEffect(() => {
        // Direct chat auto-scroll inside groups page.
        if (!activeDirect?.id) return;
        const container = directMessagesScrollRef.current;
        const end = directMessagesEndRef.current;
        if (!container || !end) return;

        if (!initialDirectScrollDoneRef.current) {
            end.scrollIntoView({ behavior: "auto", block: "end" });
            initialDirectScrollDoneRef.current = true;
            return;
        }
        if (!directAutoScrollOnceRef.current) return;
        end.scrollIntoView({ behavior: "smooth", block: "end" });
        directAutoScrollOnceRef.current = false;
    }, [directMessages.length, activeDirect?.id]);

    useEffect(() => {
        if (!activeDirect?.id) return;
        const timer = setInterval(() => {
            loadDirectMessages(activeDirect.id);
        }, 4000);
        return () => clearInterval(timer);
    }, [activeDirect?.id]);

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
                writeStoredDirectChats(next);
                return next;
            });
            setUnreadByChat((prevUnread) => {
                const nextUnread = { ...prevUnread };
                let newToast = "";
                for (const c of arr) {
                    const cid = Number(c.id);
                    const isActive = Number(activeDirect?.id || 0) === cid;
                    const cnt = Number(c.unread_count || 0);
                    nextUnread[cid] = isActive ? 0 : cnt;
                    if (!isActive && cnt > 0) {
                        newToast = `${c.peer_name || "Қатысушы"}: ${cnt} жаңа хабарлама`;
                    }
                }
                if (newToast) setToastText(newToast);
                return nextUnread;
            });
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
            // backend ListMessages already marks as seen
            setUnreadByChat((p) => ({ ...p, [Number(chatID)]: 0 }));
            if (arr.length > 0) {
                const last = arr[arr.length - 1];
                const cid = Number(chatID);
                setDirectChats((prev) => {
                    const next = (prev || []).map((c) => {
                        if (Number(c.id) !== cid) return c;
                        return {
                            ...c,
                            last_message: last.body || c.last_message || "",
                            last_at: last.created_at || c.last_at,
                        };
                    });
                    writeStoredDirectChats(next);
                    return next;
                });
            }
        } catch {
            setDirectMessages([]);
        }
    }

    async function loadMessages(groupId) {
        try {
            const data = await api(`/api/v1/groups/${groupId}/messages?ts=${Date.now()}`, { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setMessages(arr);
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
            await api(`/api/v1/groups/${selectedGroupId}/messages`, {
                method: "POST",
                auth: true,
                body: { body: msgText },
            });
            const sent = msgText.trim();
            setMsgText("");
            groupAutoScrollOnceRef.current = true;
            setMyGroups((prev) => (prev || []).map((g) => (
                Number(g.id) === Number(selectedGroupId)
                    ? { ...g, last_message: sent, unread_count: 0 }
                    : g
            )));
            loadMessages(selectedGroupId);
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
            // Load peer avatar (doctor photo) for the header.
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
            setDirectChats((prev) => {
                const exists = prev.some((c) => Number(c.id) === cid);
                const result = exists ? prev : [next, ...prev];
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
                const next = (prev || []).map((c) => {
                    if (Number(c.id) !== cid) return c;
                    return { ...c, last_message: text, last_at: now };
                });
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

    return (
        <div className="page groups-page">
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

            <div className="groups-chat-shell">
                <aside className="groups-sidebar">
                    <div className="groups-sidebar__head">
                        <span>Менің топтарым</span>
                        {canManage && (
                            <button
                                type="button"
                                className="groups-sidebar__plus"
                                onClick={() => setCreateOpen((v) => !v)}
                                title="Создать группу"
                            >
                                +
                            </button>
                        )}
                    </div>
                    {canManage && createOpen && (
                        <form className="groups-create-inline" onSubmit={createGroup}>
                            <input
                                className="input"
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
                                            <option value="patient">patient</option>
                                            <option value="doctor">doctor</option>
                                            <option value="volunteer">volunteer</option>
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
                                                    {m.full_name} · {m.role_in_group}
                                                    <button type="button" onClick={() => removeCreateMember(m.user_id)}>x</button>
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                            <button className="btn" type="submit">Топ құру</button>
                        </form>
                    )}
                    {myGroups.length === 0 ? (
                        <p className="muted groups-sidebar__empty">Әзірге топқа қосылмағансыз.</p>
                    ) : (
                        <div className="groups-list">
                            {myGroups.map((g) => (
                                <button
                                    key={g.id}
                                    className={`groups-list__item ${selectedGroupId === g.id ? "is-active" : ""}`}
                                    onClick={() => {
                                        didAutoSelectOnceRef.current = true;
                                        setSelectedGroupId(g.id);
                                    }}
                                >
                                    <span className="groups-list__row">
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
                                        <span className="groups-list__titleBlock">
                                            <span className="groups-list__name">{g.name}</span>
                                            <span className="groups-list__meta">{g.last_message || "Топтық чат"}</span>
                                        </span>
                                    </span>
                                    {Number(g.unread_count || 0) > 0 && (
                                        <span className="groups-list__badge">{Number(g.unread_count || 0)}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="groups-sidebar__head groups-sidebar__head--sub">Жеке чаттар</div>
                    {directChats.length === 0 ? (
                        <p className="muted groups-sidebar__empty">Әзірге жеке чат жоқ.</p>
                    ) : (
                        <div className="groups-list groups-list--direct">
                            {directChats.map((c) => (
                                <button
                                    key={c.id}
                                    className={`groups-list__item ${activeDirect?.id === c.id ? "is-active" : ""}`}
                                    onClick={() => {
                                        setActiveDirect(c);
                                        setGroupInfoOpen(false);
                                        setSettingsOpen(false);
                                        loadDirectMessages(c.id);
                                    }}
                                >
                                    <span className="groups-list__left">
                                        <span className="groups-list__name">{c.peer_name || "Қатысушы"}</span>
                                        <span className="groups-list__meta">
                                            {(c.last_message || "").trim() ? c.last_message : "Хабарлама жоқ"}
                                        </span>
                                    </span>
                                    <span className="groups-list__right">
                                        <span className="groups-list__time">{fmtChatWhen(c.last_at)}</span>
                                        {Number(unreadByChat[c.id] || 0) > 0 && (
                                            <span className="groups-list__badge">{Number(unreadByChat[c.id] || 0)}</span>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </aside>

                <section className="groups-chat">
                    {!selectedGroup ? (
                        <div className="groups-chat__placeholder">Сол жақтан топ таңдаңыз.</div>
                    ) : (
                        <>
                            {activeDirect ? (
                                <>
                                    <div
                                        className="groups-chat__head"
                                        style={{ cursor: "pointer" }}
                                        onClick={() => openPeerProfile(activeDirect.peer_user_id)}
                                    >
                                        <div className="groups-chat__avatar">
                                            {activeDirect.photo_url ? (
                                                <img
                                                    src={normalizePhoto(activeDirect.photo_url)}
                                                    alt=""
                                                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                                />
                                            ) : (
                                                (activeDirect.peer_name || "Қ").slice(0, 1).toUpperCase()
                                            )}
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
                                            directMessages.map((m, idx) => {
                                                const isLast = idx === directMessages.length - 1;
                                                const isMine = Number(m.sender_id) === myUserId;
                                                return (
                                                    <div
                                                        key={m.id}
                                                        className={`groups-msg ${Number(m.sender_id) === myUserId ? "is-own" : ""}`}
                                                    >
                                                        <div className="groups-msg__meta">
                                                            {m.sender_name || "—"} · {new Date(m.created_at).toLocaleString("kk-KZ")}
                                                        </div>
                                                        <div className="groups-msg__body">{m.body}</div>
                                                        {!m.is_system && isLast && isMine && m.is_read_by_peer && m.read_at_by_peer ? (
                                                            <div className="groups-msg__read">
                                                                Просмотрено:{" "}
                                                                {new Date(m.read_at_by_peer).toLocaleString("kk-KZ", {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                })}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={directMessagesEndRef} style={{ height: 1 }} />
                                    </div>
                                    <form onSubmit={sendDirectMessage} className="groups-chat__composer">
                                        <input
                                            className="input groups-chat__input"
                                            placeholder="Жеке хабарлама..."
                                            value={directText}
                                            onChange={(e) => setDirectText(e.target.value)}
                                        />
                                        <button className="btn groups-chat__send" type="submit">Жіберу</button>
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
                                        className="groups-chat__edit-btn"
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
                                                            Вы
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
                                                    <option value="patient">patient</option>
                                                    <option value="doctor">doctor</option>
                                                    <option value="volunteer">volunteer</option>
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
                                        messages.map((m, idx) => {
                                            const isLast = idx === messages.length - 1;
                                            const isMine = Number(m.sender_id) === myUserId;
                                            const readers = Array.isArray(m.readers) ? m.readers : [];
                                            const peerReaders = readers.filter((r) => !r.read_by_me);
                                            return (
                                            <div
                                                key={m.id}
                                                className={`groups-msg ${Number(m.sender_id) === myUserId ? "is-own" : ""}`}
                                            >
                                                <div className="groups-msg__meta">
                                                    {m.sender_name || "—"} · {new Date(m.created_at).toLocaleString("kk-KZ")}
                                                </div>
                                                <div className="groups-msg__body">{m.body}</div>
                                                {!m.is_system && isLast && isMine && peerReaders.length > 0 ? (
                                                    <div className="groups-msg__read">
                                                        Просмотрено:{" "}
                                                        {peerReaders
                                                            .slice(0, 4)
                                                            .map((r) => r.full_name)
                                                            .filter(Boolean)
                                                            .join(", ")}
                                                        {peerReaders.length > 4 ? ` +${peerReaders.length - 4}` : ""}
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
                                <form onSubmit={sendMessage} className="groups-chat__composer">
                                    <input
                                        className="input groups-chat__input"
                                        placeholder="Хабарлама..."
                                        value={msgText}
                                        onChange={(e) => setMsgText(e.target.value)}
                                    />
                                    <button className="btn groups-chat__send" type="submit">Жіберу</button>
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
                                        {peerProfile.photo_url ? (
                                            <img
                                                src={normalizePhoto(peerProfile.photo_url)}
                                                alt=""
                                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "999px" }}
                                            />
                                        ) : (
                                            (peerProfile.full_name || "П").slice(0, 1).toUpperCase()
                                        )}
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

