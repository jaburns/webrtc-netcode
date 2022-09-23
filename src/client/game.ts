import { serializeInputsPacket } from '../shared/inputs.js'
import { deserializeServerStatePacket, GameState, newGameState, PlayerState, tickPlayer } from '../shared/state.js'
import { trace, TICK_MILLIS, clone, TICKS_PER_SERVER_UPDATE, log } from '../shared/utils.js'
import { ClientConnection } from './connection.js'
import { consumeAccumulatedInputs } from './inputs.js'
import { renderGame } from './render.js'

let connection: ClientConnection

let lastNow = Date.now()

const serverStateBuffer: GameState[] = []
let prevStateView: GameState = newGameState()
let curStateView: GameState = newGameState()

let prevLocalClientState: PlayerState | null = null
let curLocalClientState: PlayerState | null = null
let localEstimatedServerTick: number = 0

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
        connection.send(serializeInputsPacket({ unit: 'reset' })) // TODO this needs to go through the inputs reliability layer
        return
    }

    localTickAccMillis += deltaNow
    const localTickMillis = TICK_MILLIS + localTimeDilation
    while (localTickAccMillis > localTickMillis) {
        localTickAccMillis -= localTickMillis
        runLocalTick()
    }

    remoteUpdateAccMillis += deltaNow
    const remoteUpdateMillis = TICKS_PER_SERVER_UPDATE * (TICK_MILLIS + remoteTimeDilation)

    //while (remoteUpdateAccMillis > remoteUpdateMillis) {
    //    remoteUpdateAccMillis -= remoteUpdateMillis
    //    runRemoteUpdate()
    //}

    const numRemoteUpdates = Math.floor(remoteUpdateAccMillis / remoteUpdateMillis)
    remoteUpdateAccMillis -= numRemoteUpdates * remoteUpdateMillis
    if (numRemoteUpdates > 1) log(`Running multiple remote updates: ${numRemoteUpdates}`)
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

    const inputs = consumeAccumulatedInputs()
    connection.send(serializeInputsPacket({ unit: inputs }))

    prevLocalClientState = clone(curLocalClientState)
    tickPlayer(curLocalClientState, inputs)
    localEstimatedServerTick += 1

    trace('Local ticks ahead', localEstimatedServerTick - curStateView.serverTick)
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
            localEstimatedServerTick = curStateView.serverTick
        }
    }

    remoteTimeDilation = Math.sign(targetStateBufferSize - serverStateBuffer.length - 1)
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
