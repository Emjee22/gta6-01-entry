// Perla Bay — entrypoint. Copies the static game and screenshots to the
// output directory and writes the dossier with the kit's buildDossier.
// Node 22, stdlib only. Paths resolve from this file's own location, never
// from the working directory: the grader runs `node /bot/main.ts` from
// another directory.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = here;
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(here, 'output');

function clearContents(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

function main() {
  // Create the output directory if missing; clear only its contents, never
  // the directory itself (the grader mounts it under a read-only root).
  mkdirSync(outDir, { recursive: true });
  clearContents(outDir);

  const gameDir = join(repoDir, 'game');
  const shotsDir = join(repoDir, 'screenshots');
  if (existsSync(gameDir)) cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  if (existsSync(shotsDir)) cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
// Perla Bay — entrypoint (continued): the dossier build is delegated to the
// kit's buildDossier so the output matches the grader's expectation exactly.
// Nothing else to configure here: game/ and screenshots/ are copied verbatim.
export {};
