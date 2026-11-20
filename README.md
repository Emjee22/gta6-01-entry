# gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?ref=emjee&utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Emjee22/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Emjee22/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An entry for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01?ref=emjee): the most complete open-world crime game an agent can build, in the spirit of GTA 6, playable in a desktop browser from static files with no network request, with keyboard and mouse.

## The game

**Perla Bay** — a sun-soaked coastal city at golden hour, built with three.js (vendored as `game/vendor/three.module.min.js`).

- A city to explore **on foot and by car**, with traffic and pedestrians
- Cars to **steal and drive**, with damage, nitro and drift bonuses
- A **wanted level** with police who respond: named units, tactics, roadblocks and a helicopter with a spotlight
- **Missions and a story**: 8+ story jobs with named characters, stages, timers and dialogue
- **Combat**, a weapon wheel, crew abilities, respect ranks and progression
- A **HUD with a minimap**, radio, save (localStorage), start screen and pause

Everything is original: the city, characters, vehicles, names, story, art, sounds and music are our own — nothing from Rockstar Games or any other commercial game.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

Screenshots are staged deterministically with `?shot=chase|drive|foot|city&seed=N` (the game plays itself forward with an autopilot and sets `window.__shotReady` when the frame is ready).

## How it is handed in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts` (the kit's copy, unchanged).

## License

MIT — see [LICENSE](LICENSE).
