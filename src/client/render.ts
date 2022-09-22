import { GameState } from '../shared/state.js'
import { PLAYER_RADIUS } from '../shared/utils.js'

let ctx: CanvasRenderingContext2D

export const renderInit = (canvasCtx: CanvasRenderingContext2D): void => {
    ctx = canvasCtx
}

export const renderGame = (state: GameState): void => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.strokeStyle = '#fff'

    for (const id in state.players) {
        const player = state.players[id]

        ctx.beginPath()
        ctx.arc(player.pos[0], player.pos[1], PLAYER_RADIUS, 0, 2 * Math.PI)
        ctx.stroke()

        const dx = 0.5 * PLAYER_RADIUS * Math.cos(player.theta)
        const dy = 0.5 * PLAYER_RADIUS * Math.sin(player.theta)
        ctx.beginPath()
        ctx.arc(player.pos[0] + dx, player.pos[1] + dy, 0.5 * PLAYER_RADIUS, 0, 2 * Math.PI)
        ctx.stroke()
    }
}
