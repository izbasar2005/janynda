import { Link } from "react-router-dom";

const NO_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <rect width='100%' height='100%' fill='%23e2e8f0'/>
    <circle cx='128' cy='100' r='50' fill='%2312bfae' opacity='0.3'/>
    <rect x='68' y='160' width='120' height='60' rx='30' fill='%2312bfae' opacity='0.3'/>
  </svg>`);

function normalizePhoto(url) {
    if (!url) return NO_AVATAR;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
}

function fmtDate(s) {
    if (!s) return "";
    try {
        return new Date(s).toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" });
    } catch {
        return "";
    }
}

function Stars({ rating }) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return <span className="landing-doctor-card-stars">{"★".repeat(r)}{"☆".repeat(5 - r)}</span>;
}

export default function DoctorCard({ doctor, reviewsData }) {
    const {
        full_name,
        specialty,
        experience = 0,
        price = 0,
        photo_url,
        id,
    } = doctor || {};
    const src = normalizePhoto(photo_url);
    const avgRating = reviewsData?.average_rating != null ? Number(reviewsData.average_rating).toFixed(1) : null;
    const lastReview = reviewsData?.reviews?.[0];

    return (
        <Link
            to={`/doctors/${Number(id)}`}
            className="landing-doctor-card card landing-doctor-card--link"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
            <div className="landing-doctor-card__photo-wrap">
                <img
                    src={src}
                    alt={full_name || "Дәрігер"}
                    className="landing-doctor-card__photo"
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = NO_AVATAR;
                    }}
                />
            </div>
            <h3 className="landing-doctor-card__name">{full_name || "Аты көрсетілмеген"}</h3>
            <p className="landing-doctor-card__specialty muted">{specialty || "Мамандығы жоқ"}</p>
            <div className="landing-doctor-card__meta">
                <span className="landing-doctor-card__exp">Тәжірибе: {Number(experience)} жыл</span>
                <span className="landing-doctor-card__rating" aria-label={avgRating ? `Орташа рейтинг ${avgRating}` : "Рейтинг жоқ"}>
                    ★ {avgRating ?? "—"}
                </span>
            </div>
            <p className="landing-doctor-card__price">
                Бағасы: <strong>{Number(price)} ₸</strong>
            </p>
            {lastReview && (
                <div className="landing-doctor-card__last-review">
                    <div className="landing-doctor-card__last-review-head">
                        <span className="landing-doctor-card__last-review-name">
                            {(lastReview.patient && lastReview.patient.full_name) || "Пациент"}
                        </span>
                        <span className="landing-doctor-card__last-review-date">{fmtDate(lastReview.created_at)}</span>
                    </div>
                    <div className="landing-doctor-card__last-review-stars">
                        <Stars rating={lastReview.rating} />
                    </div>
                    {lastReview.text && (
                        <p className="landing-doctor-card__last-review-text">
                            {lastReview.text.length > 120 ? lastReview.text.slice(0, 120) + "…" : lastReview.text}
                        </p>
                    )}
                </div>
            )}
        </Link>
    );
}
