import { useEffect, useMemo, useState } from "react";
import { api, token } from "../services/api";
import DoctorCardUI from "../components/DoctorCardUI";

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

    const groupedBySpecialty = useMemo(() => {
        const map = {};
        filtered.forEach((d) => {
            const spec = (d.specialty || "").trim() || "Басқа";
            if (!map[spec]) map[spec] = [];
            map[spec].push(d);
        });
        return map;
    }, [filtered]);

    const specialties = useMemo(() => Object.keys(groupedBySpecialty).sort(), [groupedBySpecialty]);

    const [selectedSpecialty, setSelectedSpecialty] = useState(null);

    const specialtiesToShow = selectedSpecialty
        ? groupedBySpecialty[selectedSpecialty]
            ? [selectedSpecialty]
            : specialties
        : specialties;

    return (
        <div className="page doctors-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Дәрігерлер</h2>
                    <p className="muted page-header__subtitle">
                        Барлығы: <b>{list.length}</b> · Заманауи карточкалар арқылы таңдаңыз
                    </p>
                </div>

                <div className="doctors-page__search">
                    <label className="muted doctors-page__search-label" htmlFor="doctors-search">
                        Іздеу (аты / мамандық / білім / тіл)
                    </label>
                    <input
                        id="doctors-search"
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

            {!msg && filtered.length > 0 && (
                <div className="doctors-layout">
                    <aside className="doctors-sidebar" aria-label="Мамандық фильтрі">
                        <h3 className="doctors-sidebar__title">Мамандықтар</h3>
                        <button
                            type="button"
                            className={`doctors-sidebar__item ${selectedSpecialty === null ? "is-active" : ""}`}
                            onClick={() => setSelectedSpecialty(null)}
                        >
                            Барлығы
                        </button>
                        {specialties.map((spec) => (
                            <button
                                key={spec}
                                type="button"
                                className={`doctors-sidebar__item ${selectedSpecialty === spec ? "is-active" : ""}`}
                                onClick={() => setSelectedSpecialty(spec)}
                            >
                                {spec}
                            </button>
                        ))}
                    </aside>
                    <div className="doctors-main">
                        {specialtiesToShow.map((spec) => (
                            <section key={spec} className="doctors-row">
                                <h3 className="doctors-row__title">{spec}</h3>
                                <div className="doc-card-grid">
                                    {groupedBySpecialty[spec].map((d) => (
                                        <DoctorCardUI
                                            key={`${d.id}-${d.user_id}`}
                                            doctor={d}
                                            role={role}
                                            variant="page"
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            )}

            {!msg && filtered.length === 0 && list.length > 0 && (
                <p className="muted">Іздеу нәтижесі бос.</p>
            )}
        </div>
    );
}
