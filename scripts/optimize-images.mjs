import { createRequire } from 'node:module';
import { homedir } from 'node:os';
let sharp;
try {
  sharp = createRequire(import.meta.url)('sharp');
} catch {
  sharp = createRequire(
    `${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json`,
  )('sharp');
}
import { readFileSync } from 'node:fs';
const assets = JSON.parse(
  readFileSync(process.env.DRIVECORE_ASSET_MANIFEST || '.runtime/generated-assets.json', 'utf8'),
);
const thumbs = [];
let index = 0;
for (const [name, file] of Object.entries(assets)) {
  await sharp(file)
    .resize({ width: name === 'hero' ? 1920 : 1000, withoutEnlargement: true })
    .webp({ quality: 83 })
    .toFile(`public-site/assets/${name}.webp`);
  await sharp(file).resize(480, 320, { fit: 'cover' }).png().toFile(`.runtime/${name}-preview.png`);
  thumbs.push({
    input: `.runtime/${name}-preview.png`,
    left: (index % 4) * 480,
    top: Math.floor(index / 4) * 320,
  });
  index++;
}
await sharp({
  create: { width: 1920, height: 640, channels: 3, background: '#111111' },
})
  .composite(thumbs)
  .jpeg()
  .toFile('.runtime/image-review.jpg');
