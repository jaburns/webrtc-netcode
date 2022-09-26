import { GameState } from '../shared/state.js'
import { textDecoder, trace } from '../shared/utils.js'

const MAX_TARGET_BUFFER_SIZE = 32

export class StateUpdateReceiver {
    private localTimeDilation: number = 0
    private ackedInputSeq: number = 0
    private stateBuffer: GameState[] = []
    private newestConsumedServerTick: number = 0
    private newestSeenServerTick: number = 0

    private targetBufferSize: number = 2
    private bufferSizeHistory: number[] = []
    private canIncreaseTargetSize: boolean = false

    getLocalTimeDilation (): number {
        return this.localTimeDilation
    }
    getRemoteTimeDilation(): number {
        return Math.sign(this.targetBufferSize - this.stateBuffer.length - 1)
    }
    getAckedInputSeq (): number {
        return this.ackedInputSeq
    }

    receivePackets (packets: ArrayBuffer[]): void {
        const data = packets.map(bytes => {
            trace('State packet size', bytes.byteLength)
            return JSON.parse(textDecoder.decode(bytes))
        })

        for (const [state, ackedInputSeq, timeDilation] of data) {
            if (state.serverTick > this.newestSeenServerTick) {
                this.newestSeenServerTick = state.serverTick;
                this.ackedInputSeq = ackedInputSeq
                this.localTimeDilation = timeDilation
            }
        }

        this.stateBuffer.push(...data.map(x => x[0]))
        this.stateBuffer = this.stateBuffer.filter((item, pos) =>
            this.stateBuffer.findIndex(x => x.serverTick === item.serverTick) === pos
        )
        this.stateBuffer.sort((a, b) => a.serverTick - b.serverTick)

        while (this.stateBuffer.length > 0 && this.stateBuffer[0].serverTick <= this.newestConsumedServerTick) {
            this.stateBuffer.shift()
        }
    }

    maybeGetNewState (): GameState | null {
        trace('State buffer size', this.stateBuffer.length)
        trace('Target state buffer size', this.targetBufferSize)

        // Handle dynamic buffer size
        {
            this.bufferSizeHistory.push(this.stateBuffer.length)
            if (this.bufferSizeHistory.length > 60) {
                this.bufferSizeHistory.shift()

                if (this.targetBufferSize > 1) {
                    const halfTargetSize = (this.targetBufferSize / 2) | 0
                    let foundSmallBuffer = false
                    for (let i = 0; i < this.bufferSizeHistory.length; ++i) {
                        if (this.bufferSizeHistory[i] <= halfTargetSize) {
                            foundSmallBuffer = true
                            break
                        }
                    }
                    if (!foundSmallBuffer) {
                        this.bufferSizeHistory.length = 0
                        this.targetBufferSize /= 2
                    }
                }
            }

            if (
                this.stateBuffer.length === 0 &&
                this.targetBufferSize < MAX_TARGET_BUFFER_SIZE &&
                this.canIncreaseTargetSize
            ) {
                this.targetBufferSize *= 2
                this.canIncreaseTargetSize = false
            }

            if (this.stateBuffer.length >= this.targetBufferSize) {
                this.canIncreaseTargetSize = true
            }
        }

        const state = this.stateBuffer.shift() ?? null
        if (state !== null) {
            this.newestConsumedServerTick = state.serverTick
        }
        return state
    }

    resetConnection(): void {
        this.stateBuffer.length = 0
    }
}
