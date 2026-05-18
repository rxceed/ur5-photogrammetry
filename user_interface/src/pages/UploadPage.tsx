import { useState } from "react";
import { getCookie } from "../utils/cookies";

type UploadStatus = "idle" | "loading" | "success" | "error";

interface UploadPageProps {
  onBack: () => void;
}

export default function UploadPage({ onBack }: UploadPageProps) {
  const [projectName, setProjectName] = useState<string>("");
  const [taskName,    setTaskName]    = useState<string>("");
  const [files,       setFiles]       = useState<File[]>([]);
  const [status,      setStatus]      = useState<UploadStatus>("idle");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setFiles(Array.from(e.target.files ?? []));
  }

  // ─────────────────────────────────────────────────────────────
  // UPLOAD SUBMIT — sends FormData to your backend endpoint
  // ─────────────────────────────────────────────────────────────
  async function handleSubmit(): Promise<void> {
    if (!projectName.trim() || !taskName.trim()) {
      alert("Please fill in Project Name and Task Name.");
      return;
    }
    const baseUrl = process.env.BUN_PUBLIC_BE_BASE_URI
    const authUrl = `${baseUrl}/api/auth/token-auth/`
    const authRes = await fetch(authUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json',},
                                body: JSON.stringify({"username": process.env.BUN_PUBLIC_USERNAME as string,
                                                      "password": process.env.BUN_PUBLIC_PASS as string
                                }),
                                credentials: 'include'
    })
    const token = (await authRes.json()).token

    // ══════════════════════════════════════════════════════════
    // ★  JWT COOKIE ACCESS  ★
    // Retrieve the "jwt" cookie to attach as an Authorization header
    const jwtToken: string | null = getCookie("jwt");
    // ══════════════════════════════════════════════════════════

    const formData = new FormData()
    formData.append("name",    taskName);
    for (const file of files) {
      formData.append("images", file);
    }

    setStatus("loading");

    try {
      // 1. Check if project exists
      const projectUrl = `${baseUrl}/api/project/?name=${encodeURIComponent(projectName)}`
      const projectRes = await fetch(projectUrl, {
                                method: "GET",
                                headers: { 
                                  "Authorization": `JWT ${token}`,
                                  "Content-Type": "application/json"
                                },
                                credentials: 'include'
      })

      let projectId;
      if (projectRes.status === 404) {
        // 2. Create project if not found
        console.log("Project not found, creating...");
        const createProjectUrl = `${baseUrl}/api/project/`
        const createRes = await fetch(createProjectUrl, {
          method: "POST",
          headers: { 
            "Authorization": `JWT ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: projectName }),
          credentials: 'include'
        });
        if (!createRes.ok) throw new Error(`Failed to create project: ${createRes.status}`);
        const newProject = await createRes.json();
        projectId = newProject.id;
      } else if (!projectRes.ok) {
        throw new Error(`Failed to check project: ${projectRes.status}`);
      } else {
        const projectData = await projectRes.json();
        projectId = projectData.id;
      }

      if (!projectId) throw new Error("Could not obtain a valid Project ID");

      // 3. Create task
      formData.append("projectId", projectId.toString());
      const uploadUrl = `${baseUrl}/api/task`
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Authorization": `JWT ${token}` },
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error(`Server responded ${response.status}`);

      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  return (
    <div className="container">
      <button
        className="start"
        style={{ marginBottom: "20px", alignSelf: "flex-start" }}
        onClick={onBack}
      >
        ← Back
      </button>

      <h1>Upload</h1>

      <div className="form-group">
        <label htmlFor="projectName">Project Name</label>
        <input
          id="projectName"
          type="text"
          placeholder="Enter project name"
          value={projectName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setProjectName(e.target.value)
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="taskName">Task Name</label>
        <input
          id="taskName"
          type="text"
          placeholder="Enter task name"
          value={taskName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTaskName(e.target.value)
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="fileUpload">Images</label>
        <input
          id="fileUpload"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
        />
        {files.length > 0 && (
          <p className="file-count">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      <div className="buttons">
        <button
          className="upload"
          onClick={handleSubmit}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Uploading…" : "Upload"}
        </button>
      </div>

      {status === "success" && <p className="status success">Upload successful!</p>}
      {status === "error"   && <p className="status error">Upload failed. Try again.</p>}
    </div>
  );
}