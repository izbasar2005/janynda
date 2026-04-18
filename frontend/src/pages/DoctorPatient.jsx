import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, token } from "../services/api";
import {
    appointmentStatusLabelDoctor,
    APPOINTMENT_STATUS_FLOW_HINT,
    DOCTOR_STATUS_SELECT,
    doctorFormStatusFromAppointment,
} from "../utils/appointmentStatus";

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
        return new Date(s).toLocaleString("kk-KZ", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
        return String(s);
    }
}

function genderLabel(g) {
    if (!g) return "—";
    const v = (g + "").toLowerCase();
    if (v === "male" || v === "m" || v === "ер") return "Ер адам";
    if (v === "female" || v === "f" || v === "әйел") return "Әйел адам";
    return g;
}

export default function DoctorPatient() {
    const { userId } = useParams();
    const t = token();
    const role = t ? parseJwt(t)?.role : null;
    const pid = Number(userId);

    const [patient, setPatient] = useState(null);
    const [apps, setApps] = useState([]);
    const [msg, setMsg] = useState("");
    const [forms, setForms] = useState({});
    const [saveToast, setSaveToast] = useState(null);
    const saveToastTimer = useRef(null);

    useEffect(() => {
        return () => {
            if (saveToastTimer.current) {
                clearTimeout(saveToastTimer.current);
            }
        };
    }, []);

    function showSaveToast(payload) {
        if (saveToastTimer.current) {
            clearTimeout(saveToastTimer.current);
        }
        setSaveToast(payload);
        saveToastTimer.current = setTimeout(() => {
            setSaveToast(null);
            saveToastTimer.current = null;
        }, 5500);
    }

    const myApps = useMemo(() => {
        if (!Number.isFinite(pid)) return [];
        return apps
            .filter((a) => Number(a.patient_id) === pid)
            .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
    }, [apps, pid]);

    useEffect(() => {
        if (!t || role !== "doctor" || !Number.isFinite(pid)) return;
        setMsg("");
        api(`/api/v1/users/${pid}`, { auth: true })
            .then(setPatient)
            .catch((e) => {
                setPatient(null);
                setMsg(e.message || "Профиль жүктелмеді");
            });
        api("/api/v1/appointments/my", { auth: true })
            .then((d) => setApps(Array.isArray(d) ? d : []))
            .catch(() => setApps([]));
    }, [t, role, pid]);

    useEffect(() => {
        const next = {};
        for (const a of myApps) {
            next[a.id] = {
                diagnosis: a.diagnosis ?? "",
                clinical_notes: a.clinical_notes ?? "",
                status: doctorFormStatusFromAppointment(a.status),
            };
        }
        setForms(next);
    }, [myApps]);

    function isCanceledStatus(s) {
        const v = (s || "").toLowerCase();
        return v === "canceled" || v === "cancelled";
    }

    async function saveAppointment(ap) {
        const f = forms[ap.id];
        if (!f) return;
        setMsg("");
        try {
            const body = {
                diagnosis: f.diagnosis,
                clinical_notes: f.clinical_notes,
            };
            if (!isCanceledStatus(ap.status)) {
                body.status = f.status;
            }
            const updated = await api(`/api/v1/appointments/${ap.id}`, {
                method: "PATCH",
                auth: true,
                body,
            });
            setApps((prev) => prev.map((x) => (Number(x.id) === Number(ap.id) ? { ...x, ...updated } : x)));
            const st = String(updated?.status || body.status || "").toLowerCase();
            if (st === "done") {
                showSaveToast({ variant: "done", title: "Қабылдау аяқталды" });
            } else {
                showSaveToast({ variant: "ok", title: "Сақталды" });
            }
        } catch (e) {
            setMsg(e.message || "Сақтау қатесі");
        }
    }

    if (!t) {
        return <Navigate to="/login" replace />;
    }
    if (role !== "doctor") {
        return <Navigate to="/profile" replace />;
    }
    if (!Number.isFinite(pid)) {
        return <Navigate to="/doctor" replace />;
    }

    const displayName = patient?.full_name || [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || `Пациент #${pid}`;

    return (
        <div className="page doctor-patient">
            {saveToast && (
                <div className="doctor-save-toast" role="alert" aria-live="polite">
                    <div className="doctor-save-toast__box">
                        <span className="doctor-save-toast__icon" aria-hidden="true">
                            {saveToast.variant === "done" ? "✅" : "✓"}
                        </span>
                        <div className="doctor-save-toast__main">
                            <p className="doctor-save-toast__title">{saveToast.title}</p>
                        </div>
                        <button
                            type="button"
                            className="doctor-save-toast__close"
                            aria-label="Жабу"
                            onClick={() => {
                                if (saveToastTimer.current) {
                                    clearTimeout(saveToastTimer.current);
                                    saveToastTimer.current = null;
                                }
                                setSaveToast(null);
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
            <p className="doctor-patient__back">
                <Link to="/doctor" className="doctor-cabinet__link">
                    ← Дәрігер кабинеті
                </Link>
            </p>

            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Пациент профилі</h2>
                    <p className="muted page-header__subtitle">
                        {displayName} — медициналық жазба тек сізге жазылған жазылулар үшін ғана.
                    </p>
                </div>
            </div>

            {msg && <p className="form-error">{msg}</p>}

            {!patient ? (
                <div className="card">
                    <p className="muted">Жүктелуде немесе қол жеткізу жоқ...</p>
                </div>
            ) : (
                <>
                    <section className="card doctor-cabinet__section profile-card--info">
                        <h3 className="doctor-cabinet__h3">Деректер</h3>
                        <dl className="profile-info">
                            <div className="profile-info__row">
                                <dt className="profile-info__label">Аты-жөні</dt>
                                <dd className="profile-info__value">{patient.full_name || "—"}</dd>
                            </div>
                            <div className="profile-info__row">
                                <dt className="profile-info__label">Телефон</dt>
                                <dd className="profile-info__value">{patient.phone || "—"}</dd>
                            </div>
                            <div className="profile-info__row">
                                <dt className="profile-info__label">ЖСН</dt>
                                <dd className="profile-info__value">{patient.iin || "—"}</dd>
                            </div>
                            <div className="profile-info__row">
                                <dt className="profile-info__label">Жынысы</dt>
                                <dd className="profile-info__value">{genderLabel(patient.gender)}</dd>
                            </div>
                            {(patient.first_name || patient.last_name) && (
                                <div className="profile-info__row">
                                    <dt className="profile-info__label">Толық аты</dt>
                                    <dd className="profile-info__value">
                                        {[patient.last_name, patient.first_name, patient.patronymic].filter(Boolean).join(" ")}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </section>

                    <section className="card doctor-cabinet__section">
                        <h3 className="doctor-cabinet__h3">Жазылулар және медициналық жазба</h3>
                        <p className="muted doctor-patient__flow-hint">{APPOINTMENT_STATUS_FLOW_HINT}</p>
                        {myApps.length === 0 ? (
                            <p className="muted doctor-cabinet__empty">Бұл пациентпен жазылу тарихы жоқ.</p>
                        ) : (
                            <div className="doctor-patient__apps">
                                {myApps.map((a) => {
                                    const f = forms[a.id] || { diagnosis: "", clinical_notes: "", status: a.status };
                                    return (
                                        <div key={a.id} className="doctor-patient__app-card">
                                            <div className="doctor-patient__app-head">
                                                <span className="doctor-patient__app-date">{fmtStartAt(a.start_at)}</span>
                                                <span className={`doctor-cabinet__pill doctor-cabinet__pill--${(a.status || "").toLowerCase()}`}>
                                                    {appointmentStatusLabelDoctor(a.status)}
                                                </span>
                                            </div>
                                            {a.note ? (
                                                <p className="doctor-patient__note">
                                                    <strong>Пациент ескертпесі:</strong> {a.note}
                                                </p>
                                            ) : null}

                                            <label className="form-label">Диагноз</label>
                                            <textarea
                                                className="input doctor-patient__textarea"
                                                rows={2}
                                                value={f.diagnosis}
                                                onChange={(e) =>
                                                    setForms((prev) => ({
                                                        ...prev,
                                                        [a.id]: { ...f, diagnosis: e.target.value },
                                                    }))
                                                }
                                            />

                                            <label className="form-label">Дәрігер жазбасы</label>
                                            <textarea
                                                className="input doctor-patient__textarea"
                                                rows={3}
                                                value={f.clinical_notes}
                                                onChange={(e) =>
                                                    setForms((prev) => ({
                                                        ...prev,
                                                        [a.id]: { ...f, clinical_notes: e.target.value },
                                                    }))
                                                }
                                            />

                                            <label className="form-label">Жазылудың күйі</label>
                                            {isCanceledStatus(a.status) ? (
                                                <p className="muted">
                                                    {appointmentStatusLabelDoctor(a.status)} — күйді өзгерту мүмкін емес, тек диагноз/жазба.
                                                </p>
                                            ) : (
                                                <>
                                                    <select
                                                        className="input"
                                                        value={f.status}
                                                        onChange={(e) =>
                                                            setForms((prev) => ({
                                                                ...prev,
                                                                [a.id]: { ...f, status: e.target.value },
                                                            }))
                                                        }
                                                    >
                                                        {DOCTOR_STATUS_SELECT.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="muted doctor-patient__status-hint">
                                                        {(DOCTOR_STATUS_SELECT.find((o) => o.value === f.status) || DOCTOR_STATUS_SELECT[0]).hint}
                                                    </p>
                                                </>
                                            )}

                                            <div className="doctor-patient__actions">
                                                <button type="button" className="btn" onClick={() => saveAppointment(a)}>
                                                    Сақтау
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
