import { ClientConnection, createConnection } from './connection.js'
import { gameFrame, gameInit } from './game.js'
import { bindInputsListeners } from './inputs.js'
import { renderInit, renderTraces } from './render.js'

let connection: ClientConnection

const main = async (): Promise<void> => {
    connection = await createConnection(new WebSocket('ws://localhost:8080'))

    const canvas = document.getElementById('maincanvas') as HTMLCanvasElement
    const debugDiv = document.getElementById('info') as HTMLDivElement

    renderInit(canvas.getContext('2d')!, debugDiv)

    setInterval(() => {
        renderTraces()
    }, 50)

    bindInputsListeners(canvas)

    gameInit(connection)
    requestAnimationFrame(frame)
}

const frame = (): void => {
    requestAnimationFrame(frame)
    gameFrame()
}

main()
