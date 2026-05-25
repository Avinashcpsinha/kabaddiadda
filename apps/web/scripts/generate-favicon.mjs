#!/usr/bin/env node
/**
 * Generate favicon + apple-touch-icon from the brand logo.
 *
 * The source logo (public/Logo.png) is wider than it is tall, so we pad it
 * onto a square transparent canvas before resizing. Outputs follow the
 * Next.js App Router file convention (src/app/icon.png + src/app/apple-icon.png),
 * which means Next auto-generates the <link> tags — no metadata wiring needed.
 *
 * Re-run this any time the logo changes:
 *   node apps/web/scripts/generate-favicon.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');

const sourcePath = resolve(webRoot, 'public', 'Logo.png');
const iconOut = resolve(webRoot, 'src', 'app', 'icon.png');
const appleOut = resolve(webRoot, 'src', 'app', 'apple-icon.png');

const source = readFileSync(sourcePath);

async function squarePad(buffer, size) {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  // Trim any near-white/transparent borders the source logo already has so
  // the artwork fills the favicon instead of floating in dead space.
  const trimmed = await sharp(buffer).trim({ threshold: 10 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const longest = Math.max(meta.width, meta.height);
  // 4% inner margin — just enough breathing room at favicon sizes.
  const padded = Math.round(longest * 1.08);

  const leftPad = Math.round((padded - meta.width) / 2);
  const topPad = Math.round((padded - meta.height) / 2);

  return sharp(trimmed)
    .extend({
      top: topPad,
      bottom: padded - meta.height - topPad,
      left: leftPad,
      right: padded - meta.width - leftPad,
      background: transparent,
    })
    .resize(size, size, { fit: 'contain', background: transparent })
    .png()
    .toBuffer();
}

const icon = await squarePad(source, 512);
const apple = await squarePad(source, 180);

writeFileSync(iconOut, icon);
writeFileSync(appleOut, apple);

console.log(`✓ Wrote ${iconOut} (${icon.length} bytes, 512×512)`);
console.log(`✓ Wrote ${appleOut} (${apple.length} bytes, 180×180)`);
