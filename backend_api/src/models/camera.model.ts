import { t, type UnwrapSchema } from 'elysia'

export const cameraModel = {
    cameraRes: t.Object({
        message: t.String(),
        pid: t.Optional(t.Integer())
    })
} as const

export type cameraModel = {
    [k in keyof typeof cameraModel]: UnwrapSchema<typeof cameraModel[k]>
}
