import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { LimitWindow, SceneState, Snapshot, TurnInfo } from '../types'

const snap = atom(
  { plugin: 'neon-limity', key: 'snap' } as const,
  { limits: [], ctxWindow: 0, startedAt: 0 } as Snapshot,
  { shape: 'snap-2' },
)
const turn = atom(
  { plugin: 'neon-limity', key: 'turn' } as const,
  { prompts: 0, cacheRead: 0, cacheWrite: 0, uncached: 0 } as TurnInfo,
  { shape: 'turn-2' },
)
const scene = atom(
  { plugin: 'neon-limity', key: 'scene' } as const,
  { activity: 'think', agents: 0, isNapping: false } as SceneState,
  { shape: 'scene-1' },
)
const isHidden = atom({ plugin: 'neon-limity', key: 'isHidden' } as const, false)
const isWorking = atom({ plugin: 'neon-limity', key: 'isWorking' } as const, false)

const NAP_AFTER_MS = 15 * 60 * 1000
const MISSION_MIN_SEC = 45
const MISSION_MIN_TOOLS = 5

// ── Sunset palette ────────────────────────────────────────────────
const PINK = '#FF2E97'
const ORANGE = '#FF9F1C'
const TEAL = '#2DE2E6'
const VIOLET = '#B57BFF'
const SUN = '#FFD319'
const CLAUDE = '#D97757'
const SHIRT = '#0FA3B1'
const SHIRT_DARK = '#0B6E78'
const MONEY = '#3CFF7A'
const CARD_BG = '#170B2B'
const TRACK = '#3A2657'
const MUTED = '#B9A6D9'
const RED = '#FF3B3B'

// ── Sprites ───────────────────────────────────────────────────────
// Working: wide flat body, black shades with cyan glints, arms out
const OCTO = [
  '..oOOOOOOOOOo..',
  '..OOOOOOOOOOO..',
  '..KKKKKOKKKKK..',
  '..KGKKKOKGKKK..',
  'OOOOOOOOOOOOOOO',
  'o.TPTTYTTPTTY.o',
  '..TTYTTPTTYTT..',
]
// Waiting: shades off (tucked on the shirt), Claude's own eyes showing
const OCTO_IDLE = [
  '..oOOOOOOOOOo..',
  '..OOOOOOOOOOO..',
  '..OOKOOOOOKOO..',
  '..OOKOOOOOKOO..',
  'OOOOOOOOOOOOOOO',
  'o.TPTKKOKKTTY.o',
  '..TTYTTPTTYTT..',
]
// Napping: eyes shut
const OCTO_SLEEP = [
  '..oOOOOOOOOOo..',
  '..OOOOOOOOOOO..',
  '..OOOOOOOOOOO..',
  '..OKKOOOOOKKO..',
  'OOOOOOOOOOOOOOO',
  'o.TPTKKOKKTTY.o',
  '..TTYTTPTTYTT..',
]
const LEGS_A = ['..O.O.....O.O..', '..O.O.....O.O..']
const LEGS_B = ['...O.O...O.O...', '..O...O.O...O..']
// Binoculars over the shades, for searching / reading
const BINO = ['..KKK...KKK....', '..KGK...KGK....', '..KKKKKKKKK....']
const LAPTOP = ['.SSSSSSS.', '.SLLLLLS.', '.SLLL..S.', '.SSSSSSS.', 'ggggggggg']
const TERMINAL = ['SSSSSSSSS', 'SVkVVVkkS', 'SVkVVkkkS', 'SkkkkkkkS', 'SSSSSSSSS', '...SSS...']
const BOAT = ['..WWWWWW..', 'NNNNNNNNNN', '.NEEEEEEN.']
const PALM = [
  '..DD..DDD.',
  '.DDDDDDDDD',
  'DD..DD...D',
  'D...DD....',
  '....D.....',
  '....D.....',
  '.....D....',
  '.....D....',
  '.....D....',
  '....D.....',
  '....D.....',
  '..DDDDDD..',
]
const PIX: Record<string, string> = {
  O: CLAUDE,
  o: '#B85A3D',
  K: '#0D0D12',
  G: TEAL,
  T: '#12B5C4',
  P: PINK,
  Y: SUN,
  D: '#12061F',
  S: '#2B2F45',
  L: TEAL,
  g: '#9AA0B8',
  k: '#0A0F14',
  V: MONEY,
  W: '#E8ECFF',
  N: '#1B2A6B',
  E: '#F4F4F4',
}

function pixels(map: string[], ox: number, oy: number, s: number): string {
  let out = ''
  map.forEach((row, y) => {
    row.split('').forEach((ch, x) => {
      const fill = PIX[ch]
      if (fill) out += `<rect x="${ox + x * s}" y="${oy + y * s}" width="${s}" height="${s}" fill="${fill}"/>`
    })
  })
  return out
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const c = [0, 1, 2].map(i => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t))
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

