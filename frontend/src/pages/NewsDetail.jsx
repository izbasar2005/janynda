import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";

function formatDate(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleDateString();
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

    if (loading) return <p className="muted">Жүктелуде...</p>;
    if (msg) return <p className="muted">{msg}</p>;
    if (!item) return <p className="muted">Табылмады.</p>;

    return (
        <div className="page">
            <div className="news-detail card">
                <div className="news-detail__top">
                    <Link to="/news" className="muted" style={{ textDecoration: "none" }}>
                        ← Барлық жаңалық
                    </Link>
                    <div className="muted">{formatDate(item.published_at)}</div>
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
            </div>
        </div>
    );
}

