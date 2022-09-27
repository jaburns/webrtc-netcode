import { vec2 } from 'gl-matrix'

export type InputHistoryItem = InputsUnit | 'reset'

export interface TickInputs {
    seq: number | null,
    inputs: InputsUnit,
}

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
