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
        <div style={{ marginTop: 24 }}>
            <h2>Дәрігерге жазылу</h2>

            <div className="card" style={{ maxWidth: 900 }}>
                {doc && (
                    <p className="muted" style={{ marginTop: 0 }}>
                        Дәрігер: <b>{doc.full_name}</b> — {doc.specialty}
                    </p>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <label className="muted">Күні</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div style={{ flex: 1, minWidth: 220 }}>
                        <label className="muted">Уақыты</label>
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                    </div>

                    <button className="btn" onClick={submit}>Жазылу</button>
                </div>

                {msg && <p style={{ color: "#ef4444" }}>{msg}</p>}
            </div>
        </div>
    );
}