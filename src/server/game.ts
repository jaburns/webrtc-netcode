import { ServerConnection } from './connection.js'
import { TICK_MILLIS, TICKS_PER_SERVER_UPDATE, trace } from '../shared/utils.js'
import { GameState, newGameState, newPlayerState, serializeServerStatePacket, ServerStatePacket, tickPlayer } from '../shared/state.js'
import { InputsReceiver } from './inputs.js'

interface PlayerConnection {
    connection: ServerConnection,
    confirmed: boolean,
    inputsReceiver: InputsReceiver,
}

const newPlayerConnection = (playerId: string, connection: ServerConnection): PlayerConnection => ({
    connection,
    confirmed: false,
    inputsReceiver: new InputsReceiver(playerId),
})

let tickAccMillis = 0
let lastNow = Date.now()

const state = newGameState()
const players: Record<string, PlayerConnection> = {}

export const gameNotifyConnections = (connections: Record<string, ServerConnection>): void => {
    for (const id in connections) {
        if (!(id in players)) {
            players[id] = newPlayerConnection(id, connections[id])
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
        const packets = players[id].connection.recv()
        if (packets.length > 0) {
            const bytes = packets.pop()!
            players[id].inputsReceiver.receiveInputsPacket(bytes)
            trace(`Inputs packet size (${id})`, bytes.byteLength)
        }
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
        player.inputsReceiver.tick()
        tickPlayer(state.players[id], player.inputsReceiver.getCurrentInputs())
    }
}

const sendUpdateToPlayer = (player: PlayerConnection): void => {
    const packet: ServerStatePacket = {
        state,
        ackedInputSeq: player.inputsReceiver.getAckedInputSeq(),
        clientTimeDilation: player.inputsReceiver.getClientTimeDilation(),
    }
    player.connection.send(serializeServerStatePacket(packet))
}
