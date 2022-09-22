import { serializeInputsPacket } from '../shared/inputs.js'
import { deserializeServerStatePacket, GameState, newGameState, newPlayerState, PlayerState } from '../shared/state.js'
import { trace, DebugInfoSet, setGlobalDebugInfoFn, TICK_MILLIS } from '../shared/utils.js'
import { ClientConnection, createConnection } from './connection.js'
import { bindInputsListeners, consumeAccumulatedInputs } from './inputs.js'
import { renderDebugInfos, renderGame, renderInit } from './render.js'

let connection: ClientConnection

const main = async (): Promise<void> => {
    connection = await createConnection(new WebSocket('ws://localhost:8080'))

    const canvas = document.getElementById('maincanvas') as HTMLCanvasElement
    const debugDiv = document.getElementById('info') as HTMLDivElement

    renderInit(canvas.getContext('2d')!, debugDiv)

    const clientDebugInfo: DebugInfoSet = {}
    const serverDebugInfo: DebugInfoSet = {}
    setGlobalDebugInfoFn((k, v) => {
        clientDebugInfo[k] = v
    })
    setInterval(() => {
        Object.assign(serverDebugInfo, connection.recvDebugInfo())
        renderDebugInfos(clientDebugInfo, serverDebugInfo)
    }, 50)

    bindInputsListeners(canvas)
    requestAnimationFrame(frame)
}

let lastNow = Date.now()

let serverStateBuffer: GameState[] = []
let prevStateView: GameState = newGameState()
let curStateView: GameState = newGameState()

let prevLocalClientState: PlayerState = newPlayerState()
let curLocalClientState: PlayerState = JSON.parse(JSON.stringify(prevLocalClientState))

let targetStateBufferSize: number = 2

let localTickAccMillis = 0
let localTimeDilation: number = 0
let remoteTickAccMillis = 0
let remoteTimeDilation: number = 0

const frame = (): void => {
    requestAnimationFrame(frame)

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

    renderGame(
        prevStateView,
        curStateView,
        remoteTickAccMillis / remoteTickMillis,
        prevLocalClientState,
        curLocalClientState,
        localTickAccMillis / localTickMillis,
    )
}

const runLocalTick = (): void => {
    const inputs = consumeAccumulatedInputs()
    connection.send(serializeInputsPacket({ unit: inputs }))
}

const runRemoteTick = (): void => {
    receiveIncomingPackets()

    trace('State buffer size', serverStateBuffer.length)

    prevStateView = curStateView
    if (serverStateBuffer.length > 0) {
        curStateView = serverStateBuffer.shift()!
    }

    remoteTimeDilation = Math.sign(targetStateBufferSize - serverStateBuffer.length - 1)
    trace('Remote time dilation', remoteTimeDilation)
}

const receiveIncomingPackets = (): void => {
    let seenFirst = false

    for (const bytes of connection.recv()) {
        const packet = deserializeServerStatePacket(bytes)
        serverStateBuffer.push(packet.state)

        if (!seenFirst) {
            seenFirst = true
            localTimeDilation = packet.clientTimeDilation

            trace('Local time dilation', localTimeDilation)
        }
    }
}

main()
