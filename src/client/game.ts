import { newInputsUnit, TickInputs } from '../shared/inputs.js'
import { GameState, newGameState, PlayerState, tickPlayer } from '../shared/state.js'
import { trace, TICK_MILLIS, clone, TICKS_PER_SERVER_UPDATE, log } from '../shared/utils.js'
import { ClientConnection } from './connection.js'
import { consumeAccumulatedInputs, InputsSender } from './inputs.js'
import { renderGame } from './render.js'
import { StateUpdateReceiver } from './state.js'

const MAX_LOCAL_CLIENT_HISTORY = 200

let connection: ClientConnection

let lastNow = Date.now()

let prevStateView: GameState = newGameState()
let curStateView: GameState = newGameState()

const localClientHistory: [TickInputs, PlayerState][] = []

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
        localClientHistory.length = 0
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

    if (localClientHistory.length >= 2) {
        renderGame(
            prevStateView,
            curStateView,
            remoteUpdateAccMillis / remoteUpdateMillis,
            localClientHistory[1][1],
            localClientHistory[0][1],
            localTickAccMillis / localTickMillis,
        )
    }
}

const runLocalTick = (): void => {
    if (localClientHistory.length < 2) return

    const inputs = consumeAccumulatedInputs()
    const [tickInputs, maybePacket] = inputsSender.addTickInputsAndMaybeMakePacket(inputs)
    if (maybePacket !== null) {
        connection.send(maybePacket)
    }

    const newLocalClientState = clone(localClientHistory[0][1])
    tickPlayer(newLocalClientState, tickInputs)

    localClientHistory.unshift([tickInputs, newLocalClientState])

    if (localClientHistory.length > MAX_LOCAL_CLIENT_HISTORY) {
        localClientHistory.pop()
    }
}

const runRemoteUpdate = (): void => {
    updateReceiver.receivePackets(connection.recv())

    const maybeNewState = updateReceiver.maybeGetNewState()

    prevStateView = curStateView
    if (maybeNewState !== null) {
        curStateView = maybeNewState

        if (connection.playerId in curStateView.players) {
            const localPlayerServerState = curStateView.players[connection.playerId]

            if (localClientHistory.length < 2) {
                log('Initializing local player from server state')
                localClientHistory.push([{ seq:null, inputs: newInputsUnit() }, clone(localPlayerServerState) ])
                localClientHistory.push([{ seq:null, inputs: newInputsUnit() }, localPlayerServerState ])
            } else if (localPlayerServerState.latestInputSeq !== null) {
                checkAndResolveMisprediction(localPlayerServerState)
            }
        }
    }

    localTimeDilation = updateReceiver.getLocalTimeDilation()
    remoteTimeDilation = updateReceiver.getRemoteTimeDilation()
    inputsSender.ackInputSeq(updateReceiver.getAckedInputSeq())

    trace('Local time dilation', localTimeDilation)
    trace('Remote time dilation', remoteTimeDilation)
}

const checkAndResolveMisprediction = (serverPlayer: PlayerState): void => {
    const remoteSeq = serverPlayer.latestInputSeq
    let historicalIndex = 0

    for (; historicalIndex < localClientHistory.length; ++historicalIndex) {
        if (localClientHistory[historicalIndex][1].latestInputSeq === remoteSeq) {
            break
        }
    }

    if (historicalIndex >= localClientHistory.length) {
        log('Found no reference for misprediction check')
        return
    }

    localClientHistory.length = historicalIndex + 1

    const historicalPlayer = localClientHistory[historicalIndex][1]
    if (Math.abs(serverPlayer.pos[0] - historicalPlayer.pos[0]) > 0.001 ||
        Math.abs(serverPlayer.pos[1] - historicalPlayer.pos[1]) > 0.001)
    {
        log('Found prediction failure, resolving')
    } else {
        return
    }

    localClientHistory[historicalIndex][1] = clone(serverPlayer)

    while (historicalIndex > 0) {
        historicalIndex--
        const newPlayer = clone(localClientHistory[historicalIndex + 1][1])
        tickPlayer(newPlayer, localClientHistory[historicalIndex][0])
        localClientHistory[historicalIndex][1] = newPlayer
    }
}
