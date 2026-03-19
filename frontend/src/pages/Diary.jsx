import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const MOOD_OPTIONS = [
    { value: 1, label: "Өте ауыр", emoji: "😢" },
    { value: 2, label: "Қиындау", emoji: "😟" },
    { value: 3, label: "Жай", emoji: "😐" },
    { value: 4, label: "Жақсы", emoji: "🙂" },
    { value: 5, label: "Жақсырақ", emoji: "😊" },
];

const PROMPTS = [
    "Бүгін мені ең көп уайымдатқан нәрсе...",
    "Бүгін маған күш беріп тұрған нәрсе...",
    "Кімге немесе неге ризамын...",
];

export default function Diary() {
    const [mood, setMood] = useState(3);
    const [text, setText] = useState("");
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError("");
            try {
                const [list, sum] = await Promise.all([
                    api("/api/v1/diary", { auth: true }),
                    api("/api/v1/diary/summary", { auth: true }),
                ]);
                if (!cancelled) {
                    setEntries(Array.isArray(list) ? list : []);
                    setSummary(sum || null);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e.message || "Күнделік жүктеу қатесі");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const latestMoodLabel = useMemo(() => {
        if (!summary || !summary.latest_mood) return "";
        const opt = MOOD_OPTIONS.find((o) => o.value === summary.latest_mood);
        return opt ? `${opt.emoji} ${opt.label}` : "";
    }, [summary]);

    const avgMood = summary?.avg_mood || 0;
    const moodBandClass = useMemo(() => {
        if (!avgMood || avgMood <= 0) return "diary-visual--none";
        if (avgMood > 0 && avgMood <= 1.5) return "diary-visual--band1";
        if (avgMood > 1.5 && avgMood <= 2.5) return "diary-visual--band2";
        if (avgMood > 2.5 && avgMood <= 3.5) return "diary-visual--band3";
        if (avgMood > 3.5 && avgMood <= 5) return "diary-visual--band4";
        return "diary-visual--none";
    }, [avgMood]);

    const moodMessage = useMemo(() => {
        if (!avgMood || avgMood <= 0) {
            return "Көңіл-күйіңізді күнде қысқаша белгілеп отыру – өзіңізге деген қамқорлығыңыз.";
        }
        if (avgMood > 0 && avgMood <= 1.5) {
            return "Қазір сізге өте ауыр. Бірақ өміріңіз өз қолыңызда, әр сезіміңіз маңызды – жалғыз емессіз.";
        }
        if (avgMood > 1.5 && avgMood <= 2.5) {
            return "Қиындау кезең. Уайым көп болса да, кішкентай қадамдар арқылы өз өміріңізге ықпал ете аласыз.";
        }
        if (avgMood > 2.5 && avgMood <= 3.5) {
            return "Жағдайыңыз орташа. Өз күйіңізді байқап, демалыс пен қуаныш сыйлайтын сәттерді көбейтуге тырысыңыз.";
        }
        // 3.5-тен жоғары — жақсы көңіл-күй
        return "Көңіл-күйіңіз жақсы. Көңілді жүру, өзіңізге қамқор болу – өміріңізді ұзартып, сапасын жақсартады.";
    }, [avgMood]);

    const [showAllEntries, setShowAllEntries] = useState(false);
    const entriesToShow = useMemo(() => {
        const list = Array.isArray(entries) ? entries : [];
        return showAllEntries ? list : list.slice(0, 5);
    }, [entries, showAllEntries]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!mood) {
            setError("Алдымен көңіл-күйді таңдаңыз.");
            return;
        }
        setSaving(true);
        try {
            const entry = await api("/api/v1/diary", {
                method: "POST",
                auth: true,
                body: { mood, text },
            });
            setText("");
            setEntries((prev) => [entry, ...prev]);
            // summary-ды шамамен жаңарту
            setSummary((prev) => {
                const now = entry.mood;
                if (!prev || !prev.count) {
                    return {
                        count: 1,
                        avg_mood: now,
                        first_mood: now,
                        latest_mood: now,
                    };
                }
                const newCount = prev.count + 1;
                const newAvg = (prev.avg_mood * prev.count + now) / newCount;
                return {
                    ...prev,
                    count: newCount,
                    avg_mood: newAvg,
                    latest_mood: now,
                };
            });
        } catch (e) {
            setError(e.message || "Жазбаны сақтау қатесі");
        } finally {
            setSaving(false);
        }
    }

    function applyPrompt(p) {
        if (!p) return;
        if (!text) {
            setText(p + " ");
        } else if (!text.startsWith(p)) {
            setText(text + (text.endsWith(" ") ? "" : " ") + p + " ");
        }
    }

    return (
        <div className="page diary-page">
            <div className="diary-hero">
                <div className="diary-main">
                    <header className="diary-header">
                        <p className="diary-kicker">Менің күнделігім</p>
                        <h1 className="diary-title">Ойларыңызды қауіпсіз кеңістікке жазып отырыңыз</h1>
                        <p className="diary-subtitle">
                            Күн сайын бірнеше сөйлем ғана болса да, сіздің ішкі күйіңізді түсінуге көмектеседі. Бұл
                            жазбаларды ешкім оқымайды, тек өте қиын жағдайда ғана психологқа көрінуі мүмкін.
                        </p>
                        <p className="diary-subtitle diary-subtitle--mood">{moodMessage}</p>
                    </header>

                    <section className="diary-card">
                        <form onSubmit={handleSubmit} className="diary-form">
                            <div className="diary-form__row">
                                <span className="diary-label">Бүгінгі күйіңіз:</span>
                                <div className="diary-mood">
                                    {MOOD_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={
                                                "diary-mood__item" +
                                                (mood === opt.value ? " diary-mood__item--active" : "")
                                            }
                                            onClick={() => setMood(opt.value)}
                                        >
                                            <span className="diary-mood__emoji" aria-hidden="true">
                                                {opt.emoji}
                                            </span>
                                            <span className="diary-mood__label">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="diary-form__row">
                                <span className="diary-label">Қысқаша жаза кеткіңіз келсе:</span>
                                <div className="diary-prompts">
                                    {PROMPTS.map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            className="diary-prompt"
                                            onClick={() => applyPrompt(p)}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    className="diary-textarea"
                                    rows={4}
                                    placeholder="Қаламасаңыз, тек көңіл-күйді таңдау да жеткілікті. Бірақ 1–2 сөйлем өзіңізге көмектесуі мүмкін."
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                />
                            </div>

                            {error && <div className="form-error diary-error">{error}</div>}

                            <div className="diary-actions">
                                <button className="btn" type="submit" disabled={saving}>
                                    {saving ? "Сақталуда..." : "Жазбаны сақтау"}
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="diary-history">
                        <div className="diary-history__head">
                            <h2 className="diary-history__title">Алдыңғы жазбалар</h2>
                            {!loading && entries.length > 5 && (
                                <button
                                    type="button"
                                    className="diary-history__toggle"
                                    onClick={() => setShowAllEntries((p) => !p)}
                                >
                                    {showAllEntries ? "Жасыру" : "Толық көру"}
                                </button>
                            )}
                        </div>
                        {loading && <p className="muted">Күнделік жүктелуде…</p>}
                        {!loading && entries.length === 0 && (
                            <p className="muted">
                                Әзірге жазба жоқ. Бүгінгі ойыңызды қысқаша белгілеп көруден бастайық.
                            </p>
                        )}
                        {!loading && entries.length > 0 && (
                            <ul className="diary-list">
                                {entriesToShow.map((e) => {
                                    const d = new Date(e.created_at || e.CreatedAt || e.createdAt);
                                    const opt = MOOD_OPTIONS.find((o) => o.value === e.mood);
                                    return (
                                        <li key={e.id} className="diary-list__item">
                                            <div className="diary-list__meta">
                                                <span className="diary-list__date">
                                                    {d.toLocaleDateString("kk-KZ", {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </span>
                                                {opt && (
                                                    <span className="diary-list__mood">
                                                        <span aria-hidden="true">{opt.emoji}</span> {opt.label}
                                                    </span>
                                                )}
                                            </div>
                                            {e.text && <p className="diary-list__text">{e.text}</p>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>

                <aside className={`diary-visual ${moodBandClass}`}>
                    <div className="diary-visual__card diary-visual__card--big"></div>
                    <p className="diary-visual__message">
                        {moodMessage}
                    </p>
                </aside>
            </div>
        </div>
    );
}

