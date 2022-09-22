import { Connection } from '../shared/utils.js'

export const createConnection = async (ws: WebSocket): Promise<Connection> => {
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

    ws.addEventListener('message', e => {
        if (e.data[0] === 'D') {
            descriptionResolve()
        } else if (e.data[0] !== 'p') {
            rtcPeerConn.addIceCandidate(JSON.parse(e.data))
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
