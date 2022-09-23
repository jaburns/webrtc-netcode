import { vec2 } from 'gl-matrix'
import { textEncoder, textDecoder, log, TICKS_PER_SECOND, trace } from './utils.js'

export interface InputsUnit {
    mouseDelta: [number, number],
    clicking: boolean,
}

export const newInputsUnit = (): InputsUnit => ({
    mouseDelta: [0, 0],
    clicking: false,
})

export const addInputsUnits = (out: InputsUnit, a: InputsUnit, b: InputsUnit): InputsUnit => {
    vec2.add(out.mouseDelta, a.mouseDelta, b.mouseDelta)
    out.clicking = a.clicking || b.clicking
    return out
}

type InputHistoryItem = InputsUnit | 'reset'

export class InputsSender {
    private tickInputsHistory: InputHistoryItem[] = []
    private inputSeqAtHeadOfHistory: number = 0
    private ackedInputSeq: number | null = null

    addTickInputsAndMakePacket(inputs: InputsUnit): ArrayBuffer {
        this.tickInputsHistory.unshift(inputs)
        this.inputSeqAtHeadOfHistory += 1

        const send: any[] = [ this.inputSeqAtHeadOfHistory ]
        for (let i = 0; i < this.tickInputsHistory.length; ++i) {
            let historyItem = this.tickInputsHistory[i]
            if (this.ackedInputSeq !== null && this.inputSeqAtHeadOfHistory - i <= this.ackedInputSeq) {
                break
            }
            send.push(historyItem)
        }

        return textEncoder.encode(JSON.stringify(send)).buffer
    }

    ackInputSeq(seq: number): void {
        this.ackedInputSeq = seq
    }

    resetConnection(): void {
        this.tickInputsHistory = ['reset']
        this.inputSeqAtHeadOfHistory += 1
    }
}

export class InputsReceiver {
    private catchUpCombinedInputs: InputsUnit | null = null
    private guessedInputs: number = 0

    private ackedInputSeq: number = 0
    private inputsBuffer: InputsUnit[] = []
    private currentInputs: InputsUnit = newInputsUnit()
    private targetInputsBufferSize: number = 8
    private confirmed: boolean = false

    private readonly playerId: string // only needed for logs

    constructor(playerId: string) {
        this.playerId = playerId
    }

    getCurrentInputs(): InputsUnit {
        return this.currentInputs
    }
    getClientTimeDilation(): number {
        return Math.sign(this.inputsBuffer.length - this.targetInputsBufferSize + 1)
    }
    getAckedInputSeq(): number {
        return this.ackedInputSeq
    }

    receiveInputsPacket(packet: ArrayBuffer) {
        const recv: InputHistoryItem[] = JSON.parse(textDecoder.decode(packet))
        const mostRecentSeq: number = recv.shift() as any

        const amountToTake = mostRecentSeq - this.ackedInputSeq
        this.ackedInputSeq = mostRecentSeq

        let items = recv.slice(0, amountToTake)

        trace('Amount to take', amountToTake)
        trace('Acked input seq', this.ackedInputSeq)

        trace(`Inputs buffer size (${this.playerId})`, this.inputsBuffer.length)

        while (items.length > 0) {
            const item = items.pop()!
            if (item === 'reset') {
                log(`Client "${this.playerId}" sent a reset, unconfirming`)
                this.inputsBuffer.length = 0
                this.guessedInputs = 0
                this.catchUpCombinedInputs = null
                this.confirmed = false
            } else {
                this.inputsBuffer.push(item)
            }
        }

        trace(`Inputs buffer size (${this.playerId})`, this.inputsBuffer.length)
    }

    tick() {
        if (this.inputsBuffer.length > 0 && this.guessedInputs > 0) {
            log(`Combining ${this.guessedInputs} inputs for this "${this.playerId}"`)
            if (this.catchUpCombinedInputs === null) {
                this.catchUpCombinedInputs = newInputsUnit()
            }
        }

        while (this.inputsBuffer.length > 0 && this.guessedInputs > 0) {
            const inputs = this.inputsBuffer.shift()!
            this.guessedInputs--
            addInputsUnits(this.catchUpCombinedInputs!, this.catchUpCombinedInputs!, inputs)
        }

        if (this.inputsBuffer.length > 0) {
            if (this.catchUpCombinedInputs !== null) {
                addInputsUnits(this.currentInputs, this.catchUpCombinedInputs, this.inputsBuffer.shift()!)
                this.catchUpCombinedInputs = null
            } else {
                this.currentInputs = this.inputsBuffer.shift()!
            }

            if (!this.confirmed) {
                this.confirmed = true
                log(`Confirmed this "${this.playerId}"`)
            }
        } else if (this.confirmed) {
            this.guessedInputs++
            this.currentInputs.mouseDelta[0] = 0
            this.currentInputs.mouseDelta[1] = 0
            if (this.guessedInputs > TICKS_PER_SECOND) {
                this.currentInputs.clicking = false
            }
        }

        trace(`Guessed inputs (${this.playerId})`, this.guessedInputs)
    }
}
