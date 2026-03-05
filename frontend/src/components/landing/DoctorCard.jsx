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

export default function DoctorCard({ doctor }) {
    const {
        full_name,
        specialty,
        experience = 0,
        price = 0,
        photo_url,
    } = doctor || {};
    const src = normalizePhoto(photo_url);
    const rating = 4.8;

    return (
        <div className="landing-doctor-card card">
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
                <span className="landing-doctor-card__rating" aria-label={`Рейтинг ${rating}`}>
                    ★ {rating}
                </span>
            </div>
            <p className="landing-doctor-card__price">
                Бағасы: <strong>{Number(price)} ₸</strong>
            </p>
            <Link to={`/book/${Number(doctor?.id)}`} className="btn landing-doctor-card__btn">
                Жазылу
            </Link>
        </div>
    );
}
