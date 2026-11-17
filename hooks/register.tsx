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
  { shape: 'scene-3' },
)
const isHidden = atom({ plugin: 'neon-limity', key: 'isHidden' } as const, false)
const isWorking = atom({ plugin: 'neon-limity', key: 'isWorking' } as const, false)

const NAP_AFTER_MS = 15 * 60 * 1000
const MISSION_MIN_SEC = 45
const MISSION_MIN_TOOLS = 5
const DRIVE_AFTER_MS = 20 * 1000

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

// ── Palms: a row of real ones on the sand ─────────────────────────
// Green fronds drooping both ways, coconuts, a curved banded trunk
const PALM_TREE = [
  '......L..L......',
  '...LLLLGGLLLL...',
  '.LLGGGGLLGGGGLL.',
  'LGG...GccG...GGL',
  'G.....cBbc.....G',
  '.......Bb.......',
  '.......bB.......',
  '.......Bb.......',
  '......Bb........',
  '......bB........',
  '......Bb........',
  '......bB........',
  '.....Bb.........',
  '.....bB.........',
  '.....Bb.........',
  '.....bB.........',
  '....bBBb........',
]
const PALM_PIX: Record<string, string> = {
  L: '#3FBF6F',
  G: '#1E7A48',
  c: '#5A3A1A',
  B: '#A8743F',
  b: '#6E4524',
}
const PALM_XS = [2, 46, 90, 134]

function palmRow(skip: number[] = []): string {
  const s = 2
  const oy = BEACH + 2 - PALM_TREE.length * s
  let out = ''
  PALM_XS.forEach((ox, i) => {
    if (skip.includes(i)) return
    PALM_TREE.forEach((row, y) => {
      row.split('').forEach((ch, x) => {
        const fill = PALM_PIX[ch]
        if (fill) out += `<rect x="${ox + x * s}" y="${oy + y * s}" width="${s}" height="${s}" fill="${fill}"/>`
      })
    })
  })
  return out
}

// ── City skyline on the horizon: beach, downtown, clubs, hotels, pier ──
const SKY_W = 528

function skyline(): string {
  const base = HORIZON
  const body = '#1A0B2E'
  const edge = '#3A1A55'
  let out = `<rect x="20" y="${base - 3}" width="60" height="3" fill="${body}" opacity="0.7"/>`
  const building = (x: number, w: number, h: number) => {
    let b = `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${body}"/>`
    b += `<rect x="${x}" y="${base - h}" width="${w}" height="1" fill="${edge}"/>`
    for (let wy = base - h + 3; wy < base - 2; wy += 3) {
      for (let wx = x + 2; wx < x + w - 1; wx += 3) {
        const k = (wx * 7 + wy * 13) % 5
        if (k < 2) {
          const c = k === 0 ? SUN : wx % 2 ? PINK : TEAL
          b += `<rect x="${wx}" y="${wy}" width="1" height="1" fill="${c}" opacity="0.85"/>`
        }
      }
    }
    return b
  }
  const neon = (x: number, y: number, text: string, color: string, dur: string) =>
    `<text x="${x}" y="${y}" font-family="monospace" font-weight="bold" font-size="6" fill="${color}" filter="url(#glow)">${text}` +
    `<animate attributeName="opacity" values="1;1;0.25;1" keyTimes="0;0.7;0.8;1" dur="${dur}" repeatCount="indefinite"/></text>`

  // Downtown towers
  for (const [x, w, h] of [[100, 14, 26], [116, 10, 18], [128, 18, 32], [148, 12, 22], [162, 16, 28], [180, 10, 16], [192, 20, 36], [214, 12, 20], [228, 10, 24]]) {
    out += building(x!, w!, h!)
  }
  out +=
    `<rect x="201" y="${base - 42}" width="1" height="6" fill="${body}"/>` +
    `<rect x="200" y="${base - 43}" width="3" height="2" fill="${RED}"><animate attributeName="opacity" values="1;0.1" calcMode="discrete" dur="1s" repeatCount="indefinite"/></rect>`
  // Clubs
  out += building(252, 30, 10) + neon(256, base - 12, 'CLUB', PINK, '2.2s')
  out += building(290, 22, 8) + neon(294, base - 10, 'BAR', TEAL, '1.7s')
  out += building(316, 22, 12) + neon(318, base - 14, '24/7', SUN, '2.8s')
  // Hotel strip
  out += building(352, 26, 20) + `<rect x="352" y="${base - 20}" width="26" height="2" fill="${PINK}"/>` + neon(354, base - 22, 'HOTEL', TEAL, '3.1s')
  out += building(384, 14, 14) + building(402, 22, 24) + building(406, 14, 28) + building(430, 10, 12)
  // Pier
  out += `<rect x="460" y="${base - 3}" width="56" height="2" fill="${body}"/>`
  for (let px = 462; px < 516; px += 9) out += `<rect x="${px}" y="${base - 1}" width="1" height="2" fill="${body}"/>`
  return out
}

