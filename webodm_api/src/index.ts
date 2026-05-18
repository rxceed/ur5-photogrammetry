import {Elysia} from "elysia"
import {cors} from '@elysia/cors'
import {WebODMRoute} from './routes/webodm.route'
import "dotenv/config"

const app = new Elysia()
    .onAfterHandle(({ request, set }) => {
        // Only process CORS requests
        if (request.method !== "OPTIONS") return;

        const allowHeader = set.headers["Access-Control-Allow-Headers"];
        if (allowHeader === "*") {
        set.headers["Access-Control-Allow-Headers"] =
            request.headers.get("Access-Control-Request-Headers") ?? "";
        }
    })
    .use(cors({ credentials: true, origin: process.env.CORS_ORIGIN }))
    .use(WebODMRoute)
    .get('/', 'Hello'
    )
    .listen(4000)

