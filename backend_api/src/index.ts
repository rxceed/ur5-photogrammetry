import {Elysia} from "elysia"
import {cors} from '@elysia/cors'
import {WebODMRoute} from './routes/webodm.route'
import {CameraRoute} from './routes/camera.route'
import "dotenv/config"

const app = new Elysia()
    .onError(({ code, error, set }) => {
        if (code === 'VALIDATION') {
            console.error('Validation Error Details:', {
                on: error.on,
                property: error.property,
                message: error.message,
                expected: error.expected,
                found: error.found,
                errors: error.all
            });
            return error.all;
        }
    })
    .onAfterHandle(({ request, set }) => {
        // Only process CORS requests
        if (request.method !== "OPTIONS") return;

        const allowHeader = set.headers["Access-Control-Allow-Headers"];
        if (allowHeader === "*") {
        set.headers["Access-Control-Allow-Headers"] =
            request.headers.get("Access-Control-Request-Headers") ?? "";
        }
    })
    .use(cors({ 
        credentials: true, 
        origin: [
            ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
            /^http:\/\/localhost(:\d+)?$/,
            /^http:\/\/127\.0\.0\.1(:\d+)?$/
        ]
    }))
    .use(WebODMRoute)
    .use(CameraRoute)
    .get('/', 'Hello'
    )
    .listen(4000)

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`)