// ── The car: a pink convertible, Claude at the wheel ──────────────
// Side view facing right: long low body, raised rear deck, open top,
// raked windshield, round wheels in arches, chrome bumpers, lights.
function car(): string {
  const cx = 46
  const cy = H - 29
  const r = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
    `<rect x="${cx + x}" y="${cy + y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`
  const CHROME = '#C8CCD8'
  const SHADE = '#B81C6E'
  const DARK = '#12061F'

  const head = pixels(OCTO.slice(0, 4), cx + 14, cy, 2)
  const seat = r(10, 4, 5, 9, '#3A1A3F')
  const body =
    r(2, 9, 30, 3, PINK) + // rear deck
    r(52, 10, 28, 2, PINK) + // hood
    r(0, 12, 84, 6, PINK) + // main body
    r(0, 18, 84, 2, SHADE) + // lower shading
    r(2, 14, 80, 1, TEAL) + // side stripe
    r(34, 12, 1, 6, SHADE) + // door line
    r(39, 13, 3, 1, CHROME) + // door handle
    r(80, 12, 4, 2, SUN) + // headlight
    r(0, 12, 2, 2, RED) + // tail light
    r(-1, 16, 4, 2, CHROME) + // rear bumper
    r(81, 16, 5, 2, CHROME) + // front bumper
    r(10, 16, 16, 4, DARK) + // wheel arches
    r(58, 16, 16, 4, DARK)
  const steering = r(42, 6, 1, 6, DARK) + r(40, 5, 4, 2, DARK)
  const windshield =
    `<polygon points="${cx + 49},${cy + 10} ${cx + 53},${cy + 10} ${cx + 47},${cy + 1} ${cx + 43},${cy + 1}" ` +
    `fill="${TEAL}" opacity="0.5" stroke="${CHROME}" stroke-width="1"/>`
  const wheel = (wx: number) =>
    `<circle cx="${cx + wx}" cy="${cy + 21}" r="5" fill="#0D0D12"/>` +
    `<circle cx="${cx + wx}" cy="${cy + 21}" r="2.2" fill="${CHROME}"/>` +
    `<g><animateTransform attributeName="transform" type="rotate" values="0 ${cx + wx} ${cy + 21}; 360 ${cx + wx} ${cy + 21}" dur="0.3s" repeatCount="indefinite"/>` +
    `<rect x="${cx + wx - 4}" y="${cy + 20.5}" width="8" height="1" fill="#5A5F73"/>` +
    `<rect x="${cx + wx - 0.5}" y="${cy + 17}" width="1" height="8" fill="#5A5F73"/></g>`
  const lines = [
    [cy + 4, 14],
    [cy + 11, 18],
    [cy + 17, 12],
  ]
    .map(
      ([y, w], i) =>
        `<rect x="${cx - 8}" y="${y}" width="${w}" height="1" fill="#FFFFFF" opacity="0.8">` +
        `<animateTransform attributeName="transform" type="translate" values="0 0; -30 0" dur="0.4s" begin="${i * 0.13}s" repeatCount="indefinite"/>` +
        `<animate attributeName="opacity" values="0.8;0" dur="0.4s" begin="${i * 0.13}s" repeatCount="indefinite"/></rect>`,
    )
    .join('')

  return (
    lines +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0; 0 -1" calcMode="discrete" dur="0.2s" repeatCount="indefinite"/>` +
    seat +
    head +
    steering +
    body +
    windshield +
    `</g>` +
    wheel(18) +
    wheel(66)
  )
}

