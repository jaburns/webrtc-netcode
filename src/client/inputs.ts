import { InputHistoryItem, InputsUnit, newInputsUnit } from '../shared/inputs.js'
import { textEncoder, trace } from '../shared/utils.js'

let curFrameInputs = newInputsUnit()

export const bindInputsListeners = (canvas: HTMLCanvasElement): void => {
    document.onmousedown = () => {
        if (document.pointerLockElement !== canvas) {
            canvas.requestPointerLock()
        } else {
            curFrameInputs.clicking = true
        }
    }
    document.onmouseup = () => {
        if (document.pointerLockElement !== canvas) return
        curFrameInputs.clicking = false
    }
    if ('chrome' in window) {
        (window as any).onpointerrawupdate = (es: PointerEvent): void => {
            if (document.pointerLockElement !== canvas) return
            for (const e of es.getCoalescedEvents()) {
                handleMouseMoveEvent(e.movementX, e.movementY)
            }
        }
    } else {
        window.onmousemove = (e: MouseEvent): void => {
            if (document.pointerLockElement !== canvas) return
            handleMouseMoveEvent(e.movementX, e.movementY)
        }
    }
}

let lastMouseDx = 0
let lastMouseDy = 0
const handleMouseMoveEvent = (dx: number, dy: number): void => {
    if (Math.abs(dx) > 100 && dx * lastMouseDx < 0 || Math.abs(dy) > 100 && dy * lastMouseDy < 0) {
        return
    }
    lastMouseDx = dx
    lastMouseDy = dy
    curFrameInputs.mouseDelta[0] += dx
    curFrameInputs.mouseDelta[1] += dy
}

export const consumeAccumulatedInputs = (): InputsUnit => {
    const result = curFrameInputs
    curFrameInputs = newInputsUnit()
    curFrameInputs.clicking = result.clicking
    return result
}

export class InputsSender {
    private tickInputsHistory: InputHistoryItem[] = []
    private inputSeqAtHeadOfHistory: number = 0
    private ackedInputSeq: number | null = null

    addTickInputsAndMaybeMakePacket(inputs: InputsUnit): ArrayBuffer | null {
        this.tickInputsHistory.unshift(inputs)
        this.inputSeqAtHeadOfHistory += 1

        if (this.inputSeqAtHeadOfHistory % 2 !== 0) {
            return null
        }

        const send: any[] = [ this.inputSeqAtHeadOfHistory ]
        for (let i = 0; i < this.tickInputsHistory.length; ++i) {
            let historyItem = this.tickInputsHistory[i]
            if (this.ackedInputSeq !== null && this.inputSeqAtHeadOfHistory - i <= this.ackedInputSeq) {
                break
            }
            if (historyItem === 'reset') {
                send.push(0)
            } else {
                send.push([historyItem.clicking?1:0, historyItem.mouseDelta[0], historyItem.mouseDelta[1]])
            }
        }

        const packet = textEncoder.encode(JSON.stringify(send)).buffer

        trace('Sending input seq', this.inputSeqAtHeadOfHistory)
        trace('Server-acked input seq', this.ackedInputSeq!)
        trace('Inputs packet size', packet.byteLength)

        return packet
    }

    ackInputSeq(seq: number): void {
        this.ackedInputSeq = seq
    }

    resetConnection(): void {
        this.tickInputsHistory = ['reset']
        this.inputSeqAtHeadOfHistory += 1
    }
}
