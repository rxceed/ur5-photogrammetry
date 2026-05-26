import {Elysia} from "elysia"
import {cors} from '@elysia/cors'
import {WebODMRoute} from './routes/webodm.route'
import {CameraRoute} from './routes/camera.route'
import "dotenv/config"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = new Elysia()
    .onError(({ code, error, set }) => {
        if (code === 'VALIDATION') {
            const err = error as any;
            console.error('Validation Error Details:', {
                on: err.on,
                property: err.property,
                message: err.message,
                expected: err.expected,
                found: err.found,
                errors: err.all
            });
            return err.all;
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

