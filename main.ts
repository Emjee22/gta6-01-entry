// main.ts — Perla Bay entrypoint (Node 22, stdlib only).
// Copies game/ and screenshots/ into the output dir and writes dossier.json
// with buildDossier from the kit's vendor/makefun-game.ts (unchanged).
// The output dir itself is never deleted — only its contents are cleared —
// because the grader's /output is a mount under a read-only root.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(outDir)) {
  rmSync(join(outDir, name), { recursive: true, force: true });
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (existsSync(gameDir)) cpSync(gameDir, join(outDir, 'game'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));
