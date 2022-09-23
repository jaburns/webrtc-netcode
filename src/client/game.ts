import { serializeInputsPacket } from '../shared/inputs.js'
import { deserializeServerStatePacket, GameState, newGameState, PlayerState, tickPlayer } from '../shared/state.js'
import { trace, TICK_MILLIS, clone } from '../shared/utils.js'
import { ClientConnection } from './connection.js'
import { consumeAccumulatedInputs } from './inputs.js'
import { renderGame } from './render.js'

let connection: ClientConnection

let lastNow = Date.now()

let serverStateBuffer: GameState[] = []
let prevStateView: GameState = newGameState()
let curStateView: GameState = newGameState()

let prevLocalClientState: PlayerState | null = null
let curLocalClientState: PlayerState | null = null

let targetStateBufferSize: number = 2

let localTickAccMillis = 0
let localTimeDilation: number = 0
let remoteTickAccMillis = 0
let remoteTimeDilation: number = 0

export const gameInit = (clientConnection: ClientConnection): void => {
    connection = clientConnection
}

export const gameFrame = (): void => {
    const newNow = Date.now()
    const deltaNow = newNow - lastNow
    localTickAccMillis += deltaNow
    remoteTickAccMillis += deltaNow
    lastNow = newNow

    let localTickMillis = TICK_MILLIS + localTimeDilation
    while (localTickAccMillis > localTickMillis) {
        localTickAccMillis -= localTickMillis
        runLocalTick()
    }

    let remoteTickMillis = TICK_MILLIS + remoteTimeDilation
    while (remoteTickAccMillis > remoteTickMillis) {
        remoteTickAccMillis -= remoteTickMillis
        runRemoteTick()
    }

    if (curLocalClientState !== null && prevLocalClientState !== null) {
        renderGame(
            prevStateView,
            curStateView,
            remoteTickAccMillis / remoteTickMillis,
            prevLocalClientState,
            curLocalClientState,
            localTickAccMillis / localTickMillis,
        )
    }
}

const runLocalTick = (): void => {
    if (curLocalClientState === null) return

    const inputs = consumeAccumulatedInputs()
    connection.send(serializeInputsPacket({ unit: inputs }))

    prevLocalClientState = clone(curLocalClientState)
    tickPlayer(curLocalClientState, inputs)
}

const runRemoteTick = (): void => {
    receiveIncomingPackets()

    prevStateView = curStateView
    if (serverStateBuffer.length > 0) {
        curStateView = serverStateBuffer.shift()!

        if (curLocalClientState === null && connection.playerId in curStateView.players) {
            curLocalClientState = clone(curStateView.players[connection.playerId])
            prevLocalClientState = curLocalClientState
        }
    }

    remoteTimeDilation = Math.sign(targetStateBufferSize - serverStateBuffer.length - 1)
    trace('Remote time dilation', remoteTimeDilation)
}

const receiveIncomingPackets = (): void => {
    let seenFirstPacket = false

    for (const bytes of connection.recv()) {
        const packet = deserializeServerStatePacket(bytes)
        serverStateBuffer.push(packet.state)

        if (!seenFirstPacket) {
            seenFirstPacket = true
            localTimeDilation = packet.clientTimeDilation
            trace('Local time dilation', localTimeDilation)
        }
    }

    trace('State buffer size', serverStateBuffer.length)
}
