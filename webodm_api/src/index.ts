import {Elysia} from "elysia"
import {WebODMRoute} from './routes/webodm.route'

const app = new Elysia()
    .use(WebODMRoute)
    .get('/', 'Hello'
    )
    .listen(4000)

