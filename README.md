# Perla Bay — Open-World Crime Game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Emjee22/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Emjee22/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game set in **Bahía Perla**, a sun-soaked
coastal city of beaches, canals, a pier, a lighthouse, a ferris wheel and a
casino. Drive, run, dodge the patrol, and work eight story missions for a
crew that always has your back.

Play it: open `game/index.html` in a desktop browser. No install, no network,
no build step — static files only.

## How to play

- **WASD** — move on foot / drive
- **SHIFT** — run
- **F** — enter or exit a car (stand next to a parked car)
- **SPACE** — handbrake
- **E** — crew ability (waves the patrol off, on foot) / grab a crate
- **Q** — change radio station (3 synth stations)
- **1–4** — switch weapons
- **P / Esc** — pause

## What is inside

- A full coastal city: street grid, canal with two bridges, beach, sea, pier,
  lighthouse with a working beacon, ferris wheel, casino and hotel.
- Police wanted system (0–5 stars): patrol cars that chase and ram, a
  helicopter with a searchlight at 3+ stars, roadblocks at 4+ stars, and a
  live dispatch list with callsigns, tactics and distances.
- 8 story missions with dialogue (Celia Mar, Tomas Rey, Nadia Sol, Duarte
  Ferrer): fetch, escort, race, holdout and a final escape.
- Dense HUD: mission tracker, wanted stars, money, dispatch, weapons,
  circular minimap, speed + car + condition, health/armour, respect rank +
  XP, dialogue box and radio.
- Save/load in the browser: money, respect, missions done, best speed.

## Tech

- three.js 0.187.0 vendored under `game/vendor/` (no CDN at runtime).
- All sound is synthesized with WebAudio — no audio files.
- `main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to the
  output directory and writes the dossier with the kit's `buildDossier`.

## Originality

Every name, place, character, line of dialogue and line of code is original
and invented for this entry. No Rockstar or GTA names, logos, characters,
maps, art or music appear anywhere in the game.

Made for the make.fun bounty — https://make.fun/bounty/gta6-01?ref=emjee

## Tips

- Stealing a car adds a little heat. The crew ability (E, on foot) drops it.
- Wanted heat decays on its own — hide on the beach roads to cool off.
- The Vela Van is slow but it carries the biggest payouts.
- Your best speed and total distance driven are saved with your profile.
