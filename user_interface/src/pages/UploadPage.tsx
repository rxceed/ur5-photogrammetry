import { useState, useEffect } from "react";
import { getCookie } from "../utils/cookies";

type UploadStatus = "idle" | "scanning" | "loading" | "success" | "error";

interface ImageEntry {
  name: string;
  path: string;
}

interface UploadPageProps {
  onBack: () => void;
  onUploadSuccess?: (projectName: string, taskName: string) => void;
}

export default function UploadPage({ onBack, onUploadSuccess }: UploadPageProps) {
  const [projectName, setProjectName] = useState<string>(
    process.env.BUN_PUBLIC_DEFAULT_PROJECT_NAME || "PersepsiRobot"
  );
  const [taskName,    setTaskName]    = useState<string>("");
  const [status,      setStatus]      = useState<UploadStatus>("idle");
  const [errorMsg,    setErrorMsg]    = useState<string>("");

  // ─── Directory + image list ──────────────────────────────────────────────
  const [defaultDir,   setDefaultDir]   = useState<string>("");
  const [imageDir,     setImageDir]     = useState<string>("");
  const [imageDirInput, setImageDirInput] = useState<string>("");  // raw input value
  const [images,       setImages]       = useState<ImageEntry[]>([]);
  const [scanError,    setScanError]    = useState<string>("");

  // ─── Lightbox ────────────────────────────────────────────────────────────
  const [lightbox, setLightbox] = useState<ImageEntry | null>(null);

  // Load default directory on mount
  useEffect(() => {
    fetch("/api/list-images")
      .then(r => r.json())
      .then((data) => {
        if (data.defaultDir) {
          setDefaultDir(data.defaultDir);
          setImageDirInput(data.defaultDir);
        }
        if (data.images) {
          setImages(data.images);
          setImageDir(data.dir);
        }
      })
      .catch(() => {/* server might not be ready yet, ignore */});
  }, []);

  // ─── Scan directory ──────────────────────────────────────────────────────
  async function handleScan(): Promise<void> {
    setScanError("");
    setImages([]);
    setStatus("scanning");

    const dir = imageDirInput.trim() || defaultDir;
    const res = await fetch(`/api/list-images?dir=${encodeURIComponent(dir)}`);
    const data = await res.json();

    setStatus("idle");

    if (!res.ok || data.error) {
      setScanError(data.error ?? "Failed to read directory.");
      return;
    }

    setImageDir(data.dir);
    setImages(data.images ?? []);
    if ((data.images ?? []).length === 0) {
      setScanError("No image files found in that directory.");
    }
  }

  // ─── Upload ──────────────────────────────────────────────────────────────
  async function handleSubmit(): Promise<void> {
    setErrorMsg("");

    if (!projectName.trim() || !taskName.trim()) {
      alert("Please fill in Project Name and Task Name.");
      return;
    }
    if (images.length === 0) {
      alert("No images loaded. Please scan a directory first.");
      return;
    }

    const baseUrl = process.env.BUN_PUBLIC_BE_BASE_URI;
    setStatus("loading");

    try {
      // 1. Authenticate
      const authRes = await fetch(`${baseUrl}/api/auth/token-auth/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: process.env.BUN_PUBLIC_USERNAME as string,
          password: process.env.BUN_PUBLIC_PASS as string,
        }),
        credentials: "include",
      });
      const token = (await authRes.json()).token;

      // 2. Get or create project
      const projectRes = await fetch(
        `${baseUrl}/api/project/?name=${encodeURIComponent(projectName)}`,
        {
          headers: {
            Authorization: `JWT ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      let projectId: number;
      if (projectRes.status === 404) {
        const createRes = await fetch(`${baseUrl}/api/project/`, {
          method: "POST",
          headers: {
            Authorization: `JWT ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: projectName }),
          credentials: "include",
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

      if (!projectId!) throw new Error("Could not obtain a valid Project ID");

      // 3. Fetch all images from local server and build FormData
      const formData = new FormData();
      formData.append("name", taskName);
      formData.append("projectId", projectId.toString());

      await Promise.all(
        images.map(async (img) => {
          const imgRes = await fetch(
            `/api/get-image?path=${encodeURIComponent(img.path)}`
          );
          if (!imgRes.ok) throw new Error(`Could not load image: ${img.name}`);
          const blob = await imgRes.blob();
          formData.append("images", blob, img.name);
        })
      );

      // 4. Create task
      const uploadRes = await fetch(`${baseUrl}/api/task`, {
        method: "POST",
        headers: { Authorization: `JWT ${token}` },
        body: formData,
        credentials: "include",
      });

      if (!uploadRes.ok) throw new Error(`Server responded ${uploadRes.status}`);

      setStatus("success");
      setTimeout(() => {
        onUploadSuccess?.(projectName, taskName);
      }, 800);
    } catch (err) {
      console.error(err);
      setErrorMsg(String(err));
      setStatus("error");
    }
  }

  const isUploading = status === "loading";
  const isScanning  = status === "scanning";

  return (
    <div className="container upload-container">
      {/* ── Back ── */}
      <button
        className="start back-btn"
        onClick={onBack}
      >
        ← Back
      </button>

      <h1>Upload to WebODM</h1>

      {/* ── Project / Task fields ── */}
      <div className="form-group">
        <label htmlFor="projectName">Project Name</label>
        <input
          id="projectName"
          type="text"
          placeholder="Enter project name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="taskName">Task Name</label>
        <input
          id="taskName"
          type="text"
          placeholder="Enter task name"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
        />
      </div>

      {/* ── Directory picker ── */}
      <div className="form-group dir-group">
        <label htmlFor="imageDir">Image Directory</label>
        <div className="dir-row">
          <input
            id="imageDir"
            type="text"
            placeholder={defaultDir || "/path/to/images"}
            value={imageDirInput}
            onChange={(e) => setImageDirInput(e.target.value)}
            className="dir-input"
          />
          <button
            className="scan-btn"
            onClick={handleScan}
            disabled={isScanning || isUploading}
          >
            {isScanning ? "Scanning…" : "Load Images"}
          </button>
        </div>
        {defaultDir && (
          <p className="dir-hint">
            Default: <code>{defaultDir}</code>
          </p>
        )}
        {scanError && (
          <p className="dir-error">{scanError}</p>
        )}
      </div>

      {/* ── Gallery preview ── */}
      {images.length > 0 && (
        <div className="gallery-section">
          <div className="gallery-header">
            <span className="gallery-count">
              {images.length} image{images.length !== 1 ? "s" : ""} found
            </span>
            <span className="gallery-dir-label" title={imageDir}>
              {imageDir}
            </span>
          </div>

          <div className="gallery-grid">
            {images.map((img) => (
              <button
                key={img.path}
                className="gallery-thumb"
                onClick={() => setLightbox(img)}
                title={img.name}
              >
                <img
                  src={`/api/get-image?path=${encodeURIComponent(img.path)}`}
                  alt={img.name}
                  loading="lazy"
                />
                <span className="gallery-thumb-name">{img.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Upload button ── */}
      <div className="buttons">
        <button
          className="upload"
          onClick={handleSubmit}
          disabled={isUploading || isScanning || images.length === 0}
        >
          {isUploading
            ? `Uploading ${images.length} images…`
            : `Upload ${images.length > 0 ? `(${images.length})` : ""}`}
        </button>
      </div>

      {/* ── Status messages ── */}
      {status === "success" && (
        <p className="status success">✓ Upload successful! Task created in WebODM.</p>
      )}
      {status === "error" && (
        <p className="status error">✗ Upload failed: {errorMsg || "Please try again."}</p>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.name}
        >
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="lightbox-close"
              onClick={() => setLightbox(null)}
              aria-label="Close preview"
            >
              ✕
            </button>
            <img
              src={`/api/get-image?path=${encodeURIComponent(lightbox.path)}`}
              alt={lightbox.name}
            />
            <p className="lightbox-name">{lightbox.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}