import { useRef } from "react";

interface CameraPageProps {
  onNavigateUpload: () => void;
  onNavigateViewer: () => void;
}

export default function CameraPage({ onNavigateUpload, onNavigateViewer }: CameraPageProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─────────────────────────────────────────────────────────────
  // START BUTTON — blank template, wire up your own logic here
  // ─────────────────────────────────────────────────────────────
  function handleStart(): void {
    const BE_BASE_URI = process.env.BUN_PUBLIC_BE_BASE_URI
    const url = `${BE_BASE_URI}/api/camera/start`
    fetch(url, {
                    method: 'POST'
    })
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(err => console.error(err))
  }

  // ─────────────────────────────────────────────────────────────
  // STOP HELPER — uncomment when needed to release the camera
  // ─────────────────────────────────────────────────────────────
  function stopCamera(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // ─────────────────────────────────────────────────────────────
  // PREVIEW BUTTON — starts live camera feed in the <video> element
  // ─────────────────────────────────────────────────────────────
  async function handlePreview(): Promise<void> {
    // If a stream is already running, do nothing
    if (streamRef.current)
      {
        stopCamera();
        return;
      };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Could not access camera. Please allow camera permissions.");
      console.error(err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UPLOAD BUTTON — navigates to the Upload form page
  // ─────────────────────────────────────────────────────────────
  function handleUploadNavigate(): void {
    onNavigateUpload();
  }

  // ─────────────────────────────────────────────────────────────
  // VIEWER BUTTON — navigates to the 3D Viewer page
  // ─────────────────────────────────────────────────────────────
  function handleViewerNavigate(): void {
    onNavigateViewer();
  }

  return (
    <div className="container">
      <h1>UR5 Photogrammetry</h1>

      {/* muted is required for autoPlay to work in most browsers */}
      <video ref={videoRef} autoPlay playsInline muted />

      <div className="buttons">
        <button className="start"   onClick={handleStart}>Start</button>
        <button className="preview" onClick={handlePreview}>Preview</button>
        <button className="upload"  onClick={handleUploadNavigate}>Upload</button>
        <button className="viewer"  onClick={handleViewerNavigate}>Viewer</button>
      </div>

      {/* Hidden canvas used for frame capture */}
      {/* Uncomment if you re-add snapshot functionality */}
      {/* <canvas ref={canvasRef} style={{ display: "none" }} /> */}
      {/* <img ref={previewImgRef} style={{ display: "none" }} alt="preview" /> */}
    </div>
  );
}