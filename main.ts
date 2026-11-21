// main.ts — PERLA BAY entry point for the make.fun grader.
// Node 22, stdlib only. Copies game/ + screenshots/ into the output dir and
// writes /output/dossier.json via buildDossier from vendor/makefun-game.ts.
// Paths resolve from this file's own location (never from the CWD), and the
// output directory itself is never deleted — only its contents are cleared,
// because the grader mounts /output under a read-only root.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(here);
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function clearContents(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

mkdirSync(outputDir, { recursive: true });
clearContents(outputDir);
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}
// The dossier is built from the COPIED output tree (buildDossier reads
// <out>/game/ and <out>/screenshots/), with the scorer's caps from the kit's
// reference/gate.json. buildDossier returns canonical bytes — write them
// verbatim, never re-serialized.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// The dossier is produced entirely by the kit's buildDossier (unchanged):
// it inventories game/ and screenshots/, hashes every file, and records the
// vendored library. This file adds no content of its own — it only copies
// and delegates — so the dossier is byte-identical across runs.
