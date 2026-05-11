import { WebODM_AuthService, WebODM_ProjectService, WebODM_TaskService } from '../services/webodm.service';
import { authModel, projectModel, taskModel } from '../models/webodm.model';
import { t, Elysia, status } from 'elysia';

const authHeaderCheck =  new Elysia()
    .resolve({as: 'global'}, () => {
        return {token: String()};
    }
    )
    .onBeforeHandle(({token, request: {headers}}) => {
            const authHeader = headers.get('Authorization');
            if(!authHeader)
            {
                throw status(401, 'Unauthorized: No token provided')
            }
            const tokenFromHeader: string = authHeader.split(" ")[1] as string;
            token = tokenFromHeader
        }
    )

export const auth = new Elysia({prefix: '/auth'})
    .post('/token-auth',
        async ({body, cookie: {jwt}}) => {
            const res = await WebODM_AuthService.tokenAuth(body)
            jwt!.value = res.token
            jwt!.path = '/'
            jwt!.httpOnly = true
            jwt!.maxAge = 3600*6
        },
        {
            body: authModel.authBody,
        }
    )
export const project = new Elysia({prefix: '/project'})
    .use(authHeaderCheck)
    .get('/', 
        async ({token, query, request: {headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            token = tokenFromHeader
            const res = await WebODM_ProjectService.getProjectByName(query, token)
            return res
        },
        {
            query: projectModel.projectBody,
            response: {
                200: projectModel.projectRes
            }
        }
    )
    .post('/',
        async ({token, body, request: {headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            token = tokenFromHeader
            const res = await WebODM_ProjectService.createProject(body, token)
            return res
        },
        {
            body: projectModel.projectBody,
            response: {
                201: projectModel.projectRes
            }
        }
    )

export const task = new Elysia({prefix: '/task'})
    .use(authHeaderCheck)
    .post('/',
        async ({body, token, request:{headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            token = tokenFromHeader
            const res = await WebODM_TaskService.createWebODMTask(body, token);
            return res;
        },
        {
            body: taskModel.taskBody,
            response: {
                201: taskModel.taskRes
            }
        }
    )