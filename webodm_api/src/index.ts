import {Elysia} from "elysia"
import {cors} from '@elysia/cors'
import {WebODMRoute} from './routes/webodm.route'

const app = new Elysia()
    .use(cors({ credentials: true }))
    .use(WebODMRoute)
    .get('/', 'Hello'
    )
    .listen(4000)

