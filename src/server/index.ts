import { createRequire } from 'node:module'
import express from 'express'
import fs from 'fs'
import { ServerConnection, createConnection } from './connection.js'
import { gameNotifyConnections, gameFrame } from './game.js'
import { consumeLogs, getTraces } from '../shared/utils.js'
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
app.use(express.static('static-root'))

app.get('/', (_req, res) => {
    res.send(fs.readFileSync('./src/client/index.html', 'utf8'))
})

wsServer.on('connection', async (socket: any) => {
    const id = Math.random().toString(36).substring(2, 6)
    const conn = await createConnection(id, socket)
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
    console.log('')
}).on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (socket: any) => {
        wsServer.emit('connection', socket, req)
    })
})

let lastNumTraces = 0
const renderDebug = (): void => {
    const traces = getTraces()
    console.log(`\x1B[${(lastNumTraces + 2).toString()}A`)
    console.log('-'.repeat(40))
    for (const id in traces) {
        console.log(`${id} = ${traces[id].toString()}${' '.repeat(5)}`)
    }
    lastNumTraces = Object.keys(traces).length

    consumeLogs().forEach(x => console.log(' '.repeat(45) + x))
}

setInterval(renderDebug, 50)

setInterval(() => {
    gameNotifyConnections(connections)
    gameFrame()
}, 5)
