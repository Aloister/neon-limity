export type LimitWindow = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = {
  limits: LimitWindow[]
  usd?: number
  ctxPct?: number
  ctxTokens?: number
  ctxWindow: number
  startedAt: number
}
export type TurnInfo = {
  lastSec?: number
  hit?: number
  model?: string
  effort?: string
  prompts: number
  root?: string
  cacheRead: number
  cacheWrite: number
  uncached: number
}
/** What the mascot is doing and the short-lived scene events. */
export type SceneState = {
  activity: 'think' | 'edit' | 'bash' | 'web'
  agents: number
  isNapping: boolean
  banner?: { text: string; until: number }
  cash?: { text: string; until: number }
  lastUsd?: number
  /** The current task's title, made from the prompt. */
  missionName?: string
  /** Radio station index into STATIONS, and the song playing on it. */
  radio: number
  song: string
}

declare module 'claude-code' {
  interface PluginState {
    'neon-limity': {
      snap: Shaped<Snapshot>
      turn: Shaped<TurnInfo>
      scene: Shaped<SceneState>
      isHidden: boolean
      isWorking: boolean
    }
  }
}
