import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const PRESETS = [
    { id: "375", label: "Mobile 375px", width: 375 },
    { id: "768", label: "Tablet 768px", width: 768 },
    { id: "1024", label: "Tablet 1024px", width: 1024 },
];

const PAGES = [
    { path: "/news", label: "Жаңалықтар", group: "Жария" },
    { path: "/doctors", label: "Дәрігерлер", group: "Жария" },
    { path: "/doctors/1", label: "Дәрігер профилі", group: "Жария" },
    { path: "/groups", label: "Топтар", group: "Auth" },
    { path: "/psych", label: "Психолог кабинеті", group: "Auth" },
    { path: "/psych/assignments", label: "Пациенттерді бөлу", group: "Auth" },
    { path: "/admin/users", label: "Admin — Users", group: "Admin" },
    { path: "/admin/doctors", label: "Admin — Doctors", group: "Admin" },
    { path: "/admin/news", label: "Admin — News", group: "Admin" },
    { path: "/admin/ai-test", label: "Admin — AI Test", group: "Admin" },
    { path: "/", label: "Басты бет (Home)", group: "Жария" },
];

export default function MobilePreview() {
    const [path, setPath] = useState("/news");
    const [preset, setPreset] = useState("375");
    const [customPath, setCustomPath] = useState("");

    const width = useMemo(
        () => PRESETS.find((p) => p.id === preset)?.width ?? 375,
        [preset]
    );

    const iframeSrc = customPath.trim() || path;
    const groups = useMemo(() => {
        const map = new Map();
        for (const p of PAGES) {
            if (!map.has(p.group)) map.set(p.group, []);
            map.get(p.group).push(p);
        }
        return map;
    }, []);

    return (
        <div className="mobile-preview">
            <aside className="mobile-preview__sidebar">
                <div className="mobile-preview__brand">
                    <span className="mobile-preview__logo">📱</span>
                    <div>
                        <h1 className="mobile-preview__title">Mobile Preview</h1>
                        <p className="mobile-preview__hint">Беттерді телефон өлшемінде қарау</p>
                    </div>
                </div>

                <div className="mobile-preview__section">
                    <label className="mobile-preview__label">Экран өлшемі</label>
                    <div className="mobile-preview__presets">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className={`mobile-preview__preset${preset === p.id ? " is-active" : ""}`}
                                onClick={() => setPreset(p.id)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mobile-preview__section">
                    <label className="mobile-preview__label">Бет таңдау</label>
                    {[...groups.entries()].map(([group, items]) => (
                        <div key={group} className="mobile-preview__group">
                            <div className="mobile-preview__group-title">{group}</div>
                            {items.map((item) => (
                                <button
                                    key={item.path}
                                    type="button"
                                    className={`mobile-preview__page-btn${path === item.path && !customPath.trim() ? " is-active" : ""}`}
                                    onClick={() => {
                                        setPath(item.path);
                                        setCustomPath("");
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="mobile-preview__section">
                    <label className="mobile-preview__label" htmlFor="mobile-preview-path">
                        Немесе URL жолы
                    </label>
                    <input
                        id="mobile-preview-path"
                        className="mobile-preview__input"
                        placeholder="/news"
                        value={customPath}
                        onChange={(e) => setCustomPath(e.target.value)}
                    />
                </div>

                <div className="mobile-preview__footer">
                    <a
                        className="mobile-preview__open-tab"
                        href={iframeSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Жаңа вкладкада ашу ↗
                    </a>
                    <Link className="mobile-preview__back" to="/">
                        ← Сайтқа оралу
                    </Link>
                </div>
            </aside>

            <div className="mobile-preview__stage">
                <div className="mobile-preview__device" style={{ width: width + 32 }}>
                    <div className="mobile-preview__device-notch" aria-hidden />
                    <div className="mobile-preview__device-screen" style={{ width }}>
                        <iframe
                            key={iframeSrc + preset}
                            title="Mobile preview"
                            className="mobile-preview__iframe"
                            src={iframeSrc}
                        />
                    </div>
                </div>
                <p className="mobile-preview__meta">
                    {iframeSrc} · {width}px
                    <span className="mobile-preview__meta-note">
                        Auth беттер үшін алдымен login жасаңыз (iframe сол localStorage пайдаланады)
                    </span>
                </p>
            </div>
        </div>
    );
}
