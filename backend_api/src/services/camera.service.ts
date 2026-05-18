import { spawn } from "bun";
import path from "path";

export abstract class WebODM_CameraService {
    private static captureProcess: any = null;

    static async startCapture() {
        if (this.captureProcess) {
            // Already running or needs cleanup? 
            // For now, let's just return if already running.
            return {
                message: "Capture already in progress",
                pid: this.captureProcess.pid
            };
        }

        const scriptPath = path.resolve(process.cwd(), "../camera_interface/scripts/run_capture.sh");
        const cwd = path.resolve(process.cwd(), "../camera_interface");

        console.log(`[INFO] Spawning camera capture script: ${scriptPath}`);

        this.captureProcess = spawn(["bash", scriptPath], {
            cwd: cwd,
            stdout: "inherit",
            stderr: "inherit",
            onExit: (proc) => {
                console.log(`[INFO] Camera capture process exited with code ${proc.exitCode}`);
                this.captureProcess = null;
            }
        });

        return {
            message: "Camera capture started",
            pid: this.captureProcess.pid
        };
    }

    static async stopCapture() {
        if (!this.captureProcess) {
            return { message: "No capture in progress" };
        }

        this.captureProcess.kill();
        this.captureProcess = null;
        return { message: "Camera capture stopped" };
    }
}
