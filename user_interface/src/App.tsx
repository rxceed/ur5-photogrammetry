import { useState } from "react";
import CameraPage from "./pages/CameraPage";
import UploadPage from "./pages/UploadPage";
import ViewerPage from "./pages/ViewerPage";
import "./App.css";

type Page = "camera" | "upload" | "viewer";

export default function App() {
  const [page, setPage] = useState<Page>("camera");

  return (
    <>
      {page === "camera" && (
        <CameraPage 
          onNavigateUpload={() => setPage("upload")} 
          onNavigateViewer={() => setPage("viewer")}
        />
      )}
      {page === "upload" && (
        <UploadPage onBack={() => setPage("camera")} />
      )}
      {page === "viewer" && (
        <ViewerPage onBack={() => setPage("camera")} />
      )}
    </>
  );
}