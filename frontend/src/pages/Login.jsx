import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notRobot, setNotRobot] = useState(false);
  const [robotVisible, setRobotVisible] = useState(false);
  const nav = useNavigate();

  async function doLogin() {
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

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    // Формалық базалық валидация (қаласаң күшейтуге болады)
    if (!phone || !password) {
      setMsg("Телефон/логин және парольді толтырыңыз.");
      return;
    }
    // Алдымен "Я не робот" модалын көрсетеміз
    setRobotVisible(true);
  }

  async function handleRobotConfirm() {
    if (!notRobot) {
      // Модалдың ішінде кішкентай ескерту ретінде alert жеткілікті
      alert('Алдымен "Я не робот" дегенді белгілеңіз.');
      return;
    }
    setRobotVisible(false);
    await doLogin();
  }

  return (
    <>
      <div className="login-page">
        <div className="login-center">
          <div className="login-card">
            <div className="login-card__brandrow">
              <div className="login-logo" aria-hidden="true">
                <img src="/img/logo.png" alt="" className="login-logo-img" />
              </div>
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
                <div className="password-field">
                  <input
                      className="login-input password-field__input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Введите пароль"
                  />
                  <button
                      type="button"
                      className="password-field__toggle"
                      onClick={() => setShowPassword((p) => !p)}
                  >
                    👁
                  </button>
                </div>
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
      {robotVisible && (
        <div className="login-robot-modal">
          <div className="login-robot-modal__card">
            <div className="login-robot-modal__title">Қауіпсіздік тексерісі</div>
            <p className="login-robot-modal__subtitle">
              Кіру үшін «Я не робот» дегенді белгілеңіз.
            </p>
            <div className="login-robot">
              <label className="login-robot__label">
                <input
                    type="checkbox"
                    checked={notRobot}
                    onChange={(e) => setNotRobot(e.target.checked)}
                />
                <span>Я не робот</span>
              </label>
            </div>
            <div className="login-robot-modal__actions">
              <button type="button" className="btn" onClick={handleRobotConfirm}>
                Жалғастыру
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}