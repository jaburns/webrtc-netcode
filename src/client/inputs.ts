import { InputsUnit, newInputsUnit } from '../shared/inputs.js'

let curFrameInputs = newInputsUnit()

export const bindInputsListeners = (canvas: HTMLCanvasElement): void => {
    canvas.onmousedown = () => {
        if (document.pointerLockElement !== canvas) {
            canvas.requestPointerLock()
        } else {
            curFrameInputs.clicking = true
        }
    }

    canvas.onmouseup = () => {
        if (document.pointerLockElement !== canvas) return
        curFrameInputs.clicking = false
    }

    canvas.onmousemove = e => {
        if (document.pointerLockElement !== canvas) return
        curFrameInputs.mouseDelta[0] += e.movementX
        curFrameInputs.mouseDelta[1] += e.movementY
    }
}

export const consumeAccumulatedInputs = (): InputsUnit => {
    const result = curFrameInputs
    curFrameInputs = newInputsUnit()
    curFrameInputs.clicking = result.clicking
    return result
}
