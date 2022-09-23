import { addInputsUnits, InputsUnit, newInputsUnit } from '../shared/inputs.js'
import { textDecoder, log, TICKS_PER_SECOND, trace } from '../shared/utils.js'

export class InputsReceiver {
    private catchUpCombinedInputs: InputsUnit | null = null
    private guessedInputs: number = 0

    private ackedInputSeq: number = 0
    private inputsBuffer: InputsUnit[] = []
    private currentInputs: InputsUnit = newInputsUnit()
    private readonly targetInputsBufferSize: number = 8
    private confirmed: boolean = false

    private readonly playerId: string // only needed for logs

    constructor (playerId: string) {
        this.playerId = playerId
    }

    getCurrentInputs (): InputsUnit {
        return this.currentInputs
    }

    getClientTimeDilation (): number {
        return Math.sign(this.inputsBuffer.length - this.targetInputsBufferSize + 1)
    }

    getAckedInputSeq (): number {
        return this.ackedInputSeq
    }

    receiveInputsPacket (packet: ArrayBuffer): void {
        const recv: any[] = JSON.parse(textDecoder.decode(packet))
        const mostRecentSeq: number = recv.shift()

        trace(`Receiving input seq (${this.playerId})`, mostRecentSeq)

        if (mostRecentSeq <= this.ackedInputSeq) {
            return
        }

        const amountToTake = mostRecentSeq - this.ackedInputSeq
        this.ackedInputSeq = mostRecentSeq

        const items = recv.slice(0, amountToTake)

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
                    clicking: item[0] !== 0,
                    mouseDelta: [item[1], item[2]],
                })
            }
        }

        trace(`Inputs buffer length (${this.playerId})`, this.inputsBuffer.length)
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
