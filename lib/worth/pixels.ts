/**
 * THE CARD'S GROUND — the pixel city behind /worth's share card (Ilya
 * 2026-10-21: the blue of unfair.so's home, inverted from the white card; the
 * picture crumbles into pixels at its edges).
 *
 * Satori draws no canvas and no masks, so the picture is made here as a grid
 * of squares, one colour per cell, and handed over as an SVG: a blue field, a
 * skyline of windows standing on the foot line, a few hearts and speech
 * bubbles in the sky, and an edge where each cell is likelier to be missing
 * the nearer it is to the border. Missing cells show the card's own white.
 *
 * Deterministic: the same size always draws the same city, so a card looks
 * the same on every render and in every cache.
 */

const CELL = 12
const BLUE = '#0033ff'
const BAND = '#002bd9'
const TOWER = '#0026bf'
const SKY = ['#6f89ff', '#8aa0ff']
/** how many cells in from the border the edge keeps dissolving */
const EDGE = 4

function rng(seed: number) {
  let x = seed >>> 0
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0
    return x / 4294967296
  }
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
const BUBBLE = ['########', '########', '########', '########', '..####..', '..##....']

/* the skyline, for a field a hundred cells wide: [column, width, height in cells] */
const TOWERS: [number, number, number][] = [
  [0, 10, 7],
  [10, 7, 4],
  [17, 12, 11],
  [29, 9, 5],
  [38, 8, 2],
  [46, 10, 7],
  [56, 12, 3],
  [68, 10, 13],
  [78, 8, 6],
  [86, 9, 10],
  [95, 5, 3],
]

/**
 * The ground as an SVG data URI: `width` × `height` pixels, with the foot band
 * `band` pixels tall along the bottom, and the skyline standing on its top edge.
 */
export function ground(width: number, height: number, band: number): string {
  const cols = Math.ceil(width / CELL)
  const rows = Math.ceil(height / CELL)
  const foot = Math.round((height - band) / CELL)
  const r = rng(11 + width + height)
  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(BLUE))

  for (let j = foot; j < rows; j++) grid[j].fill(BAND)

  /* the city, its windows lit at random */
  const scale = cols / 100
  const tall = Math.max(1, foot / 45)
  for (const [c0, w0, h0] of TOWERS) {
    const c = Math.round(c0 * scale)
    const w = Math.max(2, Math.round(w0 * scale))
    const h = Math.max(2, Math.round(h0 * tall))
    for (let j = foot - h; j < foot; j++) {
      for (let i = c; i < Math.min(cols, c + w); i++) {
        const window = (i - c) % 2 === 1 && (foot - 1 - j) % 2 === 1 && i < c + w - 1 && j >= foot - h + 1
        const v = r()
        grid[j][i] = window ? (v < 0.35 ? '#ffffff' : v < 0.55 ? '#8aa0ff' : '#001f99') : TOWER
      }
    }
  }

  /* the sky */
  const put = (sprite: string[], c: number, j: number, colour: string) =>
    sprite.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '#' && grid[j + y]?.[c + x] !== undefined) grid[j + y][c + x] = colour
      }),
    )
  const sky = [
    [HEART, 0.5, 0.14],
    [HEART, 0.72, 0.07],
    [BUBBLE, 0.65, 0.24],
    [HEART, 0.86, 0.22],
    [BUBBLE, 0.9, 0.11],
    [HEART, 0.93, 0.46],
  ] as const
  sky.forEach(([sprite, fx, fy], k) => put(sprite, Math.round(fx * cols), Math.round(fy * foot), SKY[k % 2]))

  /* the edge: the nearer the border, the likelier a cell is gone */
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const d = Math.min(i, j, cols - 1 - i, rows - 1 - j)
      if (r() >= Math.min(1, Math.pow(d / EDGE, 0.7))) grid[j][i] = null
    }
  }

  /* one rect per run of cells of the same colour */
  const rects: string[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; ) {
      const colour = grid[j][i]
      if (!colour) {
        i++
        continue
      }
      let k = i
      while (k < cols && grid[j][k] === colour) k++
      const x = i * CELL
      const y = j * CELL
      rects.push(`<rect x="${x}" y="${y}" width="${Math.min(width, k * CELL) - x}" height="${Math.min(height, y + CELL) - y}" fill="${colour}"/>`)
      i = k
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${rects.join('')}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