type Mode = 'idle' | 'nap' | 'think' | 'edit' | 'bash' | 'web'
type SceneOpts = {
  mode: Mode
  agents: boolean
  sunUsed: number
  ctx: number
  police: boolean
  wasted: boolean
  banner?: string
  cash?: string
}

const W = 176
const H = 64
const HORIZON = 44
const BEACH = 57
const MX = 70
const MS = 3
const MY = H - 9 * MS - 6

function legs(x: number, y: number, s: number, walking: boolean): string {
  const ly = y + OCTO.length * s
  if (!walking) return pixels(LEGS_A, x, ly, s)
  const step = '0.36s'
  return (
    `<g>${pixels(LEGS_A, x, ly, s)}` +
    `<animate attributeName="opacity" values="1;0" calcMode="discrete" dur="${step}" repeatCount="indefinite"/></g>` +
    `<g opacity="0">${pixels(LEGS_B, x, ly, s)}` +
    `<animate attributeName="opacity" values="0;1" calcMode="discrete" dur="${step}" repeatCount="indefinite"/></g>`
  )
}

function walker(body: string[], x: number, y: number, s: number, path: string, dur: string): string {
  return (
    `<g><animateTransform attributeName="transform" type="translate" values="${path}" dur="${dur}" repeatCount="indefinite"/>` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0; 0 -${s - 1}" calcMode="discrete" dur="0.36s" repeatCount="indefinite"/>` +
    pixels(body, x, y, s) +
    `</g>${legs(x, y, s, true)}</g>`
  )
}

function mascot(mode: Mode): string {
  if (mode === 'nap') return ''
  if (mode === 'think') return walker(OCTO, MX, MY, MS, '-40 0; 36 0; -40 0', '9s')
  if (mode === 'idle') {
    const lid = (cx: number) =>
      `<rect x="${MX + cx * MS}" y="${MY + 2 * MS}" width="${MS}" height="${2 * MS}" fill="${CLAUDE}"/>`
    return (
      `<g>${pixels(OCTO_IDLE, MX, MY, MS)}${legs(MX, MY, MS, false)}` +
      `<g opacity="0">${lid(4)}${lid(10)}` +
      `<animate attributeName="opacity" values="0;1;0" keyTimes="0;0.93;0.97" calcMode="discrete" dur="4.5s" repeatCount="indefinite"/>` +
      `</g></g>`
    )
  }
  // Busy at a prop: stands still, bobbing slightly while it works
  let prop = ''
  let face = ''
  if (mode === 'edit') {
    prop =
      pixels(LAPTOP, MX + 48, BEACH - 10, 2) +
      `<rect x="${MX + 58}" y="${BEACH - 6}" width="2" height="2" fill="${TEAL}">` +
      `<animate attributeName="opacity" values="1;0" calcMode="discrete" dur="0.6s" repeatCount="indefinite"/></rect>`
  } else if (mode === 'bash') {
    prop =
      pixels(TERMINAL, MX + 48, BEACH - 12, 2) +
      `<rect x="${MX + 52}" y="${BEACH - 6}" width="4" height="2" fill="${MONEY}">` +
      `<animate attributeName="opacity" values="1;0" calcMode="discrete" dur="0.5s" repeatCount="indefinite"/></rect>`
  } else if (mode === 'web') {
    face =
      `<g>${pixels(BINO, MX, MY + MS, MS)}` +
      `<animateTransform attributeName="transform" type="translate" values="0 0; 2 0; 0 0; -2 0; 0 0" dur="3s" repeatCount="indefinite"/></g>`
  }
  return (
    `<g><animateTransform attributeName="transform" type="translate" values="0 0; 0 -1" calcMode="discrete" dur="0.5s" repeatCount="indefinite"/>` +
    pixels(OCTO, MX, MY, MS) +
    face +
    `</g>${legs(MX, MY, MS, false)}${prop}`
  )
}

function hammock(): string {
  const post = `<rect x="64" y="34" width="2" height="${BEACH - 34}" fill="#12061F"/>`
  const net = `<path d="M22 37 Q 43 54 64 37" fill="none" stroke="${TEAL}" stroke-width="2"/>`
  const sleeper = pixels(OCTO_SLEEP, 29, 33, 2)
  const front = `<path d="M24 42 Q 43 55 62 42" fill="none" stroke="${PINK}" stroke-width="2"/>`
  const zzz =
    `<g font-family="monospace" font-weight="bold" fill="#FFFFFF">` +
    `<text x="58" y="30" font-size="6">z<animateTransform attributeName="transform" type="translate" values="0 0; 4 -8" dur="2.4s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="1;0" dur="2.4s" repeatCount="indefinite"/></text>` +
    `<text x="62" y="24" font-size="8">Z<animateTransform attributeName="transform" type="translate" values="0 0; 4 -8" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="1;0" dur="2.4s" begin="1.2s" repeatCount="indefinite"/></text></g>`
  return `<g><animateTransform attributeName="transform" type="rotate" values="-2 43 37; 2 43 37; -2 43 37" dur="3s" repeatCount="indefinite"/>${post}${net}${sleeper}${front}</g>${zzz}`
}

