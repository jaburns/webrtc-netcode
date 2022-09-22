import { vec2 } from 'gl-matrix'
import { GameState, PlayerState } from '../shared/state.js'
import { DebugInfoSet, lerpAngle, PLAYER_RADIUS } from '../shared/utils.js'

const vec2_0: vec2 = vec2.create()

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

    ctx.strokeStyle = '#f99'
    for (const id in state1.players) {
        if (!(id in state0.players)) continue
        const player0 = state0.players[id]
        const player1 = state1.players[id]
        renderPlayer(
            vec2.lerp(vec2_0, player0.pos, player1.pos, remoteLerp),
            lerpAngle(player0.theta, player1.theta, remoteLerp)
        )
    }

    ctx.strokeStyle = '#9f9'
    renderPlayer(
        vec2.lerp(vec2_0, localPlayer0.pos, localPlayer1.pos, localLerp),
        lerpAngle(localPlayer0.theta, localPlayer1.theta, localLerp)
    )
}

const renderPlayer = (pos: vec2, theta: number): void => {
    ctx.beginPath()
    ctx.arc(pos[0], pos[1], PLAYER_RADIUS, 0, 2 * Math.PI)
    ctx.stroke()

    const dx = 0.5 * PLAYER_RADIUS * Math.cos(theta)
    const dy = 0.5 * PLAYER_RADIUS * Math.sin(theta)
    ctx.beginPath()
    ctx.arc(pos[0] + dx, pos[1] + dy, 0.5 * PLAYER_RADIUS, 0, 2 * Math.PI)
    ctx.stroke()
}

export const renderDebugInfos = (clientInfo: DebugInfoSet, serverInfo: DebugInfoSet): void => {
    let html = ''
    for (const k in clientInfo) {
        html += `<p><b>[cli]</b> ${k} = ${clientInfo[k].toString()}</p>`
    }
    for (const k in serverInfo) {
        html += `<p><b>[ser]</b> ${k} = ${serverInfo[k].toString()}</p>`
    }
    debugInfoDiv.innerHTML = html
}
