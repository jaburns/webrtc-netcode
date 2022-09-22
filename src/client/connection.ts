import { DebugInfoSet } from '../shared/utils.js'

export interface ClientConnection {
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

    let descriptionResolve: () => void = 0 as any
    const descriptionPromise = new Promise<void>(resolve => { descriptionResolve = resolve })
    let earlyDatachannel: RTCDataChannel | null = null
    let resolveDatachannel: ((x: RTCDataChannel) => void) | null = null

    let accDebugInfos: DebugInfoSet = {}

    ws.addEventListener('message', e => {
        const payload = e.data.substring(1)
        switch (e.data[0]) {
            case 'c':
                console.log(payload)
                rtcPeerConn.addIceCandidate(JSON.parse(payload))
                break
            case 'd':
                console.log('d')
                descriptionResolve()
                break
            case 'i':
                console.log('i')
                Object.assign(accDebugInfos, JSON.parse(payload))
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

    await descriptionPromise

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
