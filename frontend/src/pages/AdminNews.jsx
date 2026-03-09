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
        const d = new Date(v);
        return d.toISOString();
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
        () => ({
            title: "",
            excerpt: "",
            content_html: "",
            cover_url: "",
            featured: false,
            published_at: "",
        }),
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
            setMsg("Бұл бет тек admin немесе super_admin үшін.");
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
            if (!res.ok) throw new Error(text || "Upload failed");
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                data = {};
            }
            setForm((p) => ({ ...p, cover_url: data.url || "" }));
            alert("Cover жүктелді ✅");
        } catch (e) {
            alert("Upload қате: " + (e.message || "қате"));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    async function save() {
        const title = (form.title || "").trim();
        const content_html = (form.content_html || "").trim();
        if (!title) return alert("Title толтыр.");
        if (!content_html) return alert("Content (HTML) толтыр.");

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
                alert("Сақталды ✅");
            } else {
                await api("/api/v1/admin/news", { method: "POST", auth: true, body });
                alert("Қосылды ✅");
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
            alert("Өшірілді ✅");
            if (editingId === id) startCreate();
            load();
        } catch (e) {
            alert(e.message || "Қате");
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Admin — Новости</h2>
                    <p className="muted page-header__subtitle">Жаңалық/мақала қосу, өңдеу және өшіру.</p>
                </div>
            </div>

            {msg && <p className="muted" style={{ marginTop: 12 }}>{msg}</p>}
            {loading && <p className="muted">Жүктелуде...</p>}

            <div className="card admin-news__form">
                <div className="admin-news__form-top">
                    <div className="admin-news__form-title">{editingId ? `Өңдеу #${editingId}` : "Жаңа жаңалық"}</div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" className="btn ghost" onClick={startCreate} disabled={uploading}>
                            Тазарту
                        </button>
                        <button type="button" className="btn success" onClick={save} disabled={uploading}>
                            {editingId ? "Update" : "Create"}
                        </button>
                    </div>
                </div>

                <div className="form">
                    <div className="form-row">
                        <div className="form-field" style={{ flex: 2 }}>
                            <label className="form-label">Title</label>
                            <input
                                className="input"
                                value={form.title}
                                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                placeholder="Тақырып"
                            />
                        </div>
                        <div className="form-field" style={{ maxWidth: 220 }}>
                            <label className="form-label">Published at</label>
                            <input
                                className="input"
                                type="datetime-local"
                                value={form.published_at}
                                onChange={(e) => setForm((p) => ({ ...p, published_at: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label className="form-label admin-news__label-big">Excerpt (қысқаша)</label>
                            <textarea
                                className="input"
                                rows={2}
                                value={form.excerpt}
                                onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                                placeholder="Қысқаша сипаттама"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-field">
                            <label className="form-label">Content (HTML)</label>
                            <textarea
                                className="input"
                                rows={10}
                                value={form.content_html}
                                onChange={(e) => setForm((p) => ({ ...p, content_html: e.target.value }))}
                                placeholder="<p>...</p>"
                            />
                        </div>
                    </div>

                    <div className="form-row" style={{ alignItems: "flex-end" }}>
                        <div className="form-field" style={{ flex: 2 }}>
                            <label className="form-label">Cover URL</label>
                            <input
                                className="input"
                                value={form.cover_url}
                                onChange={(e) => setForm((p) => ({ ...p, cover_url: e.target.value }))}
                                placeholder="/uploads/..."
                            />
                        </div>
                        <div className="form-field" style={{ flex: 1 }}>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => uploadCover(e.target.files?.[0])}
                            />
                            <button
                                className="btn"
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? "Жүктелуде..." : "📷 Cover upload"}
                            </button>
                        </div>
                        <div className="form-field" style={{ minWidth: 160 }}>
                            <label className="form-label" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input
                                    type="checkbox"
                                    checked={!!form.featured}
                                    onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
                                />
                                Featured
                            </label>
                        </div>
                    </div>

                    {form.cover_url ? (
                        <div style={{ marginTop: 10 }}>
                            <img
                                src={form.cover_url}
                                alt=""
                                style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }}
                                onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="card" style={{ marginTop: 18 }}>
                <div className="admin-news__list-title">Барлық жаңалық</div>
                <div className="table-wrap">
                    <table className="table" style={{ minWidth: 900 }}>
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Slug</th>
                            <th>Featured</th>
                            <th>Published</th>
                            <th>Әрекет</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.map((n) => (
                            <tr key={n.id}>
                                <td>{n.id}</td>
                                <td style={{ maxWidth: 360 }}>
                                    <div style={{ fontWeight: 700 }}>{n.title}</div>
                                    {n.excerpt ? <div className="muted" style={{ fontSize: 13 }}>{n.excerpt}</div> : null}
                                </td>
                                <td>{n.slug}</td>
                                <td>{n.featured ? "✅" : "—"}</td>
                                <td>{(n.published_at || "").slice(0, 10)}</td>
                                <td style={{ minWidth: 220 }}>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button className="btn" type="button" onClick={() => startEdit(n)} disabled={uploading}>
                                            Edit
                                        </button>
                                        <button className="btn danger" type="button" onClick={() => del(n.id)} disabled={uploading}>
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {list.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={6} className="muted">Тізім бос.</td>
                            </tr>
                        ) : null}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

