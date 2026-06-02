import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

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

export default function Register() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("");

  const [login, setLogin] = useState("");          // LOGIN (қалауыңша full_name ретінде қолданамыз)
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [iin, setIin] = useState("");
  const [firstName, setFirstName] = useState("");  // ИМЯ
  const [lastName, setLastName] = useState("");    // ФИО (сенде солай тұр) -> фамилия деп аламыз
  const [patronymic, setPatronymic] = useState(""); // ОТЧЕСТВО
  const [gender, setGender] = useState("");         // ПОЛ
  const [phone, setPhone] = useState("");           // ТЕЛЕФОН
  const [role, setRole] = useState("patient");      // РӨЛ

  async function uploadAvatar(file) {
    if (!file) return;
    setAvatarUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/upload", { method: "POST", body: fd });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const data = JSON.parse(text);
      setAvatarUrl(data?.url || "");
    } catch (e) {
      setMsg("Аватар жүктеу қатесі: " + (e.message || "Қате"));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (password !== password2) {
      setMsg("Қате: құпия сөздер сәйкес емес");
      return;
    }

    // full_name backend міндетті, сондықтан құрастырып жібереміз
    const full_name =
        (lastName + " " + firstName + " " + patronymic).trim() ||
        login.trim();

    try {
      await api("/api/v1/auth/register", {
        method: "POST",
        body: {
          full_name,
          phone,
          password,

          avatar_url: avatarUrl,

          iin,
          first_name: firstName,
          last_name: lastName,
          patronymic,
          gender,
          role,
        },
      });
      nav("/login");
    } catch (e) {
      setMsg("Қате: " + e.message);
    }
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

            <h2 className="login-title">Тіркелу</h2>

            <form className="login-form form" onSubmit={onSubmit}>
            <div className="form-field">
              <label className="form-label">Аватар (міндетті емес)</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 999,
                    background: "rgba(15,23,42,.06)",
                    border: "1px solid rgba(15,23,42,.08)",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    color: "#0f172a",
                    fontWeight: 800,
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    "🙂"
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => uploadAvatar(e.target.files?.[0])}
                    disabled={avatarUploading}
                  />
                  {avatarUrl && (
                    <button type="button" className="btn ghost" onClick={() => setAvatarUrl("")} disabled={avatarUploading}>
                      Жою
                    </button>
                  )}
                  {avatarUploading && <span className="muted">Жүктелуде...</span>}
                </div>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Логин</label>
              <input className="login-input" placeholder="Логинді енгізіңіз" value={login} onChange={(e)=>setLogin(e.target.value)} />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Құпия сөз</label>
                <div className="password-field">
                  <input
                    className="login-input password-field__input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Құпия сөзді енгізіңіз"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
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
              </div>
              <div className="form-field">
                <label className="form-label">Құпия сөзді растау</label>
                <div className="password-field">
                  <input
                    className="login-input password-field__input"
                    type={showPassword2 ? "text" : "password"}
                    placeholder="Құпия сөзді қайта енгізіңіз"
                    value={password2}
                    onChange={(e)=>setPassword2(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-field__toggle"
                    onClick={() => setShowPassword2((p) => !p)}
                    title={showPassword2 ? "Құпия сөзді жасыру" : "Құпия сөзді көрсету"}
                    aria-label={showPassword2 ? "Құпия сөзді жасыру" : "Құпия сөзді көрсету"}
                  >
                    <EyeIcon off={showPassword2} />
                  </button>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">ЖСН</label>
                <input className="login-input" inputMode="numeric" placeholder="ЖСН" value={iin} onChange={(e)=>setIin(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Телефон</label>
                <input className="login-input" placeholder="+7 700 000 00 00" value={phone} onChange={(e)=>setPhone(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Аты</label>
                <input className="login-input" placeholder="Аты" value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Тегі</label>
                <input className="login-input" placeholder="Тегі" value={lastName} onChange={(e)=>setLastName(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Әкесінің аты</label>
                <input className="login-input" placeholder="Әкесінің аты" value={patronymic} onChange={(e)=>setPatronymic(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Жынысы</label>
                <select
                    className="login-input"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                >
                  <option value="" disabled>Жынысын таңдаңыз</option>
                  <option value="male">Ер</option>
                  <option value="female">Әйел</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Рөл</label>
              <select
                  className="login-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
              >
                <option value="patient">Науқас</option>
                <option value="volunteer">Ерікті</option>
              </select>
            </div>

            {msg && <div className="form-error login-error">{msg}</div>}

            <button className="login-btn" type="submit">Тіркелу</button>
          </form>
            <div className="login-links">
              <Link className="login-link login-link--accent" to="/login">Кіру</Link>
            </div>
          </div>
        </div>
      </div>
  );
}
