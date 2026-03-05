import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const nav = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      const data = await api("/api/v1/auth/login", {
        method: "POST",
        body: { phone, password },
      });
      localStorage.setItem("token", data.token);
      nav("/profile");
    } catch (e) {
      setMsg("Қате: " + e.message);
    }
  }

  return (
      <div className="login-page">


        {/* Center card */}
        <div className="login-center">
          <div className="login-card">
            <div className="login-card__brandrow">
              <div className="login-logo" aria-hidden="true" />
              <span className="login-brand login-brand--small">Janymda</span>
            </div>

            <h2 className="login-title">Войти</h2>

            <form onSubmit={onSubmit} className="login-form">
              <input
                  className="login-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="LOGIN"
              />

              <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="PASSWORD"
              />

              <button className="login-btn" type="submit">
                Войти
              </button>
            </form>

            {msg && <div className="login-error">{msg}</div>}

            <div className="login-links">
              <button className="login-link" type="button">
                Забыли пароль
              </button>

              {/* Мынау сенің /register маршрутыңа апарады */}
              <Link className="login-link login-link--accent" to="/register">
                Зарегистрироваться
              </Link>
            </div>
          </div>
        </div>



      </div>
  );
}