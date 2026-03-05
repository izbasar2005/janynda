import { Link, useLocation, useNavigate } from "react-router-dom";

function parseJwt(t) {
    try {
        const base = t.split(".")[1];
        const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
        return null;
    }
}

export default function Navbar() {
    const loc = useLocation();
    const nav = useNavigate();
    const t = localStorage.getItem("token");
    const role = t ? (parseJwt(t)?.role || "user") : "guest";

    const active = (p) => (loc.pathname === p ? "active" : "");

    const logout = () => {
        localStorage.removeItem("token");
        nav("/login");
    };

    return (
        <div className="nav">
            <div className="brand">Janymda</div>
            <div className="nav-links">
                <Link className={active("/")} to="/">Басты бет</Link>
                <Link className={active("/doctors")} to="/doctors">Дәрігерлер</Link>

                {!t ? (
                    <>
                        <Link className={active("/login")} to="/login">Кіру</Link>
                        <Link className={active("/register")} to="/register">Тіркелу</Link>
                    </>
                ) : (
                    <>
                        {role === "admin" && (
                            <>
                                <Link className={active("/admin/doctors")} to="/admin/doctors">Admin Doctors</Link>
                                <Link className={active("/admin/users")} to="/admin/users">Users</Link>
                            </>
                        )}
                        <Link className={active("/profile")} to="/profile">Профиль</Link>
                        <a href="#" onClick={(e) => (e.preventDefault(), logout())}>Шығу</a>
                    </>
                )}
            </div>
        </div>
    );
}