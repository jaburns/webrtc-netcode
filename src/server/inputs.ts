import { addInputsUnits, InputHistoryItem, InputsUnit, newInputsUnit } from '../shared/inputs.js'
import { textDecoder, log, TICKS_PER_SECOND, trace } from '../shared/utils.js'

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
        if (this.inputsBuffer.length > 1 && this.guessedInputs > 0) {
            log(`Combining ${this.guessedInputs} inputs for this "${this.playerId}". Available: ${this.inputsBuffer.length}`)
            if (this.catchUpCombinedInputs === null) {
                this.catchUpCombinedInputs = newInputsUnit()
            }
        }

        while (this.inputsBuffer.length > 1 && this.guessedInputs > 0) {
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
