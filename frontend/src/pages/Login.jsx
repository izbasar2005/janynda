import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import TurnstileField from "../components/TurnstileField.jsx";
import { TURNSTILE_ENABLED } from "../config/turnstile.js";

function EyeIcon({ off = false }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {off ? (
        <path
          d="M4 20 20 4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const nav = useNavigate();

  async function doLogin() {
    setMsg("");
    if (TURNSTILE_ENABLED && !captchaToken) {
      setMsg("CAPTCHA растаңыз");
      return;
    }
    try {
      const data = await api("/api/v1/auth/login", {
        method: "POST",
        body: { phone, password, captcha_token: captchaToken },
      });
      localStorage.setItem("token", data.token);
      nav("/profile");
    } catch (e) {
      setMsg("Қате: " + e.message);
      turnstileRef.current?.reset();
      setCaptchaToken("");
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    // Формалық базалық валидация (қаласаң күшейтуге болады)
    if (!phone || !password) {
      setMsg("Телефон/логин және құпия сөзді толтырыңыз.");
      return;
    }
    await doLogin();
  }

  return (
      <div className="login-page">
        <div className="login-center">
          <div className="login-card">
            <div className="login-card__brandrow">
              <div className="login-logo" aria-hidden="true">
                <img src="/img/logo.png" alt="" className="login-logo-img" />
              </div>
              <span className="login-brand login-brand--small">Janynda</span>
            </div>

            <h2 className="login-title">Кіру</h2>

            <form onSubmit={onSubmit} className="login-form form">
              <div className="form-field">
                <label className="form-label">Телефон немесе логин</label>
                <input
                    className="login-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 700 000 00 00"
                />
              </div>

              <div className="form-field">
                <label className="form-label">Құпия сөз</label>
                <div className="password-field">
                  <input
                      className="login-input password-field__input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Құпия сөзді енгізіңіз"
                  />
                  <button
                      type="button"
                      className="password-field__toggle"
                      onClick={() => setShowPassword((p) => !p)}
                      title={showPassword ? "Құпия сөзді жасыру" : "Құпия сөзді көрсету"}
                      aria-label={showPassword ? "Құпия сөзді жасыру" : "Құпия сөзді көрсету"}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
                <p className="form-hint">Құпия сөзді үшінші тұлғаларға бермеңіз.</p>
              </div>

              {msg && <div className="form-error login-error">{msg}</div>}

              <TurnstileField
                ref={turnstileRef}
                onToken={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
              />

              <button className="login-btn" type="submit">
                Кіру
              </button>
            </form>

            <div className="login-links">
              <Link className="login-link" to="/forgot-password">
                Құпия сөзді ұмыттыңыз ба?
              </Link>

              <Link className="login-link login-link--accent" to="/register">
                Тіркелу
              </Link>
            </div>
          </div>
        </div>
      </div>
  );
}
