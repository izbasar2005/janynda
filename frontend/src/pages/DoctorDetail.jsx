import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, token } from "../services/api";

const NO_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <rect width='100%' height='100%' fill='#0b1220'/>
    <circle cx='128' cy='102' r='46' fill='#1f2a44'/>
    <rect x='52' y='160' width='152' height='64' rx='32' fill='#1f2a44'/>
  </svg>`);

function normalizePhoto(url) {
    if (!url) return NO_AVATAR;
    if (url.startsWith("http") || url.startsWith("//")) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
}

function fmtDate(s) {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" });
    } catch {
        return String(s);
    }
}

function Stars({ rating }) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return (
        <span className="doctor-detail-stars" aria-label={`${r} жұлдыз`}>
            {"★".repeat(r)}{"☆".repeat(5 - r)}
        </span>
    );
}

const TAB_REVIEWS = "reviews";
const TAB_ABOUT = "about";

export default function DoctorDetail() {
    const { id } = useParams();
    const [doc, setDoc] = useState(null);
    const [reviews, setReviews] = useState({ average_rating: 0, total: 0, reviews: [] });
    const [myReviewIds, setMyReviewIds] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [me, setMe] = useState(null);
    const [msg, setMsg] = useState("");
    const [activeTab, setActiveTab] = useState(TAB_REVIEWS);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [submitMsg, setSubmitMsg] = useState("");

    useEffect(() => {
        if (!id) return;
        api(`/api/v1/doctors/${id}`)
            .then(setDoc)
            .catch((e) => setMsg("Дәрігер табылмады: " + e.message));
    }, [id]);

    useEffect(() => {
        if (!id) return;
        api(`/api/v1/doctors/${id}/reviews`)
            .then(setReviews)
            .catch(() => setReviews({ average_rating: 0, total: 0, reviews: [] }));
    }, [id]);

    useEffect(() => {
        const t = token();
        if (!t) return;
        api("/api/v1/me", { auth: true })
            .then((u) => {
                setMe(u);
                if (u?.role !== "patient") return;
                api("/api/v1/appointments/my", { auth: true })
                    .then((d) => setAppointments(Array.isArray(d) ? d : []))
                    .catch(() => setAppointments([]));
                api("/api/v1/reviews/my", { auth: true })
                    .then((data) => setMyReviewIds(data.doctor_user_ids || []))
                    .catch(() => setMyReviewIds([]));
            })
            .catch(() => setMe(null));
    }, []);

    const hasAppointment = doc && me?.role === "patient" && appointments.some((a) => Number(a.doctor_user_id) === Number(doc.user_id));
    const alreadyReviewed = doc && myReviewIds.includes(Number(doc.user_id));
    const canReview = hasAppointment && !alreadyReviewed;
    const reviewsList = reviews.reviews || [];

    async function submitReview(e) {
        e.preventDefault();
        setSubmitMsg("");
        if (!doc) return;
        try {
            await api("/api/v1/reviews", {
                method: "POST",
                auth: true,
                body: { doctor_user_id: doc.user_id, rating: reviewRating, text: reviewText.trim() },
            });
            setShowReviewForm(false);
            setReviewText("");
            setReviewRating(5);
            setMyReviewIds((prev) => [...prev, doc.user_id]);
            const res = await api(`/api/v1/doctors/${id}/reviews`);
            setReviews(res);
        } catch (err) {
            setSubmitMsg(err.message || "Қате");
        }
    }

    if (msg) {
        return (
            <div className="page">
                <p className="form-error">{msg}</p>
                <Link to="/doctors">← Дәрігерлер тізімі</Link>
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="page">
                <p className="muted">Жүктелуде...</p>
            </div>
        );
    }

    const photoSrc = normalizePhoto(doc.photo_url);
    const avg = reviews.average_rating != null ? Number(reviews.average_rating).toFixed(1) : "0";
    const price = Number(doc.price || 0);

    return (
        <div className="page doctor-detail-page-v2">
            {/* Үлкен жасыл тақырып */}
            <div className="doctor-detail-header">
                <h1 className="doctor-detail-header__title">{doc.full_name ? doc.full_name.toUpperCase() : "ДӘРІГЕР"}</h1>
            </div>

            {/* Екі бағана: контент + сайдбар */}
            <div className="doctor-detail-layout">
                <div className="doctor-detail-main">
                    {/* Табтар */}
                    <div className="doctor-detail-tabs">
                        <button
                            type="button"
                            className={`doctor-detail-tab ${activeTab === TAB_REVIEWS ? "doctor-detail-tab--active" : ""}`}
                            onClick={() => setActiveTab(TAB_REVIEWS)}
                        >
                            Пікірлер
                        </button>
                        <button
                            type="button"
                            className={`doctor-detail-tab ${activeTab === TAB_ABOUT ? "doctor-detail-tab--active" : ""}`}
                            onClick={() => setActiveTab(TAB_ABOUT)}
                        >
                            Дәрігер туралы
                        </button>
                    </div>

                    {activeTab === TAB_REVIEWS && (
                        <div className="doctor-detail-tab-content">
                            {canReview && (
                                <div className="doctor-detail__review-section">
                                    {!showReviewForm ? (
                                        <button type="button" className="btn ghost" onClick={() => setShowReviewForm(true)}>
                                            Пікір қалдыру
                                        </button>
                                    ) : (
                                        <form onSubmit={submitReview} className="doctor-detail-review-form card doctor-detail-review-form-card">
                                            <label className="form-label">Рейтинг (1–5)</label>
                                            <div className="doctor-detail-stars-input">
                                                {[1, 2, 3, 4, 5].map((n) => (
                                                    <button
                                                        key={n}
                                                        type="button"
                                                        className={reviewRating >= n ? "is-active" : ""}
                                                        onClick={() => setReviewRating(n)}
                                                        aria-label={`${n} жұлдыз`}
                                                    >
                                                        ★
                                                    </button>
                                                ))}
                                            </div>
                                            <label className="form-label">Пікір (міндетсіз)</label>
                                            <textarea
                                                className="input"
                                                rows={3}
                                                value={reviewText}
                                                onChange={(e) => setReviewText(e.target.value)}
                                                placeholder="Пікіріңізді жазыңыз"
                                            />
                                            <div className="doctor-detail-review-form-actions">
                                                <button type="submit" className="btn">Жіберу</button>
                                                <button type="button" className="btn ghost" onClick={() => setShowReviewForm(false)}>
                                                    Болдырмау
                                                </button>
                                            </div>
                                            {submitMsg && <p className="form-error">{submitMsg}</p>}
                                        </form>
                                    )}
                                </div>
                            )}

                            {reviewsList.length === 0 ? (
                                <p className="muted doctor-detail-empty">Әзірге пікір жоқ.</p>
                            ) : (
                                <ul className="doctor-detail-reviews-list">
                                    {reviewsList.map((r) => (
                                        <li key={r.id} className="doctor-detail-review-card card">
                                            <div className="doctor-detail-review-card__head">
                                                <span className="doctor-detail-review-card__name">{(r.patient && r.patient.full_name) || "Пациент"}</span>
                                                <span className="doctor-detail-review-card__date">{fmtDate(r.created_at)}</span>
                                            </div>
                                            <div className="doctor-detail-review-card__rating">
                                                <Stars rating={r.rating} />
                                            </div>
                                            {r.text && <p className="doctor-detail-review-card__text">{r.text}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {activeTab === TAB_ABOUT && (
                        <div className="doctor-detail-tab-content doctor-detail-about">
                            <div className="card doctor-detail-about-card">
                                <h3 className="doctor-detail-about__title">Ақпарат</h3>
                                <dl className="doctor-detail__meta">
                                    <div className="doctor-detail__meta-row">
                                        <dt>Тәжірибе</dt>
                                        <dd>{Number(doc.experience || 0)} жыл</dd>
                                    </div>
                                    <div className="doctor-detail__meta-row">
                                        <dt>Бағасы</dt>
                                        <dd>{price} ₸</dd>
                                    </div>
                                    {doc.education && (
                                        <div className="doctor-detail__meta-row">
                                            <dt>Білімі</dt>
                                            <dd>{doc.education}</dd>
                                        </div>
                                    )}
                                    {doc.languages && (
                                        <div className="doctor-detail__meta-row">
                                            <dt>Тілдері</dt>
                                            <dd>{doc.languages}</dd>
                                        </div>
                                    )}
                                </dl>
                                <p className="doctor-detail-about__specialty muted">
                                    <strong>Мамандығы:</strong> {doc.specialty || "—"}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Сайдбар — жабысқақ карточка */}
                <aside className="doctor-detail-sidebar">
                    <div className="doctor-detail-sidebar-card card">
                        <div className="doctor-detail-sidebar__photo-wrap">
                            <img
                                src={photoSrc}
                                alt={doc.full_name || ""}
                                className="doctor-detail-sidebar__photo"
                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = NO_AVATAR; }}
                            />
                        </div>
                        <h2 className="doctor-detail-sidebar__name">{doc.full_name || "Аты көрсетілмеген"}</h2>
                        <p className="doctor-detail-sidebar__experience muted">Тәжірибе: {Number(doc.experience || 0)} жыл</p>
                        <p className="doctor-detail-sidebar__price">
                            Қабылдау: <strong className="doctor-detail-sidebar__price-value">{price} ₸</strong>
                        </p>
                        <div className="doctor-detail-sidebar__stats">
                            <span className="doctor-detail-sidebar__rating">
                                <span className="doctor-detail-sidebar__star">★</span> {avg}
                            </span>
                            <span className="doctor-detail-sidebar__reviews-count">
                                <span className="doctor-detail-sidebar__bubble">💬</span> {reviews.total}
                            </span>
                        </div>
                        <div className="doctor-detail-sidebar__action">
                            {!token() ? (
                                <Link to="/login" className="btn doctor-detail-sidebar__btn">Кіру</Link>
                            ) : me?.role === "patient" || me?.role === "user" ? (
                                <Link to={`/book/${doc.id}`} className="btn doctor-detail-sidebar__btn">Жазылу</Link>
                            ) : null}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
