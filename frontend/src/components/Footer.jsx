import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="app-footer">
            <div className="app-footer__inner">
                <div className="app-footcol">
                    <div className="app-footcol__brand">Janymda</div>
                    <p className="app-footcol__text">
                        Медициналық онлайн платформа — дәрігерге оңай жазылу.
                    </p>
                    <div className="app-footcol__icons">
                        <span className="app-icon" title="Instagram" />
                        <span className="app-icon" title="YouTube" />
                    </div>
                </div>

                <div className="app-footcol">
                    <div className="app-footcol__title">Платформа</div>
                    <Link className="app-footlink" to="/">Главная</Link>
                    <Link className="app-footlink" to="/doctors">Запись к врачу</Link>
                    <Link className="app-footlink" to="/login">Войти</Link>
                    <Link className="app-footlink" to="/register">Регистрация</Link>
                </div>

                <div className="app-footcol">
                    <div className="app-footcol__title">Дәрігерлер</div>
                    <Link className="app-footlink" to="/doctors">Терапевт</Link>
                    <Link className="app-footlink" to="/doctors">Педиатр</Link>
                    <Link className="app-footlink" to="/doctors">Кардиолог</Link>
                    <Link className="app-footlink" to="/doctors">Тіс дәрігері</Link>
                </div>

                <div className="app-footcol">
                    <div className="app-footcol__title">Байланыс</div>
                    <p className="app-footcol__text">+7 (700) 000-00-00</p>
                    <p className="app-footcol__text">support@janymda.kz</p>
                </div>

                <div className="app-footcol">
                    <div className="app-footcol__title">Құпиялылық</div>
                    <a className="app-footlink" href="#">Қолдану шарттары</a>
                    <a className="app-footlink" href="#">Құпиялылық саясаты</a>
                    <a className="app-footlink" href="#">Cookie саясаты</a>
                </div>

                <div className="app-footcol app-footcol--news">
                    <div className="app-footcol__title">Жаңалықтар</div>
                    <div className="app-news">
                        <input className="app-news__input" placeholder="Email мекенжайы" />
                        <button className="app-news__btn" type="button">➤</button>
                    </div>
                </div>
            </div>
            <div className="app-footer__bottom">
                <p className="app-footer__copy">© {new Date().getFullYear()} Janymda. Барлық құқықтар қорғалған.</p>
            </div>
        </footer>
    );
}
