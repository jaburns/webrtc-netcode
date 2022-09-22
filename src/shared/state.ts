import { vec2 } from 'gl-matrix'
import { InputsUnit } from './inputs.js'
import { textEncoder, textDecoder, WORLD_WIDTH, PLAYER_RADIUS, WORLD_HEIGHT } from './utils.js'

export interface GameState {
    serverTick: number
    players: Record<string, PlayerState>,
}

export interface PlayerState {
    pos: [number, number],
    vel: [number, number],
    theta: number,
}

export const newGameState = (): GameState => ({
    serverTick: 0,
    players: {},
})

export const newPlayerState = (): PlayerState => ({
    pos: [100 + 800 * Math.random(), 100 + 500 * Math.random()],
    vel: [0, 0],
    theta: 2 * Math.PI * Math.random(),
})

export const tickPlayer = (self: PlayerState, inputs: InputsUnit): void => {
    if (inputs.clicking) {
        self.vel[0] += 0.05 * Math.cos(self.theta)
        self.vel[1] += 0.05 * Math.sin(self.theta)
    } else {
        vec2.scale(self.vel, self.vel, 0.95)
    }

    self.theta += 0.002 * inputs.mouseDelta[0]

    vec2.add(self.pos, self.pos, self.vel)

    if (self.pos[0] < PLAYER_RADIUS) {
        self.pos[0] = PLAYER_RADIUS
        self.vel[0] = Math.abs(self.vel[0])
    } else if (self.pos[0] > WORLD_WIDTH - PLAYER_RADIUS) {
        self.pos[0] = WORLD_WIDTH - PLAYER_RADIUS
        self.vel[0] = -Math.abs(self.vel[0])
    }

    if (self.pos[1] < PLAYER_RADIUS) {
        self.pos[1] = PLAYER_RADIUS
        self.vel[1] = Math.abs(self.vel[1])
    } else if (self.pos[1] > WORLD_HEIGHT - PLAYER_RADIUS) {
        self.pos[1] = WORLD_HEIGHT - PLAYER_RADIUS
        self.vel[1] = -Math.abs(self.vel[1])
    }
}

export const serializeGameState = (state: GameState): ArrayBuffer => {
    return textEncoder.encode(JSON.stringify(state)).buffer
}

export const deserializeGameState = (buffer: ArrayBuffer): GameState => {
    return JSON.parse(textDecoder.decode(buffer))
}
