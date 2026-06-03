import DoctorCardUI from "../DoctorCardUI";

export default function DoctorCard({ doctor, reviewsData }) {
    return <DoctorCardUI doctor={doctor} reviewsData={reviewsData} variant="landing" />;
}
