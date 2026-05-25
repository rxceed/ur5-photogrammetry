import { Elysia } from 'elysia'
import { WebODM_CameraService } from '../services/camera.service'
import { cameraModel } from '../models/camera.model'
import path from 'path'
import fs from 'fs'

const DATASET_PATH = path.resolve(process.cwd(), '../dataset')
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp'])

function listImages(): string[] {
    if (!fs.existsSync(DATASET_PATH)) return []
    return fs.readdirSync(DATASET_PATH)
        .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
        .sort()
}

export const camera = new Elysia({ prefix: '/camera' })
    .post('/start', 
        async () => {
            const res = await WebODM_CameraService.startCapture()
            return res
        },
        {
            response: {
                200: cameraModel.cameraRes
            }
        }
    )
    .post('/stop',
        async () => {
            const res = await WebODM_CameraService.stopCapture()
            return res
        },
        {
            response: {
                200: cameraModel.cameraRes
            }
        }
    )

    // ── List all images currently in /dataset ─────────────────────
    .get('/dataset', () => {
        return { images: listImages() }
    })

    // ── Serve a single image file from /dataset ───────────────────
    .get('/dataset/:filename', ({ params, set }) => {
        const filename = params.filename
        // Prevent path traversal
        if (filename.includes('..') || filename.includes('/')) {
            set.status = 400
            return 'Invalid filename'
        }

        const filePath = path.join(DATASET_PATH, filename)
        if (!fs.existsSync(filePath)) {
            set.status = 404
            return 'Not found'
        }

        const ext = path.extname(filename).toLowerCase()
        const mimeMap: Record<string, string> = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png',  '.bmp': 'image/bmp',
            '.tiff': 'image/tiff', '.tif': 'image/tiff',
            '.webp': 'image/webp'
        }
        set.headers['Content-Type'] = mimeMap[ext] ?? 'application/octet-stream'
        set.headers['Cache-Control'] = 'no-store'
        return Bun.file(filePath)
    })

    // ── SSE stream: push new image filenames as they appear ───────
    .get('/dataset/stream', ({ set }) => {
        set.headers['Content-Type']  = 'text/event-stream'
        set.headers['Cache-Control'] = 'no-cache'
        set.headers['Connection']    = 'keep-alive'

        const encoder = new TextEncoder()
        let watcher: ReturnType<typeof fs.watch> | null = null
        let closed = false

        const stream = new ReadableStream({
            start(controller) {
                // Helper to send an SSE event
                const send = (event: string, data: string) => {
                    if (closed) return
                    try {
                        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
                    } catch {
                        closed = true
                    }
                }

                // Send the current list immediately on connect
                send('snapshot', JSON.stringify(listImages()))

                // Ensure dataset dir exists before watching
                if (!fs.existsSync(DATASET_PATH)) {
                    fs.mkdirSync(DATASET_PATH, { recursive: true })
                }

                // Watch for new files
                watcher = fs.watch(DATASET_PATH, (eventType, filename) => {
                    if (!filename) return
                    const ext = path.extname(filename).toLowerCase()
                    if (!IMAGE_EXTS.has(ext)) return
                    if (eventType === 'rename') {
                        // 'rename' fires on both create and delete
                        const fullPath = path.join(DATASET_PATH, filename)
                        if (fs.existsSync(fullPath)) {
                            send('new-image', filename)
                        }
                    }
                })

                watcher.on('error', () => {
                    closed = true
                    try { controller.close() } catch {}
                })
            },
            cancel() {
                closed = true
                watcher?.close()
            }
        })

        return stream
    })
