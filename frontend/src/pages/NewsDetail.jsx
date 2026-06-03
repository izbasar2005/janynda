import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

export default function NewsDetail() {
    const { slug } = useParams();
    const [item, setItem] = useState(null);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setMsg("");
        api(`/api/v1/news/${encodeURIComponent(slug || "")}`)
            .then((d) => setItem(d || null))
            .catch((e) => setMsg(`Қате: ${e.message}`))
            .finally(() => setLoading(false));
    }, [slug]);

    if (loading) {
        return (
            <div className="page news-detail-page">
                <p className="muted">Жүктелуде...</p>
            </div>
        );
    }
    if (msg) {
        return (
            <div className="page news-detail-page">
                <p className="muted">{msg}</p>
            </div>
        );
    }
    if (!item) {
        return (
            <div className="page news-detail-page">
                <p className="muted">Табылмады.</p>
            </div>
        );
    }

    return (
        <div className="page news-detail-page">
            <article className="news-detail card">
                <div className="news-detail__top">
                    <Link to="/news" className="news-detail__back muted">
                        ← Барлық жаңалықтар
                    </Link>
                    <time className="muted" dateTime={item.published_at || undefined}>
                        {formatDate(item.published_at)}
                    </time>
                </div>

                <h1 className="news-detail__title">{item.title}</h1>

                {item.cover_url ? (
                    <div className="news-detail__cover">
                        <img className="news-detail__img" src={item.cover_url} alt="" />
                    </div>
                ) : null}

                {item.excerpt ? <p className="news-detail__excerpt muted">{item.excerpt}</p> : null}

                <div
                    className="news-detail__content"
                    dangerouslySetInnerHTML={{ __html: item.content_html || "" }}
                />
            </article>
        </div>
    );
}
