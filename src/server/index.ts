import { createRequire } from 'node:module'
import express from 'express'
import fs from 'fs'
import { ServerConnection, createConnection } from './connection.js'
import { trace, DebugInfoSet, setGlobalDebugInfoFn, TICK_MILLIS } from '../shared/utils.js'
import { GameState, newGameState, newPlayerState, serializeGameState, tickPlayer } from '../shared/state.js'
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
}, 100)

// ----- game loop -------------------------------------------------------------

interface PlayerConnection {
    inputsBuffer: InputsUnit[],
    currentInputs: InputsUnit,
}

const newPlayerConnection = (): PlayerConnection => ({
    inputsBuffer: [],
    currentInputs: newInputsUnit(),
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
    }

    for (const id in state.players) {
        if (!(id in connections)) {
            delete state.players[id]
            delete playerConns[id]
        }
    }

    tickState(state)

    const statePacket = serializeGameState(state)
    for (const id in connections) {
        connections[id].send(statePacket)
    }
}

const tickState = (state: GameState): void => {
    for (const id in state.players) {
        trace(`Inputs buffer size (${id})`, playerConns[id].inputsBuffer.length)

        if (playerConns[id].inputsBuffer.length > 0) {
            playerConns[id].currentInputs = playerConns[id].inputsBuffer.shift()!
        }
        tickPlayer(state.players[id], playerConns[id].currentInputs)
    }
}
