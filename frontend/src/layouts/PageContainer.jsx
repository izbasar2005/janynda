import { Outlet } from "react-router-dom";

/** Centered page shell for all routes except home (hero is full-width there). */
export default function PageContainer() {
    return (
        <div className="container page">
            <Outlet />
        </div>
    );
}
