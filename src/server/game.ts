import { ServerConnection } from './connection.js'
import { trace, TICK_MILLIS, TICKS_PER_SERVER_UPDATE, log } from '../shared/utils.js'
import { GameState, newGameState, newPlayerState, serializeServerStatePacket, ServerStatePacket, tickPlayer } from '../shared/state.js'
import { addInputsUnits, deserializeInputsPacket, InputsUnit, newInputsUnit } from '../shared/inputs.js'

interface PlayerConnection {
    connection: ServerConnection,
    confirmed: boolean,
    burntInputs: InputsUnit | null,
    inputsToBurn: number,
    inputsBuffer: InputsUnit[],
    currentInputs: InputsUnit,
    targetInputsBufferSize: number,
}

const newPlayerConnection = (connection: ServerConnection): PlayerConnection => ({
    connection,
    confirmed: false,
    burntInputs: null,
    inputsToBurn: 0,
    inputsBuffer: [],
    currentInputs: newInputsUnit(),
    targetInputsBufferSize: 2,
})

let tickAccMillis = 0
let lastNow = Date.now()

const state = newGameState()
const players: Record<string, PlayerConnection> = {}

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
        for (const bytes of players[id].connection.recv()) {
            const packet = deserializeInputsPacket(bytes)

            if (packet.unit === 'reset') {
                log(`Client "${id}" sent a reset, unconfirming`)
                players[id].inputsBuffer.length = 0
                players[id].inputsToBurn = 0
                players[id].burntInputs = null
                players[id].confirmed = false
            } else {
                players[id].inputsBuffer.push(packet.unit)
            }
        }
        trace(`Inputs buffer size (${id})`, players[id].inputsBuffer.length)
    }

    tickState(state)

    if (state.serverTick % TICKS_PER_SERVER_UPDATE === 0) {
        for (const id in players) {
            sendUpdateToPlayer(players[id])
        }
    }
}

const tickState = (state: GameState): void => {
    state.serverTick += 1

    for (const id in state.players) {
        const player = players[id]

        if (player.inputsBuffer.length > 0 && player.inputsToBurn > 0) {
            log(`Burning ${player.inputsToBurn} inputs for player ${id}`)
            if (player.burntInputs === null) {
                player.burntInputs = newInputsUnit()
            }
        }

        while (player.inputsBuffer.length > 0 && player.inputsToBurn > 0) {
            const inputs = player.inputsBuffer.shift()!
            player.inputsToBurn--
            addInputsUnits(player.burntInputs!, player.burntInputs!, inputs)
        }

        if (player.inputsBuffer.length > 0) {
            if (player.burntInputs !== null) {
                addInputsUnits(player.currentInputs, player.burntInputs, player.inputsBuffer.shift()!)
                player.burntInputs = null
            } else {
                player.currentInputs = player.inputsBuffer.shift()!
            }

            if (!player.confirmed) {
                player.confirmed = true
                log(`Confirmed player "${id}"`)
            }
        } else if (player.confirmed) {
            player.inputsToBurn++
            player.currentInputs.mouseDelta[0] = 0
            player.currentInputs.mouseDelta[1] = 0
        }

        trace(`Inputs to burn (${id})`, player.inputsToBurn)

        tickPlayer(state.players[id], player.currentInputs)
    }
}

const sendUpdateToPlayer = (player: PlayerConnection): void => {
    const packet: ServerStatePacket = {
        state,
        clientTimeDilation: Math.sign(player.inputsBuffer.length - player.targetInputsBufferSize + 1),
    }
    player.connection.send(serializeServerStatePacket(packet))
}
