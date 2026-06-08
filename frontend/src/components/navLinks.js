/** Role-based main navigation links (desktop + mobile). */
export function getNavLinks({ token, role, active }) {
    const links = [
        { to: "/", label: "Басты бет", show: true },
    ];

    const normalizedRole = String(role || "").toLowerCase();
    const staffRoles = new Set(["doctor", "psychologist", "head_psychologist", "admin", "super_admin"]);

    if (token && !staffRoles.has(normalizedRole)) {
        links.push(
            { to: "/doctors", label: "Дәрігерге жазылу", show: true },
            { to: "/diary", label: "Күнделік", show: true },
        );
    }

    if (token && normalizedRole === "doctor") {
        links.push({ to: "/doctor", label: "Дәрігер кабинеті", show: true });
    }

    if (token && normalizedRole === "psychologist") {
        links.push({ to: "/psych", label: "Психолог кабинеті", show: true });
    }

    if (token && normalizedRole === "head_psychologist") {
        links.push(
            { to: "/psych", label: "Психолог кабинеті", show: true },
            { to: "/psych/assignments", label: "Пациенттерді бөлу", show: true },
        );
    }

    if (token) {
        links.push({ to: "/groups", label: "Топтар", show: true });
    }

    if (token && normalizedRole === "admin") {
        links.push(
            { to: "/admin/doctors", label: "Дәрігерлер", show: true },
            { to: "/admin/users", label: "Қолданушылар", show: true },
            { to: "/admin/news", label: "Жаңалықтар", show: true },
            { to: "/admin/ai-test", label: "AI тексеру", show: true },
        );
    }

    if (token && normalizedRole === "super_admin") {
        links.push(
            { to: "/admin/dashboard", label: "Басқару панелі", show: true },
            { to: "/admin/doctors-stats", label: "Дәрігерлер", show: true },
            { to: "/admin/users", label: "Қолданушылар", show: true },
            { to: "/admin/news", label: "Жаңалықтар", show: true },
            { to: "/admin/ai-test", label: "AI тексеру", show: true },
        );
    }

    return links
        .filter((l) => l.show)
        .map((l) => ({
            ...l,
            className: active(l.to) ? "is-active" : "",
        }));
}