// ── Police at WASTED: a cruiser parked by Claude, lights flashing ──
const COP_CAR = ['....WWWWW.....', '...WkkWkkW....', 'KKKKKKKKKKKKKK', 'WWWWWWWWWWWWWW', 'KKKKKKKKKKKKKK']

function policeCar(): string {
  const s = 2
  const x = 122
  const y = BEACH + 3 - 6 * s
  const flash = (lx: number, a: string, b: string) =>
    `<rect x="${x + lx * s}" y="${y - s}" width="${2 * s}" height="${s}" fill="${a}"><animate attributeName="fill" values="${a};${b}" calcMode="discrete" dur="0.3s" repeatCount="indefinite"/></rect>`
  const wheel = (wx: number) => `<rect x="${x + wx * s}" y="${y + 5 * s}" width="${2 * s}" height="${s}" fill="#0D0D12"/>`
  return (
    `<rect width="${W}" height="${H}" fill="${RED}" opacity="0.16"><animate attributeName="fill" values="${RED};#2E6BFF" calcMode="discrete" dur="0.3s" repeatCount="indefinite"/></rect>` +
    pixels(COP_CAR, x, y, s) +
    flash(5, RED, '#2E6BFF') +
    flash(7, '#2E6BFF', RED) +
    wheel(1) +
    wheel(10)
  )
}

type Mode = 'idle' | 'nap' | 'think' | 'drive' | 'edit' | 'bash' | 'web'
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
  // Walks in place: the world scrolls past instead (see scrolling layers)
  if (mode === 'think') return walker(OCTO, MX, MY, MS, '0 0; 0 0', '1s')
  if (mode === 'drive') return car()
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
  const waveOp = (0.55 * (1 - u * 0.7)).toFixed(2)
  const waveRects = (list: number[][]) =>
    list.map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="2" fill="${PINK}" opacity="${waveOp}"/>`).join('')
  // The sun's reflection stays put with the sun; the other waves drift
  const reflection = waveRects([[118, 48, 28], [124, 52, 16]])
  const waves = waveRects([[20, 50, 18], [90, 53, 10], [60, 48, 8], [150, 55, 12]])

  // Walking or driving: the world scrolls past in parallax, far layers slower;
  // in the car everything goes about three times faster
  const driving = o.mode === 'drive'
  const scrolling = o.mode === 'think' || driving
  const speed = driving
    ? { stars: '20s', city: '7s', waves: '4s', shore: '1.4s' }
    : { stars: '60s', city: '24s', waves: '12s', shore: '5s' }
  const layer = (content: string, dur: string, width = W) =>
    scrolling
      ? `<g><animateTransform attributeName="transform" type="translate" values="0 0; -${width} 0" dur="${dur}" repeatCount="indefinite"/>` +
        `${content}<g transform="translate(${width} 0)">${content}</g></g>`
      : content
  const pebbles = [[20, 60], [58, 61], [88, 59], [118, 61], [160, 60]]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="3" height="1" fill="#6B2E63"/>`)
    .join('')
  const shells = [[30, 59], [110, 60]]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="2" fill="${PINK}" opacity="0.8"/>`)
    .join('')
  // Neon palms in one row on the sand; the hammock needs the second spot free
  const shoreProps = palmRow(o.mode === 'nap' ? [1] : []) + pebbles + shells

  const world =
    `<rect width="${W}" height="${HORIZON}" fill="url(#sky)"/>` +
    layer(stars, speed.stars) +
    moon +
    `<circle cx="148" cy="${sunY}" r="22" fill="url(#sun)" mask="url(#cut)" clip-path="url(#above)"/>` +
    (scrolling
      ? layer(skyline(), speed.city, SKY_W)
      : // Standing still: the calm stretch (pier, open water) so the sun stays clear
        `<g transform="translate(-440 0)">${skyline()}<g transform="translate(${SKY_W} 0)">${skyline()}</g></g>`) +
    `<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#sea)"/>` +
    reflection +
    layer(waves, speed.waves) +
    (o.police ? police() : '') +
    `<rect y="${BEACH}" width="${W}" height="${H - BEACH}" fill="#3A1A3F"/>` +
    `<rect y="${BEACH}" width="${W}" height="1" fill="#6B2E63"/>` +
    layer(shoreProps, speed.shore) +
    (o.mode === 'nap' ? hammock() : '') +
    (o.agents && !driving
      ? walker(OCTO, 22, H - 9 * 2 - 6, 2, scrolling ? '0 0; 0 0' : '0 0; 14 0; 0 0', '4s')
      : '') +
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
    `<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1" result="b"/>` +
    `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>` +
    `<g${o.wasted ? ' filter="url(#gray)"' : ''}>${world}</g>` +
    (o.wasted ? policeCar() : '') +
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
  if (kind === 'five_hour') return { name: 'HEALTH', sub: '5h', color: PINK }
  if (kind === 'seven_day') return { name: 'ARMOR', sub: '7d', color: VIOLET }
  if (kind === 'spend_limit') return { name: 'CASH', sub: 'spend', color: SUN }
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
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
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
  if (limits.length === 0) return { text: 'WAITING FOR THE FIRST REPLY...', color: TEAL }
  const worst = Math.min(...limits.map(left))
  if (worst <= 0) return { text: 'WASTED — wait for the reset', color: RED }
  if (worst <= 15) return { text: 'COPS ON YOUR TAIL — slow down', color: PINK }
  if (worst <= 40) return { text: 'CAREFUL — supplies running low', color: ORANGE }
  return { text: 'MISSION ON — cruising easy', color: TEAL }
}

