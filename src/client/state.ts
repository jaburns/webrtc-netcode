import { GameState } from '../shared/state.js'
import { textDecoder, trace } from '../shared/utils.js'

export class StateUpdateReceiver {
    private localTimeDilation: number = 0
    private ackedInputSeq: number = 0
    private stateBuffer: GameState[] = []
    private readonly targetStateBufferSize: number = 8
    private newestConsumedServerTick: number = 0
    private newestSeenServerTick: number = 0

    getLocalTimeDilation (): number {
        return this.localTimeDilation
    }
    getRemoteTimeDilation(): number {
        return Math.sign(this.targetStateBufferSize - this.stateBuffer.length - 1)
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

        trace('State buffer size', this.stateBuffer.length)
    }

    maybeGetNewState (): GameState | null {
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
