export default function Footer() {
    return (
        <footer className="app-footer">
            <div className="app-footer__inner">
                <div className="app-footcol">
                    <div className="app-footcol__brand">Janymda</div>
                    <div className="app-footcol__text">All rights reserved</div>
                    <div className="app-footcol__icons">
                        <span className="app-icon" title="Instagram" />
                        <span className="app-icon" title="YouTube" />
                    </div>
                </div>

                <div className="app-footcol">
                    <div className="app-footcol__title">Компания</div>
                    <a className="app-footlink" href="#">О нас</a>
                    <a className="app-footlink" href="#">О команде</a>
                    <a className="app-footlink" href="#">Контакты</a>
                </div>

                <div className="app-footcol">
                    <div className="app-footcol__title">Поддержка</div>
                    <a className="app-footlink" href="#">FAQ</a>
                    <a className="app-footlink" href="#">Terms of service</a>
                    <a className="app-footlink" href="#">Пользовательское соглашение</a>
                    <a className="app-footlink" href="#">Политика безопасности</a>
                </div>

                <div className="app-footcol">
                    <div className="app-footcol__title">Stay up to date</div>
                    <div className="app-news">
                        <input className="app-news__input" placeholder="Your email address" />
                        <button className="app-news__btn" type="button">➤</button>
                    </div>
                </div>
            </div>
        </footer>
    );
}