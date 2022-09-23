import { DebugInfoSet, setGlobalDebugInfoFn } from '../shared/utils.js'
import { ClientConnection, createConnection } from './connection.js'
import { gameFrame, gameInit } from './game.js'
import { bindInputsListeners } from './inputs.js'
import { renderDebugInfos, renderInit } from './render.js'

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

    gameInit(connection)
    requestAnimationFrame(frame)
}

const frame = (): void => {
    requestAnimationFrame(frame)
    gameFrame()
}

main()
