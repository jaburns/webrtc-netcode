import { addInputsUnits, InputsUnit, newInputsUnit, TickInputs } from '../shared/inputs.js'
import { textDecoder, log, TICKS_PER_SECOND, trace, BufferSizeCounter } from '../shared/utils.js'

export class InputsReceiver {
    private catchUpCombinedInputs: InputsUnit | null = null
    private guessedInputs: number = 0

    private ackedInputSeq: number = 0
    private inputsBuffer: TickInputs[] = []
    private currentInputs: TickInputs = { seq: null, inputs: newInputsUnit() }
    private readonly bufferSizeCounter: BufferSizeCounter = new BufferSizeCounter()

    private confirmed: boolean = false

    private readonly playerId: string // only needed for logs

    constructor (playerId: string) {
        this.playerId = playerId
    }

    getCurrentInputs (): TickInputs {
        return this.currentInputs
    }

    getClientTimeDilation (): number {
        return Math.sign(this.inputsBuffer.length - this.bufferSizeCounter.getTargetBufferSize() + 1)
    }

    getAckedInputSeq (): number {
        return this.ackedInputSeq
    }

    receiveInputsPacket (packet: ArrayBuffer): void {
        const recv: any[] = JSON.parse(textDecoder.decode(packet))
        let inputsSeq: number = recv.shift()

        trace(`Receiving input seq (${this.playerId})`, inputsSeq)

        if (inputsSeq <= this.ackedInputSeq) {
            return
        }

        const amountToTake = inputsSeq - this.ackedInputSeq
        this.ackedInputSeq = inputsSeq

        const items = recv.slice(0, amountToTake)
        inputsSeq -= amountToTake - 1

        while (items.length > 0) {
            const item = items.pop()!
            if (item === 0) {
                log(`Client "${this.playerId}" sent a reset, unconfirming`)
                this.inputsBuffer.length = 0
                this.guessedInputs = 0
                this.catchUpCombinedInputs = null
                this.confirmed = false
            } else {
                this.inputsBuffer.push({
                    seq: inputsSeq,
                    inputs: {
                        clicking: item[0] !== 0,
                        mouseDelta: [item[1], item[2]],
                    }
                })
            }
            inputsSeq++;
        }
    }

    tick (): void {
        if (this.inputsBuffer.length > 0 && this.guessedInputs > 0) {
            if (this.catchUpCombinedInputs === null) {
                this.catchUpCombinedInputs = newInputsUnit()
            }
        }

        while (this.inputsBuffer.length > 0 && this.guessedInputs > 0) {
            const inputs = this.inputsBuffer.shift()!
            this.guessedInputs--
            addInputsUnits(this.catchUpCombinedInputs!, this.catchUpCombinedInputs!, inputs.inputs)
        }

        this.bufferSizeCounter.recordBufferSize(this.inputsBuffer.length)

        trace(`Inputs buffer length (${this.playerId})`, this.inputsBuffer.length)
        trace(`Target inputs buffer length (${this.playerId})`, this.bufferSizeCounter.getTargetBufferSize())

        if (this.inputsBuffer.length > 0) {
            this.currentInputs = this.inputsBuffer.shift()!

            if (this.catchUpCombinedInputs !== null) {
                addInputsUnits(this.currentInputs.inputs, this.currentInputs.inputs, this.catchUpCombinedInputs)
                this.catchUpCombinedInputs = null
            }

            if (!this.confirmed) {
                this.confirmed = true
                log(`Confirmed this "${this.playerId}"`)
            }
        } else if (this.confirmed) {
            this.guessedInputs++
            this.currentInputs.inputs.mouseDelta[0] = 0
            this.currentInputs.inputs.mouseDelta[1] = 0
            this.currentInputs.seq = null
            if (this.guessedInputs > TICKS_PER_SECOND) {
                this.currentInputs.inputs.clicking = false
            }
        }

        trace(`Guessed inputs (${this.playerId})`, this.guessedInputs)
    }
}
