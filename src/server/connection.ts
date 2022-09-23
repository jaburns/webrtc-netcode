import nodeDataChannel from 'node-datachannel'
const { PeerConnection } = nodeDataChannel

// nodeDataChannel.initLogger('Debug')

export interface ServerConnection {
    send: (bytes: ArrayBuffer) => void
    recv: () => ArrayBuffer[]
    close: () => void
}

export const createConnection = async (playerId: string, socket: any): Promise<ServerConnection> => {
    const peer = new PeerConnection('conn', {
        iceServers: ['stun:stun.l.google.com:19302'],
        iceTransportPolicy: 'all',
    })

    peer.onLocalDescription((sdp, type) => {
        socket.send(JSON.stringify({ sdp, type }))
    })

    let candidates: string[] | null = []

    peer.onLocalCandidate((candidate, sdpMid) => {
        const json = JSON.stringify({ candidate, sdpMid })
        if (candidates !== null) {
            candidates.push('c' + json)
        } else {
            socket.send('c' + json)
        }
    })

    const dc = peer.createDataChannel('chan', {
        ordered: false,
        maxRetransmits: 0,
    })

    socket.addEventListener('message', (e: any) => {
        const desc = JSON.parse(e.data)
        peer.setRemoteDescription(desc.sdp, desc.type)
        socket.send('d' + JSON.stringify([playerId]))
        for (const c of candidates!) {
            socket.send(c)
        }
        candidates = null
    }, { once: true })

    await new Promise<void>(resolve => { dc.onOpen(resolve) })

    let messages: ArrayBuffer[] = []
    dc.onMessage(msg => {
        if (document.visibilityState === 'hidden') return
        messages.push((msg as Buffer).slice())
    })

    return {
        send (bytes) {
            if (!dc.isOpen()) return
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
        },
    }
}
