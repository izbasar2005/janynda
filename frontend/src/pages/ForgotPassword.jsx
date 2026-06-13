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

export default function ForgotPassword() {
  const nav = useNavigate();
  const [method, setMethod] = useState(null); // null = choice, "phone", "email"
  const [step, setStep] = useState(1); // 1=input, 2=code, 3=new password
  const [phone, setPhone] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [msg, setMsg] = useState("");
  const [callMethod, setCallMethod] = useState(""); // "sms" or "call" from server
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);

  function startCountdown() {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendCodePhone(e) {
    if (e) e.preventDefault();
    if (!phone.trim()) { setMsg("Телефон нөмірін енгізіңіз"); return; }
    if (TURNSTILE_ENABLED && !captchaToken) { setMsg("CAPTCHA растаңыз"); return; }
    setLoading(true);
    setMsg("");
    try {
      const data = await api("/api/v1/auth/forgot-password/send-code", {
        method: "POST",
        body: { phone: phone.trim(), captcha_token: captchaToken },
      });
      setStep(2);
      setCallMethod(data.method || "call");
      if (data.method === "call") {
        setMsg("Сізге қоңырау шалынады. Кодты тыңдаңыз.");
      } else {
        setMsg("SMS код жіберілді");
      }
      startCountdown();
      turnstileRef.current?.reset();
      setCaptchaToken("");
    } catch (e) {
      try { setMsg(JSON.parse(e.message).error || e.message); } catch { setMsg(e.message); }
      turnstileRef.current?.reset();
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCodeEmail(e) {
    if (e) e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) { setMsg("Email дұрыс енгізіңіз"); return; }
    if (TURNSTILE_ENABLED && !captchaToken) { setMsg("CAPTCHA растаңыз"); return; }
    setLoading(true);
    setMsg("");
    try {
      await api("/api/v1/auth/forgot-password/email/send-code", {
        method: "POST",
        body: { email: emailInput.trim(), captcha_token: captchaToken },
      });
      setStep(2);
      setMsg("Код email-ге жіберілді");
      startCountdown();
      turnstileRef.current?.reset();
      setCaptchaToken("");
    } catch (e) {
      try { setMsg(JSON.parse(e.message).error || e.message); } catch { setMsg(e.message); }
      turnstileRef.current?.reset();
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoToPassword(e) {
    e.preventDefault();
    if (!code.trim()) { setMsg("Кодты енгізіңіз"); return; }
    setMsg("");
    setLoading(true);
    try {
      const endpoint = method === "phone"
        ? "/api/v1/auth/forgot-password/check-code"
        : "/api/v1/auth/forgot-password/email/check-code";
      const body = method === "phone"
        ? { phone: phone.trim(), code: code.trim() }
        : { email: emailInput.trim(), code: code.trim() };
      await api(endpoint, { method: "POST", body });
      setStep(3);
    } catch (e) {
      try { setMsg(JSON.parse(e.message).error || e.message); } catch { setMsg(e.message); }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setMsg("");
    if (!newPassword || !newPassword2) { setMsg("Жаңа құпия сөзді енгізіңіз"); return; }
    if (newPassword !== newPassword2) { setMsg("Құпия сөздер сәйкес емес"); return; }
    if (newPassword.length < 4) { setMsg("Құпия сөз кемінде 4 символ болуы керек"); return; }

    setLoading(true);
    try {
      const endpoint = method === "phone"
        ? "/api/v1/auth/forgot-password/reset"
        : "/api/v1/auth/forgot-password/email/reset";

      const body = method === "phone"
        ? { phone: phone.trim(), code: code.trim(), new_password: newPassword }
        : { email: emailInput.trim(), code: code.trim(), new_password: newPassword };

      await api(endpoint, { method: "POST", body });
      setMsg("Құпия сөз сәтті өзгертілді!");
      setTimeout(() => nav("/login"), 2000);
    } catch (e) {
      try { setMsg(JSON.parse(e.message).error || e.message); } catch { setMsg(e.message); }
    } finally {
      setLoading(false);
    }
  }

  // Method selection screen
  if (!method) {
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
            <h2 className="login-title">Құпия сөзді қалпына келтіру</h2>
            <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20, textAlign: "center" }}>
              Қалпына келтіру әдісін таңдаңыз:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                type="button"
                className="login-btn"
                onClick={() => setMethod("phone")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <span style={{ fontSize: 20 }}>📞</span> Телефон арқылы
              </button>
              <button
                type="button"
                className="login-btn"
                onClick={() => setMethod("email")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#6366f1" }}
              >
                <span style={{ fontSize: 20 }}>✉️</span> Email арқылы
              </button>
            </div>
            <div className="login-links" style={{ marginTop: 16 }}>
              <Link className="login-link" to="/login">← Кіру бетіне оралу</Link>
            </div>
          </div>
        </div>
      </div>
    );
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

          <h2 className="login-title">Құпия сөзді қалпына келтіру</h2>
          <p style={{ fontSize: 13, color: "#6366f1", marginBottom: 12, textAlign: "center", cursor: "pointer" }}
             onClick={() => { setMethod(null); setStep(1); setMsg(""); setCode(""); }}>
            ← Әдісті өзгерту ({method === "phone" ? "Телефон" : "Email"})
          </p>

          {/* Step 1: Input phone or email */}
          {step === 1 && (
            <form className="login-form form" onSubmit={method === "phone" ? handleSendCodePhone : handleSendCodeEmail}>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
                {method === "phone"
                  ? "Тіркелген телефон нөміріңізді енгізіңіз."
                  : "Тіркелген email адресіңізді енгізіңіз."}
              </p>
              <div className="form-field">
                <label className="form-label">{method === "phone" ? "Телефон" : "Email"}</label>
                {method === "phone" ? (
                  <input
                    className="login-input"
                    placeholder="+7 700 000 00 00"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                ) : (
                  <input
                    className="login-input"
                    type="email"
                    placeholder="example@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                )}
              </div>
              {msg && <div className="form-error login-error">{msg}</div>}
              <TurnstileField
                ref={turnstileRef}
                onToken={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
              />
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Жіберілуде..." : "Код жіберу"}
              </button>
            </form>
          )}

          {/* Step 2: Enter code */}
          {step === 2 && (
            <form className="login-form form" onSubmit={handleGoToPassword}>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
                {method === "phone"
                  ? `${phone} нөміріне ${callMethod === "call" ? "қоңырау шалынды" : "код жіберілді"}.`
                  : `${emailInput} адресіне код жіберілді.`}
              </p>
              <div className="form-field">
                <label className="form-label">Код</label>
                <input
                  className="login-input"
                  placeholder="Кодты енгізіңіз"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={4}
                  inputMode="numeric"
                  style={{ maxWidth: 180 }}
                />
              </div>
              <TurnstileField
                ref={turnstileRef}
                onToken={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
              />
              <button
                type="button"
                className="login-link"
                onClick={method === "phone" ? handleSendCodePhone : handleSendCodeEmail}
                disabled={countdown > 0 || loading}
                style={{ fontSize: 13, opacity: countdown > 0 ? 0.5 : 1, marginBottom: 8 }}
              >
                {countdown > 0 ? `Қайта жіберу (${countdown}с)` : "Қайта жіберу"}
              </button>
              {msg && (
                <div style={{ fontSize: 13, marginTop: 4, color: msg.includes("жіберілді") || msg.includes("шалынады") ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                  {msg}
                </div>
              )}
              <button className="login-btn" type="submit" disabled={loading || !code.trim()}>
                Жалғастыру
              </button>
            </form>
          )}

          {/* Step 3: New password */}
          {step === 3 && (
            <form className="login-form form" onSubmit={handleResetPassword}>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 12 }}>
                Жаңа құпия сөзді орнатыңыз.
              </p>
              <div className="form-field">
                <label className="form-label">Жаңа құпия сөз</label>
                <div className="password-field">
                  <input
                    className="login-input password-field__input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Жаңа құпия сөз"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button type="button" className="password-field__toggle" onClick={() => setShowPassword((p) => !p)}>
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Құпия сөзді растау</label>
                <div className="password-field">
                  <input
                    className="login-input password-field__input"
                    type={showPassword2 ? "text" : "password"}
                    placeholder="Құпия сөзді қайта енгізіңіз"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                  />
                  <button type="button" className="password-field__toggle" onClick={() => setShowPassword2((p) => !p)}>
                    <EyeIcon off={showPassword2} />
                  </button>
                </div>
              </div>
              {msg && (
                <div style={{ fontSize: 13, marginTop: 8, color: msg.includes("сәтті") ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                  {msg}
                </div>
              )}
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "Өзгертілуде..." : "Құпия сөзді өзгерту"}
              </button>
            </form>
          )}

          <div className="login-links">
            <Link className="login-link" to="/login">← Кіру бетіне оралу</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
