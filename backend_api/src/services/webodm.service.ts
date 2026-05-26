import "dotenv/config"
import  {type authModel,
                type projectModel,
                type taskModel } from "../models/webodm.model"
import { status } from "elysia"
import { promises as fs, createWriteStream } from "fs"
import path from "path"
import AdmZip from "adm-zip"

const NODEODM_URI_BASE: string = (process.env.NODEODM_URI_BASE || process.env.WEBODM_URI_BASE || "http://127.0.0.1:8000")

const DB_FILE = '/app/dataset_volume/projects_db.json'

interface Project {
    id: number
    name: string
    description: string
    created_at: string
    tasks: string[] // List of NodeODM task UUIDs
}

async function readDB(): Promise<{ projects: Project[] }> {
    try {
        const data = await fs.readFile(DB_FILE, 'utf-8')
        return JSON.parse(data)
    } catch (e) {
        try {
            await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
        } catch (_) {}
        return { projects: [] }
    }
}

async function writeDB(db: { projects: Project[] }): Promise<void> {
    try {
        await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
    } catch (_) {}
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export abstract class WebODM_AuthService{
    static async tokenAuth({username, password}: authModel['authBody'])
    {
        // 1. Check if auth is required on NodeODM
        try {
            const infoRes = await fetch(`${NODEODM_URI_BASE}/auth/info`)
            if (infoRes.ok) {
                const info = await infoRes.json() as any
                if (info.loginUrl === null) {
                    return { token: "no-auth-required" }
                }
            }
        } catch (e) {
            console.warn("[NodeODM Auth] Failed to check auth info, proceeding directly with login:", e)
        }

        // 2. Perform login
        const url: string = `${NODEODM_URI_BASE}/auth/login`
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        })
        if(!res.ok) {
            let errorData: any
            try {
                errorData = await res.json()
            } catch (_) {
                errorData = { error: await res.text() }
            }
            throw status(500, JSON.stringify(errorData))
        }
        const resJSON = await res.json() as any
        return {
            token: resJSON.token
        }
    }
}

export abstract class WebODM_ProjectService{
    static async getProjectByName({name}: projectModel['projectBody'], token: string){
        const db = await readDB()
        const project = db.projects.find((p: any) => p.name === name)
        if (!project) {
            throw status(404, "Project not found")
        }
        return {
            id: project.id,
            tasks: project.tasks || [],
            created_at: project.created_at,
            name: project.name,
            description: project.description,
            permissions: [],
        }
    }
    
    static async createProject({name, description}: projectModel['projectBody'], token: string){
        const db = await readDB()
        let project = db.projects.find((p: any) => p.name === name)
        if (project) {
            return {
                id: project.id,
                tasks: project.tasks || [],
                created_at: project.created_at,
                name: project.name,
                description: project.description,
                permissions: [],
            }
        }
        
        const newId = db.projects.length > 0 ? Math.max(...db.projects.map((p: any) => p.id)) + 1 : 1
        project = {
            id: newId,
            name: name,
            description: description || "",
            created_at: new Date().toISOString(),
            tasks: []
        }
        db.projects.push(project)
        await writeDB(db)
        
        return {
            id: project.id,
            tasks: project.tasks || [],
            created_at: project.created_at,
            name: project.name,
            description: project.description,
            permissions: [],
        }
    }
}

export abstract class WebODM_TaskService{
    static async createWebODMTask({projectId, name, images}: taskModel['taskBody'], token: string,){
        // 1. Prepare options
        const taskOptions = [
            {"name":"auto-boundary","value":true},
            {"name":"use-hybrid-bundle-adjustment","value":true},
            {"name":"mesh-octree-depth","value":"12"},
            {"name":"skip-orthophoto","value":true},
            {"name":"pc-quality", "value":"high"},
            {"name":"mesh-size", "value":300000},
            {"name":"bg-removal", "value":true},
            {"name":"gltf", "value":true}
        ]

        // 2. Prepare FormData
        const formData = new FormData()
        images.forEach((file) => {
            formData.append("images", file)
        })
        formData.append("name", name)
        formData.append("options", JSON.stringify(taskOptions))

        // 3. Post to NodeODM /task/new
        const queryParam = token && token !== "no-auth-required" ? `?token=${token}` : ""
        const url = `${NODEODM_URI_BASE}/task/new${queryParam}`

        const res = await fetch(url, {
            method: "POST",
            body: formData,
        })

        if(!res.ok) {
            let errorData: any
            try {
                errorData = await res.json()
            } catch (_) {
                errorData = { error: await res.text() }
            }
            throw status(500, JSON.stringify(errorData))
        }
        
        const resJSON = await res.json() as any
        const uuid = resJSON.uuid

        // 4. Update local DB to register task under project
        const db = await readDB()
        const project = db.projects.find((p: any) => p.id === Number(projectId))
        if (project) {
            if (!project.tasks) {
                project.tasks = []
            }
            project.tasks.push(uuid)
            await writeDB(db)
        }

        // Return initial task representation matching the Elysia validation schema
        return {
            id: uuid,
            project: Number(projectId),
            processing_node: null,
            processing_node_name: null,
            images_count: images.length,
            can_rerun_from: [],
            available_assets: [],
            uuid: uuid,
            name: name,
            processing_time: 0,
            auto_processing_node: true,
            status: 10, // 10 = QUEUED
            last_error: null,
            options: taskOptions,
            created_at: new Date().toISOString(),
            pending_action: null,
            upload_progress: 100,
            resize_progress: 100,
            running_progress: 0
        }
    }

