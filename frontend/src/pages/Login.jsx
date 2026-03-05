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
        <div className="login-center">
          <div className="login-card">
            <div className="login-card__brandrow">
              <div className="login-logo" aria-hidden="true" />
              <span className="login-brand login-brand--small">Janymda</span>
            </div>

            <h2 className="login-title">Войти</h2>

            <form onSubmit={onSubmit} className="login-form form">
              <div className="form-field">
                <label className="form-label">Телефон или логин</label>
                <input
                    className="login-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 700 000 00 00"
                />
              </div>

              <div className="form-field">
                <label className="form-label">Пароль</label>
                <input
                    className="login-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                />
                <p className="form-hint">Не передавайте пароль третьим лицам.</p>
              </div>

              {msg && <div className="form-error login-error">{msg}</div>}

              <button className="login-btn" type="submit">
                Войти
              </button>
            </form>

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