const ACTIVITY_TEXT: Record<SceneState['activity'], string> = {
  think: 'CLAUDE IS ON THE MOVE...',
  edit: 'CLAUDE IS CODING ON THE LAPTOP...',
  bash: 'CLAUDE IS HACKING IN THE TERMINAL...',
  web: 'CLAUDE IS SCOUTING WITH BINOCULARS...',
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
    'Grabbing a coconut, brb 🥥',
    'Shorter prompt = fewer tokens = longer mission.',
    'Got this shirt on sale at the Neon Beach Outlet.',
    'Type /neon-hud to hide the HUD.',
    'Waiting for GTA 6? I am waiting for my limit reset. Let us see which comes first 🌴',
    'Hawaiian shirt ✔ Shades ✔ Sunset ✔ Just missing the GTA 6 release.',
    'Training for GTA 6: already got 5 stars, just in usage limits 😎',
  ]
  if (five) {
    const r = resetIn(five.resetsAt, now)
    tips.push(`${left(five)}% of your 5h limit left${r ? `, resets in ${r}` : ''}.`)
    if (left(five) < 30 && r) tips.push(`Running low on fuel. Full tank in ${r} — go grab a coffee ☕`)
  }
  if (s.ctxPct !== undefined) {
    tips.push(
      s.ctxPct >= 80
        ? `Context at ${s.ctxPct}% — time for /compact, a storm is coming.`
        : `Context at ${s.ctxPct}% — calm waters.`,
    )
  }
  const total = t.cacheRead + t.cacheWrite + t.uncached
  if (total > 0) tips.push(`Cache hits ${Math.round((t.cacheRead / total) * 100)}% — outlet prices.`)
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

function scheduleDrive($: any, ms: number) {
  return $.clock.after(ms, () => {
    void update($, scene, x => ({ ...x, isDriving: true })).catch(() => undefined)
  })
}

function scheduleNap($: any, ms: number) {
  return $.clock.after(ms, () => {
    void update($, scene, x => ({ ...x, isNapping: true })).catch(() => undefined)
  })
}

// ── Mission names ─────────────────────────────────────────────────
const DISTRICTS = ['in Neon Bay', 'on Palm Strip', 'at Sunset Docks', 'on Pixel Pier', 'in Coral Heights', 'on Laser Avenue']

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

