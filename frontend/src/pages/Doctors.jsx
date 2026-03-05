import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, token } from "../services/api";

function roleFromToken() {
    const t = token();
    if (!t) return "guest";
    try {
        const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return p?.role || "user";
    } catch {
        return "user";
    }
}

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
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
}

export default function Doctors() {
    const [list, setList] = useState([]);
    const [msg, setMsg] = useState("");
    const [q, setQ] = useState("");

    useEffect(() => {
        api("/api/v1/doctors")
            .then((d) => {
                const arr = Array.isArray(d) ? d : [];
                if (arr.length === 0) {
                    setMsg("Қазір дәрігер жоқ. (Admin Doctors беттен қосуға болады)");
                    setList([]);
                    return;
                }
                setMsg("");
                setList(arr);
            })
            .catch((e) => setMsg("Қате: " + e.message));
    }, []);

    const role = roleFromToken();

    const filtered = useMemo(() => {
        const s = (q || "").trim().toLowerCase();
        if (!s) return list;

        return list.filter((d) => {
            const name = String(d.full_name || "").toLowerCase();
            const spec = String(d.specialty || "").toLowerCase();
            const edu = String(d.education || "").toLowerCase();
            const lang = String(d.languages || "").toLowerCase();
            return name.includes(s) || spec.includes(s) || edu.includes(s) || lang.includes(s);
        });
    }, [q, list]);

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Дәрігерлер тізімі</h2>
                    <p className="muted page-header__subtitle">
                        Барлығы: <b>{list.length}</b>
                    </p>
                </div>

                <div style={{ width: 320, maxWidth: "100%" }}>
                    <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                        Іздеу (аты / мамандық / білім / тіл)
                    </div>
                    <input
                        className="input"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Мысалы: терапевт"
                    />
                </div>
            </div>

            {msg && (
                <div className="empty-state">
                    <h4 className="empty-state__title">Пока дәрігерлер жоқ</h4>
                    <p className="empty-state__text">{msg}</p>
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 20,
                    marginTop: 16,
                }}
            >
                {filtered.map((d) => (
                    <DoctorCard key={`${d.id}-${d.user_id}`} d={d} role={role} />
                ))}
            </div>

            <style>{`
        @keyframes pulse {
          0% { transform: translateX(-30%); }
          100% { transform: translateX(30%); }
        }
      `}</style>
        </div>
    );
}

function DoctorCard({ d, role }) {
    const src = normalizePhoto(d.photo_url);
    const imgRef = useRef(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setLoaded(false);
    }, [src]);

    useEffect(() => {
        const img = imgRef.current;
        if (img && img.complete) {
            setLoaded(true);
        }
    }, [src]);

    return (
        <div
            className="card"
            style={{
                padding: 20,
                borderRadius: 18,
                transition: "transform .15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <div
                    style={{
                        width: 124,
                        height: 124,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "2px solid rgba(255,255,255,0.10)",
                        position: "relative",
                    }}
                >
                    {!loaded && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                background:
                                    "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
                                animation: "pulse 1.2s infinite",
                                zIndex: 1,
                            }}
                        />
                    )}

                    <img
                        ref={imgRef}
                        src={src}
                        alt={d.full_name || "doctor"}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                        }}
                        onLoad={() => setLoaded(true)}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = NO_AVATAR;
                            setLoaded(true);
                        }}
                    />
                </div>
            </div>

            <h3 style={{ textAlign: "center", margin: 0 }}>
                {d.full_name || "Аты көрсетілмеген"}
            </h3>

            <p className="muted" style={{ textAlign: "center", margin: "8px 0 14px" }}>
                {d.specialty || "Мамандығы көрсетілмеген"}
            </p>

            <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Тәжірибе</span>
                    <b>{Number(d.experience || 0)} жыл</b>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Бағасы</span>
                    <b>{Number(d.price || 0)} ₸</b>
                </div>

                {d.education && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="muted">Білімі</span>
                        <span>{d.education}</span>
                    </div>
                )}

                {d.languages && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="muted">Тілдері</span>
                        <span>{d.languages}</span>
                    </div>
                )}
            </div>

            <div style={{ marginTop: 16, textAlign: "center" }}>
                {role === "guest" ? (
                    <Link to="/login" className="btn">
                        Кіру
                    </Link>
                ) : role === "patient" || role === "user" ? (
                    <Link to={`/book/${Number(d.id)}`} className="btn">
                        Жазылу
                    </Link>
                ) : (
                    <span className="muted">Тек пациент</span>
                )}
            </div>
        </div>
    );
}