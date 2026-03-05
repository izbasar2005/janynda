import { useEffect, useRef, useState } from "react";
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

export default function AdminDoctors() {
    const nav = useNavigate();
    const [list, setList] = useState([]);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({});
    const [uploading, setUploading] = useState({});

    const fileRefs = useRef({}); // fileRefs.current[uid] = inputEl

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        const role = parseJwt(t)?.role;
        if (role !== "admin") {
            setMsg("Бұл бет тек admin үшін.");
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

                    photo_url: u.photo_url || "",
                    education: u.education || "",
                    languages: u.languages || "",

                    has_profile: !!u.has_profile,
                };
            });
            setForm(init);
            setMsg("Тізім жүктелді ✅");
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

    async function uploadPhoto(uid, file) {
        try {
            setUploading((p) => ({ ...p, [uid]: true }));

            const fd = new FormData();
            fd.append("file", file);

            const res = await fetch("/api/v1/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token()}` },
                body: fd,
            });

            const text = await res.text();
            if (!res.ok) throw new Error(text || "Upload failed");

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                data = {};
            }

            setField(uid, "photo_url", data.url || "");
            alert("Фото жүктелді ✅");
        } catch (e) {
            alert("Upload қате: " + e.message);
        } finally {
            setUploading((p) => ({ ...p, [uid]: false }));
            const el = fileRefs.current[uid];
            if (el) el.value = "";
        }
    }

    async function createProfile(userId) {
        try {
            const f = form[userId] || {};
            const specialty = (f.specialty || "").trim();
            const experience = parseInt(f.experience || 0, 10);
            const price = parseInt(f.price || 0, 10);

            const photo_url = (f.photo_url || "").trim();
            const education = (f.education || "").trim();
            const languages = (f.languages || "").trim();

            if (!specialty) return alert("Мамандығын толтыр.");
            if (experience < 0 || price < 0) return alert("Тәжірибе/баға теріс болмауы керек.");

            await api("/api/v1/admin/doctors", {
                method: "POST",
                auth: true,
                body: { user_id: userId, specialty, experience, price, photo_url, education, languages },
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

            const photo_url = (f.photo_url || "").trim();
            const education = (f.education || "").trim();
            const languages = (f.languages || "").trim();

            if (!specialty) return alert("Мамандығын толтыр.");
            if (experience < 0 || price < 0) return alert("Тәжірибе/баға теріс болмауы керек.");

            await api(`/api/v1/admin/doctors/${userId}`, {
                method: "PUT",
                auth: true,
                body: { specialty, experience, price, photo_url, education, languages },
            });

            alert("Сақталды ✅");
            load();
        } catch (e) {
            alert(`Қате: ${e.message}`);
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Admin — Doctor профилі</h2>
                    <p className="muted page-header__subtitle">
                        Мамандық, тәжірибе, баға, фото және басқа да дәрігердің профиль өрістерін толтырыңыз.
                    </p>
                </div>
            </div>

            <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                    Бұл бет тек <b>admin token</b> арқылы жұмыс істейді.
                    <br />
                    1) Алдымен <b>Admin Users</b> бетінде role-ды <b>doctor</b> қылып қой.
                    <br />
                    2) Сосын осы бетте doctor profile толтыр.
                </p>
            </div>

            {msg && (
                <p style={{ marginTop: 12, color: msg.startsWith("Қате") ? "#ef4444" : "#94a3b8" }}>
                    {msg}
                </p>
            )}
            {loading && <p className="muted">Жүктелуде...</p>}

            <div className="table-wrap">
                <table className="table" style={{ minWidth: 1750 }}>
                    <thead>
                    <tr>
                        <th>UserID</th>
                        <th>Аты-жөні</th>
                        <th>Телефон</th>
                        <th>Профиль</th>

                        <th>Мамандығы</th>
                        <th>Тәжірибе (жыл)</th>
                        <th>Баға (₸)</th>

                        <th>Фото</th>
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
                        const isUp = !!uploading[uid];

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

                                <td style={{ minWidth: 320, position: "relative" }}>
                                    {(() => {
                                        const inputId = `doctor-photo-${uid}`;
                                        return (
                                            <>
                                                <input
                                                    id={inputId}
                                                    ref={(el) => {
                                                        if (el) fileRefs.current[uid] = el;
                                                    }}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{
                                                        position: "absolute",
                                                        left: "-9999px",
                                                        width: 1,
                                                        height: 1,
                                                    }}
                                                    disabled={isUp}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) uploadPhoto(uid, file);
                                                    }}
                                                />

                                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                                    <label
                                                        htmlFor={inputId}
                                                        className="btn ghost"
                                                        style={{ cursor: isUp ? "not-allowed" : "pointer", opacity: isUp ? 0.6 : 1 }}
                                                    >
                                                        {isUp ? "Жүктелуде..." : "📷 Фото таңдау"}
                                                    </label>

                                                    {f.photo_url ? (
                                                        <button
                                                            className="btn"
                                                            type="button"
                                                            onClick={() => setField(uid, "photo_url", "")}
                                                            disabled={isUp}
                                                        >
                                                            Өшіру
                                                        </button>
                                                    ) : null}
                                                </div>

                                                {f.photo_url ? (
                                                    <div style={{ marginTop: 10 }}>
                                                        <img
                                                            src={f.photo_url}
                                                            alt="doctor"
                                                            style={{
                                                                width: 72,
                                                                height: 72,
                                                                objectFit: "cover",
                                                                borderRadius: 12,
                                                                border: "1px solid rgba(255,255,255,0.08)",
                                                            }}
                                                            onError={(e) => (e.currentTarget.style.display = "none")}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                                                        Фото жоқ
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
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
                            <td colSpan={11} className="muted">
                                Тізім бос.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}