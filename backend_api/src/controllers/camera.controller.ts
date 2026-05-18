import { Elysia } from 'elysia'
import { WebODM_CameraService } from '../services/camera.service'
import { cameraModel } from '../models/camera.model'

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