    static async streamTaskModel(projectId: string, taskId: string, token: string) {
        const queryParam = token && token !== "no-auth-required" ? `?token=${token}` : ""
        
        const datasetDir = path.resolve(process.cwd(), process.env.DATASET_DIR || "/dataset_volume")
        const primaryDir = path.join(datasetDir, "extracted_tasks", taskId)
        const fallbackDir = path.join(process.cwd(), "dataset_volume", "extracted_tasks", taskId)
        
        let glbPath: string | null = null
        
        // 1. Try to find GLB in primary directory
        try {
            if (await fs.stat(primaryDir).then(s => s.isDirectory()).catch(() => false)) {
                glbPath = await this.findGlbFile(primaryDir)
            }
        } catch (_) {}
        
        // 2. Try to find GLB in fallback directory
        if (!glbPath) {
            try {
                if (await fs.stat(fallbackDir).then(s => s.isDirectory()).catch(() => false)) {
                    glbPath = await this.findGlbFile(fallbackDir)
                }
            } catch (_) {}
        }
        
        // 3. If not cached, download and extract
        if (!glbPath) {
            const taskDir = await this.getWritableTaskDir(taskId)
            console.log(`[NodeODM] No cached model found for task ${taskId}. Downloading and extracting all.zip to ${taskDir}...`)
            
            const downloadUrl = `${NODEODM_URI_BASE}/task/${taskId}/download/all.zip${queryParam}`
            
            let downloadRes: Response
            try {
                downloadRes = await fetch(downloadUrl, {
                    tls: {
                        rejectUnauthorized: false
                    }
                })
            } catch (e: any) {
                throw status(500, `Failed to connect/fetch all.zip from NodeODM: ${e.message}`)
            }
            
            if (!downloadRes.ok) {
                throw status(500, `Failed to download all.zip from NodeODM: ${downloadRes.status} ${downloadRes.statusText}`)
            }
            
            const zipPath = path.join(taskDir, "all.zip")
            const fileStream = createWriteStream(zipPath)
            const bodyStream = downloadRes.body
            if (!bodyStream) {
                throw status(500, "Response body is empty")
            }
            
            try {
                const reader = bodyStream.getReader()
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) {
                        break
                    }
                    await new Promise<void>((resolve, reject) => {
                        fileStream.write(value, (err) => {
                            if (err) reject(err)
                            else resolve()
                        })
                    })
                }
            } catch (e: any) {
                fileStream.destroy()
                throw status(500, `Failed to write all.zip to disk: ${e.message}`)
            } finally {
                fileStream.end()
                await new Promise<void>((resolve) => {
                    fileStream.on("close", resolve)
                })
            }
            
            try {
                const zip = new AdmZip(zipPath)
                zip.extractAllTo(taskDir, true)
            } catch (e: any) {
                try { await fs.unlink(zipPath) } catch (_) {}
                throw status(500, `Failed to extract task assets: ${e.message}`)
            }
            
            try {
                await fs.unlink(zipPath)
            } catch (e) {
                console.warn(`[NodeODM] Failed to delete temporary zip file:`, e)
            }
            
