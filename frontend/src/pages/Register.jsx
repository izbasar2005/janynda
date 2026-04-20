import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

export default function Register() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("");

  const [login, setLogin] = useState("");          // LOGIN (қалауыңша full_name ретінде қолданамыз)
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

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
      setMsg("Қате: пароль сәйкес емес");
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
      <div className="reg-page">
        <div className="reg-card">
          <div className="reg-top">
            <div className="reg-logo" aria-hidden="true" />
            <div className="reg-brand">Janynda</div>
          </div>

          <div className="reg-head">
            <h2 className="reg-title">Тіркелу</h2>
            <Link className="reg-mini" to="/login">Аккаунтыңыз бар ма?</Link>
          </div>

          <form className="reg-form form" onSubmit={onSubmit}>
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
                      Өшіру
                    </button>
                  )}
                  {avatarUploading && <span className="muted">Жүктелуде...</span>}
                </div>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Логин</label>
              <input className="reg-input" placeholder="LOGIN" value={login} onChange={(e)=>setLogin(e.target.value)} />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Құпия сөз</label>
                <input className="reg-input" type="password" placeholder="PASSWORD" value={password} onChange={(e)=>setPassword(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Подтверждение пароля</label>
                <input className="reg-input" type="password" placeholder="ПОВТОРНЫЙ ПАРОЛЬ" value={password2} onChange={(e)=>setPassword2(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">ИИН</label>
                <input className="reg-input" placeholder="ИИН" value={iin} onChange={(e)=>setIin(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Телефон</label>
                <input className="reg-input" placeholder="ТЕЛЕФОН" value={phone} onChange={(e)=>setPhone(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Имя</label>
                <input className="reg-input" placeholder="ИМЯ" value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Фамилия</label>
                <input className="reg-input" placeholder="ФАМИЛИЯ" value={lastName} onChange={(e)=>setLastName(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label">Отчество</label>
                <input className="reg-input" placeholder="ОТЧЕСТВО" value={patronymic} onChange={(e)=>setPatronymic(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Пол</label>
                <select
                    className="reg-input"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                >
                  <option value="" disabled>ПОЛ</option>
                  <option value="male">Мужчина</option>
                  <option value="female">Женщина</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Рөл</label>
              <select
                  className="reg-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
              >
                <option value="patient">Пациент</option>
                <option value="volunteer">Волонтер</option>
              </select>
            </div>

            {msg && <div className="reg-msg form-error">{msg}</div>}

            <button className="reg-btn" type="submit">Зарегистрироваться</button>
          </form>
        </div>
      </div>
  );
}
