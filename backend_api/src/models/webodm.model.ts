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
        description: t.Optional(t.String())
    }),
    projectRes: t.Object({
        id: t.Numeric(),
        tasks: t.Array(t.Union([t.String(), t.Numeric(), t.Null()])),
        created_at: t.Union([t.String(), t.Null()]),
        name: t.Union([t.String(), t.Null()]),
        description: t.Union([t.String(), t.Null()]),
        permissions: t.Union([t.Array(t.String()), t.Null()])
    })
} as const

export const taskModel = {
    taskBody: t.Object({
        projectId: t.Numeric(),
        name: t.String(),
        images: t.Array(t.File({
            type: 'image',
            error: 'invalid file'
        }))
    }),
    taskRes: t.Object({
        id: t.String(),
        project: t.Numeric(),
        processing_node: t.Union([t.Integer(), t.Null()]),
        processing_node_name: t.Union([t.String(), t.Null()]),
        images_count: t.Integer(),
        can_rerun_from: t.Array(t.String()),
        available_assets: t.Array(t.String()),
        uuid: t.String(),
        name: t.String(),
        processing_time: t.Union([t.Integer(), t.Null()]),
        auto_processing_node: t.Boolean(),
        status: t.Integer(),
        last_error: t.Union([t.String(), t.Null()]),
        options: t.Array(t.Any()),
        created_at: t.String(),
        pending_action: t.Union([t.Integer(), t.Null()]),
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