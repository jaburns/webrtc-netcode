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
    out.mouseDelta[0] = a.mouseDelta[0] + b.mouseDelta[0]
    out.mouseDelta[1] = a.mouseDelta[1] + b.mouseDelta[1]
    out.clicking = a.clicking || b.clicking
    return out
}
