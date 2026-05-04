// Renders the Rabona "[ R ]" logo from a single source SVG into every place
// the brand assets live. Run with: node scripts/generate-logo.mjs
//
// Outputs (web + Capacitor input):
//   resources/icon-only.png        (1024x1024)
//   resources/splash.png           (2732x2732)
//   public/logo.png                (512x512)
//   public/logo.svg                (vector source mirror)
//   public/icon-512.png            (PWA / store-listing icon)
//   public/icon-192.png            (PWA icon)
//   public/apple-touch-icon.png    (180x180 for iOS web home-screen)
//   src/app/icon.svg               (Next.js app icon)
//
// Outputs (native iOS):
//   ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png  (1024x1024)
//   ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png
//
// Outputs (native Android):
//   android/.../mipmap-*/ic_launcher.png            (48..192)
//   android/.../mipmap-*/ic_launcher_round.png      (48..192)
//   android/.../mipmap-*/ic_launcher_foreground.png (108..432, adaptive icon foreground)
//   android/.../drawable*/splash.png                (port/land at every density)
//   android/.../values/ic_launcher_background.xml   (set to #000000)
//
// Replaces what `pnpm cap:assets` would do — that script depends on
// @capacitor/assets which bundles a sharp build that doesn't ship a Windows
// binary for newer Node versions, so we drive sharp directly here.

import sharp from 'sharp'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// --- The source mark --------------------------------------------------------
// Black rounded square, white square brackets framing a bold white "R".
// Coordinates are designed on a 1024 canvas; everything else is rendered from
// this SVG so the icon stays consistent across every surface.

function iconSvg({ size = 1024, rounded = true } = {}) {
  const s = size
  const r = rounded ? Math.round(s * 0.22) : 0

  // Geometry, all in canvas units.
  const cx = s / 2
  // Bracket pair: vertical stroke + two serifs each side. Tuned to match the
  // proportions of the previous "[ S ]" mark.
  const bracketHeight = s * 0.46
  const bracketTop = (s - bracketHeight) / 2
  const bracketBottom = bracketTop + bracketHeight
  const bracketStroke = s * 0.037
  const bracketSerif = s * 0.118
  const bracketGapFromCenter = s * 0.255 // distance from center to inner edge of bracket
  const leftBracketX = cx - bracketGapFromCenter - bracketStroke
  const rightBracketX = cx + bracketGapFromCenter

  // The "R" sits between the brackets.
  const letterY = s * 0.705 // text baseline
  const letterSize = s * 0.36

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" ry="${r}" fill="#000000"/>
  <g fill="#ffffff">
    <!-- left bracket -->
    <rect x="${leftBracketX}" y="${bracketTop}" width="${bracketStroke}" height="${bracketHeight}"/>
    <rect x="${leftBracketX}" y="${bracketTop}" width="${bracketSerif}" height="${bracketStroke}"/>
    <rect x="${leftBracketX}" y="${bracketBottom - bracketStroke}" width="${bracketSerif}" height="${bracketStroke}"/>
    <!-- right bracket -->
    <rect x="${rightBracketX}" y="${bracketTop}" width="${bracketStroke}" height="${bracketHeight}"/>
    <rect x="${rightBracketX + bracketStroke - bracketSerif}" y="${bracketTop}" width="${bracketSerif}" height="${bracketStroke}"/>
    <rect x="${rightBracketX + bracketStroke - bracketSerif}" y="${bracketBottom - bracketStroke}" width="${bracketSerif}" height="${bracketStroke}"/>
  </g>
  <text x="${cx}" y="${letterY}" text-anchor="middle"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-weight="900" font-size="${letterSize}" fill="#ffffff"
        letter-spacing="-2">R</text>
</svg>`
}

// Splash artwork: icon centered on a black canvas of the requested aspect
// ratio. The icon is sized to ~30% of the smaller dimension so it sits
// comfortably regardless of orientation.
function splashSvg({ width = 2732, height = 2732 } = {}) {
  const minDim = Math.min(width, height)
  const iconSize = Math.round(minDim * 0.30)
  const offsetX = Math.round((width - iconSize) / 2)
  const offsetY = Math.round((height - iconSize) / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#000000"/>
  <g transform="translate(${offsetX} ${offsetY}) scale(${iconSize / 1024})">
    ${iconSvg({ size: 1024, rounded: true }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}
  </g>
</svg>`
}

