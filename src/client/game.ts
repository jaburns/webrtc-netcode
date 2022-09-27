import { GameState, newGameState, PlayerState, tickPlayer } from '../shared/state.js'
import { trace, TICK_MILLIS, clone, TICKS_PER_SERVER_UPDATE, log } from '../shared/utils.js'
import { ClientConnection } from './connection.js'
import { consumeAccumulatedInputs, InputsSender } from './inputs.js'
import { renderGame } from './render.js'
import { StateUpdateReceiver } from './state.js'

let connection: ClientConnection

let lastNow = Date.now()

let prevStateView: GameState = newGameState()
let curStateView: GameState = newGameState()

let prevLocalClientState: PlayerState | null = null
let curLocalClientState: PlayerState | null = null

const inputsSender = new InputsSender()
const updateReceiver = new StateUpdateReceiver()

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
        connection.recv()
        inputsSender.resetConnection()
        updateReceiver.resetConnection()
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

    const inputs = consumeAccumulatedInputs()
    const [tickInputs, maybePacket] = inputsSender.addTickInputsAndMaybeMakePacket(inputs)
    if (maybePacket !== null) {
        connection.send(maybePacket)
    }

    prevLocalClientState = clone(curLocalClientState)
    tickPlayer(curLocalClientState, tickInputs)
}

const runRemoteUpdate = (): void => {
    updateReceiver.receivePackets(connection.recv())

    const maybeNewState = updateReceiver.maybeGetNewState()

    prevStateView = curStateView
    if (maybeNewState !== null) {
        curStateView = maybeNewState

        if (curLocalClientState === null && connection.playerId in curStateView.players) {
            log('Initializing local player from server state')
            curLocalClientState = clone(curStateView.players[connection.playerId])
            prevLocalClientState = curLocalClientState
        }
    }

    localTimeDilation = updateReceiver.getLocalTimeDilation()
    remoteTimeDilation = updateReceiver.getRemoteTimeDilation()
    inputsSender.ackInputSeq(updateReceiver.getAckedInputSeq())

    trace('Local time dilation', localTimeDilation)
    trace('Remote time dilation', remoteTimeDilation)
}
