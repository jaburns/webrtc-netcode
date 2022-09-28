export const textEncoder = new TextEncoder()
export const textDecoder = new TextDecoder('utf-8')

export const WORLD_WIDTH = 1024
export const WORLD_HEIGHT = 768

export const PLAYER_RADIUS = 26

export const TICKS_PER_SECOND = 60
export const TICK_MILLIS = 1000 / 60
export const TICKS_PER_SERVER_UPDATE = 2

export type Vec2 = [number, number]

export const lerpVec2 = (out: Vec2, a: Vec2, b: Vec2, t: number): Vec2 => {
    out[0] = a[0] + t * (b[0] - a[0])
    out[1] = a[1] + t * (b[1] - a[1])
    return out
}

export const lerpAngle = (a: number, b: number, t: number): number => {
    const delta = b - a
    const lerp = delta > Math.PI
        ? delta - 2 * Math.PI
        : delta < -Math.PI
            ? delta + 2 * Math.PI
            : delta
    return a + lerp * t
}

export const clone = <T>(a: T): T => JSON.parse(JSON.stringify(a))

export type TraceSet = Record<string, string | number | boolean>
const allTraces: TraceSet = {}
export const trace = (k: string, v: string | number | boolean): void => { allTraces[k] = v }
export const getTraces = (): TraceSet => allTraces

let allLogs: string[] = []
export const log = (log: string): void => { allLogs.push(log) }
export const consumeLogs = (): string[] => {
    const out = allLogs
    allLogs = []
    return out
}

const MAX_TARGET_BUFFER_SIZE = 32
const STABLE_MEASUREMENTS_BEFORE_DROP = 60

export class BufferSizeCounter {
    private targetBufferSize: number = 2
    private bufferSizeHistory: number[] = []
    private canIncreaseTargetSize: boolean = false

    getTargetBufferSize (): number {
        return this.targetBufferSize
    }

    recordBufferSize (length: number): void {
        this.bufferSizeHistory.push(length)
        if (this.bufferSizeHistory.length > STABLE_MEASUREMENTS_BEFORE_DROP) {
            this.bufferSizeHistory.shift()

            if (this.targetBufferSize > 1) {
                const halfTargetSize = (this.targetBufferSize / 2) | 0
                let foundSmallBuffer = false
                for (let i = 0; i < this.bufferSizeHistory.length; ++i) {
                    if (this.bufferSizeHistory[i] <= halfTargetSize) {
                        foundSmallBuffer = true
                        break
                    }
                }
                if (!foundSmallBuffer) {
                    this.bufferSizeHistory.length = 0
                    this.targetBufferSize /= 2
                }
            }
        }

        if (
            length === 0 &&
            this.targetBufferSize < MAX_TARGET_BUFFER_SIZE &&
            this.canIncreaseTargetSize
        ) {
            this.targetBufferSize *= 2
            this.canIncreaseTargetSize = false
        }

        if (length >= this.targetBufferSize) {
            this.canIncreaseTargetSize = true
        }
    }
}