function weather(ctx: number): string {
  let out = ''
  if (ctx >= 70) {
    const cloud = (x: number, y: number, d: string) =>
      `<g opacity="0.85"><animateTransform attributeName="transform" type="translate" values="0 0; 24 0; 0 0" dur="${d}" repeatCount="indefinite"/>` +
      `<rect x="${x + 4}" y="${y}" width="18" height="4" fill="#5B4A7A"/><rect x="${x}" y="${y + 4}" width="28" height="5" fill="#4A3B66"/></g>`
    out += cloud(30, 6, '14s') + cloud(100, 12, '18s')
  }
  if (ctx >= 90) {
    out += `<rect width="${W}" height="${H}" fill="#0A0418" opacity="0.3"/>`
    let drops = ''
    for (let i = 0; i < 22; i++) {
      const x = (i * 37) % W
      const y = (i * 23) % H
      drops += `<rect x="${x}" y="${y - H}" width="1" height="4" fill="#9FB4FF" opacity="0.7"/>`
    }
    out +=
      `<g><animateTransform attributeName="transform" type="translate" values="0 0; -6 ${H}" dur="0.7s" repeatCount="indefinite"/>${drops}</g>` +
      `<g><animateTransform attributeName="transform" type="translate" values="0 ${H / 2}; -6 ${H * 1.5}" dur="0.7s" repeatCount="indefinite"/>${drops}</g>`
  }
  return out
}

function police(): string {
  const x = 0
  const y = HORIZON - 7
  return (
    `<g><animateTransform attributeName="transform" type="translate" values="${W + 10} 0; -40 0" dur="7s" repeatCount="indefinite"/>` +
    pixels(BOAT, x, y, 2) +
    `<rect x="${x + 6}" y="${y - 2}" width="4" height="2" fill="${RED}"><animate attributeName="fill" values="${RED};#2E6BFF" calcMode="discrete" dur="0.3s" repeatCount="indefinite"/></rect>` +
    `<rect x="${x + 10}" y="${y - 2}" width="4" height="2" fill="#2E6BFF"><animate attributeName="fill" values="#2E6BFF;${RED}" calcMode="discrete" dur="0.3s" repeatCount="indefinite"/></rect>` +
    `</g>`
  )
}

function buildScene(o: SceneOpts): string {
  const u = Math.max(0, Math.min(1, o.sunUsed / 100))
  const skyTop = mix('#1A0B3D', '#05030F', u)
  const skyMid = mix('#7A1E8C', '#1B0B33', u)
  const skyLow = mix('#FF5E7E', '#2A1240', u)
  const sunY = 26 + u * 42
  const starOp = (0.35 + 0.65 * u).toFixed(2)
  const stars = [[8, 4], [30, 9], [52, 3], [70, 12], [96, 6], [150, 4], [168, 10], [130, 2], [112, 14], [20, 16]]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="2" fill="#FFFFFF" opacity="${starOp}"/>`)
    .join('')
  const stripes = [14, 9, 5, 2]
    .map((d, i) => `<rect x="0" y="${sunY + 22 - d - 6}" width="${W}" height="${1 + i * 0.6}" fill="black"/>`)
    .join('')
  const moon = u > 0.85 ? `<circle cx="150" cy="12" r="5" fill="#F4E9FF"/><circle cx="152" cy="10" r="5" fill="${skyTop}"/>` : ''
  const waves = [[118, 48, 28], [124, 52, 16], [20, 50, 18], [90, 53, 10]]
    .map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="2" fill="${PINK}" opacity="${(0.55 * (1 - u * 0.7)).toFixed(2)}"/>`)
    .join('')

  const world =
    `<rect width="${W}" height="${HORIZON}" fill="url(#sky)"/>` +
    stars +
    moon +
    `<circle cx="148" cy="${sunY}" r="22" fill="url(#sun)" mask="url(#cut)" clip-path="url(#above)"/>` +
    `<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#sea)"/>` +
    waves +
    (o.police ? police() : '') +
    `<rect y="${BEACH}" width="${W}" height="${H - BEACH}" fill="#3A1A3F"/>` +
    `<rect y="${BEACH}" width="${W}" height="1" fill="#6B2E63"/>` +
    pixels(PALM, 6, HORIZON - PALM.length * 3 + 2, 3) +
    (o.mode === 'nap' ? hammock() : '') +
    (o.agents ? walker(OCTO, 22, H - 9 * 2 - 6, 2, '0 0; 14 0; 0 0', '4s') : '') +
    mascot(o.mode) +
    weather(o.ctx)

  const cash = o.cash
    ? `<text x="${MX + 22}" y="${MY - 2}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="9" fill="${MONEY}" stroke="#0A0418" stroke-width="0.6">${o.cash}` +
      `<animateTransform attributeName="transform" type="translate" values="0 0; 0 -6" dur="2.5s" fill="freeze"/>` +
      `<animate attributeName="opacity" values="1;1;0" keyTimes="0;0.6;1" dur="2.5s" fill="freeze"/></text>`
    : ''
  const banner = o.banner
    ? `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="5s" fill="freeze"/>` +
      `<rect x="0" y="2" width="${W}" height="19" fill="#0A0418" opacity="0.6"/>` +
      `<text x="${W / 2}" y="17" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="15" fill="${SUN}" stroke="#3A1500" stroke-width="0.8" letter-spacing="0.5">${o.banner}</text></g>`
    : ''
  const wasted = o.wasted
    ? `<rect x="0" y="20" width="${W}" height="22" fill="#000000" opacity="0.55"/>` +
      `<text x="${W / 2}" y="37" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="18" fill="#D7263D" letter-spacing="1">WASTED</text>`
    : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">` +
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${skyTop}"/><stop offset="0.55" stop-color="${skyMid}"/><stop offset="1" stop-color="${skyLow}"/>` +
    `</linearGradient>` +
    `<linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${SUN}"/><stop offset="1" stop-color="${PINK}"/>` +
    `</linearGradient>` +
    `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${mix('#1B2C6B', '#0A0F2A', u)}"/><stop offset="1" stop-color="#0A1030"/>` +
    `</linearGradient>` +
    `<mask id="cut"><rect width="${W}" height="${H}" fill="white"/>${stripes}</mask>` +
    `<clipPath id="above"><rect width="${W}" height="${HORIZON}"/></clipPath>` +
    `<filter id="gray"><feColorMatrix type="saturate" values="0"/></filter>` +
    `</defs>` +
    `<g${o.wasted ? ' filter="url(#gray)"' : ''}>${world}</g>` +
    cash +
    banner +
    wasted +
    `</svg>`
  )
}

