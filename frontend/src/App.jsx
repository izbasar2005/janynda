import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";

import Home from "./pages/Home.jsx";
import Doctors from "./pages/Doctors.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Profile from "./pages/Profile.jsx";
import Book from "./pages/Book.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import AdminDoctors from "./pages/AdminDoctors.jsx";

export default function App() {
    return (
        <div className="app-shell">
            <Header />

            <main className="app-main">
                <div className="container">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/doctors" element={<Doctors />} />

                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        <Route path="/profile" element={<Profile />} />
                        <Route path="/book/:doctorId" element={<Book />} />

                        <Route path="/admin/users" element={<AdminUsers />} />
                        <Route path="/admin/doctors" element={<AdminDoctors />} />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </main>

            <Footer />
        </div>
    );
}