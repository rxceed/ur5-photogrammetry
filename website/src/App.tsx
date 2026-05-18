import { useState } from "react";
import CameraPage from "./pages/CameraPage";
import UploadPage from "./pages/UploadPage";
import "./App.css";

type Page = "camera" | "upload";

export default function App() {
  const [page, setPage] = useState<Page>("camera");

  return (
    <>
      {page === "camera" && (
        <CameraPage onNavigateUpload={() => setPage("upload")} />
      )}
      {page === "upload" && (
        <UploadPage onBack={() => setPage("camera")} />
      )}
    </>
  );
}