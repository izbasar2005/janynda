import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

function formatDate(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" });
    } catch {
        return "";
    }
}

export default function NewsList() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [offset, setOffset] = useState(0);
    const limit = 12;

    useEffect(() => {
        setItems([]);
        setOffset(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        loadMore(true);
    }, []);

    async function loadMore(reset = false) {
        if (loading) return;
        setLoading(true);
        setMsg("");
        try {
            const off = reset ? 0 : offset;
            const data = await api(`/api/v1/news?limit=${limit}&offset=${off}`);
            const arr = Array.isArray(data) ? data : [];
            setItems((p) => (reset ? arr : [...p, ...arr]));
            setOffset(off + arr.length);
            if (reset && arr.length === 0) setMsg("Жаңалық жоқ.");
        } catch (e) {
            setMsg(`Қате: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="page news-list-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Жаңалықтар</h2>
                    <p className="muted page-header__subtitle">
                        Денсаулық туралы жаңалықтар мен пайдалы мақалалар.
                    </p>
                </div>
            </div>

            {msg && <p className="muted news-list-page__msg">{msg}</p>}

            <div className="news-grid">
                {items.map((n) => (
                    <Link
                        key={n.id}
                        to={`/news/${n.slug}`}
                        className="news-card card"
                    >
                        <div className="news-card__cover">
                            {n.cover_url ? (
                                <img src={n.cover_url} alt="" className="news-card__img" loading="lazy" />
                            ) : (
                                <div className="news-card__placeholder" aria-hidden />
                            )}
                        </div>
                        <div className="news-card__body">
                            {n.featured ? (
                                <span className="news-card__featured">★ Басты жаңалық</span>
                            ) : null}
                            <div className="news-card__title">{n.title}</div>
                            {n.excerpt ? (
                                <div className="news-card__excerpt muted">{n.excerpt}</div>
                            ) : null}
                            <div className="news-card__meta muted">{formatDate(n.published_at)}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {items.length > 0 && (
                <div className="news-list-more">
                    <button className="btn" type="button" onClick={() => loadMore(false)} disabled={loading}>
                        {loading ? "Жүктелуде..." : "Тағы көрсету"}
                    </button>
                </div>
            )}
        </div>
    );
}
