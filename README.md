# PERLA BAY — Bahía Perla

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?ref=emjee)
[![rank](https://make.fun/badge/gta6-01/Emjee22/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01?ref=emjee)
[![reward](https://make.fun/badge/gta6-01/Emjee22/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?ref=emjee)

A 3D open-world crime game in the sun-soaked coastal city of **Bahía Perla**,
built for the [gta6-01 "Make GTA 6" bounty on make.fun](https://make.fun/bounty/gta6-01?ref=emjee).

## Play it

Open `game/index.html` in a desktop browser (or serve the `game/` folder with
any static server). No network, no build step, no install — everything runs
from local files.

- **WASD** walk / drive · **Mouse** camera (click to lock) · **Shift** run / drift
- **F** enter / exit a car · **E** crew ability (Nadia jams the police radio)
- **Space** jump / handbrake · **1–4** weapons · **M** mute · **P** pause
- Progress saves automatically to your browser (localStorage).

## The game

You are a rookie driver in Bahía Perla. Celia Mar, the fixer, hands you your
first stolen car — and from there it is eight story missions with Celia,
Tomas and Nadia Sol, against Duarte Ferrer and the whole Perla Bay PD:

1. **First Keys** — steal the Faro Sport on Plaza Perla
2. **Tomas Teaches Speed** — beach-road run to the Casino Perla
3. **Ferris Deal** — lift Duarte's Cometa GT by the Rueda del Sol
4. **Heat on the Avenue** — draw the police, then lose them
5. **The Pier Drop** — a package at the end of Muelle Perla
6. **Nadia Runs Interference** — jam the dispatch radio with E
7. **Duarte Ferrer** — face the man who owns the bay
8. **Queen of the Bay** — the full-heat run home

Wanted levels run 1–4 stars: ground units with callsigns, tactics and live
distances on the dispatch list, plus a helicopter with a searchlight from
two stars up. Lose them by distance and time — or let Nadia jam them.

## Tech

- Three.js 0.160.0 vendored as `game/vendor/three.module.min.js` (self-contained)
- Vanilla JS modules, one job per file under `game/src/`
- DOM HUD: mission panel, wanted stars, dispatch list, circular minimap,
  speed + car + condition, health/armour, respect rank, dialogue, radio
- WebAudio-synthesized engine, siren and radio — no audio files
- Deterministic screenshots via `?shot=chase|drive|foot|city&seed=N`

## Build

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` via the kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE).

## Screenshots

The four screenshots in `screenshots/` are real renders of the game's own
code in a browser (1280×800 each): a police chase, driving the beach road,
on foot by the ferris wheel, and an aerial view of the whole bay at sunset.