function ring(pct: number, color: string): string {
  const r = 10
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">` +
    `<circle cx="14" cy="14" r="${r}" fill="none" stroke="${TRACK}" stroke-width="4"/>` +
    `<circle cx="14" cy="14" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" ` +
    `stroke-dasharray="${((p / 100) * c).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 14 14)"/>` +
    `<circle cx="14" cy="14" r="3" fill="${color}" opacity="0.9"/>` +
    `</svg>`
  )
}

// ── Helpers ───────────────────────────────────────────────────────
function label(kind: string): { name: string; sub: string; color: string } {
  if (kind === 'five_hour') return { name: 'ZDROWIE', sub: '5h', color: PINK }
  if (kind === 'seven_day') return { name: 'PANCERZ', sub: '7d', color: VIOLET }
  if (kind === 'spend_limit') return { name: 'GOTÓWKA', sub: 'wydatki', color: SUN }
  return { name: kind.toUpperCase(), sub: 'limit', color: ORANGE }
}

function left(w: LimitWindow): number {
  return Math.max(0, Math.min(100, Math.round(100 - w.percentUsed)))
}

function heat(base: string, used: number): string {
  if (used >= 85) return RED
  if (used >= 60) return ORANGE
  return base
}

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${fmtPct(Math.round(n / 100_000) / 10)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

function fmtDur(ms: number): string {
  let min = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(min / 1440)
  min -= d * 1440
  const h = Math.floor(min / 60)
  const m = min % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function resetIn(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  const at = Date.parse(resetsAt)
  return Number.isFinite(at) ? fmtDur(at - now) : ''
}

function shortModel(m?: string): string {
  if (!m) return ''
  return m.replace(/^claude-/, '').replace(/\[.*\]$/, '').replace(/-\d{8}$/, '')
}

function effortStyle(effort?: string): { label: string; color: string } | undefined {
  if (!effort) return undefined
  const map: Record<string, { label: string; color: string }> = {
    low: { label: 'low', color: TEAL },
    medium: { label: 'med', color: SUN },
    high: { label: 'high', color: ORANGE },
    xhigh: { label: 'xhigh', color: PINK },
    max: { label: 'MAX', color: RED },
  }
  return map[effort] ?? { label: effort, color: VIOLET }
}

function baseName(p?: string): string {
  if (!p) return 'Claude'
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? 'Claude'
}

function fiveHour(limits: LimitWindow[]): LimitWindow | undefined {
  return limits.find(l => l.kind === 'five_hour') ?? limits[0]
}

// Wanted stars: more used in the 5h window = more heat
function stars(limits: LimitWindow[]): number {
  const hot = fiveHour(limits)
  if (!hot) return 0
  return Math.min(5, Math.floor(hot.percentUsed / 20))
}

function isWasted(limits: LimitWindow[]): boolean {
  return limits.some(l => left(l) <= 0)
}

function mission(limits: LimitWindow[]): { text: string; color: string } {
  if (limits.length === 0) return { text: 'CZEKAM NA PIERWSZĄ ODPOWIEDŹ...', color: TEAL }
  const worst = Math.min(...limits.map(left))
  if (worst <= 0) return { text: 'WASTED — czekaj na reset', color: RED }
  if (worst <= 15) return { text: 'POLICJA NA OGONIE — zwolnij', color: PINK }
  if (worst <= 40) return { text: 'UWAŻAJ — zapasy się kończą', color: ORANGE }
  return { text: 'MISJA TRWA — luz, jedziemy', color: TEAL }
}

const ACTIVITY_TEXT: Record<SceneState['activity'], string> = {
  think: 'CLAUDE W TRASIE — robota wre...',
  edit: 'CLAUDE PISZE KOD NA LAPTOPIE...',
  bash: 'CLAUDE HAKUJE W TERMINALU...',
  web: 'CLAUDE SZUKA TROPÓW PRZEZ LORNETKĘ...',
}

function classify(tool: string): SceneState['activity'] | 'agent' {
  const t = tool.toLowerCase()
  if (t === 'agent' || t === 'task') return 'agent'
  if (['edit', 'write', 'multiedit', 'notebookedit'].includes(t)) return 'edit'
  if (['bash', 'powershell'].includes(t)) return 'bash'
  if (
    ['read', 'grep', 'glob', 'websearch', 'webfetch'].includes(t) ||
    /browser|firecrawl|fetch|search|scrape|navigate/.test(t)
  )
    return 'web'
  return 'think'
}

type Measured = {
  rateLimits: LimitWindow[]
  cost?: { usd: number }
  context: { tokens?: number; window: number; percent?: number }
}

async function refresh($: any, m: Measured, startedAt?: number) {
  await update($, snap, prev => ({
    limits: m.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
    usd: m.cost?.usd,
    ctxPct: m.context.percent,
    ctxTokens: m.context.tokens,
    ctxWindow: m.context.window,
    startedAt: startedAt ?? prev.startedAt,
  }))
  const parts = m.rateLimits.map(l => `${label(l.kind).sub} ${left(l)}%`)
  const s = stars(m.rateLimits)
  $.ui.status(parts.length ? `${'★'.repeat(s)}${'☆'.repeat(5 - s)} ${parts.join(' · ')}` : undefined)
}

async function pull($: any) {
  const u = await $.session.usage()
  await refresh($, u, u.startedAt)
  const [model, prompts, root] = await Promise.all([$.session.model(), $.session.turns(), $.session.root()])
  await update($, turn, t => ({ ...t, model, prompts, root }))
  await update($, scene, sc => ({ ...sc, lastUsd: sc.lastUsd ?? u.cost?.usd }))
}

function tipFor(s: Snapshot, t: TurnInfo, now: number): string {
  const five = fiveHour(s.limits)
  const tips: string[] = [
    'Idę po kokosa, zaraz wracam 🥥',
    'Krótszy prompt = mniej tokenów = dłuższa misja.',
    'Ta koszula była na promocji w Neon Beach Outlet.',
    'Kliknij /limity, żeby schować HUD.',
  ]
  if (five) {
    const r = resetIn(five.resetsAt, now)
    tips.push(`Zostało ${left(five)}% limitu 5h${r ? `, reset za ${r}` : ''}.`)
    if (left(five) < 30 && r) tips.push(`Mało paliwa. Za ${r} pełny bak — idź na kawę ☕`)
  }
  if (s.ctxPct !== undefined) {
    tips.push(
      s.ctxPct >= 80
        ? `Kontekst ${s.ctxPct}% — pora na /compact, bo nadciąga burza.`
        : `Kontekst ${s.ctxPct}% — spokojna woda.`,
    )
  }
  const total = t.cacheRead + t.cacheWrite + t.uncached
  if (total > 0) tips.push(`Cache trafia w ${Math.round((t.cacheRead / total) * 100)}% — tanio jak w outlecie.`)
  return tips[Math.floor(Math.random() * tips.length)] ?? tips[0]!
}

function setActivity($: any, inFlight: Map<string, SceneState['activity']>) {
  const vals = [...inFlight.values()]
  const act = vals.length ? vals[vals.length - 1]! : 'think'
  return update($, scene, sc => (sc.activity === act ? sc : { ...sc, activity: act }))
}

function flash($: any, field: 'banner' | 'cash', text: string, ms: number, now: number) {
  void update($, scene, sc => ({ ...sc, [field]: { text, until: now + ms } }))
  $.clock.after(ms + 100, () => {
    void update($, scene, sc => ({ ...sc, [field]: undefined })).catch(() => undefined)
  })
}

function scheduleNap($: any, ms: number) {
  return $.clock.after(ms, () => {
    void update($, scene, x => ({ ...x, isNapping: true })).catch(() => undefined)
  })
}

// ── Hooks ─────────────────────────────────────────────────────────
export const register: Register = on => {
  const warned = new Set<string>()
  const inFlight = new Map<string, SceneState['activity']>()
  let turnStart = 0
  let turnTools = 0
  let napTimer: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'limity',
      description: 'Pokaż / schowaj neonowy HUD limitów nad polem wiadomości',
    })
    await pull($)

    return next(e)
  })

  on('command.run', { command: 'limity' }, async $ => {
    await pull($)
    const hidden = await update($, isHidden, v => !v)

    return { text: hidden ? 'HUD schowany. /limity pokaże go znowu.' : 'HUD widoczny.' }
  })

  on('prompt.submit', async ($, e, next) => {
    // HUD must never block a prompt
    turnStart = await $.clock.now().catch(() => turnStart)
    turnTools = 0
    inFlight.clear()
    napTimer?.cancel()
    napTimer = undefined
    await update($, isWorking, () => true).catch(() => undefined)
    await update($, scene, sc => ({ ...sc, activity: 'think', isNapping: false })).catch(() => undefined)
    await update($, turn, t => ({ ...t, prompts: t.prompts + 1 })).catch(() => undefined)

    return next(e)
  })

  // What Claude is doing right now drives the mascot's prop
  on('tool.call', async ($, e, next) => {
    const kind = classify(e.tool)
    turnTools += 1
    if (kind === 'agent') {
      await update($, scene, sc => ({ ...sc, agents: sc.agents + 1 })).catch(() => undefined)
      try {
        return await next(e)
      } finally {
        await update($, scene, sc => ({ ...sc, agents: Math.max(0, sc.agents - 1) })).catch(() => undefined)
      }
    }
    inFlight.set(e.tool_use_id, kind)
    await setActivity($, inFlight).catch(() => undefined)
    try {
      return await next(e)
    } finally {
      inFlight.delete(e.tool_use_id)
      await setActivity($, inFlight).catch(() => undefined)
    }
  })

  // Which model answers and at what effort: read off each main-loop request
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      const effort = e.effort === undefined ? undefined : String(e.effort)
      void read($, turn)
        .then(t =>
          t.model === e.model && t.effort === effort
            ? undefined
            : update($, turn, x => ({ ...x, model: e.model, effort })),
        )
        .catch(() => undefined)
    }

    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      inFlight.clear()
      await update($, isWorking, () => false)
      const now = await $.clock.now()
      const secs = turnStart ? Math.round((now - turnStart) / 1000) : 0
      const u = e.usage
      const total = u ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : 0
      await update($, turn, t => ({
        ...t,
        lastSec: turnStart ? secs : t.lastSec,
        hit: u && total > 0 ? Math.round((u.cache_read_input_tokens / total) * 100) : t.hit,
        model: u?.model ?? t.model,
        cacheRead: t.cacheRead + (u?.cache_read_input_tokens ?? 0),
        cacheWrite: t.cacheWrite + (u?.cache_creation_input_tokens ?? 0),
        uncached: t.uncached + (u?.input_tokens ?? 0),
      }))

      // Cash pickup: what this turn cost floats up over the mascot
      const usage = await $.session.usage()
      const usd = usage.cost?.usd
      const sc = await read($, scene)
      await update($, scene, x => ({ ...x, activity: 'think', lastUsd: usd ?? x.lastUsd }))
      if (usd !== undefined && sc.lastUsd !== undefined && usd - sc.lastUsd >= 0.005) {
        flash($, 'cash', `+$${(usd - sc.lastUsd).toFixed(2)}`, 2600, now)
      }

      // Mission passed: a long or busy turn earns the banner and the jingle
      if (e.reason === 'answer' && (secs >= MISSION_MIN_SEC || turnTools >= MISSION_MIN_TOOLS)) {
        flash($, 'banner', 'MISJA ZALICZONA', 5200, now)
        void $.audio.play({ asset: 'sounds/mission.wav' }).catch(() => undefined)
      }

      // Nap: no new prompt for a while and Claude dozes off on the hammock
      napTimer?.cancel()
      napTimer = scheduleNap($, NAP_AFTER_MS)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, e)
    for (const l of e.rateLimits) {
      const pct = left(l)
      for (const t of [0, 15, 40]) {
        if (pct > t) continue
        const id = `${l.kind}:${t}:${l.resetsAt ?? ''}`
        if (!warned.has(id)) {
          warned.add(id)
          $.ui.toast(
            t === 0
              ? `WASTED — limit ${label(l.kind).sub} wyczerpany`
              : `★ WANTED — limit ${label(l.kind).sub}: zostało ${pct}%`,
          )
          if (t === 0) void $.audio.play({ asset: 'sounds/wasted.wav' }).catch(() => undefined)
        }
        break
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const s = await read($, snap)
    const t = await read($, turn)
    const sc = await read($, scene)
    const now = await $.clock.now()
    const working = await read($, isWorking)
    const st = stars(s.limits)
    const wasted = isWasted(s.limits)

    const mode: Mode = working ? sc.activity : sc.isNapping ? 'nap' : 'idle'
    let m = mission(s.limits)
    if (!wasted && working) {
      m = {
        text: ACTIVITY_TEXT[sc.activity] + (sc.agents > 0 ? ` + ekipa (${sc.agents})` : ''),
        color: SUN,
      }
    } else if (!wasted && sc.isNapping) {
      m = { text: 'CLAUDE ŚPI NA HAMAKU — napisz coś, żeby go obudzić', color: VIOLET }
    }

    if (e.surface === 'terminal') {
      return terminalBand($, e, s, t, now, st, m)
    }

    const ui = $.ui.resolve(e) as any
    const { Box, Text, Svg, Button } = ui

    const sceneSvg = buildScene({
      mode,
      agents: sc.agents > 0,
      sunUsed: fiveHour(s.limits)?.percentUsed ?? 0,
      ctx: s.ctxPct ?? 0,
      police: st >= 4 && !wasted,
      wasted,
      banner: sc.banner && sc.banner.until > now ? sc.banner.text : undefined,
      cash: sc.cash && sc.cash.until > now ? sc.cash.text : undefined,
    })

    const gauge = (key: string, pct: number, color: string, big: string, small: string) => (
      <Box key={key} flexDirection="row" alignItems="center" gap={1} marginRight={3}>
        <Svg source={ring(pct, color)} alt={`${big} ${small}`} width={28} height={28} />
        <Text weight="bold" color="#FFFFFF">
          {big}
        </Text>
        <Text color={MUTED}>{small}</Text>
      </Box>
    )

    const gauges = []
    if (s.ctxPct !== undefined) {
      gauges.push(
        gauge(
          'ctx',
          s.ctxPct,
          heat(TEAL, s.ctxPct),
          `${s.ctxPct}%`,
          `ctx · ${fmtTokens(s.ctxTokens ?? 0)}/${fmtTokens(s.ctxWindow)}`,
        ),
      )
    }
    const cacheTotal = t.cacheRead + t.cacheWrite + t.uncached
    if (cacheTotal > 0) {
      const hitAll = Math.round((t.cacheRead / cacheTotal) * 100)
      gauges.push(
        gauge(
          'cache',
          hitAll,
          hitAll >= 70 ? MONEY : hitAll >= 40 ? SUN : ORANGE,
          `${hitAll}%`,
          `cache · ⇣ ${fmtTokens(t.cacheRead)} odczyt · ⇡ ${fmtTokens(t.cacheWrite)} zapis`,
        ),
      )
    }
    for (const l of s.limits) {
      const info = label(l.kind)
      const r = resetIn(l.resetsAt, now)
      gauges.push(
        gauge(
          l.kind,
          l.percentUsed,
          heat(info.color, l.percentUsed),
          `${fmtPct(l.percentUsed)}%`,
          `${info.sub}${r ? ` · ↻ ${r}` : ''} · zostało ${left(l)}%`,
        ),
      )
    }

    const head = [
      s.startedAt ? fmtDur(now - s.startedAt) : '',
      `${t.prompts} ${t.prompts === 1 ? 'prompt' : 'prompts'}`,
    ].filter(Boolean)
    const side = [
      t.lastSec !== undefined ? `last ${t.lastSec}s` : '',
      t.hit !== undefined ? `hit ${t.hit}%` : '',
    ].filter(Boolean)
    const eff = effortStyle(t.effort)

    return (
      <Box
        flexDirection="row"
        alignItems="center"
        borderStyle="round"
        borderColor={wasted ? RED : PINK}
        backgroundColor={CARD_BG}
        paddingX={2}
        paddingY={1}
        gap={2}
      >
        <Box flexDirection="column" flexGrow={1} gap={1}>
          <Box flexDirection="row" justifyContent="space-between" flexWrap="wrap">
            <Text>
              <Text weight="bold" italic color={PINK}>
                {baseName(t.root)}
              </Text>
              <Text color={MUTED}>{` · ${head.join(' · ')} · `}</Text>
              {s.usd !== undefined && (
                <Text weight="bold" color={MONEY}>
                  {`$${s.usd.toFixed(2)}`}
                </Text>
              )}
              <Text color={SUN}>{`  ${'★'.repeat(st)}`}</Text>
              <Text color={TRACK}>{'★'.repeat(5 - st)}</Text>
            </Text>
            <Box flexDirection="row" alignItems="center" gap={1}>
              {side.length > 0 && <Text color={MUTED}>{`${side.join(' · ')}  `}</Text>}
              {t.model && (
                <Text weight="bold" color="#FFFFFF" backgroundColor="#3A1F66">
                  {` ◆ ${shortModel(t.model)} `}
                </Text>
              )}
              {eff && (
                <Text weight="bold" color="#170B2B" backgroundColor={eff.color}>
                  {` effort ${eff.label} `}
                </Text>
              )}
            </Box>
          </Box>
          <Box flexDirection="row" alignItems="center" flexWrap="wrap">
            {gauges.length > 0 ? (
              gauges
            ) : (
              <Text color={MUTED} italic>
                Limity pojawią się po pierwszej odpowiedzi (tylko subskrypcja).
              </Text>
            )}
          </Box>
          <Text weight="bold" italic color={m.color}>
            {`▶ ${m.text}`}
          </Text>
        </Box>
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Svg
            source={sceneSvg}
            alt="Claude w koszuli hawajskiej na plaży o zachodzie słońca"
            width={W}
            height={H}
            isInteractive
          />
          <Button
            key="mascot"
            plain
            label="Zagadaj do Claude'a"
            onPress={() => {
              $.ui.toast(tipFor(s, t, now))
              if (sc.isNapping) void update($, scene, x => ({ ...x, isNapping: false })).catch(() => undefined)
            }}
          >
            <Text color={TEAL}>{sc.isNapping ? '💤 obudź Claude’a' : '💬 zagadaj do Claude’a'}</Text>
          </Button>
        </Box>
      </Box>
    )
  })
}

