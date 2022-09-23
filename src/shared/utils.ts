export const textEncoder = new TextEncoder()
export const textDecoder = new TextDecoder('utf-8')

export const WORLD_WIDTH = 1024
export const WORLD_HEIGHT = 768

export const PLAYER_RADIUS = 26

export const TICKS_PER_SECOND = 60
export const TICK_MILLIS = 1000 / 60
export const TICKS_PER_SERVER_UPDATE = 2

export const lerpAngle = (a: number, b: number, t: number): number => {
    const delta = b - a
    const lerp = delta > Math.PI
        ? delta - 2 * Math.PI
        : delta < -Math.PI
            ? delta + 2 * Math.PI
            : delta
    return a + lerp * t
}

export type DebugInfoSet = Record<string, string | number | boolean>
export type DebugInfoFn = (k: string, v: string | number | boolean) => void

let debugInfoFn: DebugInfoFn
export const setGlobalDebugInfoFn = (fn: DebugInfoFn): void => {
    debugInfoFn = fn
}
export const trace = (k: string, v: string | number | boolean): void => {
    debugInfoFn(k, v)
}

export const clone = <T>(a: T): T => JSON.parse(JSON.stringify(a))
