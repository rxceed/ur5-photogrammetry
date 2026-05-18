import { useRef } from "react";

interface CameraPageProps {
  onNavigateUpload: () => void;
}

export default function CameraPage({ onNavigateUpload }: CameraPageProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─────────────────────────────────────────────────────────────
  // START BUTTON — blank template, wire up your own logic here
  // ─────────────────────────────────────────────────────────────
  function handleStart(): void {
    const RELAY_BASE_URI = process.env.BUN_PUBLIC_RELAY_BASE_URL
    const url = `${RELAY_BASE_URI}/4`
    const res = fetch(url, {
                    method: 'POST',
                    body: new URLSearchParams({"state": "on"})
    })
  }

  // ─────────────────────────────────────────────────────────────
  // STOP HELPER — uncomment when needed to release the camera
  // ─────────────────────────────────────────────────────────────
  // function stopCamera(): void {
  //   streamRef.current?.getTracks().forEach((track) => track.stop());
  //   streamRef.current = null;
  //   if (videoRef.current) videoRef.current.srcObject = null;
  // }

  // ─────────────────────────────────────────────────────────────
  // PREVIEW BUTTON — starts live camera feed in the <video> element
  // ─────────────────────────────────────────────────────────────
  async function handlePreview(): Promise<void> {
    // If a stream is already running, do nothing
    if (streamRef.current) return;

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

  return (
    <div className="container">
      <h1>Camera Stream</h1>

      {/* muted is required for autoPlay to work in most browsers */}
      <video ref={videoRef} autoPlay playsInline muted />

      <div className="buttons">
        <button className="start"   onClick={handleStart}>Start</button>
        <button className="preview" onClick={handlePreview}>Preview</button>
        <button className="upload"  onClick={handleUploadNavigate}>Upload</button>
      </div>

      {/* Hidden canvas used for frame capture */}
      {/* Uncomment if you re-add snapshot functionality */}
      {/* <canvas ref={canvasRef} style={{ display: "none" }} /> */}
      {/* <img ref={previewImgRef} style={{ display: "none" }} alt="preview" /> */}
    </div>
  );
}