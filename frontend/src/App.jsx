import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { initChatRealtime } from "./services/chatRealtime";
import Home from "./pages/Home.jsx";
import Doctors from "./pages/Doctors.jsx";
import DoctorDetail from "./pages/DoctorDetail.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Profile from "./pages/Profile.jsx";
import Diary from "./pages/Diary.jsx";
import Book from "./pages/Book.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import AdminDoctors from "./pages/AdminDoctors.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminDoctorsStats from "./pages/AdminDoctorsStats.jsx";
import AdminNews from "./pages/AdminNews.jsx";
import AdminAiTest from "./pages/AdminAiTest.jsx";
import Notifications from "./pages/Notifications.jsx";
import Chat from "./pages/Chat.jsx";
import DirectChat from "./pages/DirectChat.jsx";
import Groups from "./pages/Groups.jsx";
import NewsList from "./pages/NewsList.jsx";
import NewsDetail from "./pages/NewsDetail.jsx";
import DoctorCabinet from "./pages/DoctorCabinet.jsx";
import DoctorPatient from "./pages/DoctorPatient.jsx";
import PsychDashboard from "./pages/PsychDashboard.jsx";
import PsychCaseDetail from "./pages/PsychCaseDetail.jsx";
import PsychAssignments from "./pages/PsychAssignments.jsx";
import MobilePreview from "./pages/MobilePreview.jsx";
import PageContainer from "./layouts/PageContainer.jsx";

function RequireAuth({ children }) {
    const loc = useLocation();
    const t = localStorage.getItem("token");
    if (!t) return <Navigate to="/login" state={{ from: loc }} replace />;
    return children;
}

export default function App() {
    const loc = useLocation();
    const isMobilePreview = loc.pathname === "/mobile-preview";
    const isGroupsPage = loc.pathname === "/groups";

    useEffect(() => {
        if (isMobilePreview) return undefined;
        return initChatRealtime();
    }, [isMobilePreview]);

    useEffect(() => {
        if (!isGroupsPage) return undefined;
        document.documentElement.classList.add("route-groups");
        document.body.classList.add("route-groups");
        return () => {
            document.documentElement.classList.remove("route-groups");
            document.body.classList.remove("route-groups");
        };
    }, [isGroupsPage]);

    return (
        <div
            className={
                "app-shell" +
                (isMobilePreview ? " app-shell--mobile-preview" : "") +
                (isGroupsPage ? " app-shell--groups" : "")
            }
        >
            {!isMobilePreview && (
                <a href="#main-content" className="skip-link">
                    Негізгі мазмұнға өту
                </a>
            )}
            {!isMobilePreview && <Header />}

            <main
                id="main-content"
                className={"app-main" + (isGroupsPage ? " app-main--groups" : "")}
                tabIndex={-1}
            >
                <Routes>
                    <Route path="/mobile-preview" element={<MobilePreview />} />
                    <Route path="/" element={<Home />} />
                    <Route element={<PageContainer />}>
                        <Route path="/doctors" element={<Doctors />} />
                        <Route path="/doctors/:id" element={<DoctorDetail />} />

                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />

                        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                        <Route path="/doctor" element={<RequireAuth><DoctorCabinet /></RequireAuth>} />
                        <Route path="/doctor/patients/:userId" element={<RequireAuth><DoctorPatient /></RequireAuth>} />
                        <Route path="/diary" element={<RequireAuth><Diary /></RequireAuth>} />
                        <Route path="/book/:doctorId" element={<RequireAuth><Book /></RequireAuth>} />
                        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
                        <Route path="/chat/:appointmentId" element={<RequireAuth><Chat /></RequireAuth>} />
                        <Route path="/dm/:chatId" element={<RequireAuth><DirectChat /></RequireAuth>} />
                        <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />

                        <Route path="/news" element={<NewsList />} />
                        <Route path="/news/:slug" element={<NewsDetail />} />

                        <Route path="/psych" element={<RequireAuth><PsychDashboard /></RequireAuth>} />
                        <Route path="/psych/assignments" element={<RequireAuth><PsychAssignments /></RequireAuth>} />
                        <Route path="/psych/cases/:id" element={<RequireAuth><PsychCaseDetail /></RequireAuth>} />

                        <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />
                        <Route path="/admin/doctors" element={<RequireAuth><AdminDoctors /></RequireAuth>} />
                        <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
                        <Route path="/admin/doctors-stats" element={<RequireAuth><AdminDoctorsStats /></RequireAuth>} />
                        <Route path="/admin/news" element={<RequireAuth><AdminNews /></RequireAuth>} />
                        <Route path="/admin/ai-test" element={<RequireAuth><AdminAiTest /></RequireAuth>} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>

            {!isMobilePreview && !isGroupsPage && <Footer />}
        </div>
    );
}