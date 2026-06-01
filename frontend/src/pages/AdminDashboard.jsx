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
            setMsg("Бұл бет тек сүпер админ үшін.");
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
                const m = e.message || "";
                setMsg(m.includes("404") ? "Қате: 404 — API табылмады. Бэкендті қайта іске қосыңыз." : "Қате: " + m);
            })
            .finally(() => setLoading(false));
    }, [nav]);

    if (loading) {
        return (
            <div style={S.page}>
                <Header />
                <p style={S.muted}>Жүктелуде…</p>
            </div>
        );
    }

    if (msg) {
        return (
            <div style={S.page}>
                <Header />
                <div style={S.errorBanner}>{msg}</div>
            </div>
        );
    }

    const maxDaily = Math.max(1, ...dailyData.map((x) => x.count || 0));

    return (
        <div style={S.page}>
            <Header />

            <div style={S.cards}>
                <StatCard icon="👥" label="Қолданушылар" value={stats.users} hint="Жүйеде тіркелгендер" accent="#2563eb" />
                <StatCard icon="🩺" label="Дәрігерлер" value={stats.doctors} hint="Барлық дәрігерлер" accent="#0891b2" />
                <StatCard icon="📅" label="Жазылулар" value={stats.appointments} hint="Барлық жазылулар" accent="#7c3aed" />
                <StatCard icon="⭐" label="Пікірлер" value={stats.reviews} hint="Қалдырылған пікірлер" accent="#d97706" />
            </div>

            {dailyData.length > 0 && (
                <section style={S.section}>
                    <div style={S.sectionHead}>
                        <h3 style={S.sectionTitle}>Күндік жазылулар</h3>
                        <span style={S.sectionSub}>Соңғы 7 күн</span>
                    </div>
                    <div style={S.chart}>
                        {dailyData.map((d) => {
                            const hPct = (d.count || 0) / maxDaily;
                            const barH = Math.max(6, hPct * 180);
                            return (
                                <div key={d.date} style={S.barWrap} title={`${d.date}: ${d.count}`}>
                                    <span style={S.barValue}>{d.count ?? 0}</span>
                                    <div style={{ ...S.bar, height: barH }} />
                                    <span style={S.barLabel}>{d.date ? d.date.slice(5) : ""}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <section style={S.section}>
                <div style={S.sectionHead}>
                    <h3 style={S.sectionTitle}>Төмен бағалы пікірлер</h3>
                    <span style={S.sectionSub}>1 жұлдыз</span>
                </div>
                {lowReviews.length === 0 ? (
                    <p style={S.muted}>Әзірге 1 жұлдызды пікір жоқ.</p>
                ) : (
                    <div style={S.tableWrap}>
                        <table style={S.table}>
                            <thead>
                                <tr>
                                    <th style={S.th}>Клиент</th>
                                    <th style={S.th}>Пікір</th>
                                    <th style={S.th}>Дәрігер (мамандығы)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowReviews.map((r) => (
                                    <tr key={r.id} style={S.tr}>
                                        <td style={S.td}>{r.patient_name || "—"}</td>
                                        <td style={{ ...S.td, color: "#475569", maxWidth: 420 }}>{r.text || "—"}</td>
                                        <td style={S.td}>
                                            {r.doctor_specialty ? `${r.doctor_name || "—"} (${r.doctor_specialty})` : (r.doctor_name || "—")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function Header() {
    return (
        <div style={S.header}>
            <h1 style={S.title}>Басқару панелі</h1>
            <p style={S.subtitle}>Платформаның жалпы көрсеткіштері</p>
        </div>
    );
}

function StatCard({ icon, label, value, hint, accent }) {
    return (
        <div style={S.card}>
            <div style={{ ...S.cardIcon, background: accent + "1a", color: accent }}>{icon}</div>
            <div style={S.cardBody}>
                <div style={S.cardLabel}>{label}</div>
                <div style={{ ...S.cardValue, color: accent }}>{value}</div>
                <div style={S.cardHint}>{hint}</div>
            </div>
        </div>
    );
}

const S = {
    page: { maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px" },
    header: { marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 },
    subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
    muted: { color: "#94a3b8", fontSize: 14 },
    errorBanner: { background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "14px 18px", fontWeight: 600, fontSize: 14 },

    cards: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14,
    },
    card: {
        display: "flex",
        gap: 14,
        alignItems: "center",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: "18px 18px",
    },
    cardIcon: {
        width: 48, height: 48, borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
    },
    cardBody: { minWidth: 0 },
    cardLabel: { fontSize: 13, color: "#64748b", fontWeight: 600 },
    cardValue: { fontSize: 28, fontWeight: 800, lineHeight: 1.1, marginTop: 2 },
    cardHint: { fontSize: 12, color: "#94a3b8", marginTop: 2 },

    section: {
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: "20px 22px",
        marginTop: 24,
    },
    sectionHead: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 },
    sectionSub: { fontSize: 13, color: "#94a3b8" },

    chart: {
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        height: 230,
        paddingTop: 10,
    },
    barWrap: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
        height: "100%",
    },
    bar: {
        width: "100%",
        maxWidth: 46,
        borderRadius: "8px 8px 0 0",
        background: "linear-gradient(180deg, #6366f1, #4f46e5)",
        transition: "height 0.3s",
    },
    barValue: { fontSize: 13, fontWeight: 700, color: "#334155" },
    barLabel: { fontSize: 11, color: "#94a3b8" },

    tableWrap: { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10 },
    table: { width: "100%", borderCollapse: "collapse", minWidth: 560 },
    th: {
        textAlign: "left", padding: "12px 14px", fontSize: 12, fontWeight: 700,
        color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em",
        borderBottom: "1px solid #e2e8f0", background: "#f8fafc",
    },
    tr: { borderBottom: "1px solid #f1f5f9" },
    td: { padding: "12px 14px", fontSize: 14, color: "#0f172a", verticalAlign: "top" },
};
