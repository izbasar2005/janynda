import { useEffect, useState } from "react";
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

export default function AdminDashboard() {
    const nav = useNavigate();
    const [stats, setStats] = useState({ users: 0, doctors: 0, appointments: 0, reviews: 0 });
    const [lowReviews, setLowReviews] = useState([]);
    const [dailyData, setDailyData] = useState([]);
    const [, setAllAppointments] = useState([]); // қолданылмайды, ескі сілтеме үшін
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
            api("/api/v1/admin/dashboard/stats", { auth: true }),
            api("/api/v1/admin/dashboard/low-reviews", { auth: true }),
            api("/api/v1/admin/dashboard/appointments-daily?days=7", { auth: true }),
        ])
            .then(([data, lowList, daily]) => {
                setStats({
                    users: Number(data.users ?? data.Users ?? 0),
                    doctors: Number(data.doctors ?? data.Doctors ?? 0),
                    appointments: Number(data.appointments ?? data.Appointments ?? 0),
                    reviews: Number(data.reviews ?? data.Reviews ?? 0),
                });
                setLowReviews(Array.isArray(lowList) ? lowList : []);
                const arr = Array.isArray(daily) ? daily : [];
                setDailyData(arr.map((d) => ({ ...d, count: Number(d.count ?? d.Count ?? 0) })));
            })
            .catch((e) => {
                const msg = e.message || "";
                setMsg(msg.includes("404") ? "Қате: 404 — API табылмады. Бэкендті қайта іске қосыңыз (мысалы: go run .)." : "Қате: " + msg);
            })
            .finally(() => setLoading(false));
    }, [nav]);

    if (loading) {
        return (
            <div className="page">
                <div className="page-header">
                    <h2 className="page-header__title">Super Admin — Dashboard</h2>
                    <p className="muted">Жүктелуде…</p>
                </div>
            </div>
        );
    }

    if (msg) {
        return (
            <div className="page">
                <div className="page-header">
                    <h2 className="page-header__title">Super Admin — Dashboard</h2>
                    <p className="muted">{msg}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page admin-dashboard-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Super Admin — Жалпы статистика</h2>
                    <p className="muted page-header__subtitle">
                        Платформа көрсеткіштері (Top Cards).
                    </p>
                </div>
            </div>

            <div className="admin-dashboard-cards">
                <div className="admin-dashboard-card card">
                    <div className="admin-dashboard-card__label">Users</div>
                    <div className="admin-dashboard-card__value">{stats.users}</div>
                    <p className="admin-dashboard-card__hint">Жүйеде тіркелген қолданушылар</p>
                </div>
                <div className="admin-dashboard-card card">
                    <div className="admin-dashboard-card__label">Doctors</div>
                    <div className="admin-dashboard-card__value">{stats.doctors}</div>
                    <p className="admin-dashboard-card__hint">Дәрігерлер саны</p>
                </div>
                <div className="admin-dashboard-card card">
                    <div className="admin-dashboard-card__label">Appointments</div>
                    <div className="admin-dashboard-card__value">{stats.appointments}</div>
                    <p className="admin-dashboard-card__hint">Жазылулар саны</p>
                </div>
                <div className="admin-dashboard-card card">
                    <div className="admin-dashboard-card__label">Reviews</div>
                    <div className="admin-dashboard-card__value">{stats.reviews}</div>
                    <p className="admin-dashboard-card__hint">Пікірлер саны</p>
                </div>
            </div>

            {dailyData.length > 0 && (
                <section className="admin-dashboard-section card" style={{ marginTop: 28 }}>
                    <h3 className="admin-dashboard-section__title">Күндік жазылулар (соңғы 7 күн)</h3>
                    <p className="muted admin-dashboard-section__subtitle">
                        Күн сайын қанша жазылу жасалғаны.
                    </p>
                    <div className="admin-chart">
                        <div className="admin-chart__bars" style={{ height: 200 }}>
                            {dailyData.map((d) => {
                                const max = Math.max(1, ...dailyData.map((x) => x.count || 0));
                                const hPct = max > 0 ? ((d.count || 0) / max) * 100 : 0;
                                const barHeightPx = max > 0 ? Math.max(6, (hPct / 100) * 200) : 0;
                                return (
                                    <div key={d.date} className="admin-chart__bar-wrap" title={`${d.date}: ${d.count}`}>
                                        <div className="admin-chart__bar" style={{ height: barHeightPx ? `${barHeightPx}px` : 0 }} />
                                        <span className="admin-chart__label">{d.date ? d.date.slice(5) : ""}</span>
                                        <span className="admin-chart__value">{d.count ?? 0}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {lowReviews.length > 0 && (
                <section className="admin-dashboard-section card" style={{ marginTop: 28 }}>
                    <h3 className="admin-dashboard-section__title">1 жұлдыз пікірлер</h3>
                    <p className="muted admin-dashboard-section__subtitle">
                        Төмен рейтинг берген клиент, пікірі және қай дәрігерге жазылғаны (мамандығымен).
                    </p>
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Клиент (аты-жөні)</th>
                                    <th>Пікір</th>
                                    <th>Дәрігер (мамандығы)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowReviews.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.patient_name || "—"}</td>
                                        <td style={{ maxWidth: 400 }}>{r.text || "—"}</td>
                                        <td>{r.doctor_specialty ? `${r.doctor_name || "—"} (${r.doctor_specialty})` : (r.doctor_name || "—")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
            {lowReviews.length === 0 && !loading && (
                <section className="admin-dashboard-section card" style={{ marginTop: 28 }}>
                    <h3 className="admin-dashboard-section__title">1 жұлдыз пікірлер</h3>
                    <p className="muted">Әзірге 1 жұлдыз пікір жоқ.</p>
                </section>
            )}
        </div>
    );
}
