import { serializeInputsPacket } from '../shared/inputs.js'
import { deserializeGameState, GameState, newGameState } from '../shared/state.js'
import { Connection, TICK_MILLIS } from '../shared/utils.js'
import { createConnection } from './connection.js'
import { bindInputsListeners, consumeAccumulatedInputs } from './inputs.js'
import { renderGame, renderInit } from './render.js'

let connection: Connection
let state: GameState = newGameState()
let tickAccMillis = 0
let lastNow = Date.now()

const main = async (): Promise<void> => {
    connection = await createConnection(new WebSocket('ws://localhost:8080'))
    const canvas = document.getElementById('maincanvas') as HTMLCanvasElement
    renderInit(canvas.getContext('2d')!)
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

    renderGame(state)
}

const tick = (): void => {
    const inputs = consumeAccumulatedInputs()
    connection.send(serializeInputsPacket({ unit: inputs }))

    const recv = connection.recv()
    if (recv.length < 1) return
    state = deserializeGameState(recv.pop()!)
}

main()
