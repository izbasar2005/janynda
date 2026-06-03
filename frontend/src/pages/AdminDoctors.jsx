import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, token } from "../services/api";
import TableWrap from "../components/ui/TableWrap";

function parseJwt(t) {
    try {
        const base = t.split(".")[1];
        const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
        return null;
    }
}

function DoctorFields({ uid, f, setField }) {
    return (
        <>
            <div className="admin-mobile-card__field">
                <label htmlFor={`specialty-${uid}`}>Мамандығы</label>
                <input
                    id={`specialty-${uid}`}
                    className="input"
                    value={f.specialty || ""}
                    onChange={(e) => setField(uid, "specialty", e.target.value)}
                    placeholder="Мамандығы (мыс: терапевт)"
                />
            </div>
            <div className="admin-mobile-card__field">
                <label htmlFor={`experience-${uid}`}>Тәжірибе (жыл)</label>
                <input
                    id={`experience-${uid}`}
                    className="input"
                    type="number"
                    value={f.experience ?? 0}
                    onChange={(e) => setField(uid, "experience", e.target.value)}
                    placeholder="Тәжірибе"
                />
            </div>
            <div className="admin-mobile-card__field">
                <label htmlFor={`price-${uid}`}>Баға (₸)</label>
                <input
                    id={`price-${uid}`}
                    className="input"
                    type="number"
                    value={f.price ?? 0}
                    onChange={(e) => setField(uid, "price", e.target.value)}
                    placeholder="Баға"
                />
            </div>
            <div className="admin-mobile-card__field">
                <label htmlFor={`education-${uid}`}>Білімі</label>
                <input
                    id={`education-${uid}`}
                    className="input"
                    value={f.education || ""}
                    onChange={(e) => setField(uid, "education", e.target.value)}
                    placeholder="Білімі (мыс: ҚазҰМУ, 2018)"
                />
            </div>
            <div className="admin-mobile-card__field">
                <label htmlFor={`languages-${uid}`}>Тілдері</label>
                <input
                    id={`languages-${uid}`}
                    className="input"
                    value={f.languages || ""}
                    onChange={(e) => setField(uid, "languages", e.target.value)}
                    placeholder="kk, ru, en"
                />
            </div>
        </>
    );
}

