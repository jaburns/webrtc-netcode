import { serializeInputsPacket } from '../shared/inputs.js'
import { deserializeGameState, GameState, newGameState } from '../shared/state.js'
import { trace, DebugInfoSet, setGlobalDebugInfoFn, TICK_MILLIS } from '../shared/utils.js'
import { ClientConnection, createConnection } from './connection.js'
import { bindInputsListeners, consumeAccumulatedInputs } from './inputs.js'
import { renderDebugInfos, renderGame, renderInit } from './render.js'

let connection: ClientConnection
let prevState: GameState = newGameState()
let state: GameState = newGameState()
let tickAccMillis = 0
let lastNow = Date.now()

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
    }, 100)

    bindInputsListeners(canvas)
    requestAnimationFrame(frame)
}

const frame = (): void => {
    requestAnimationFrame(frame)

    const newNow = Date.now()
    tickAccMillis += newNow - lastNow
    lastNow = newNow

    while (tickAccMillis > TICK_MILLIS) {
        tickAccMillis -= TICK_MILLIS
        tick()
    }

    renderGame(prevState, state, tickAccMillis / TICK_MILLIS)
}

const tick = (): void => {
    const inputs = consumeAccumulatedInputs()
    connection.send(serializeInputsPacket({ unit: inputs }))

    trace('client', Math.random())

    const recv = connection.recv()
    if (recv.length > 0) {
        prevState = state
        state = deserializeGameState(recv.pop()!)
    }
}

main()
