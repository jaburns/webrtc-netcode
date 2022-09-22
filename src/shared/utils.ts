export interface Connection {
    send: (bytes: ArrayBuffer) => void
    recv: () => ArrayBuffer[]
    close: () => void
}

export const textEncoder = new TextEncoder()
export const textDecoder = new TextDecoder('utf-8')

export const WORLD_WIDTH = 1024
export const WORLD_HEIGHT = 768

export const PLAYER_RADIUS = 26

export const TICKS_PER_SECOND = 60
export const TICK_MILLIS = 1000 / 60
export const TICKS_PER_SERVER_UPDATE = 2