            glbPath = await this.findGlbFile(taskDir)
            if (!glbPath) {
                throw status(404, `No .glb model asset found in the task archive.`)
            }
        }
        
        console.log(`[NodeODM] Streaming glb model from: ${glbPath}`)
        return Bun.file(glbPath)
    }

    private static async getWritableTaskDir(taskId: string): Promise<string> {
        const datasetDir = path.resolve(process.cwd(), process.env.DATASET_DIR || "/dataset_volume")
        const primaryDir = path.join(datasetDir, "extracted_tasks", taskId)
        
        try {
            await fs.mkdir(primaryDir, { recursive: true })
            // Test writability by writing a temporary file
            const testFile = path.join(primaryDir, ".write_test")
            await fs.writeFile(testFile, "test")
            await fs.unlink(testFile)
            return primaryDir
        } catch (e) {
            console.warn(`[NodeODM] Primary directory ${primaryDir} is not writable:`, e)
            const fallbackDir = path.join(process.cwd(), "dataset_volume", "extracted_tasks", taskId)
            console.log(`[NodeODM] Falling back to local workspace directory: ${fallbackDir}`)
            await fs.mkdir(fallbackDir, { recursive: true })
            return fallbackDir
        }
    }

    private static async findGlbFile(dir: string): Promise<string | null> {
        const glbFiles: string[] = []
        
        async function traverse(currentDir: string) {
            const entries = await fs.readdir(currentDir, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name)
                if (entry.isDirectory()) {
                    await traverse(fullPath)
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
                    glbFiles.push(fullPath)
                }
            }
        }
        
        await traverse(dir)
        
        if (glbFiles.length === 0) {
            return null
        }
        
        // Prioritize filenames containing "textured" (case-insensitive)
        const texturedFile = glbFiles.find(file => 
            path.basename(file).toLowerCase().includes("textured")
        )
        if (texturedFile) {
            return texturedFile
        }
        
        // Fallback to the first glb file found
        return glbFiles[0] || null
    }

    static async getTasksByProject(projectId: string, token: string) {
        const db = await readDB()
        const project = db.projects.find((p: any) => p.id === Number(projectId))
        if (!project) {
            throw status(404, `Project not found: ${projectId}`)
        }

        // Query status for each task registered in this project
        const tasks = await Promise.all(
            (project.tasks || []).map(async (uuid) => {
                try {
                    return await WebODM_TaskService.getTaskStatus(projectId, uuid, token)
                } catch (e) {
                    console.error(`[NodeODM] Failed to fetch task status for ${uuid}:`, e)
                    return null
                }
            })
        )

        return tasks.filter(t => t !== null)
    }

    static async getTaskStatus(projectId: string, taskId: string, token: string) {
        const queryParam = token && token !== "no-auth-required" ? `?token=${token}` : ""
        const url = `${NODEODM_URI_BASE}/task/${taskId}/info${queryParam}`
        const res = await fetch(url)
        if (!res.ok) {
            let errorText: string
            try {
                errorText = JSON.stringify(await res.json())
            } catch (_) {
                errorText = await res.text()
            }
            throw status(500, `Failed to fetch task status from NodeODM: ${errorText}`)
        }
        const data = await res.json() as any
        
        const statusCode = data.status?.code ?? 10
        const progress = data.progress ?? 0

        return {
            id: data.uuid,
            project: Number(projectId),
            processing_node: null,
            processing_node_name: null,
            images_count: data.imagesCount || 0,
            can_rerun_from: [],
            available_assets: statusCode === 40 ? ["textured_model.glb"] : [],
            uuid: data.uuid,
            name: data.name || "",
            processing_time: data.processingTime || 0,
            auto_processing_node: true,
            status: statusCode,          // 10=queued, 20=running, 30=failed, 40=completed, 50=cancelled
            last_error: data.last_error || null,
            options: data.options || [],
            created_at: data.dateCreated ? new Date(data.dateCreated).toISOString() : new Date().toISOString(),
            pending_action: null,
            upload_progress: 100,
            resize_progress: 100,
            running_progress: progress,
        }
    }

    /**
     * Async generator that continuously polls NodeODM's task output endpoint
     * and yields SSE-formatted strings (log lines + status snapshots).
     * Terminates when the task reaches a terminal state.
     *
     * NodeODM task status codes:
     *   10 = queued, 20 = running, 30 = failed, 40 = completed, 50 = cancelled
     */
    static async *streamTaskOutput(
        projectId: string,
        taskId: string,
        token: string,
        pollIntervalMs = 3000
    ): AsyncGenerator<string> {
        const TERMINAL_STATUSES = new Set([30, 40, 50]) // failed, completed, cancelled
        let lineOffset = 0
        let isTerminal = false

        const queryParam = token && token !== "no-auth-required" ? `&token=${token}` : ""

        while (!isTerminal) {
            // --- Fetch new log lines ---
            const outputUrl = `${NODEODM_URI_BASE}/task/${taskId}/output?line=${lineOffset}${queryParam}`
            let newLines: string[] = []
            try {
                const outputRes = await fetch(outputUrl)
                if (outputRes.ok) {
                    const lines = await outputRes.json() as string[]
                    if (Array.isArray(lines) && lines.length > 0) {
                        newLines = lines
                        lineOffset += lines.length
                    }
                }
            } catch (e) {
                console.error('[NodeODM SSE] Failed to fetch output lines:', e)
            }

            // Yield each new log line as an SSE "log" event
            for (const line of newLines) {
                yield `event: log\ndata: ${JSON.stringify({ line })}\n\n`
            }

            // --- Fetch task status ---
            try {
                const taskStatus = await WebODM_TaskService.getTaskStatus(projectId, taskId, token)
                yield `event: status\ndata: ${JSON.stringify(taskStatus)}\n\n`
                if (TERMINAL_STATUSES.has(taskStatus.status)) {
                    isTerminal = true
                }
            } catch (e) {
                console.error('[NodeODM SSE] Failed to fetch task status:', e)
            }

            if (!isTerminal) {
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
            }
        }

        // Signal the client that the stream is done
        yield `event: done\ndata: ${JSON.stringify({ message: 'Task finished' })}\n\n`
    }
}