// Adaptive-icon foreground: just the brackets + R on a transparent canvas,
// scaled to fit the inner 66/108 "safe zone" so Android's launcher mask
// doesn't crop it.
function foregroundSvg({ size = 432 } = {}) {
  const inner = Math.round(size * (66 / 108))
  const offset = Math.round((size - inner) / 2)
  // Strip the outer rounded-rect background by reusing the icon SVG without
  // the fill.
  const innerArt = iconSvg({ size: 1024, rounded: true })
    .replace(/<rect width="1024" height="1024"[^/]*\/>/, '')
    .replace(/^<svg[^>]*>|<\/svg>$/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${offset} ${offset}) scale(${inner / 1024})">
    ${innerArt}
  </g>
</svg>`
}

async function writeFileEnsuringDir(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}

async function renderPng(svg, outPath, size) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFileEnsuringDir(outPath, buf)
  console.log(`  wrote ${outPath} (${size}x${size})`)
}

async function renderPngWH(svg, outPath, w, h) {
  const buf = await sharp(Buffer.from(svg)).resize(w, h).png().toBuffer()
  await writeFileEnsuringDir(outPath, buf)
  console.log(`  wrote ${outPath} (${w}x${h})`)
}

// Android launcher PNG sizes by density bucket.
// ic_launcher / ic_launcher_round = full icon (rounded square).
// ic_launcher_foreground = adaptive-icon foreground only (transparent bg).
const ANDROID_LAUNCHER = [
  { dir: 'mipmap-mdpi',    icon: 48,  fg: 108 },
  { dir: 'mipmap-hdpi',    icon: 72,  fg: 162 },
  { dir: 'mipmap-xhdpi',   icon: 96,  fg: 216 },
  { dir: 'mipmap-xxhdpi',  icon: 144, fg: 324 },
  { dir: 'mipmap-xxxhdpi', icon: 192, fg: 432 },
]

// Android splash PNGs, in <directory, width, height> form.
const ANDROID_SPLASH = [
  { dir: 'drawable',              w: 480,  h: 320 },
  { dir: 'drawable-port-mdpi',    w: 320,  h: 480 },
  { dir: 'drawable-port-hdpi',    w: 480,  h: 800 },
  { dir: 'drawable-port-xhdpi',   w: 720,  h: 1280 },
  { dir: 'drawable-port-xxhdpi',  w: 960,  h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  { dir: 'drawable-land-mdpi',    w: 480,  h: 320 },
  { dir: 'drawable-land-hdpi',    w: 800,  h: 480 },
  { dir: 'drawable-land-xhdpi',   w: 1280, h: 720 },
  { dir: 'drawable-land-xxhdpi',  w: 1600, h: 960 },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
]

async function main() {
  console.log('Rendering logo assets…')

  const masterIcon = iconSvg({ size: 1024, rounded: true })
  const masterSplashSquare = splashSvg({ width: 2732, height: 2732 })

  // SVG sources kept in repo for future re-renders.
  await writeFileEnsuringDir(resolve(ROOT, 'public/logo.svg'), masterIcon)
  console.log('  wrote public/logo.svg')

  // Tiny Next.js app icon — same mark, smaller corner radius for the small size.
  await writeFileEnsuringDir(resolve(ROOT, 'src/app/icon.svg'), iconSvg({ size: 32, rounded: true }))
  console.log('  wrote src/app/icon.svg')

  // Web / Capacitor input artwork.
  await renderPng(masterIcon, resolve(ROOT, 'resources/icon-only.png'), 1024)
  await renderPng(masterSplashSquare, resolve(ROOT, 'resources/splash.png'), 2732)
  await renderPng(masterIcon, resolve(ROOT, 'public/logo.png'), 512)
  await renderPng(masterIcon, resolve(ROOT, 'public/icon-512.png'), 512)
  await renderPng(masterIcon, resolve(ROOT, 'public/icon-192.png'), 192)
  await renderPng(masterIcon, resolve(ROOT, 'public/apple-touch-icon.png'), 180)

  // iOS app icon + splash.
  const iosBase = resolve(ROOT, 'ios/App/App/Assets.xcassets')
  await renderPng(masterIcon, resolve(iosBase, 'AppIcon.appiconset/AppIcon-512@2x.png'), 1024)
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await renderPng(masterSplashSquare, resolve(iosBase, 'Splash.imageset', name), 2732)
  }

  // Android launcher icons.
  const androidRes = resolve(ROOT, 'android/app/src/main/res')
  for (const { dir, icon, fg } of ANDROID_LAUNCHER) {
    await renderPng(masterIcon, resolve(androidRes, dir, 'ic_launcher.png'), icon)
    await renderPng(masterIcon, resolve(androidRes, dir, 'ic_launcher_round.png'), icon)
    await renderPng(foregroundSvg({ size: fg }), resolve(androidRes, dir, 'ic_launcher_foreground.png'), fg)
  }

  // Adaptive-icon background: solid black so it matches the rest of the brand.
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
`
  await writeFileEnsuringDir(resolve(androidRes, 'values/ic_launcher_background.xml'), bgXml)
  console.log('  wrote android values/ic_launcher_background.xml (black)')

  // Android splash images at every density / orientation.
  for (const { dir, w, h } of ANDROID_SPLASH) {
    const svg = splashSvg({ width: w, height: h })
    await renderPngWH(svg, resolve(androidRes, dir, 'splash.png'), w, h)
  }

  console.log('\nAll assets regenerated. Run `pnpm cap:sync` next to refresh native projects.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
