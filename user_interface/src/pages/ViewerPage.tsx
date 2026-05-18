import { useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { TrackballControls, Stage, Gltf, Center } from "@react-three/drei";
import { getCookie } from "../utils/cookies";

interface ViewerPageProps {
  onBack: () => void;
}

export default function ViewerPage({ onBack }: ViewerPageProps) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (modelUrl && modelUrl.startsWith("blob:")) URL.revokeObjectURL(modelUrl);
      const url = URL.createObjectURL(file);
      setModelUrl(url);
    }
  };

  const handleLoadFromWebODM = async () => {
    if (!projectName || !taskName) {
        alert("Please enter both Project Name and Task Name");
        return;
    }

    setLoading(true);
    try {
        const token = getCookie("jwt");
        const BE_BASE_URI = process.env.BUN_PUBLIC_BE_BASE_URI || "http://localhost:4000";
        
        // 1. Resolve Project ID from name
        const projectSearchUrl = `${BE_BASE_URI}/api/project?name=${encodeURIComponent(projectName)}`;
        const projectRes = await fetch(projectSearchUrl, {
            headers: { Authorization: `JWT ${token}` }
        });

        if (!projectRes.ok) {
            throw new Error(`Project "${projectName}" not found or unauthorized`);
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
        
        // Handle both array and results object if paginated
        const tasks = Array.isArray(tasksData) ? tasksData : (tasksData.results || []);
        const task = tasks.find((t: any) => t.name === taskName);

        if (!task) {
            throw new Error(`Task "${taskName}" not found in project "${projectName}"`);
        }
        const taskId = task.id;

        // 3. Load the model stream
        const url = `${BE_BASE_URI}/api/task/${projectId}/${taskId}/model`;
        const res = await fetch(url, {
            headers: { Authorization: `JWT ${token}` }
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(error || "Failed to load model from WebODM. Ensure task is complete and GLB was generated.");
        }

        const blob = await res.blob();
        if (modelUrl && modelUrl.startsWith("blob:")) URL.revokeObjectURL(modelUrl);
        const blobUrl = URL.createObjectURL(blob);
        setModelUrl(blobUrl);
    } catch (err: any) {
        alert(err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="container" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px", zIndex: 10 }}>
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
                    onClick={handleLoadFromWebODM} 
                    className="preview" 
                    style={{ height: "40px", padding: "0 20px" }}
                    disabled={loading}
                >
                    {loading ? "Loading..." : "Load from WebODM"}
                </button>
            </div>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", background: "#111", borderRadius: "8px", margin: "0 20px 20px 20px", overflow: "hidden" }}>
        {modelUrl ? (
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
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#666" }}>
            No model loaded. Pick a file or load from WebODM.
          </div>
        )}
      </div>
    </div>
  );
}
