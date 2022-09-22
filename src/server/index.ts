import { createRequire } from 'node:module'
import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import { createConnection } from './connection.js'
import { Connection, TICK_MILLIS } from '../shared/utils.js'
import { GameState, newGameState, newPlayerState, serializeGameState, tickPlayer } from '../shared/state.js'
import { deserializeInputsPacket, InputsUnit, newInputsUnit } from '../shared/inputs.js'
const oldRequire = createRequire(import.meta.url)
const ws = oldRequire('ws')

// ----- server ----------------------------------------------------------------

const app = express()
const wsServer = new ws.Server({ noServer: true })
const connections: Record<string, Connection> = {}

app.disable('x-powered-by')

app.set('etag', false)

app.use((_req, res, next) => {
    res.setHeader('cache-control', 'no-store')
    res.setHeader('cross-origin-embedder-policy', 'require-corp')
    res.setHeader('cross-origin-opener-policy', 'same-origin')
    next()
})

app.use(bodyParser.json())

app.use(express.static('client-build'))

app.get('/', (_req, res) => {
    res.send(fs.readFileSync('./src/client/index.html', 'utf8'))
})

wsServer.on('connection', async (socket: any) => {
    const conn = await createConnection(socket)

    conn.send(Uint8Array.of(4, 5, 6, 7).buffer)
    setTimeout(() => { console.log(conn.recv()) }, 1000)

    const id = Math.random().toString(36).substring(2)
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

// ----- game loop -------------------------------------------------------------

let tickAccMillis = 0
let lastNow = Date.now()
const state = newGameState()
const currentInputs: Record<string, InputsUnit> = {}

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
            currentInputs[id] = newInputsUnit()
        }

        const recv = connections[id].recv()
        if (recv.length > 0) {
            currentInputs[id] = deserializeInputsPacket(recv.pop()!).unit
        }
    }

    for (const id in state.players) {
        if (!(id in connections)) {
            delete state.players[id]
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
        tickPlayer(state.players[id], currentInputs[id])
    }
}