export default function AdminDoctors() {
    const nav = useNavigate();
    const [list, setList] = useState([]);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({});

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        const role = parseJwt(t)?.role;
        if (role !== "admin" && role !== "super_admin") {
            setMsg("Бұл бет тек admin немесе super_admin үшін.");
            return;
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function load() {
        setLoading(true);
        setMsg("");
        try {
            const data = await api("/api/v1/admin/doctor-users", { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setList(arr);

            if (arr.length === 0) {
                setMsg("role=doctor user жоқ. Admin Users бетінде role=doctor қылып қой.");
                setForm({});
                return;
            }

            const init = {};
            arr.forEach((u) => {
                init[u.user_id] = {
                    specialty: u.specialty || "",
                    experience: Number.isFinite(u.experience) ? u.experience : 0,
                    price: Number.isFinite(u.price) ? u.price : 0,
                    education: u.education || "",
                    languages: u.languages || "",
                    has_profile: !!u.has_profile,
                };
            });
            setForm(init);
        } catch (e) {
            setMsg(`Қате: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    function setField(userId, key, value) {
        setForm((p) => ({
            ...p,
            [userId]: { ...(p[userId] || {}), [key]: value },
        }));
    }

    async function createProfile(userId) {
        try {
            const f = form[userId] || {};
            const specialty = (f.specialty || "").trim();
            const experience = parseInt(f.experience || 0, 10);
            const price = parseInt(f.price || 0, 10);
            const education = (f.education || "").trim();
            const languages = (f.languages || "").trim();

            if (!specialty) return alert("Мамандығын толтыр.");
            if (experience < 0 || price < 0) return alert("Тәжірибе/баға теріс болмауы керек.");

            await api("/api/v1/admin/doctors", {
                method: "POST",
                auth: true,
                body: { user_id: userId, specialty, experience, price, education, languages },
            });

            alert("Doctor профилі жасалды ✅");
            load();
        } catch (e) {
            alert(`Қате: ${e.message}`);
        }
    }

    async function updateProfile(userId) {
        try {
            const f = form[userId] || {};
            const specialty = (f.specialty || "").trim();
            const experience = parseInt(f.experience || 0, 10);
            const price = parseInt(f.price || 0, 10);
            const education = (f.education || "").trim();
            const languages = (f.languages || "").trim();

            if (!specialty) return alert("Мамандығын толтыр.");
            if (experience < 0 || price < 0) return alert("Тәжірибе/баға теріс болмауы керек.");

            await api(`/api/v1/admin/doctors/${userId}`, {
                method: "PUT",
                auth: true,
                body: { specialty, experience, price, education, languages },
            });

            alert("Сақталды ✅");
            load();
        } catch (e) {
            alert(`Қате: ${e.message}`);
        }
    }

    const msgClass = msg.startsWith("Қате") ? "admin-banner admin-banner--error" : "admin-banner admin-banner--info";

    return (
        <div className="page admin-doctors-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Admin — Doctor профилі</h2>
                    <p className="muted page-header__subtitle">
                        Мамандық, тәжірибе, баға, білім және тілдер. Аватарды дәрігер өз профилінен басқарады.
                    </p>
                </div>
            </div>

            {msg && <p className={msgClass}>{msg}</p>}
            {loading && <p className="muted">Жүктелуде...</p>}

            <div className="admin-mobile-cards" aria-label="Дәрігерлер тізімі">
                {list.map((u) => {
                    const uid = u.user_id;
                    const f = form[uid] || {};
                    const has = !!f.has_profile;
                    return (
                        <article key={uid} className="card admin-mobile-card">
                            <header className="admin-mobile-card__head">
                                <div>
                                    <h3 className="admin-mobile-card__title">{u.full_name || `User #${uid}`}</h3>
                                    <p className="admin-mobile-card__meta">
                                        ID {uid} · {u.phone || "—"}
                                    </p>
                                </div>
                                <span className="admin-mobile-card__badge">
                                    {has ? "✅ Профиль бар" : "⛔ Профиль жоқ"}
                                </span>
                            </header>
                            <div className="admin-mobile-card__fields">
                                <DoctorFields uid={uid} f={f} setField={setField} />
                            </div>
                            <div className="admin-mobile-card__actions">
                                {has ? (
                                    <button className="btn success" onClick={() => updateProfile(uid)} type="button">
                                        Update
                                    </button>
                                ) : (
                                    <button className="btn" onClick={() => createProfile(uid)} type="button">
                                        Create
                                    </button>
                                )}
                            </div>
                        </article>
                    );
                })}
                {list.length === 0 && !loading && (
                    <p className="muted">Тізім бос.</p>
                )}
            </div>

            <div className="admin-doctors-table-view admin-desktop-table">
                <TableWrap>
                    <table className="table" style={{ minWidth: 1400 }}>
                        <thead>
                        <tr>
                            <th>UserID</th>
                            <th>Аты-жөні</th>
                            <th>Телефон</th>
                            <th>Профиль</th>
                            <th>Мамандығы</th>
                            <th>Тәжірибе (жыл)</th>
                            <th>Баға (₸)</th>
                            <th>Білімі</th>
                            <th>Тілдері</th>
                            <th>Әрекет</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.map((u) => {
                            const uid = u.user_id;
                            const f = form[uid] || {};
                            const has = !!f.has_profile;

                            return (
                                <tr key={uid}>
                                    <td>{uid}</td>
                                    <td>{u.full_name || ""}</td>
                                    <td>{u.phone || ""}</td>
                                    <td>{has ? "✅ Бар" : "⛔ Жоқ"}</td>
                                    <td style={{ minWidth: 220 }}>
                                        <input
                                            className="input"
                                            value={f.specialty || ""}
                                            onChange={(e) => setField(uid, "specialty", e.target.value)}
                                            placeholder="Мамандығы (мыс: терапевт)"
                                        />
                                    </td>
                                    <td style={{ minWidth: 140 }}>
                                        <input
                                            className="input"
                                            type="number"
                                            value={f.experience ?? 0}
                                            onChange={(e) => setField(uid, "experience", e.target.value)}
                                            placeholder="Тәжірибе"
                                        />
                                    </td>
                                    <td style={{ minWidth: 140 }}>
                                        <input
                                            className="input"
                                            type="number"
                                            value={f.price ?? 0}
                                            onChange={(e) => setField(uid, "price", e.target.value)}
                                            placeholder="Баға"
                                        />
                                    </td>
                                    <td style={{ minWidth: 240 }}>
                                        <input
                                            className="input"
                                            value={f.education || ""}
                                            onChange={(e) => setField(uid, "education", e.target.value)}
                                            placeholder="Білімі (мыс: ҚазҰМУ, 2018)"
                                        />
                                    </td>
                                    <td style={{ minWidth: 180 }}>
                                        <input
                                            className="input"
                                            value={f.languages || ""}
                                            onChange={(e) => setField(uid, "languages", e.target.value)}
                                            placeholder="kk, ru, en"
                                        />
                                    </td>
                                    <td style={{ minWidth: 150 }}>
                                        {has ? (
                                            <button className="btn success" onClick={() => updateProfile(uid)} type="button">
                                                Update
                                            </button>
                                        ) : (
                                            <button className="btn" onClick={() => createProfile(uid)} type="button">
                                                Create
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {list.length === 0 && !loading && (
                            <tr>
                                <td colSpan={10} className="muted">
                                    Тізім бос.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </TableWrap>
            </div>
        </div>
    );
}
