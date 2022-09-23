import { InputsUnit, newInputsUnit } from '../shared/inputs.js'

let curFrameInputs = newInputsUnit()

export const bindInputsListeners = (canvas: HTMLCanvasElement): void => {
    document.onmousedown = () => {
        if (document.pointerLockElement !== canvas) {
            canvas.requestPointerLock()
        } else {
            curFrameInputs.clicking = true
        }
    }
    document.onmouseup = () => {
        if (document.pointerLockElement !== canvas) return
        curFrameInputs.clicking = false
    }
    if ('chrome' in window) {
        (window as any).onpointerrawupdate = (es: PointerEvent): void => {
            if (document.pointerLockElement !== canvas) return
            for (const e of es.getCoalescedEvents()) {
                handleMouseMoveEvent(e.movementX, e.movementY)
            }
        }
    } else {
        window.onmousemove = (e: MouseEvent): void => {
            if (document.pointerLockElement !== canvas) return
            handleMouseMoveEvent(e.movementX, e.movementY)
        }
    }
}
let lastMouseDx = 0
let lastMouseDy = 0
const handleMouseMoveEvent = (dx: number, dy: number): void => {
    if (Math.abs(dx) > 100 && dx * lastMouseDx < 0 || Math.abs(dy) > 100 && dy * lastMouseDy < 0) {
        return
    }
    lastMouseDx = dx
    lastMouseDy = dy
    curFrameInputs.mouseDelta[0] += dx
    curFrameInputs.mouseDelta[1] += dy
}

export const consumeAccumulatedInputs = (): InputsUnit => {
    const result = curFrameInputs
    curFrameInputs = newInputsUnit()
    curFrameInputs.clicking = result.clicking
    return result
}
