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
            jwt!.maxAge = 3600*6
            jwt!.sameSite = 'lax'
            return res
        },
        {
            body: authModel.authBody,
            response: {
                200: authModel.authRes
            }
        }
    )
    .post('/token-auth/',
        async ({body, cookie: {jwt}}) => {
            const res = await WebODM_AuthService.tokenAuth(body)
            jwt!.value = res.token
            jwt!.path = '/'
            jwt!.maxAge = 3600*6
            jwt!.sameSite = 'lax'
            return res
        },
        {
            body: authModel.authBody,
            response: {
                200: authModel.authRes
            }
        }
    )
export const project = new Elysia({prefix: '/project'})
    .use(authHeaderCheck)
    .get('/', 
        async ({query, request: {headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            const token = tokenFromHeader
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
    .get('/:projectId/tasks',
        async ({params: {projectId}, request: {headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            const token = tokenFromHeader
            const res = await WebODM_TaskService.getTasksByProject(projectId, token)
            return res
        }
    )
    .post('/',
        async ({body, request: {headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            const token = tokenFromHeader
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
        async ({body, request:{headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            const token = tokenFromHeader
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
    .get('/:projectId/:taskId/model',
        async ({params: {projectId, taskId}, request: {headers}}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            const token = tokenFromHeader
            const res = await WebODM_TaskService.streamTaskModel(projectId, taskId, token);
            return res;
        }
    )
    .get('/:projectId/:taskId/status-stream',
        async ({params: {projectId, taskId}, request: {headers}, set}) => {
            const authHeader = headers.get('Authorization');
            const tokenFromHeader: string = authHeader!.split(" ")[1] as string;
            const token = tokenFromHeader;

            // Set SSE headers
            set.headers['Content-Type'] = 'text/event-stream';
            set.headers['Cache-Control'] = 'no-cache';
            set.headers['Connection'] = 'keep-alive';
            set.headers['X-Accel-Buffering'] = 'no'; // Disable nginx buffering if behind a proxy

            const generator = WebODM_TaskService.streamTaskOutput(projectId, taskId, token);

            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of generator) {
                            controller.enqueue(new TextEncoder().encode(chunk));
                        }
                    } catch (err) {
                        const errMsg = `event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`;
                        controller.enqueue(new TextEncoder().encode(errMsg));
                    } finally {
                        controller.close();
                    }
                },
                cancel() {
                    // Client disconnected — the generator will be GC'd
                    generator.return(undefined);
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                }
            });
        }
    )