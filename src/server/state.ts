import { GameState } from '../shared/state.js'
import { textEncoder } from '../shared/utils.js'

export class StateUpdateSender {
    makeUpdatePacket (
        state: GameState,
        ackedInputSeq: number,
        timeDilation: number,
    ): ArrayBuffer {
        return textEncoder.encode(JSON.stringify([
            state,
            ackedInputSeq,
            timeDilation,
        ])).buffer
    }
}
