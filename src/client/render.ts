import { GameState, PlayerState } from '../shared/state.js'
import { consumeLogs, getTraces, lerpAngle, lerpVec2, PLAYER_RADIUS, Vec2 } from '../shared/utils.js'

let ctx: CanvasRenderingContext2D
let debugInfoDiv: HTMLDivElement

export const renderInit = (
    canvasCtx: CanvasRenderingContext2D,
    debugInfoDivElem: HTMLDivElement,
): void => {
    ctx = canvasCtx
    debugInfoDiv = debugInfoDivElem
}

export const renderGame = (
    state0: GameState,
    state1: GameState,
    remoteLerp: number,
    localPlayer0: PlayerState,
    localPlayer1: PlayerState,
    localLerp: number,
): void => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const vec2: Vec2 = [0, 0]

    ctx.strokeStyle = '#f99'
    for (const id in state1.players) {
        if (!(id in state0.players)) continue
        const player0 = state0.players[id]
        const player1 = state1.players[id]
        renderPlayer(
            lerpVec2(vec2, player0.pos, player1.pos, remoteLerp),
            lerpAngle(player0.theta, player1.theta, remoteLerp),
        )
    }

    ctx.strokeStyle = '#9f9'
    renderPlayer(
        lerpVec2(vec2, localPlayer0.pos, localPlayer1.pos, localLerp),
        lerpAngle(localPlayer0.theta, localPlayer1.theta, localLerp),
    )
}

const renderPlayer = (pos: Vec2, theta: number): void => {
    ctx.beginPath()
    ctx.arc(pos[0], pos[1], PLAYER_RADIUS, 0, 2 * Math.PI)
    ctx.stroke()

    const dx = 0.5 * PLAYER_RADIUS * Math.cos(theta)
    const dy = 0.5 * PLAYER_RADIUS * Math.sin(theta)
    ctx.beginPath()
    ctx.arc(pos[0] + dx, pos[1] + dy, 0.5 * PLAYER_RADIUS, 0, 2 * Math.PI)
    ctx.stroke()
}

export const renderDebug = (): void => {
    let html = ''
    const traces = getTraces()
    for (const k in traces) {
        html += `<p>${k} = ${traces[k].toString()}</p>`
    }
    debugInfoDiv.innerHTML = html

    consumeLogs().forEach(x => console.log(x))
}