function missionNameFor(text: string): string | undefined {
  const words = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)
    .slice(0, 4)
  if (words.length === 0) return undefined
  const title = words.join(' ').toUpperCase()
  return `“${title.length > 32 ? `${title.slice(0, 31)}…` : title}” ${DISTRICTS[hash(text) % DISTRICTS.length]}`
}

// ── Stats and achievements (kept across sessions in $.store) ──────
type Stats = {
  missions: number
  prompts: number
  turns: number
  usd: number
  longestSec: number
  wasted: number
  models: Record<string, number>
  unlocked: string[]
}
const EMPTY_STATS: Stats = { missions: 0, prompts: 0, turns: 0, usd: 0, longestSec: 0, wasted: 0, models: {}, unlocked: [] }

const ACHIEVEMENTS: { id: string; name: string; desc: string }[] = [
  { id: 'first_mission', name: 'First Mission', desc: 'Pass your first mission' },
  { id: 'veteran', name: 'Beach Veteran', desc: 'Pass 10 missions' },
  { id: 'chatty', name: 'Chatterbox', desc: 'Send 100 prompts' },
  { id: 'marathon', name: 'Marathon', desc: 'One mission longer than 10 minutes' },
  { id: 'cache_master', name: 'Cache Master', desc: '90%+ cache hits over 200k tokens in a session' },
  { id: 'big_spender', name: 'Big Spender', desc: 'Spend $10 in total' },
  { id: 'night_owl', name: 'Night Owl', desc: 'Send a prompt between midnight and 4 AM' },
  { id: 'wanted', name: 'Most Wanted', desc: 'Reach a 4-star wanted level' },
  { id: 'survivor', name: 'Back from WASTED', desc: 'Get back in the game after running out of a limit' },
]

async function loadStats($: any): Promise<Stats> {
  const raw = (await $.store.get('stats')) as Partial<Stats> | undefined
  return { ...EMPTY_STATS, ...(raw ?? {}), models: { ...(raw?.models ?? {}) }, unlocked: [...(raw?.unlocked ?? [])] }
}

// Applies `change`, unlocks what `earned` says, saves, and announces new trophies
async function bumpStats($: any, change: (s: Stats) => void, earned: (s: Stats) => string[]) {
  const s = await loadStats($)
  change(s)
  const fresh = earned(s).filter(id => !s.unlocked.includes(id))
  s.unlocked.push(...fresh)
  await $.store.set('stats', s)
  for (const id of fresh) {
    const a = ACHIEVEMENTS.find(x => x.id === id)
    if (a) $.ui.toast(`🏆 ACHIEVEMENT UNLOCKED: ${a.name} — ${a.desc}`, { timeoutMs: 6000 })
  }
  if (fresh.length) void $.audio.play({ asset: 'sounds/mission.wav' }).catch(() => undefined)
}

