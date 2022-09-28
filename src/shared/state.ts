import { TickInputs } from './inputs.js'
import { textEncoder, textDecoder, WORLD_WIDTH, PLAYER_RADIUS, WORLD_HEIGHT } from './utils.js'

export interface GameState {
    serverTick: number
    players: Record<string, PlayerState>,
}

export interface PlayerState {
    pos: [number, number],
    vel: [number, number],
    theta: number,
    latestInputSeq: number | null,
}

export const newGameState = (): GameState => ({
    serverTick: 0,
    players: {},
})

export const newPlayerState = (): PlayerState => ({
    pos: [100 + 800 * Math.random(), 100 + 500 * Math.random()],
    vel: [0, 0],
    theta: 2 * Math.PI * Math.random(),
    latestInputSeq: null,
})

export const tickPlayer = (self: PlayerState, inputs: TickInputs): void => {
    self.latestInputSeq = inputs.seq

    if (inputs.inputs.clicking) {
        self.vel[0] += 0.05 * Math.cos(self.theta)
        self.vel[1] += 0.05 * Math.sin(self.theta)
    } else {
        self.vel[0] *= 0.95
        self.vel[1] *= 0.95
    }

    self.theta += 0.002 * inputs.inputs.mouseDelta[0]

    //if (inputs.seq !== null && inputs.seq % 100 === 0) {
    //    self.theta += 0.5
    //}

    self.pos[0] += self.vel[0]
    self.pos[1] += self.vel[1]

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

export interface ServerStatePacket {
    clientTimeDilation: number,
    ackedInputSeq: number,
    state: GameState,
}

export const serializeServerStatePacket = (state: ServerStatePacket): ArrayBuffer => {
    return textEncoder.encode(JSON.stringify(state)).buffer
}

export const deserializeServerStatePacket = (buffer: ArrayBuffer): ServerStatePacket => {
    return JSON.parse(textDecoder.decode(buffer))
}