// ── Terminal fallback: ASCII mascot + bars ────────────────────────
function terminalBand(
  $: any,
  e: any,
  s: Snapshot,
  t: TurnInfo,
  now: number,
  st: number,
  m: { text: string; color: string },
) {
  const { Box, Text } = $.ui.resolve(e)
  const BAR = 20

  const shirt = (key: string, pattern: string) => (
    <Text key={key}>
      <Text color={CLAUDE}>{' ▐'}</Text>
      {pattern.split('').map((ch, i) =>
        ch === '✿' ? (
          <Text key={`${key}${i}`} backgroundColor={SHIRT} color={i % 4 === 0 ? PINK : SUN}>
            ✿
          </Text>
        ) : (
          <Text key={`${key}${i}`} backgroundColor={SHIRT} color={SHIRT_DARK}>
            ▒
          </Text>
        ),
      )}
      <Text color={CLAUDE}>{'▌ '}</Text>
    </Text>
  )

  const rows = s.limits.map(l => {
    const info = label(l.kind)
    const pct = left(l)
    const filled = Math.round((pct / 100) * BAR)
    const c = heat(info.color, l.percentUsed)
    const r = resetIn(l.resetsAt, now)
    return (
      <Text key={l.kind}>
        <Text bold italic color={info.color}>
          {info.name.padEnd(8)}
        </Text>
        <Text color={c}>{'█'.repeat(filled)}</Text>
        <Text dimColor>{'░'.repeat(BAR - filled)}</Text>
        <Text bold color={c}>
          {` ${String(pct).padStart(3)}%`}
        </Text>
        <Text dimColor italic>
          {r ? `  reset ${r}` : ''}
        </Text>
      </Text>
    )
  })

  return (
    <Box flexDirection="row" alignItems="center">
      <Box flexDirection="column" marginRight={2}>
        <Text color={CLAUDE}>{'  ▐▛████▜▌  '}</Text>
        <Text color={CLAUDE}>{'▝▜████████▛▘'}</Text>
        {shirt('s1', '✿▒✿▒✿▒✿▒')}
        {shirt('s2', '▒✿▒✿▒✿▒✿')}
        <Text color={CLAUDE}>{'   ▘▘  ▝▝   '}</Text>
      </Box>
      <Box flexDirection="column">
        <Text>
          <Text bold italic color={PINK}>
            {'NEON HUD  '}
          </Text>
          <Text bold color={SUN}>
            {'★'.repeat(st)}
          </Text>
          <Text dimColor>{'☆'.repeat(5 - st)}</Text>
          {s.usd !== undefined && (
            <Text bold italic color={MONEY}>
              {`   $${s.usd.toFixed(2)}`}
            </Text>
          )}
        </Text>
        {rows.length > 0 ? (
          rows
        ) : (
          <Text dimColor italic>
            Limity pojawią się po pierwszej odpowiedzi (tylko subskrypcja).
          </Text>
        )}
        {termInfo(Text, t)}
        <Text bold italic color={m.color}>
          {`▶ ${m.text}`}
        </Text>
      </Box>
    </Box>
  )
}

function termInfo(Text: any, t: TurnInfo) {
  const eff = effortStyle(t.effort)
  const total = t.cacheRead + t.cacheWrite + t.uncached
  return (
    <Text>
      {t.model && <Text bold>{`◆ ${shortModel(t.model)} `}</Text>}
      {eff && <Text color={eff.color}>{`effort ${eff.label}  `}</Text>}
      {total > 0 && (
        <Text color={MONEY}>
          {`cache ${Math.round((t.cacheRead / total) * 100)}% · ⇣${fmtTokens(t.cacheRead)} ⇡${fmtTokens(t.cacheWrite)}`}
        </Text>
      )}
    </Text>
  )
}
