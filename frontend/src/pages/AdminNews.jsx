import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function formatInputDateTime(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return "";
    }
}

function toRFC3339FromInput(v) {
    if (!v) return "";
    try {
        return new Date(v).toISOString();
    } catch {
        return "";
    }
}

export default function AdminNews() {
    const nav = useNavigate();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [editingId, setEditingId] = useState(null);
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const blank = useMemo(
        () => ({ title: "", excerpt: "", content_html: "", cover_url: "", featured: false, published_at: "" }),
        []
    );
    const [form, setForm] = useState(blank);

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        const role = parseJwt(t)?.role;
        if (role !== "admin" && role !== "super_admin") {
            setMsg("Бұл бет тек админ немесе сүпер админ үшін.");
            return;
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function load() {
        setLoading(true);
        setMsg("");
        try {
            const data = await api("/api/v1/admin/news", { auth: true });
            setList(Array.isArray(data) ? data : []);
        } catch (e) {
            setMsg(`Қате: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    function startCreate() {
        setEditingId(null);
        setForm(blank);
        if (fileRef.current) fileRef.current.value = "";
    }

    function startEdit(n) {
        setEditingId(n.id);
        setForm({
            title: n.title || "",
            excerpt: n.excerpt || "",
            content_html: n.content_html || "",
            cover_url: n.cover_url || "",
            featured: !!n.featured,
            published_at: formatInputDateTime(n.published_at),
        });
        if (fileRef.current) fileRef.current.value = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function uploadCover(file) {
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/v1/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token()}` },
                body: fd,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text || "Жүктеу сәтсіз");
            let data = {};
            try { data = JSON.parse(text); } catch { data = {}; }
            setForm((p) => ({ ...p, cover_url: data.url || "" }));
        } catch (e) {
            alert("Жүктеу қатесі: " + (e.message || "қате"));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    async function save() {
        const title = (form.title || "").trim();
        const content_html = (form.content_html || "").trim();
        if (!title) return alert("Тақырыпты толтырыңыз.");
        if (!content_html) return alert("Мазмұнды (HTML) толтырыңыз.");

        const body = {
            title,
            excerpt: (form.excerpt || "").trim(),
            content_html,
            cover_url: (form.cover_url || "").trim(),
            featured: !!form.featured,
            published_at: form.published_at ? toRFC3339FromInput(form.published_at) : "",
        };

        try {
            if (editingId) {
                await api(`/api/v1/admin/news/${editingId}`, { method: "PUT", auth: true, body });
            } else {
                await api("/api/v1/admin/news", { method: "POST", auth: true, body });
            }
            startCreate();
            load();
        } catch (e) {
            alert(e.message || "Қате");
        }
    }

    async function del(id) {
        if (!window.confirm("Жоюға сенімдісіз бе?")) return;
        try {
            await api(`/api/v1/admin/news/${id}`, { method: "DELETE", auth: true });
            if (editingId === id) startCreate();
            load();
        } catch (e) {
            alert(e.message || "Қате");
        }
    }

    return (
        <div style={S.page}>
            <div style={S.header}>
                <h1 style={S.title}>Жаңалықтар</h1>
                <p style={S.subtitle}>Жаңалық пен мақалаларды қосу, өңдеу және өшіру.</p>
            </div>

            {msg && <div style={S.errorBanner}>{msg}</div>}

            <div style={S.layout}>
                {/* Форма */}
                <div style={S.formCard}>
                    <div style={S.formTop}>
                        <div style={S.formTitle}>{editingId ? `Өңдеу #${editingId}` : "Жаңа жаңалық"}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" style={S.btnGhost} onClick={startCreate} disabled={uploading}>Тазарту</button>
                            <button type="button" style={S.btnPrimary} onClick={save} disabled={uploading}>
                                {editingId ? "Жаңарту" : "Қосу"}
                            </button>
                        </div>
                    </div>

                    <label style={S.label}>Тақырып</label>
                    <input
                        style={S.input}
                        value={form.title}
                        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Тақырыпты енгізіңіз"
                    />

                    <label style={S.label}>Жариялану күні</label>
                    <input
                        style={S.input}
                        type="datetime-local"
                        value={form.published_at}
                        onChange={(e) => setForm((p) => ({ ...p, published_at: e.target.value }))}
                    />

                    <label style={S.label}>Қысқаша сипаттама</label>
                    <textarea
                        style={{ ...S.input, resize: "vertical" }}
                        rows={2}
                        value={form.excerpt}
                        onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                        placeholder="Қысқаша сипаттама"
                    />

                    <label style={S.label}>Мазмұны (HTML)</label>
                    <textarea
                        style={{ ...S.input, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
                        rows={9}
                        value={form.content_html}
                        onChange={(e) => setForm((p) => ({ ...p, content_html: e.target.value }))}
                        placeholder="<p>...</p>"
                    />

                    <label style={S.label}>Мұқаба (URL)</label>
                    <input
                        style={S.input}
                        value={form.cover_url}
                        onChange={(e) => setForm((p) => ({ ...p, cover_url: e.target.value }))}
                        placeholder="/uploads/..."
                    />

                    <div style={S.coverRow}>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => uploadCover(e.target.files?.[0])}
                        />
                        <button style={S.btnUpload} type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                            {uploading ? "Жүктелуде…" : "📷 Мұқаба жүктеу"}
                        </button>
                        <label style={S.checkLabel}>
                            <input
                                type="checkbox"
                                checked={!!form.featured}
                                onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
                            />
                            Басты жаңалық
                        </label>
                    </div>

                    {form.cover_url ? (
                        <img
                            src={form.cover_url}
                            alt=""
                            style={S.coverPreview}
                            onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                    ) : null}
                </div>

                {/* Список */}
                <div style={S.listCard}>
                    <div style={S.listTitle}>Барлық жаңалықтар <span style={S.countBadge}>{list.length}</span></div>
                    {loading && <p style={S.muted}>Жүктелуде…</p>}
                    {!loading && list.length === 0 && <p style={S.muted}>Тізім бос.</p>}
                    <div style={S.newsList}>
                        {list.map((n) => (
                            <div key={n.id} style={S.newsItem}>
                                {n.cover_url ? (
                                    <img src={n.cover_url} alt="" style={S.newsThumb} onError={(e) => (e.currentTarget.style.display = "none")} />
                                ) : (
                                    <div style={S.newsThumbEmpty}>📰</div>
                                )}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={S.newsItemTitle}>
                                        {n.featured ? <span style={S.featStar}>★</span> : null}
                                        {n.title}
                                    </div>
                                    {n.excerpt ? <div style={S.newsExcerpt}>{n.excerpt}</div> : null}
                                    <div style={S.newsMeta}>
                                        #{n.id} · {(n.published_at || "").slice(0, 10) || "күні жоқ"}
                                    </div>
                                </div>
                                <div style={S.newsActions}>
                                    <button style={S.btnSmall} type="button" onClick={() => startEdit(n)} disabled={uploading}>Өңдеу</button>
                                    <button style={S.btnSmallDanger} type="button" onClick={() => del(n.id)} disabled={uploading}>Жою</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const S = {
    page: { maxWidth: 1180, margin: "0 auto", padding: "32px 24px 60px" },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 },
    subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
    muted: { color: "#94a3b8", fontSize: 14 },
    errorBanner: { background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "12px 16px", fontWeight: 600, fontSize: 14, marginBottom: 16 },

    layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20, alignItems: "start" },

    formCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px", position: "sticky", top: 16 },
    formTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 },
    formTitle: { fontSize: 16, fontWeight: 700, color: "#0f172a" },

    label: { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", margin: "12px 0 5px" },
    input: {
        width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #cbd5e1",
        fontSize: 14, background: "#fff", boxSizing: "border-box",
    },
    coverRow: { display: "flex", alignItems: "center", gap: 16, marginTop: 14, flexWrap: "wrap" },
    checkLabel: { display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#334155", fontWeight: 600, cursor: "pointer" },
    coverPreview: { marginTop: 14, width: 180, height: 100, objectFit: "cover", borderRadius: 12, border: "1px solid #e2e8f0", display: "block" },

    btnPrimary: { padding: "8px 18px", borderRadius: 9, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    btnGhost: { padding: "8px 16px", borderRadius: 9, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    btnUpload: { padding: "9px 16px", borderRadius: 9, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontWeight: 600, cursor: "pointer", fontSize: 14 },

    listCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" },
    listTitle: { fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 },
    countBadge: { fontSize: 12, fontWeight: 700, color: "#64748b", background: "#f1f5f9", borderRadius: 999, padding: "2px 9px" },
    newsList: { display: "flex", flexDirection: "column", gap: 10 },
    newsItem: { display: "flex", gap: 12, padding: 12, border: "1px solid #eef2f6", borderRadius: 12, alignItems: "center" },
    newsThumb: { width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 },
    newsThumbEmpty: { width: 64, height: 64, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 },
    newsItemTitle: { fontWeight: 700, color: "#0f172a", fontSize: 14, display: "flex", gap: 6, alignItems: "center" },
    featStar: { color: "#f59e0b" },
    newsExcerpt: { fontSize: 13, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    newsMeta: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
    newsActions: { display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 },
    btnSmall: { padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 600, cursor: "pointer", fontSize: 13 },
    btnSmallDanger: { padding: "6px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontWeight: 600, cursor: "pointer", fontSize: 13 },
};
