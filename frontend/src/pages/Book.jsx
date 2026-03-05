import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, token } from "../services/api";

export default function Book() {
    const { doctorId } = useParams();
    const nav = useNavigate();
    const [doc, setDoc] = useState(null);
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [msg, setMsg] = useState("");

    useEffect(() => {
        if (!token()) {
            nav("/login");
            return;
        }
        api(`/api/v1/doctors/${doctorId}`)
            .then(setDoc)
            .catch((e) => setMsg("Қате: " + e.message));
    }, [doctorId, nav]);

    // date = "2026-03-03"
// time = "10:30"
    function toRFC3339(date, time) {
        if (!date || !time) return "";
        // Қазақстан +05:00 деп қоя саламыз (сенің timezone)
        return `${date}T${time}:00+05:00`;
    }

    async function submit() {
        setMsg("");
        try {
            const start_at = toRFC3339(date, time);

            await api("/api/v1/appointments", {
                method: "POST",
                auth: true,
                body: {
                    doctor_user_id: doc.user_id, // маңыздысы осы
                    start_at,
                    note: "",
                },
            });

            nav("/profile");
        } catch (e) {
            setMsg("Қате: " + e.message);
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Дәрігерге жазылу</h2>
                    <p className="muted page-header__subtitle">
                        Күн мен уақытты таңдаңыз, біз сізге жазылуды растаймыз.
                    </p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 900 }}>
                {doc && (
                    <p className="muted" style={{ marginTop: 0 }}>
                        Дәрігер: <b>{doc.full_name}</b> — {doc.specialty}
                    </p>
                )}

                <div className="form-row" style={{ marginTop: 12, alignItems: "flex-end" }}>
                    <div className="form-field">
                        <label className="form-label">Күні</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div className="form-field">
                        <label className="form-label">Уақыты</label>
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                    </div>

                    <button className="btn" onClick={submit}>Жазылу</button>
                </div>

                {msg && <p className="form-error" style={{ marginTop: 10 }}>{msg}</p>}
            </div>
        </div>
    );
}