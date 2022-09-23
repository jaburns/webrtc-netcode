import { DebugInfoSet } from '../shared/utils.js'

export interface ClientConnection {
    playerId: string,
    send: (bytes: ArrayBuffer) => void
    recvDebugInfo: () => DebugInfoSet
    recv: () => ArrayBuffer[]
    close: () => void
}

export const createConnection = async (ws: WebSocket): Promise<ClientConnection> => {
    const sdp: RTCSessionDescription = await new Promise(resolve => {
        ws.addEventListener('message', e => {
            resolve(JSON.parse(e.data))
        }, { once: true })
    })

    const rtcPeerConn = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    })

    await rtcPeerConn.setRemoteDescription(sdp)

    let descriptionResolve: (playerId: string) => void = 0 as any
    const descriptionPromise = new Promise<string>(resolve => { descriptionResolve = resolve })
    let earlyDatachannel: RTCDataChannel | null = null
    let resolveDatachannel: ((x: RTCDataChannel) => void) | null = null

    let accDebugInfos: DebugInfoSet = {}

    ws.addEventListener('message', e => {
        const payload = JSON.parse(e.data.substring(1))
        switch (e.data[0]) {
            case 'c':
                rtcPeerConn.addIceCandidate(payload)
                break
            case 'd':
                descriptionResolve(payload[0])
                break
            case 'i':
                Object.assign(accDebugInfos, payload)
                break
        }
    })

    rtcPeerConn.addEventListener('datachannel', e => {
        if (resolveDatachannel !== null) {
            resolveDatachannel(e.channel)
        } else {
            earlyDatachannel = e.channel
        }
    }, { once: true })

    const originalAnswer = await rtcPeerConn.createAnswer()
    const updatedAnswer = new RTCSessionDescription({
        type: 'answer',
        sdp: originalAnswer.sdp,
    })

    await rtcPeerConn.setLocalDescription(updatedAnswer)

    ws.send(JSON.stringify(updatedAnswer))

    const playerId = await descriptionPromise

    const dc = await new Promise<RTCDataChannel>(resolve => {
        if (earlyDatachannel !== null) {
            resolve(earlyDatachannel)
        } else {
            resolveDatachannel = resolve
        }
    })
    dc.binaryType = 'arraybuffer'

    let messages: ArrayBuffer[] = []
    dc.onmessage = e => {
        messages.push(e.data)
    }

    return {
        playerId,
        send (bytes) {
            dc.send(bytes)
        },
        recvDebugInfo () {
            const out = accDebugInfos
            accDebugInfos = {}
            return out
        },
        recv () {
            const out = messages
            messages = []
            return out
        },
        close () {
            dc.close()
            ws.close()
        },
    }
}
