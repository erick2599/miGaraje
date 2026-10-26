import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const BLUE = '#2563eb'
const INK = '#0f172a'

function carMarkup() {
  return `
    <path d="M158 282 L202 210 Q209 197 224 197 H300 Q315 197 322 210 L366 282 Z" fill="#ffffff" />
    <path d="M92 306 Q92 288 110 288 H402 Q420 288 420 306 V346 Q420 364 402 364 H110 Q92 364 92 346 Z" fill="#ffffff" />
    <path d="M188 276 L220 219 Q223 214 229 214 H248 V276 Z" fill="${BLUE}" />
    <path d="M264 214 H295 Q301 214 304 219 L336 276 H264 Z" fill="${BLUE}" />
    <path d="M256 292 V342" stroke="${BLUE}" stroke-width="6" stroke-linecap="round" opacity="0.16" />
    <circle cx="166" cy="356" r="42" fill="${INK}" />
    <circle cx="166" cy="356" r="18" fill="#ffffff" />
    <circle cx="166" cy="356" r="7" fill="${BLUE}" />
    <circle cx="346" cy="356" r="42" fill="${INK}" />
    <circle cx="346" cy="356" r="18" fill="#ffffff" />
    <circle cx="346" cy="356" r="7" fill="${BLUE}" />
  `
}

function iconSvg({ rounded = true, scale = 1 } = {}) {
  const offset = ((1 - scale) * 512) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512"${rounded ? ' rx="116"' : ''} fill="${BLUE}" />
  <g transform="translate(${offset} ${offset}) scale(${scale}) translate(0 -52)">
    ${carMarkup()}
  </g>
</svg>
`
}

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, options: {} },
  { file: 'public/icons/icon-512.png', size: 512, options: {} },
  {
    file: 'public/icons/icon-maskable-512.png',
    size: 512,
    options: { rounded: false, scale: 0.78 },
  },
  {
    file: 'public/apple-touch-icon.png',
    size: 180,
    options: { rounded: false, scale: 0.92 },
  },
]

await mkdir('public/icons', { recursive: true })
await writeFile('public/favicon.svg', iconSvg())

for (const target of targets) {
  const source = Buffer.from(iconSvg(target.options))
  await sharp(source).resize(target.size, target.size).png().toFile(target.file)
  console.log(`ok ${target.file} (${target.size}x${target.size})`)
}
