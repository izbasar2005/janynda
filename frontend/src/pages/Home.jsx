import { Link } from "react-router-dom";

export default function Home() {
    return (
        <div className="hero">
            <div>
                <h1 className="hero-main_title">Медициналық онлайн сервис Janymda</h1>
                <p className="hero-subtitle muted">
                    Дәрігерге онлайн жазылу, қауіпсіз тіркелу және заманауи жеке кабинет.
                </p>

                <div className="hero-actions">
                    <Link className="btn" to="/doctors">
                        Найти врача
                    </Link>
                    <Link className="btn ghost" to="/login">
                        Войти в личный кабинет
                    </Link>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginTop: 0 }}>Как работает платформа</h3>
                <p className="muted" style={{ marginTop: 4 }}>
                    • Авторизуйтесь или зарегистрируйтесь, чтобы мы знали вас. <br />
                    • Выберите врача и удобное время приёма. <br />
                    • Все данные передаются по защищённому соединению. API остаётся прежним:
                    <b> /api/v1/...</b>
                </p>
            </div>
        </div>
    );
}