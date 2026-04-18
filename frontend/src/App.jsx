import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { token } from "./services/api";

import Home from "./pages/Home.jsx";
import Doctors from "./pages/Doctors.jsx";
import DoctorDetail from "./pages/DoctorDetail.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Profile from "./pages/Profile.jsx";
import Diary from "./pages/Diary.jsx";
import Book from "./pages/Book.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import AdminDoctors from "./pages/AdminDoctors.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminDoctorsStats from "./pages/AdminDoctorsStats.jsx";
import AdminNews from "./pages/AdminNews.jsx";
import Notifications from "./pages/Notifications.jsx";
import Chat from "./pages/Chat.jsx";
import DirectChat from "./pages/DirectChat.jsx";
import Groups from "./pages/Groups.jsx";
import NewsList from "./pages/NewsList.jsx";
import NewsDetail from "./pages/NewsDetail.jsx";
import DoctorCabinet from "./pages/DoctorCabinet.jsx";
import DoctorPatient from "./pages/DoctorPatient.jsx";

export default function App() {
    return (
        <div className="app-shell">
            <Header />

            <main className="app-main">
                <div className="container">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/doctors" element={<Doctors />} />
                        <Route path="/doctors/:id" element={<DoctorDetail />} />

                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        <Route path="/profile" element={<Profile />} />
                        <Route path="/doctor" element={<DoctorCabinet />} />
                        <Route path="/doctor/patients/:userId" element={<DoctorPatient />} />
                        <Route path="/diary" element={token() ? <Diary /> : <Navigate to="/login" replace />} />
                        <Route path="/book/:doctorId" element={<Book />} />
                        <Route path="/notifications" element={<Notifications />} />
                        <Route path="/chat/:appointmentId" element={<Chat />} />
                        <Route path="/dm/:chatId" element={<DirectChat />} />
                        <Route path="/groups" element={<Groups />} />

                        <Route path="/news" element={<NewsList />} />
                        <Route path="/news/:slug" element={<NewsDetail />} />

                        <Route path="/admin/users" element={<AdminUsers />} />
                        <Route path="/admin/doctors" element={<AdminDoctors />} />
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                        <Route path="/admin/doctors-stats" element={<AdminDoctorsStats />} />
                        <Route path="/admin/news" element={<AdminNews />} />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </main>

            <Footer />
        </div>
    );
}