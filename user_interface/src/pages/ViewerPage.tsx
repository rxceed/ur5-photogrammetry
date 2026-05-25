import { useState, Suspense, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { TrackballControls, Stage, Gltf, Center } from "@react-three/drei";

interface ViewerPageProps {
  onBack: () => void;
  initialProjectName?: string;
  initialTaskName?: string;
  initialAutoLoad?: boolean;
  clearAutoLoad?: () => void;
}

export default function ViewerPage({
  onBack,
  initialProjectName,
  initialTaskName,
  initialAutoLoad,
  clearAutoLoad,
}: ViewerPageProps) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(
    initialProjectName || process.env.BUN_PUBLIC_DEFAULT_PROJECT_NAME || "PersepsiRobot"
  );
  const [taskName, setTaskName] = useState(initialTaskName || "");
  const [loading, setLoading] = useState(false);

  // WebODM log and status stream states
  const [logs, setLogs] = useState<string[]>([]);
  const [taskStatus, setTaskStatus] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "streaming" | "success" | "error">("idle");

  // Refs for managing active connections, DOM references, and fetch state
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const logEndRef = useRef<HTMLUListElement | null>(null);
  const modelLoadedRef = useRef(false);
  const loadingModelRef = useRef(false);

  // Auto-scroll log console
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  // Clean up streams and object URLs on unmount
  useEffect(() => {
    return () => {
      if (readerRef.current) {
        try {
          readerRef.current.cancel();
        } catch (e) {
          console.error("Error cancelling stream reader:", e);
        }
      }
      if (modelUrl && modelUrl.startsWith("blob:")) {
        URL.revokeObjectURL(modelUrl);
      }
    };
  }, [modelUrl]);

  // Auto-load model from WebODM if requested
  useEffect(() => {
    if (initialAutoLoad && initialProjectName && initialTaskName) {
      handleLoadFromWebODM(initialProjectName, initialTaskName);
      clearAutoLoad?.();
    }
  }, [initialAutoLoad, initialProjectName, initialTaskName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (modelUrl && modelUrl.startsWith("blob:")) URL.revokeObjectURL(modelUrl);
      const url = URL.createObjectURL(file);
      setModelUrl(url);

      // Reset WebODM state
      setTaskStatus(null);
      setLogs([`[System] Loaded local file: ${file.name}`]);
      setConnectionStatus("idle");
      modelLoadedRef.current = false;

      if (readerRef.current) {
        try {
          readerRef.current.cancel();
        } catch (err) {
          console.error(err);
        }
        readerRef.current = null;
      }
    }
  };

  const getStatusLabel = (statusCode: number) => {
    switch (statusCode) {
      case 10: return "Queued";
      case 20: return "Running";
      case 30: return "Failed";
      case 40: return "Completed";
      case 50: return "Cancelled";
      default: return `Unknown (${statusCode})`;
    }
  };

  const fetchAndLoadModel = async (projectId: number | string, taskId: number | string, token: string) => {
    if (loadingModelRef.current || modelLoadedRef.current) return;
    loadingModelRef.current = true;
    setLoadingModel(true);

    try {
      const BE_BASE_URI = process.env.BUN_PUBLIC_BE_BASE_URI || "http://localhost:4000";
      const url = `${BE_BASE_URI}/api/task/${projectId}/${taskId}/model`;

      setLogs(prev => [...prev, `[System] Fetching GLB model asset...`]);

      const res = await fetch(url, {
        headers: { Authorization: `JWT ${token}` }
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "GLB model asset not found or not ready yet.");
      }

      const blob = await res.blob();
      if (modelUrl && modelUrl.startsWith("blob:")) URL.revokeObjectURL(modelUrl);
      const blobUrl = URL.createObjectURL(blob);
      
      setModelUrl(blobUrl);
      modelLoadedRef.current = true;
      setLogs(prev => [...prev, `[System] Model loaded successfully!`]);
    } catch (err: any) {
      setLogs(prev => [...prev, `[System Error] Failed to load model: ${err.message}`]);
      console.error(err);
    } finally {
      loadingModelRef.current = false;
      setLoadingModel(false);
    }
  };

  const startLogStream = async (projectId: number | string, taskId: number | string, token: string) => {
    if (readerRef.current) {
      try {
        readerRef.current.cancel();
      } catch (e) {
        console.error("Error cancelling stream reader:", e);
      }
      readerRef.current = null;
    }

    setIsStreaming(true);
    setConnectionStatus("streaming");
    setLogs([`[System] Connecting to task output stream for Project ${projectId}, Task ${taskId}...`]);

    const BE_BASE_URI = process.env.BUN_PUBLIC_BE_BASE_URI || "http://localhost:4000";
    const streamUrl = `${BE_BASE_URI}/api/task/${projectId}/${taskId}/status-stream`;

    try {
      const res = await fetch(streamUrl, {
        headers: { Authorization: `JWT ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Failed to establish connection: ${res.statusText}`);
      }

      const body = res.body;
      if (!body) {
        throw new Error("No response body available for streaming");
      }

      const reader = body.getReader();
      readerRef.current = reader;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const lines = part.split("\n");
          let eventType = "";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith("data:")) {
              dataStr = line.substring(5).trim();
            }
          }

          if (eventType && dataStr) {
            try {
              const data = JSON.parse(dataStr);
              if (eventType === "log") {
                setLogs(prev => [...prev, data.line]);
              } else if (eventType === "status") {
                setTaskStatus(data);
                if (data.status === 40) {
                  fetchAndLoadModel(projectId, taskId, token);
                }
              } else if (eventType === "done") {
                setLogs(prev => [...prev, `[System] Log stream completed.`]);
                setConnectionStatus("success");
                break;
              } else if (eventType === "error") {
                setLogs(prev => [...prev, `[System Error] Stream error: ${data.message}`]);
                setConnectionStatus("error");
              }
            } catch (parseErr) {
              console.error("Failed to parse SSE payload:", parseErr, part);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setLogs(prev => [...prev, `[System] Stream aborted.`]);
      } else {
        setLogs(prev => [...prev, `[System Error] Connection lost: ${err.message}`]);
        setConnectionStatus("error");
      }
    } finally {
      setIsStreaming(false);
      readerRef.current = null;
    }
  };

  const handleLoadFromWebODM = async (pName?: string, tName?: string) => {
    const activeProjectName = pName || projectName;
    const activeTaskName = tName || taskName;

    if (!activeProjectName || !activeTaskName) {
        alert("Please enter both Project Name and Task Name");
        return;
    }

    setLoading(true);
    modelLoadedRef.current = false;
    loadingModelRef.current = false;
    setModelUrl(null);
    setTaskStatus(null);

    try {
        const BE_BASE_URI = process.env.BUN_PUBLIC_BE_BASE_URI || "http://localhost:4000";
        const authUrl = `${BE_BASE_URI}/api/auth/token-auth/`;
        const authRes = await fetch(authUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  "username": process.env.BUN_PUBLIC_USERNAME as string,
                                  "password": process.env.BUN_PUBLIC_PASS as string
                                }),
                                credentials: 'include'
                                });
        const token = (await authRes.json()).token;
        
        // 1. Resolve Project ID from name
        const projectSearchUrl = `${BE_BASE_URI}/api/project?name=${encodeURIComponent(activeProjectName)}`;
        const projectRes = await fetch(projectSearchUrl, {
            headers: { Authorization: `JWT ${token}` }
        });

        if (!projectRes.ok) {
            throw new Error(`Project "${activeProjectName}" not found or unauthorized`);
        }
        const projectData = await projectRes.json();
        const projectId = projectData.id;

        // 2. Resolve Task ID from name
        const tasksUrl = `${BE_BASE_URI}/api/project/${projectId}/tasks`;
        const tasksRes = await fetch(tasksUrl, {
            headers: { Authorization: `JWT ${token}` }
        });

        if (!tasksRes.ok) {
            throw new Error("Failed to fetch tasks for this project");
        }
        const tasksData = await tasksRes.json();
        const tasks = Array.isArray(tasksData) ? tasksData : (tasksData.results || []);
        const task = tasks.find((t: any) => t.name === activeTaskName);

        if (!task) {
            throw new Error(`Task "${activeTaskName}" not found in project "${activeProjectName}"`);
        }
        const taskId = task.id;

        // Start streaming logs immediately
        startLogStream(projectId, taskId, token);

        // Check if task is already complete and glb exists
        const isComplete = task.status === 40;
        const hasGlb = Array.isArray(task.available_assets) && 
                       task.available_assets.some((asset: string) => asset.toLowerCase().endsWith('.glb'));

        if (isComplete && hasGlb) {
          fetchAndLoadModel(projectId, taskId, token);
        } else if (isComplete && !hasGlb) {
          setLogs(prev => [...prev, "[System Warning] Task status is Complete, but GLB asset is not generated/found."]);
        }
    } catch (err: any) {
        alert(err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="container viewer-container" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px", zIndex: 10, alignSelf: "stretch" }}>
        <button onClick={onBack} className="start" style={{ marginBottom: "20px" }}>
          ← Back
        </button>
        <h1>3D Model Viewer</h1>
        
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: "200px" }}>
                <label htmlFor="model-upload">Pick a local .glb file</label>
                <input
                    id="model-upload"
                    type="file"
                    accept=".glb,.gltf"
                    onChange={handleFileChange}
                />
            </div>

            <div className="form-group" style={{ flex: 2, minWidth: "300px", display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                    <label>Project Name</label>
                    <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. My Survey" />
                </div>
                <div style={{ flex: 1 }}>
                    <label>Task Name</label>
                    <input type="text" value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g. Capture 1" />
                </div>
                <button 
                    onClick={() => handleLoadFromWebODM()} 
                    className="preview" 
                    style={{ height: "40px", padding: "0 20px" }}
                    disabled={loading}
                >
                    {loading ? "Resolving..." : "Load from WebODM"}
                </button>
            </div>
        </div>
      </div>

      {/* Viewer Window */}
      <div style={{ flex: 1, position: "relative", background: "#111", borderRadius: "8px", margin: "0 20px 20px 20px", overflow: "hidden", alignSelf: "stretch" }}>
        {modelUrl && !loading && !loadingModel && (!taskStatus || taskStatus.status === 40) ? (
          <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }}>
            <Suspense fallback={null}>
              <Stage intensity={0.5} environment="city" shadows="contact" adjustCamera={true}>
                <Center>
                    <Gltf src={modelUrl} castShadow receiveShadow />
                </Center>
              </Stage>
            </Suspense>
            <TrackballControls makeDefault rotateSpeed={1} />
          </Canvas>
        ) : (
          <div className="viewer-loader">
            {(loading || loadingModel || (taskStatus && taskStatus.status !== 40)) ? (
              <>
                <div className="spinner"></div>
                <div style={{ fontSize: "16px", fontWeight: "600" }}>
                  {loading && "Resolving WebODM Project and Task..."}
                  {loadingModel && "Downloading 3D model asset..."}
                  {taskStatus && taskStatus.status !== 40 && (
                    <>
                      WebODM Task: {getStatusLabel(taskStatus.status)}
                      {taskStatus.running_progress !== undefined && taskStatus.running_progress > 0 && ` (${taskStatus.running_progress*100}%)`}
                    </>
                  )}
                </div>
                {taskStatus && taskStatus.status !== 40 && (
                  <div style={{ fontSize: "13px", color: "#6b7280", maxWidth: "450px" }}>
                    Please wait. The 3D model will automatically render once processing finishes.
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "#666" }}>
                No model loaded. Pick a file or load from WebODM.
              </div>
            )}
          </div>
        )}
      </div>

      {/* WebODM Log Stream Panel */}
      <div className="log-panel" style={{ alignSelf: "stretch" }}>
        <div className="log-header">
          <div className="log-title">
            <span className={`status-dot ${connectionStatus}`}></span>
            WebODM Task Output Log Stream
          </div>
          <div style={{ fontSize: "11px", opacity: 0.8 }}>
            {taskStatus ? (
              <>
                Status: <span style={{ fontWeight: "bold" }}>{getStatusLabel(taskStatus.status)}</span>
                {taskStatus.running_progress !== undefined && taskStatus.running_progress > 0 ? ` (${taskStatus.running_progress*100}%)` : ""}
                {taskStatus.processing_time ? ` | Time: ${(taskStatus.processing_time / 1000 / 60).toFixed(1)}m` : ""}
              </>
            ) : "No active task connection"}
          </div>
        </div>
        <ul className="log-body" ref={logEndRef}>
          {logs.length === 0 ? (
            <li className="log-line" style={{ color: "#6b7280", fontStyle: "italic" }}>
              Log stream is empty. Load a task from WebODM to see logs.
            </li>
          ) : (
            logs.map((line, idx) => {
              let lineClass = "log-line";
              if (line.startsWith("[System]")) {
                lineClass += " system";
              } else if (line.startsWith("[System Error]") || line.startsWith("[Error]")) {
                lineClass += " error";
              }
              return (
                <li key={idx} className={lineClass}>
                  {line}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

