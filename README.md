# Whisker Way

A cozy cat platformer that runs in the browser. Guide your cat across floating islands above a flowing river, collect fish, and reach the cottage to move on to a harder level.

**Play it:** https://jengliang.github.io/whisker-way/

## Controls

| Key | Action |
|---|---|
| `A` / `D` | Move left / right |
| `W` or `Space` | Jump (press again in the air to double jump; 3-second cooldown) |
| `S` | Crouch (squeeze under low branches and through hollow logs) |
| `Shift` | Sprint |
| `P` or `Esc` | Pause |
| `M` | Toggle sound |

## Features

- Five cat coats and a wardrobe shop of collars and hats, bought with the fish you bank at the cottage.
- Moving cloud platforms, crumbling ledges, crows, and a playful corgi, introduced as the levels get harder.
- Catnip patches that stop your cat for a sniff unless you jump over them.
- A five-minute day and night cycle, fireworks on reaching home, and music and sound effects synthesized with the Web Audio API.
- Progress, fish, and outfits are saved in the browser.

## Running locally

No build step or dependencies. Serve the folder with any static web server, for example:

```sh
ruby -run -e httpd . -p 4173
```

Then open http://localhost:4173.
