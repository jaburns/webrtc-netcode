import { createRequire } from 'node:module'
import express from 'express'
import fs from 'fs'
import { ServerConnection, createConnection } from './connection.js'
import { trace, DebugInfoSet, setGlobalDebugInfoFn, TICK_MILLIS } from '../shared/utils.js'
import { GameState, newGameState, newPlayerState, serializeServerStatePacket, ServerStatePacket, tickPlayer } from '../shared/state.js'
import { deserializeInputsPacket, InputsUnit, newInputsUnit } from '../shared/inputs.js'
const oldRequire = createRequire(import.meta.url)
const ws = oldRequire('ws')

// ----- server ----------------------------------------------------------------

const app = express()
const wsServer = new ws.Server({ noServer: true })
const connections: Record<string, ServerConnection> = {}

app.use((_req, res, next) => {
    res.setHeader('cache-control', 'no-store')
    next()
})

app.use(express.static('client-build'))

app.get('/', (_req, res) => {
    res.send(fs.readFileSync('./src/client/index.html', 'utf8'))
})

wsServer.on('connection', async (socket: any) => {
    const conn = await createConnection(socket)
    const id = Math.random().toString(36).substring(2, 6)
    socket.on('close', () => {
        connections[id].close()
        delete connections[id]
    })
    connections[id] = conn
})

app.listen(8080, () => {
    console.log('[32m╔═[39m[32m═══════════════════════════[39m[32m═╗[39m')
    console.log('[32m║ [39m[1m[35m Listening on port 8080... [39m[22m[32m ║[39m')
    console.log('[32m╚═[39m[32m═══════════════════════════[39m[32m═╝[39m')
}).on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (socket: any) => {
        wsServer.emit('connection', socket, req)
    })
})

let accDebugInfos: DebugInfoSet = {}
setGlobalDebugInfoFn((k, v) => {
    accDebugInfos[k] = v
})
setInterval(() => {
    for (const id in connections) {
        connections[id].sendDebugInfo(accDebugInfos)
    }
    accDebugInfos = {}
}, 50)

// ----- game loop -------------------------------------------------------------

interface PlayerConnection {
    inputsBuffer: InputsUnit[],
    currentInputs: InputsUnit,
    targetInputsBufferSize: number,
}

const newPlayerConnection = (): PlayerConnection => ({
    inputsBuffer: [],
    currentInputs: newInputsUnit(),
    targetInputsBufferSize: 2,
})

let tickAccMillis = 0
let lastNow = Date.now()
const state = newGameState()
const playerConns: Record<string, PlayerConnection> = {}

setInterval(() => {
    const newNow = Date.now()
    tickAccMillis += newNow - lastNow
    lastNow = newNow

    while (tickAccMillis > TICK_MILLIS) {
        tickAccMillis -= TICK_MILLIS
        tick()
    }
}, 1)

const tick = (): void => {
    for (const id in connections) {
        if (!(id in state.players)) {
            state.players[id] = newPlayerState()
            playerConns[id] = newPlayerConnection()
        }

        playerConns[id].inputsBuffer.push(
            ...connections[id].recv().map(x => deserializeInputsPacket(x).unit),
        )

        trace(`Inputs buffer size (${id})`, playerConns[id].inputsBuffer.length)
    }

    for (const id in state.players) {
        if (!(id in connections)) {
            delete state.players[id]
            delete playerConns[id]
        }
    }

    tickState(state)

    for (const id in connections) {
        sendUpdateToPlayer(connections[id], playerConns[id])
    }
}

const tickState = (state: GameState): void => {
    for (const id in state.players) {
        if (playerConns[id].inputsBuffer.length > 0) {
            playerConns[id].currentInputs = playerConns[id].inputsBuffer.shift()!
        }
        tickPlayer(state.players[id], playerConns[id].currentInputs)
    }
}

const sendUpdateToPlayer = (udp: ServerConnection, conn: PlayerConnection): void => {
    const packet: ServerStatePacket = {
        state,
        clientTimeDilation: Math.sign(conn.inputsBuffer.length - conn.targetInputsBufferSize + 1)
    }
    udp.send(serializeServerStatePacket(packet))
}
