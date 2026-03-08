import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

function normalizePhoto(url) {
    if (!url || !String(url).trim()) return "";
    const u = String(url).trim();
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/")) return u;
    return "/" + u;
}

export default function AdminDoctorsStats() {
    const nav = useNavigate();
    const [topDoctors, setTopDoctors] = useState([]);
    const [doctorRatings, setDoctorRatings] = useState([]);
    const [showFullList, setShowFullList] = useState(false);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        const role = parseJwt(t)?.role;
        if (role !== "super_admin") {
            setMsg("Бұл бет тек super_admin үшін.");
            setLoading(false);
            return;
        }
        Promise.all([
            api("/api/v1/admin/dashboard/top-doctors", { auth: true }),
            api("/api/v1/admin/dashboard/doctor-ratings", { auth: true }),
        ])
            .then(([topDocList, ratingList]) => {
                setTopDoctors(Array.isArray(topDocList) ? topDocList : []);
                setDoctorRatings(Array.isArray(ratingList) ? ratingList : []);
            })
            .catch((e) => setMsg("Қате: " + (e.message || "серверге қосылу мүмкін емес")))
            .finally(() => setLoading(false));
    }, [nav]);

    if (loading) {
        return (
            <div className="page">
                <div className="page-header">
                    <h2 className="page-header__title">Дәрігерлер</h2>
                    <p className="muted">Жүктелуде…</p>
                </div>
            </div>
        );
    }

    if (msg) {
        return (
            <div className="page">
                <div className="page-header">
                    <h2 className="page-header__title">Дәрігерлер</h2>
                    <p className="muted">{msg}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page admin-doctors-stats-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Дәрігерлер</h2>
                    <p className="muted page-header__subtitle">
                        Дәрігерлер статистикасы — белсенділік және рейтинг.
                    </p>
                </div>
            </div>

            <section className="admin-dashboard-section card" style={{ marginTop: 24 }}>
                <h3 className="admin-dashboard-section__title">Ең белсенді дәрігерлер</h3>
                <p className="muted admin-dashboard-section__subtitle">
                    Жазылулар саны бойынша. Алдымен топ-3 көрсетіледі; «Толық тізімді көрсету» — барлық дәрігерлер карточкамен.
                </p>
                {topDoctors.length === 0 ? (
                    <p className="muted">Деректер жоқ.</p>
                ) : (
                    <>
                        <div className="admin-doctors-cards">
                            {(showFullList ? topDoctors : topDoctors.slice(0, 3)).map((d, i) => (
                                <Link
                                    key={d.id || i}
                                    to={`/doctors/${d.id}`}
                                    className="admin-doctor-card card"
                                    style={{ textDecoration: "none", color: "inherit" }}
                                >
                                    <div className="admin-doctor-card__img-wrap">
                                        {normalizePhoto(d.photo_url) ? (
                                            <img src={normalizePhoto(d.photo_url)} alt="" className="admin-doctor-card__img" />
                                        ) : (
                                            <div className="admin-doctor-card__placeholder">
                                                {(d.doctor_name || "?")[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="admin-doctor-card__name">{d.doctor_name || "—"}</div>
                                    <div className="admin-doctor-card__specialty">{d.specialty || "—"}</div>
                                    <div className="admin-doctor-card__count">{d.appointments ?? 0} жазылу</div>
                                </Link>
                            ))}
                        </div>
                        {!showFullList && topDoctors.length > 3 && (
                            <p style={{ marginTop: 16 }}>
                                <button type="button" className="btn primary" onClick={() => setShowFullList(true)}>
                                    Толық тізімді көрсету ({topDoctors.length} дәрігер)
                                </button>
                            </p>
                        )}
                        {showFullList && topDoctors.length > 3 && (
                            <p style={{ marginTop: 16 }}>
                                <button type="button" className="btn secondary" onClick={() => setShowFullList(false)}>
                                    Топ-3 көрсету
                                </button>
                            </p>
                        )}
                    </>
                )}
            </section>

            <section className="admin-dashboard-section card" style={{ marginTop: 28 }}>
                <h3 className="admin-dashboard-section__title">Дәрігер рейтингі</h3>
                <p className="muted admin-dashboard-section__subtitle">
                    Орташа баға және пікірлер саны (reviews бойынша).
                </p>
                {doctorRatings.length === 0 ? (
                    <p className="muted">Деректер жоқ.</p>
                ) : (
                    <div className="admin-doctors-cards">
                        {doctorRatings.map((dr, i) => (
                            <Link
                                key={dr.id || i}
                                to={`/doctors/${dr.id}`}
                                className="admin-doctor-card card"
                                style={{ textDecoration: "none", color: "inherit" }}
                            >
                                <div className="admin-doctor-card__img-wrap">
                                    {normalizePhoto(dr.photo_url) ? (
                                        <img src={normalizePhoto(dr.photo_url)} alt="" className="admin-doctor-card__img" />
                                    ) : (
                                        <div className="admin-doctor-card__placeholder">
                                            {(dr.doctor_name || "?")[0]}
                                        </div>
                                    )}
                                </div>
                                <div className="admin-doctor-card__name">{dr.doctor_name || "—"}</div>
                                <div className="admin-doctor-card__specialty">{dr.specialty || "—"}</div>
                                <div className="admin-doctor-card__count">
                                    {(Number(dr.rating) || 0).toFixed(1)} ★ · {dr.reviews ?? 0} пікір
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