function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`
}

async function statsText($: any): Promise<string> {
  const s = await loadStats($)
  const fav = Object.entries(s.models).sort((a, b) => b[1] - a[1])[0]
  const trophies = ACHIEVEMENTS.map(a => `${s.unlocked.includes(a.id) ? '🏆' : '🔒'} ${a.name} — ${a.desc}`)
  return [
    '**PLAYER STATS** 🌴',
    '',
    `Missions passed: **${s.missions}**`,
    `Prompts: ${s.prompts} · turns: ${s.turns}`,
    `Cash spent: **${s.usd.toFixed(2)}**`,
    `Longest mission: ${fmtSec(s.longestSec)}`,
    `Favourite model: ${fav ? `${shortModel(fav[0])} (${fav[1]} turns)` : '—'}`,
    `WASTED: ${s.wasted}×`,
    '',
    `**Achievements (${s.unlocked.length}/${ACHIEVEMENTS.length})**`,
    ...trophies,
  ].join('\n')
}

async function greetOncePerDay($: any) {
  const day = new Date().toISOString().slice(0, 10)
  if ((await $.store.get('greetDay')) === day) return
  await $.store.set('greetDay', day)
  $.ui.toast('📱 Text from Claude: “I am at the beach. Swing by when you have got a mission.”', { timeoutMs: 6000 })
}

// ── Hooks ─────────────────────────────────────────────────────────
export const register: Register = on => {
  const warned = new Set<string>()
  const inFlight = new Map<string, SceneState['activity']>()
  const activeAgents = new Set<string>()
  let turnStart = 0
  let turnTools = 0
  let napTimer: { cancel: () => void } | undefined
  let driveTimer: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'neon-hud',
      description: 'Show or hide the neon usage HUD above the prompt',
    })
    await $.command.register({
      name: 'neon-stats',
      description: 'Player stats and achievements from the neon HUD',
    })
    await pull($)
    await greetOncePerDay($).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'neon-stats' }, async $ => {
    return { text: await statsText($) }
  })

  on('command.run', { command: 'neon-hud' }, async $ => {
    await pull($)
    const hidden = await update($, isHidden, v => !v)

    return { text: hidden ? 'HUD hidden. /neon-hud brings it back.' : 'HUD visible.' }
  })

  on('prompt.submit', async ($, e, next) => {
    // HUD must never block a prompt
    turnStart = await $.clock.now().catch(() => turnStart)
    turnTools = 0
    inFlight.clear()
    napTimer?.cancel()
    napTimer = undefined
    await update($, isWorking, () => true).catch(() => undefined)
    const missionName = missionNameFor(e.text)
    driveTimer?.cancel()
    driveTimer = scheduleDrive($, DRIVE_AFTER_MS)
    await update($, scene, sc => ({
      ...sc,
      activity: 'think',
      isNapping: false,
      isDriving: false,
      missionName,
    })).catch(() => undefined)
    await update($, turn, t => ({ ...t, prompts: t.prompts + 1 })).catch(() => undefined)
    const hour = new Date().getHours()
    await bumpStats(
      $,
      s => {
        s.prompts += 1
      },
      s => [...(s.prompts >= 100 ? ['chatty'] : []), ...(hour < 4 ? ['night_owl'] : [])],
    ).catch(() => undefined)

    return next(e)
  })

  // What Claude is doing right now drives the mascot's prop
  on('tool.call', async ($, e, next) => {
    const kind = classify(e.tool)
    turnTools += 1
    // Subagents are counted from their own turns (turn.start / turn.complete),
    // which also catches ones running in the background
    if (kind === 'agent') return next(e)
    inFlight.set(e.tool_use_id, kind)
    await setActivity($, inFlight).catch(() => undefined)
    try {
      return await next(e)
    } finally {
      inFlight.delete(e.tool_use_id)
      await setActivity($, inFlight).catch(() => undefined)
    }
  })

  // A subagent working (foreground or background) shows the mini Claude
  on('turn.start', async ($, e, next) => {
    if (e.agentId && !activeAgents.has(e.agentId)) {
      activeAgents.add(e.agentId)
      const n = activeAgents.size
      await update($, scene, sc => ({ ...sc, agents: n })).catch(() => undefined)
    }

    return next(e)
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
    if (e.agentId && activeAgents.delete(e.agentId)) {
      const n = activeAgents.size
      await update($, scene, sc => ({ ...sc, agents: n })).catch(() => undefined)
    }
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
      const passed = e.reason === 'answer' && (secs >= MISSION_MIN_SEC || turnTools >= MISSION_MIN_TOOLS)
      if (passed) {
        flash($, 'banner', 'MISSION PASSED', 5200, now)
        void $.audio.play({ asset: 'sounds/mission.wav' }).catch(() => undefined)
      }

      // Career stats and trophies
      const delta = usd !== undefined && sc.lastUsd !== undefined ? Math.max(0, usd - sc.lastUsd) : 0
      const tt = await read($, turn)
      const cacheAll = tt.cacheRead + tt.cacheWrite + tt.uncached
      const model = shortModel(u?.model ?? tt.model)
      await bumpStats(
        $,
        s => {
          s.turns += 1
          s.usd += delta
          s.longestSec = Math.max(s.longestSec, passed ? secs : 0)
          if (passed) s.missions += 1
          if (model) s.models[model] = (s.models[model] ?? 0) + 1
        },
        s => [
          ...(s.missions >= 1 ? ['first_mission'] : []),
          ...(s.missions >= 10 ? ['veteran'] : []),
          ...(s.longestSec >= 600 ? ['marathon'] : []),
          ...(s.usd >= 10 ? ['big_spender'] : []),
          ...(cacheAll > 200_000 && tt.cacheRead / cacheAll >= 0.9 ? ['cache_master'] : []),
        ],
      ).catch(() => undefined)
      driveTimer?.cancel()
      driveTimer = undefined
      await update($, scene, x => ({ ...x, missionName: undefined, isDriving: false })).catch(() => undefined)

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
              ? `📱 Text from your ${label(l.kind).sub} limit: “WASTED. See you after the reset.”`
              : t === 15
                ? `📱 Text from your ${label(l.kind).sub} limit: “${pct}% left. Cops on your tail, slow down.”`
                : `📱 Text from your ${label(l.kind).sub} limit: “${pct}% left. Watch the corners.”`,
            { timeoutMs: 6000 },
          )
          if (t === 0) {
            void $.audio.play({ asset: 'sounds/wasted.wav' }).catch(() => undefined)
            await bumpStats(
              $,
              s => {
                s.wasted += 1
              },
              () => [],
            ).catch(() => undefined)
          }
        }
        break
      }
    }
    const heat5 = stars(e.rateLimits)
    const allBack = e.rateLimits.length > 0 && !isWasted(e.rateLimits)
    await bumpStats(
      $,
      () => undefined,
      s => [...(heat5 >= 4 ? ['wanted'] : []), ...(allBack && s.wasted > 0 ? ['survivor'] : [])],
    ).catch(() => undefined)

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

    const isDriving = working && sc.activity === 'think' && !!sc.isDriving
    const mode: Mode = working ? (isDriving ? 'drive' : sc.activity) : sc.isNapping ? 'nap' : 'idle'
    let m = mission(s.limits)
    if (!wasted && working) {
      m = {
        text:
          (sc.missionName ? `MISSION ${sc.missionName} · ` : '') +
          (isDriving ? 'CLAUDE IS CRUISING IN THE NEON CONVERTIBLE 🚗💨' : ACTIVITY_TEXT[sc.activity]) +
          (sc.agents > 0 ? ` + crew (${sc.agents})` : ''),
        color: SUN,
      }
    } else if (!wasted && sc.agents > 0) {
      m = { text: `THE CREW IS ON A SIDE JOB (${sc.agents}) — Claude waits on the beach`, color: TEAL }
    } else if (!wasted && sc.isNapping) {
      m = { text: 'CLAUDE IS NAPPING IN THE HAMMOCK — send a message to wake Claude up', color: VIOLET }
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
          `cache · ⇣ ${fmtTokens(t.cacheRead)} read · ⇡ ${fmtTokens(t.cacheWrite)} write`,
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
          `${info.sub}${r ? ` · ↻ ${r}` : ''} · ${left(l)}% left`,
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
                Limits show up after the first reply (subscription plans only).
              </Text>
            )}
          </Box>
          <Text weight="bold" italic color={m.color}>
            {`▶ ${m.text}`}
          </Text>
        </Box>
        {/* The scene on the right; the numbers keep the room they need */}
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Svg
            source={sceneSvg}
            alt="Claude in a Hawaiian shirt on a beach at sunset"
            width={Math.round(W * 1.3)}
            height={Math.round(H * 1.3)}
            isInteractive
          />
          <Button
            key="mascot"
            plain
            label="Talk to Claude"
            onPress={() => {
              $.ui.toast(tipFor(s, t, now))
              if (sc.isNapping) void update($, scene, x => ({ ...x, isNapping: false })).catch(() => undefined)
            }}
          >
            <Text color={TEAL}>{sc.isNapping ? '💤 wake Claude up' : '💬 talk to Claude'}</Text>
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
          {r ? `  resets in ${r}` : ''}
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
            Limits show up after the first reply (subscription plans only).
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
