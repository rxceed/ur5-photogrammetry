import {t, type UnwrapSchema} from 'elysia'

export const authModel = {
    authBody: t.Object({
            username: t.String(),
            password: t.String()
    }),
    authRes: t.Object({
        token: t.String()
    }),
    // authErr: t.Object({
    //     error: t.E
    // })
} as const

export const projectModel = {
    projectBody: t.Object({
        name: t.String(),
        description: t.String()
    }),
    projectRes: t.Object({
        id: t.Integer(),
        tasks: t.Array(t.Integer()),
        created_at: t.String(),
        name: t.String(),
        description: t.String(),
        permissions: t.Array(t.String())
    })
} as const

export const taskModel = {
    taskBody: t.Object({
        projectName: t.String(),
        name: t.String(),
        images: t.Array(t.File({
            type: 'image',
            error: 'invalid file'
        }))
    }),
    taskRes: t.Object({
        id: t.Integer(),
        project: t.Integer(),
        processing_node: t.Integer(),
        processing_node_name: t.String(),
        images_count: t.Integer(),
        can_rerun_from: t.Array(t.String()),
        available_assets: t.Array(t.String()),
        uuid: t.String(),
        name: t.String(),
        processing_time: t.Integer(),
        auto_processing_node: t.Boolean(),
        status: t.Integer(),
        last_error: t.String(),
        options: t.Array(t.Any()),
        created_at: t.String(),
        pending_action: t.Integer(),
        upload_progress: t.Number(),
        resize_progress: t.Number(),
        running_progress: t.Number()
    })
} as const

export type authModel = {
	[k in keyof typeof authModel]: UnwrapSchema<typeof authModel[k]>
}

export type projectModel = {
    [k in keyof typeof projectModel]: UnwrapSchema<typeof projectModel[k]>
}

export type taskModel = {
    [k in keyof typeof taskModel]: UnwrapSchema<typeof taskModel[k]>
}