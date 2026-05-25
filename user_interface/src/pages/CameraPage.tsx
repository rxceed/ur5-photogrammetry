import { useRef, useState, useEffect } from "react";
import logo from "../assets/logo.svg";

interface CameraPageProps {
  onNavigateUpload: () => void;
  onNavigateViewer: () => void;
}

type AppMode = "idle" | "previewing" | "capturing";

export default function CameraPage({ onNavigateUpload, onNavigateViewer }: CameraPageProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sseRef    = useRef<EventSource | null>(null);

  const [isStreaming, setIsStreaming]     = useState(false);
  const [isCapturing, setIsCapturing]    = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [lightboxSrc, setLightboxSrc]    = useState<string | null>(null);

  const BE_BASE_URI = process.env.BUN_PUBLIC_BE_BASE_URI ?? "";

  // Derived display mode
  const mode: AppMode = isCapturing ? "capturing" : isStreaming ? "previewing" : "idle";

  // ─────────────────────────────────────────────────────────────
  // SSE — subscribe to /dataset/stream while capturing
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCapturing) {
      sseRef.current?.close();
      sseRef.current = null;
      return;
    }

    // Seed the gallery with whatever already exists
    fetch(`${BE_BASE_URI}/api/camera/dataset`)
      .then(r => r.json())
      .then(({ images }: { images: string[] }) => setCapturedImages(images))
      .catch(() => {});

    const es = new EventSource(`${BE_BASE_URI}/api/camera/dataset/stream`);
    sseRef.current = es;

    // Full snapshot (sent once on connect)
    es.addEventListener("snapshot", (e) => {
      const imgs: string[] = JSON.parse(e.data);
      setCapturedImages(imgs);
    });

    // Incremental: one new filename per event
    es.addEventListener("new-image", (e) => {
      const filename = e.data as string;
      setCapturedImages(prev =>
        prev.includes(filename) ? prev : [...prev, filename]
      );
    });

    es.onerror = () => {
      console.warn("[SSE] dataset stream error – will retry");
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [isCapturing, BE_BASE_URI]);

  // ─────────────────────────────────────────────────────────────
  // START BUTTON
  // ─────────────────────────────────────────────────────────────
  function handleStart(): void {
    if (isStreaming) {
      alert('Please stop the camera preview first by clicking the "Stop" button before starting capture.');
      return;
    }

    // Reset gallery and enter capturing mode
    setCapturedImages([]);
    setIsCapturing(true);

    fetch(`${BE_BASE_URI}/api/camera/start`, { method: "POST" })
      .then(r => r.json())
      .then(data => console.log("[Camera] start →", data))
      .catch(err => {
        console.error(err);
        setIsCapturing(false);
      });
  }

  // ─────────────────────────────────────────────────────────────
  // STOP HELPER — fully releases camera hardware
  // ─────────────────────────────────────────────────────────────
  function stopCamera(): void {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
  }

  // ─────────────────────────────────────────────────────────────
  // PREVIEW / STOP BUTTON
  // ─────────────────────────────────────────────────────────────
  async function handlePreview(): Promise<void> {
    if (isCapturing) {
      // Stop the backend capture process
      fetch(`${BE_BASE_URI}/api/camera/stop`, { method: "POST" })
        .then(r => r.json())
        .then(data => console.log("[Camera] stop →", data))
        .catch(console.error);
      setIsCapturing(false);
      return;
    }

    if (streamRef.current) {
      stopCamera();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setIsStreaming(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Could not access camera. Please allow camera permissions.");
      console.error(err);
    }
  }

  function handleUploadNavigate(): void { onNavigateUpload(); }
  function handleViewerNavigate(): void { onNavigateViewer(); }

  // ─────────────────────────────────────────────────────────────
  // Helpers for lightbox
  // ─────────────────────────────────────────────────────────────
  function openLightbox(filename: string) {
    setLightboxSrc(`${BE_BASE_URI}/api/camera/dataset/${encodeURIComponent(filename)}`);
  }
  function closeLightbox() { setLightboxSrc(null); }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="container">
      <h1 className="title-with-logo">
        <img src={logo} alt="UR5 Logo" className="title-logo" />
        <span>UR5 Photogrammetry</span>
      </h1>

      {/* ── Media area ── */}
      <div className="media-area">
        {/* Live preview — only mounted while previewing */}
        <video
          ref={videoRef}
          autoPlay playsInline muted
          style={{ display: mode === "previewing" ? "block" : "none" }}
        />

        {/* Idle placeholder */}
        {mode === "idle" && (
          <div className="media-placeholder">
            <div className="placeholder-icon">📷</div>
            <p className="placeholder-title">No camera active</p>
            <p className="placeholder-hint">
              Press <strong>Start</strong> to begin capturing images,
              or press <strong>Preview</strong> to see a live camera feed.
            </p>
          </div>
        )}

        {/* Capturing gallery */}
        {mode === "capturing" && (
          <div className="capture-gallery">
            {capturedImages.length === 0 ? (
              <div className="gallery-empty">
                <span className="gallery-spinner" />
                <p>Waiting for captured images…</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {capturedImages.map(filename => (
                  <div
                    key={filename}
                    className="gallery-thumb"
                    onClick={() => openLightbox(filename)}
                    title={filename}
                  >
                    <img
                      src={`${BE_BASE_URI}/api/camera/dataset/${encodeURIComponent(filename)}`}
                      alt={filename}
                      loading="lazy"
                    />
                    <span className="gallery-thumb-label">{filename}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="gallery-counter">
              {capturedImages.length} image{capturedImages.length !== 1 ? "s" : ""} captured
            </div>
          </div>
        )}
      </div>

      {/* ── Buttons ── */}
      <div className="buttons">
        <button className="start" onClick={handleStart} disabled={isCapturing}>
          Start
        </button>
        <button
          className={isCapturing ? "stop" : isStreaming ? "stop" : "preview"}
          onClick={handlePreview}
        >
          {isCapturing ? "Stop Capture" : isStreaming ? "Stop" : "Preview"}
        </button>
        <button className="upload" onClick={handleUploadNavigate}>Upload</button>
        <button className="viewer" onClick={handleViewerNavigate}>Viewer</button>
      </div>

      {/* ── Stream-active warning ── */}
      {isStreaming && !isCapturing && (
        <div className="stream-warning">
          📷 Camera stream is active. Click <strong>Stop</strong> to release the camera before starting capture.
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>✕</button>
            <img src={lightboxSrc} alt="captured frame" />
          </div>
        </div>
      )}
    </div>
  );
}