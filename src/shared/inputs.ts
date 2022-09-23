import { vec2 } from 'gl-matrix'
import { textEncoder, textDecoder } from './utils.js'

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

export interface InputsPacket {
    unit: InputsUnit | 'reset',
}

export const serializeInputsPacket = (state: InputsPacket): ArrayBuffer => {
    return textEncoder.encode(JSON.stringify(state)).buffer
}

export const deserializeInputsPacket = (buffer: ArrayBuffer): InputsPacket => {
    return JSON.parse(textDecoder.decode(buffer))
}
