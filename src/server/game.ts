import { ServerConnection } from './connection.js'
import { trace, TICK_MILLIS } from '../shared/utils.js'
import { GameState, newGameState, newPlayerState, serializeServerStatePacket, ServerStatePacket, tickPlayer } from '../shared/state.js'
import { deserializeInputsPacket, InputsUnit, newInputsUnit } from '../shared/inputs.js'

interface PlayerConnection {
    connection: ServerConnection,
    inputsBuffer: InputsUnit[],
    currentInputs: InputsUnit,
    targetInputsBufferSize: number,
}

const newPlayerConnection = (connection: ServerConnection): PlayerConnection => ({
    connection,
    inputsBuffer: [],
    currentInputs: newInputsUnit(),
    targetInputsBufferSize: 2,
})

let tickAccMillis = 0
let lastNow = Date.now()

let state = newGameState()
let players: Record<string, PlayerConnection> = {}

export const gameNotifyConnections = (connections: Record<string, ServerConnection>): void => {
    for (const id in connections) {
        if (!(id in players)) {
            players[id] = newPlayerConnection(connections[id])
            state.players[id] = newPlayerState()
        }
    }

    for (const id in state.players) {
        if (!(id in connections)) {
            delete players[id]
            delete state.players[id]
        }
    }
}

export const gameFrame = (): void => {
    const newNow = Date.now()
    tickAccMillis += newNow - lastNow
    lastNow = newNow

    while (tickAccMillis > TICK_MILLIS) {
        tickAccMillis -= TICK_MILLIS
        tick()
    }
}

const tick = (): void => {
    for (const id in players) {
        players[id].inputsBuffer.push(
            ...players[id].connection.recv().map(x => deserializeInputsPacket(x).unit),
        )
        trace(`Inputs buffer size (${id})`, players[id].inputsBuffer.length)
    }

    tickState(state)

    for (const id in players) {
        sendUpdateToPlayer(players[id])
    }
}

const tickState = (state: GameState): void => {
    for (const id in state.players) {
        if (players[id].inputsBuffer.length > 0) {
            players[id].currentInputs = players[id].inputsBuffer.shift()!
        }
        tickPlayer(state.players[id], players[id].currentInputs)
    }
}

const sendUpdateToPlayer = (player: PlayerConnection): void => {
    const packet: ServerStatePacket = {
        state,
        clientTimeDilation: Math.sign(player.inputsBuffer.length - player.targetInputsBufferSize + 1)
    }
    player.connection.send(serializeServerStatePacket(packet))
}
