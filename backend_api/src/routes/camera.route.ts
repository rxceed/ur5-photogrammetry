import { Elysia } from 'elysia'
import { camera } from '../controllers/camera.controller'

export const CameraRoute = new Elysia()
    .group('/api', (app) => app
        .use(camera)
    )
