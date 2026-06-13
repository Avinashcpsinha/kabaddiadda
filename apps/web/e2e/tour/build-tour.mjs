// Orchestration helpers for the narrated product tour.
//
//   node build-tour.mjs durations   → ffprobe each audio/*.wav, write durations.json
//   node build-tour.mjs mux         → overlay narration onto the recorded video → docs/*.mp4
//
// Run order: tts.ps1  →  durations  →  playwright tour  →  mux
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const audioOf = (id) => resolve(HERE, 'audio', `${id}.wav`);
const stage = process.argv[2];

function ffprobeDuration(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' },
  );
  return parseFloat(out.trim());
}

if (stage === 'durations') {
  const narration = JSON.parse(readFileSync(resolve(HERE, 'narration.json'), 'utf8'));
  const durations = {};
  for (const s of narration) {
    const f = audioOf(s.id);
    if (!existsSync(f)) throw new Error(`missing audio for "${s.id}" — run tts.ps1 first`);
    durations[s.id] = ffprobeDuration(f);
  }
  writeFileSync(resolve(HERE, 'durations.json'), JSON.stringify(durations, null, 2));
  const total = Object.values(durations).reduce((a, b) => a + b, 0);
  console.log(`durations.json written — ${narration.length} clips, ${total.toFixed(1)}s of speech`);
} else if (stage === 'mux') {
  const meta = JSON.parse(readFileSync(resolve(HERE, 'offsets.json'), 'utf8'));
  // Playwright finalises the video into outputDir on context close, so the
  // path recorded mid-test (a temp artifact) is gone — find the real .webm.
  function findVideo(dir) {
    let best = null;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        const inner = findVideo(p);
        if (inner && (!best || statSync(inner).mtimeMs > statSync(best).mtimeMs)) best = inner;
      } else if (e.name.endsWith('.webm')) {
        if (!best || statSync(p).mtimeMs > statSync(best).mtimeMs) best = p;
      }
    }
    return best;
  }
  let video = meta.videoPath;
  if (!video || !existsSync(video)) video = findVideo(resolve(HERE, 'output'));
  if (!video || !existsSync(video)) throw new Error(`video not found (looked in output/)`);
  console.log('video:', video);
  const offsets = meta.offsets.filter((o) => existsSync(audioOf(o.id)));

  const args = ['-y', '-i', video];
  for (const o of offsets) args.push('-i', audioOf(o.id));

  let fc = '';
  const labels = [];
  offsets.forEach((o, i) => {
    const lab = `d${i}`;
    // input index is i+1 (video is input 0)
    fc += `[${i + 1}:a]adelay=${Math.round(o.offsetMs)}:all=1,aresample=48000[${lab}];`;
    labels.push(`[${lab}]`);
  });
  fc += `${labels.join('')}amix=inputs=${offsets.length}:normalize=0:dropout_transition=0[aout]`;

  const outDir = resolve(HERE, '..', '..', '..', '..', 'docs');
  const outPath = resolve(outDir, 'kabaddiadda-tutorial.mp4');
  args.push(
    '-filter_complex', fc,
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart',
    outPath,
  );

  console.log(`muxing ${offsets.length} narration clips onto video → ${outPath}`);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log('\n✓ done:', outPath);
} else {
  console.error('usage: node build-tour.mjs <durations|mux>');
  process.exit(1);
}
