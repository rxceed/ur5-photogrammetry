import {Elysia} from 'elysia'
import {auth, project, task} from '../controllers/webodm.controller'

export const WebODMRoute = new Elysia()
    .group('/api', (app) => app
        .use(auth)
        .use(project)
        .use(task))