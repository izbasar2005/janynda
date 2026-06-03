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

    const msgClass = msg.startsWith("Қате") ? "admin-banner admin-banner--error" : "admin-banner admin-banner--info";

    return (
        <div className="page admin-news-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Жаңалықтар</h2>
                    <p className="muted page-header__subtitle">Жаңалық пен мақалаларды қосу, өңдеу және өшіру.</p>
                </div>
            </div>

            {msg && <div className={msgClass}>{msg}</div>}

            <div className="admin-news-layout">
                <section className="admin-news-form" aria-label="Жаңалық формасы">
                    <div className="admin-news-form__top">
                        <h3 className="admin-news-form__title">
                            {editingId ? `Өңдеу #${editingId}` : "Жаңа жаңалық"}
                        </h3>
                        <div className="admin-news-form__actions">
                            <button type="button" className="btn ghost" onClick={startCreate} disabled={uploading}>
                                Тазарту
                            </button>
                            <button type="button" className="btn" onClick={save} disabled={uploading}>
                                {editingId ? "Жаңарту" : "Қосу"}
                            </button>
                        </div>
                    </div>

                    <div className="admin-news-field">
                        <label htmlFor="admin-news-title">Тақырып</label>
                        <input
                            id="admin-news-title"
                            className="input"
                            value={form.title}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Тақырыпты енгізіңіз"
                        />
                    </div>

                    <div className="admin-news-field">
                        <label htmlFor="admin-news-date">Жариялану күні</label>
                        <input
                            id="admin-news-date"
                            className="input"
                            type="datetime-local"
                            value={form.published_at}
                            onChange={(e) => setForm((p) => ({ ...p, published_at: e.target.value }))}
                        />
                    </div>

                    <div className="admin-news-field">
                        <label htmlFor="admin-news-excerpt">Қысқаша сипаттама</label>
                        <textarea
                            id="admin-news-excerpt"
                            className="input"
                            rows={2}
                            value={form.excerpt}
                            onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                            placeholder="Қысқаша сипаттама"
                        />
                    </div>

                    <div className="admin-news-field">
                        <label htmlFor="admin-news-html">Мазмұны (HTML)</label>
                        <textarea
                            id="admin-news-html"
                            className="input admin-news-field__html"
                            rows={9}
                            value={form.content_html}
                            onChange={(e) => setForm((p) => ({ ...p, content_html: e.target.value }))}
                            placeholder="<p>...</p>"
                        />
                    </div>

                    <div className="admin-news-field">
                        <label htmlFor="admin-news-cover">Мұқаба (URL)</label>
                        <input
                            id="admin-news-cover"
                            className="input"
                            value={form.cover_url}
                            onChange={(e) => setForm((p) => ({ ...p, cover_url: e.target.value }))}
                            placeholder="/uploads/..."
                        />
                    </div>

                    <div className="admin-news-cover-row">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => uploadCover(e.target.files?.[0])}
                        />
                        <button className="btn ghost" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                            {uploading ? "Жүктелуде…" : "📷 Мұқаба жүктеу"}
                        </button>
                        <label className="admin-news-check">
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
                            className="admin-news-cover-preview"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                    ) : null}
                </section>

                <section className="admin-news-list-panel" aria-label="Жаңалықтар тізімі">
                    <h3 className="admin-news-list-panel__head">
                        Барлық жаңалықтар
                        <span className="admin-news-count">{list.length}</span>
                    </h3>
                    {loading && <p className="muted">Жүктелуде…</p>}
                    {!loading && list.length === 0 && <p className="muted">Тізім бос.</p>}
                    <div className="admin-news-cards">
                        {list.map((n) => (
                            <article key={n.id} className="admin-news-item">
                                <div className="admin-news-item__media">
                                    {n.cover_url ? (
                                        <img
                                            src={n.cover_url}
                                            alt=""
                                            className="admin-news-item__img"
                                            onError={(e) => (e.currentTarget.style.display = "none")}
                                        />
                                    ) : (
                                        <span aria-hidden>📰</span>
                                    )}
                                </div>
                                <div className="admin-news-item__body">
                                    <h4 className="admin-news-item__title">
                                        {n.featured ? <span className="admin-news-item__star" aria-label="Басты">★</span> : null}
                                        {n.title}
                                    </h4>
                                    {n.excerpt ? <p className="admin-news-item__excerpt">{n.excerpt}</p> : null}
                                    <p className="admin-news-item__meta">
                                        #{n.id} · {(n.published_at || "").slice(0, 10) || "күні жоқ"}
                                    </p>
                                </div>
                                <div className="admin-news-item__actions">
                                    <button className="btn ghost" type="button" onClick={() => startEdit(n)} disabled={uploading}>
                                        Өңдеу
                                    </button>
                                    <button className="btn ghost btn--danger" type="button" onClick={() => del(n.id)} disabled={uploading}>
                                        Жою
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
