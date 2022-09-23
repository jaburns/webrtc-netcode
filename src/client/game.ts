import { deserializeServerStatePacket, GameState, newGameState, PlayerState, tickPlayer } from '../shared/state.js'
import { trace, TICK_MILLIS, clone, TICKS_PER_SERVER_UPDATE, log } from '../shared/utils.js'
import { ClientConnection } from './connection.js'
import { consumeAccumulatedInputs, InputsSender } from './inputs.js'
import { renderGame } from './render.js'

let connection: ClientConnection

let lastNow = Date.now()

const serverStateBuffer: GameState[] = []
let prevStateView: GameState = newGameState()
let curStateView: GameState = newGameState()

let prevLocalClientState: PlayerState | null = null
let curLocalClientState: PlayerState | null = null

let inputsSender: InputsSender = new InputsSender()

const targetStateBufferSize: number = 2

let localTickAccMillis = 0
let localTimeDilation: number = 0
let remoteUpdateAccMillis = 0
let remoteTimeDilation: number = 0

export const gameInit = (clientConnection: ClientConnection): void => {
    connection = clientConnection
    trace('Player ID', connection.playerId)
}

export const gameFrame = (): void => {
    const newNow = Date.now()
    const deltaNow = newNow - lastNow
    lastNow = newNow

    if (deltaNow > 1000) {
        log('Resetting connection')
        curLocalClientState = null
        prevLocalClientState = null
        localTickAccMillis = 0
        remoteUpdateAccMillis = 0
        serverStateBuffer.length = 0
        connection.recv()
        inputsSender.resetConnection()
        return
    }

    localTickAccMillis += deltaNow
    const localTickMillis = TICK_MILLIS + localTimeDilation
    const numLocalTicks = Math.floor(localTickAccMillis / localTickMillis)
    localTickAccMillis -= numLocalTicks * localTickMillis
    for (let i = 0; i < numLocalTicks; ++i) {
        runLocalTick()
    }

    remoteUpdateAccMillis += deltaNow
    const remoteUpdateMillis = TICKS_PER_SERVER_UPDATE * (TICK_MILLIS + remoteTimeDilation)
    const numRemoteUpdates = Math.floor(remoteUpdateAccMillis / remoteUpdateMillis)
    remoteUpdateAccMillis -= numRemoteUpdates * remoteUpdateMillis
    for (let i = 0; i < numRemoteUpdates; ++i) {
        runRemoteUpdate()
    }

    if (curLocalClientState !== null && prevLocalClientState !== null) {
        renderGame(
            prevStateView,
            curStateView,
            remoteUpdateAccMillis / remoteUpdateMillis,
            prevLocalClientState,
            curLocalClientState,
            localTickAccMillis / localTickMillis,
        )
    }
}

const runLocalTick = (): void => {
    if (curLocalClientState === null) return

    const tickInputs = consumeAccumulatedInputs()
    const maybePacket = inputsSender.addTickInputsAndMaybeMakePacket(tickInputs)
    if (maybePacket !== null) {
        connection.send(maybePacket)
    }

    prevLocalClientState = clone(curLocalClientState)
    tickPlayer(curLocalClientState, tickInputs)
}

const runRemoteUpdate = (): void => {
    receiveIncomingPackets()

    prevStateView = curStateView
    if (serverStateBuffer.length > 0) {
        curStateView = serverStateBuffer.shift()!

        if (curLocalClientState === null && connection.playerId in curStateView.players) {
            log('Initializing local player from server state')
            curLocalClientState = clone(curStateView.players[connection.playerId])
            prevLocalClientState = curLocalClientState
        }
    }

    remoteTimeDilation = Math.sign(targetStateBufferSize - serverStateBuffer.length - 1)
}

const receiveIncomingPackets = (): void => {
    let seenFirstPacket = false

    for (const bytes of connection.recv()) {
        trace('State packet size', bytes.byteLength)
        const packet = deserializeServerStatePacket(bytes)
        serverStateBuffer.push(packet.state)

        if (!seenFirstPacket) {
            seenFirstPacket = true
            localTimeDilation = packet.clientTimeDilation
            inputsSender.ackInputSeq(packet.ackedInputSeq)
            trace('Local time dilation', localTimeDilation)
        }
    }

    trace('State buffer size', serverStateBuffer.length)
}
