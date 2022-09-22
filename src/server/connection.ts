import nodeDataChannel from 'node-datachannel'
import { Connection } from '../shared/utils.js'
const { initLogger, PeerConnection } = nodeDataChannel

initLogger('Debug')

export const createConnection = async (socket: any): Promise<Connection> => {
    const peer = new PeerConnection('conn', {
        iceServers: ['stun:stun.l.google.com:19302'],
        iceTransportPolicy: 'all',
    })

    peer.onLocalDescription((sdp, type) => {
        socket.send(JSON.stringify({ sdp, type }))
    })

    let candidates: any[] | null = []

    peer.onLocalCandidate((candidate, sdpMid) => {
        const json = JSON.stringify({ candidate, sdpMid })
        if (candidates !== null) {
            candidates.push(json)
        } else {
            socket.send(json)
        }
    })

    const dc = peer.createDataChannel('chan', {
        ordered: false,
        maxRetransmits: 0,
    })

    socket.addEventListener('message', (e: any) => {
        const desc = JSON.parse(e.data)
        peer.setRemoteDescription(desc.sdp, desc.type)
        socket.send('D')
        for (const c of candidates!) {
            socket.send(c)
        }
        candidates = null
    }, { once: true })

    await new Promise<void>(resolve => { dc.onOpen(resolve) })

    const pingInterval = setInterval(() => {
        socket.send('p')
    }, 10000)

    let messages: ArrayBuffer[] = []
    dc.onMessage(msg => {
        messages.push((msg as Buffer).slice())
    })

    return {
        send (bytes) {
            dc.sendMessageBinary(Buffer.from(bytes))
        },
        recv () {
            const out = messages
            messages = []
            return out
        },
        close () {
            dc.close()
            peer.close()
            clearInterval(pingInterval)
        },
    }
}
