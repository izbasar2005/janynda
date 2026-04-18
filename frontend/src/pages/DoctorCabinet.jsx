import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, token } from "../services/api";
import { appointmentStatusLabelDoctor } from "../utils/appointmentStatus";

function parseJwt(t) {
    try {
        const base = t.split(".")[1];
        const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
        return null;
    }
}

function fmtStartAt(s) {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleString("kk-KZ", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
        return String(s);
    }
}

export default function DoctorCabinet() {
    const nav = useNavigate();
    const t = token();
    const role = t ? parseJwt(t)?.role : null;
    const [apps, setApps] = useState([]);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        if (!t || role !== "doctor") return;
        setMsg("");
        api("/api/v1/appointments/my", { auth: true })
            .then((d) => setApps(Array.isArray(d) ? d : []))
            .catch((e) => {
                setMsg(e.message || "Қате");
                setApps([]);
            });
    }, [t, role]);

    const patientRows = useMemo(() => {
        const m = new Map();
        for (const a of apps) {
            const pid = a.patient_id ?? a.patient?.id;
            if (!pid) continue;
            const p = a.patient || {};
            const name = p.full_name || `Пациент #${pid}`;
            const prev = m.get(pid);
            const tStart = new Date(a.start_at).getTime();
            if (!prev || tStart > prev._sort) {
                m.set(pid, { patientId: pid, name, lastStart: a.start_at, lastStatus: a.status, _sort: tStart });
            }
        }
        return [...m.values()]
            .sort((a, b) => b._sort - a._sort)
            .map(({ _sort, ...row }) => row);
    }, [apps]);

    if (!t) {
        return <Navigate to="/login" replace />;
    }
    if (role !== "doctor") {
        return <Navigate to="/profile" replace />;
    }

    return (
        <div className="page doctor-cabinet">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Дәрігер кабинеті</h2>
                    <p className="muted page-header__subtitle">
                        Тек сізге жазылған пациенттер көрінеді. Диагноз бен дәрігер жазбасын осы жазылулар арқылы ғана сақтай аласыз.
                    </p>
                </div>
                <button type="button" className="btn ghost" onClick={() => nav("/profile")}>
                    Менің профилім
                </button>
            </div>

            {msg && <p className="form-error">{msg}</p>}

            <section className="card doctor-cabinet__section">
                <h3 className="doctor-cabinet__h3">Пациенттер (жазылуы бар)</h3>
                {patientRows.length === 0 ? (
                    <p className="muted doctor-cabinet__empty">Әзірге жазылу жоқ. Пациенттер жазылғанда олар осыдан көрінеді.</p>
                ) : (
                    <ul className="doctor-cabinet__patient-list">
                        {patientRows.map((row) => (
                            <li key={row.patientId} className="doctor-cabinet__patient-row">
                                <div>
                                    <p className="doctor-cabinet__patient-name">{row.name}</p>
                                    <p className="muted doctor-cabinet__patient-meta">
                                        Соңғы жазылу: {fmtStartAt(row.lastStart)} · {appointmentStatusLabelDoctor(row.lastStatus)}
                                    </p>
                                </div>
                                <Link className="btn" to={`/doctor/patients/${row.patientId}`}>
                                    Профиль және жазбалар
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="card doctor-cabinet__section">
                <h3 className="doctor-cabinet__h3">Барлық жазылулар</h3>
                {apps.length === 0 ? (
                    <p className="muted doctor-cabinet__empty">Тізім бос.</p>
                ) : (
                    <div className="doctor-cabinet__table-wrap">
                        <table className="doctor-cabinet__table">
                            <thead>
                                <tr>
                                    <th>Күні</th>
                                    <th>Пациент</th>
                                    <th>Күйі</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {[...apps]
                                    .sort((a, b) => new Date(b.start_at) - new Date(a.start_at))
                                    .map((a) => {
                                        const pname = a.patient?.full_name || `ID ${a.patient_id}`;
                                        return (
                                            <tr key={a.id}>
                                                <td>{fmtStartAt(a.start_at)}</td>
                                                <td>{pname}</td>
                                                <td>
                                                    <span className={`doctor-cabinet__pill doctor-cabinet__pill--${(a.status || "").toLowerCase()}`}>
                                                        {appointmentStatusLabelDoctor(a.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <Link className="doctor-cabinet__link" to={`/doctor/patients/${a.patient_id}`}>
                                                        Ашу
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
