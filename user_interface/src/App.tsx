import { useState } from "react";
import CameraPage from "./pages/CameraPage";
import UploadPage from "./pages/UploadPage";
import ViewerPage from "./pages/ViewerPage";
import "./App.css";

type Page = "camera" | "upload" | "viewer";

export default function App() {
  const [page, setPage] = useState<Page>("camera");
  const [projectName, setProjectName] = useState(process.env.BUN_PUBLIC_DEFAULT_PROJECT_NAME || "PersepsiRobot");
  const [taskName, setTaskName] = useState("");
  const [autoLoad, setAutoLoad] = useState(false);

  return (
    <>
      {page === "camera" && (
        <CameraPage 
          onNavigateUpload={() => {
            setAutoLoad(false);
            setPage("upload");
          }} 
          onNavigateViewer={() => {
            setAutoLoad(false);
            setPage("viewer");
          }}
        />
      )}
      {page === "upload" && (
        <UploadPage 
          onBack={() => setPage("camera")} 
          onUploadSuccess={(pName, tName) => {
            setProjectName(pName);
            setTaskName(tName);
            setAutoLoad(true);
            setPage("viewer");
          }}
        />
      )}
      {page === "viewer" && (
        <ViewerPage 
          onBack={() => setPage("camera")} 
          initialProjectName={projectName}
          initialTaskName={taskName}
          initialAutoLoad={autoLoad}
          clearAutoLoad={() => setAutoLoad(false)}
        />
      )}
    </>
  );
}