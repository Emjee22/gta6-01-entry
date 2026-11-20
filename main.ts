// Perla Bay — build the make.fun entry bundle.
//
// Copies game/ and screenshots/ into the output directory and writes
// output/dossier.json from them with the competition's caps. All paths come
// from this file's own location, never from the working directory, so the
// script works no matter where it is invoked from. The output directory
// itself is never removed; only its contents are cleared first.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || join(here, '.makefun', 'output');

function clearContents(dir: string): void {
  if (!existsSync(dir)) return;
  for (const child of readdirSync(dir)) {
    rmSync(join(dir, child), { recursive: true, force: true });
  }
}

function countTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const child of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, child.name);
      if (child.isDirectory()) walk(p);
      else {
        files += 1;
        bytes += statSync(p).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });
  clearContents(outputDir);
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  } else {
    mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  }
  const gameTree = countTree(join(outputDir, 'game'));
  console.log(`game/: ${gameTree.files} files, ${gameTree.bytes} bytes`);
  const dossier = buildDossier(outputDir, CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`Perla Bay entry written to ${outputDir}`);
  console.log(`dossier.json: ${dossier.length} bytes`);
}

main();
