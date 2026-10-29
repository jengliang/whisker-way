"use strict";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const layer = document.createElement("canvas");
const lctx = layer.getContext("2d");

const VIEW_W = 960;
const VIEW_H = 540;
const WORLD_WIDTH = 4000;
const GRAVITY = 0.58;
const JUMP_POWER = -11.5;
const DAY_LENGTH = 5 * 60 * 1000;
const DOUBLE_JUMP_COOLDOWN = 3000;
const BASE_SPEED = 0.34 * 3.5 * 2;
const SPRINT_MULTIPLIER = 1.65;
const CROUCH_MULTIPLIER = 0.35;
const CROUCH_DROP = 12;
const LOW_CLEARANCE = 42;
const CAT_SCALE = 0.92;
const SPAWN_X = 120;
const SINK_DURATION = 750;
const RIVER_Y = 498;
const RIVER_FLOW = 0.6;
const SAVE_KEY = "whisker-way-save-v1";
const MAX_PIXEL_SCALE = 1.5;
const MAX_RISE = 85;
const MAX_DOUBLE_RISE = 150;
const DOUBLE_GAP_LEVEL = 5;
const FINAL_LEVEL = 10;
const FINALE_DURATION = 8000;
const LEADERBOARD_KEY = "whisker-way-leaderboard-v1";
const JUMP_SAFETY = 0.85;
const LOW_EDGE_CLEARANCE = 60;
const SCENERY_TOP = 200;
const FONT = '"Fredoka", "Nunito", "Varela Round", "Trebuchet MS", system-ui, sans-serif';

const SKINS = {
  ginger: {
    pattern: "tabby", base: "#e48c4e", shade: "#b9622f", light: "#fde9d0", markings: "#b05a2c",
    outline: "#5c3220", eye: "#e7b13e", eyeLight: "#fbe39a", nose: "#e88f8c", paw: "#f3b483",
    whisker: "rgba(255,248,236,0.9)",
  },
  tuxedo: {
    pattern: "tuxedo", base: "#35313f", shade: "#211e29", light: "#f6f1e9", markings: "#35313f",
    outline: "#141219", eye: "#a9cf4f", eyeLight: "#e6f5a6", nose: "#e7a3b0", paw: "#f6f1e9",
    whisker: "rgba(255,255,255,0.9)",
  },
  siamese: {
    pattern: "points", base: "#f3e8d4", shade: "#d6c3a1", light: "#fdf8ee", markings: "#5a4135",
    outline: "#4a352c", eye: "#5aa7e6", eyeLight: "#c6e6ff", nose: "#8e5f5c", paw: "#5a4135",
    whisker: "rgba(255,255,255,0.85)",
  },
  calico: {
    pattern: "calico", base: "#fbf6ee", shade: "#e0d4c2", light: "#ffffff", markings: "#e3843f",
    markings2: "#36303a", outline: "#584640", eye: "#b8c94e", eyeLight: "#eef5a8", nose: "#eea2a2",
    paw: "#fbf6ee", whisker: "rgba(110,90,85,0.65)",
  },
  silver: {
    pattern: "tabby", base: "#c9cdd6", shade: "#9ba2b0", light: "#f1f2f5", markings: "#5f6676",
    outline: "#3c414d", eye: "#7fc76a", eyeLight: "#d2f3b8", nose: "#d99aa6", paw: "#e6e8ee",
    whisker: "rgba(255,255,255,0.9)",
  },
};

const IDLE_POSE = { phase: 0, move: 0, stride: 6, crouch: 0, air: null, sniff: 0, time: 800 };
const ROCKET_PALETTES = [
  ["#ff7aa8", "#ffd36b"], ["#7ad7ff", "#c7a6ff"], ["#9cff8f", "#fff3a6"], ["#ffb36b", "#ff7a7a"],
];

const ACCESSORIES = [
  { id: "bell", slot: "collar", name: "Bell collar", price: 5 },
  { id: "bandana", slot: "collar", name: "Blue bandana", price: 8 },
  { id: "beret", slot: "hat", name: "Beret", price: 10 },
  { id: "flowers", slot: "hat", name: "Flower crown", price: 14 },
  { id: "witch", slot: "hat", name: "Witch hat", price: 20 },
  { id: "crown", slot: "hat", name: "Crown", price: 35 },
];

let platforms = [];
let collectibles = [];
let catnipPatches = [];
let obstacles = [];
let crows = [];
let dogs = [];
let drifters = [];
let level = 1;
let homeX = 0;
let transition = null;
let particles = [];
let pendingRockets = [];
let smokeTimer = 0;
let cameraX = 0;
let score = 0;
let pixelScale = 1;
let gameState = "title";
let menuIndex = 0;
let menuHitboxes = [];
let gameTime = 0;
let touchSprint = false;
let finishedRun = null;
let leaderboardFrom = "title";
let highlightDate = null;
let finaleTimers = { hop: 0, hearts: 0, confetti: 0, rockets: 0 };
let lastTime = performance.now();
const keys = {};

const save = loadSave();

const cat = {
  x: SPAWN_X, y: 0, width: 50, height: 46, vx: 0, vy: 0, grounded: true, ground: null,
  jumps: 0, doubleJumpReadyAt: 0, facing: 1, skin: save.skin,
  animTime: 0, sniffing: false, crouching: false,
  crouchAmount: 0, sniffAmount: 0, dustTimer: 0, sparkleTimer: 0, sinkingUntil: 0,
  stunnedUntil: 0, invulnerableUntil: 0, pitch: 0, landTimer: 0, landStrength: 0,
};
cat.y = 456 - cat.height;

/* ---------- helpers ---------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const bezier = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mixRgb(a, b, t) {
  return a.map((c, i) => lerp(c, b[i], t));
}

function css(rgb, alpha = 1) {
  return `rgba(${rgb.map(Math.round).join(",")},${alpha})`;
}

function mix(a, b, t) {
  return css(mixRgb(hexToRgb(a), hexToRgb(b), t));
}

function rgba(hex, alpha) {
  return css(hexToRgb(hex), alpha);
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function radialGlow(g, x, y, r, rgb, alpha) {
  const gradient = g.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gradient;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

const onScreen = (x, margin = 120) => x > cameraX - margin && x < cameraX + VIEW_W + margin;
const wrap = (value, span) => ((value % span) + span) % span;

function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loadSave() {
  const defaults = { level: 1, bank: 0, owned: [], equipped: { collar: null, hat: null }, skin: "ginger", muted: false, run: null };
  try {
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!stored) return defaults;
    return {
      ...defaults,
      ...stored,
      level: Math.min(FINAL_LEVEL, Math.max(1, Number(stored.level) || 1)),
      run: stored.run && typeof stored.run === "object" ? { ...newRun(1), ...stored.run } : null,
      bank: Math.max(0, Number(stored.bank) || 0),
      owned: Array.isArray(stored.owned) ? stored.owned : [],
      equipped: { ...defaults.equipped, ...(stored.equipped || {}) },
      skin: SKINS[stored.skin] ? stored.skin : defaults.skin,
    };
  } catch (error) {
    return defaults;
  }
}

function newRun(startLevel) {
  return { startLevel, time: 0, fish: 0, falls: 0, bumps: 0, doubleJumps: 0 };
}

function countStat(name) {
  if (save.run) save.run[name] += 1;
}

function loadLeaderboard() {
  try {
    const stored = JSON.parse(localStorage.getItem(LEADERBOARD_KEY));
    return Array.isArray(stored) ? stored.filter((entry) => entry && typeof entry.time === "number") : [];
  } catch (error) {
    return [];
  }
}

function writeLeaderboard(entries) {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch (error) {
    // Storage can be unavailable (private browsing); the board still shows for this session.
  }
}

function rankEntries(entries) {
  return entries.slice().sort((a, b) => a.time - b.time || b.fish - a.fish || a.date.localeCompare(b.date));
}

function formatTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds.toFixed(1)}`;
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    // Private browsing or file:// pages can refuse storage; the game still plays without saving.
  }
}

/* ---------- level ---------- */

function generateLevel(levelNumber) {
  let seed = levelNumber * 9176 + 23;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const tier = Math.min(levelNumber, 10);
  platforms = [makePlatform(0, 456, 520, 84)];
  collectibles = [];
  catnipPatches = [];
  obstacles = [];
  crows = [];
  dogs = [];
  homeX = 3750 + levelNumber * 10;

  let cursor = 520;
  let previousY = platforms[0].y;
  let previousKind = "plain";
  const doubleChance = levelNumber >= DOUBLE_GAP_LEVEL ? Math.min(0.35, 0.15 + 0.04 * (levelNumber - DOUBLE_GAP_LEVEL)) : 0;
  for (;;) {
    const kind = pickPlatformKind(levelNumber, random);
    const moving = kind === "moving-x" || kind === "moving-y";
    const amplitude = kind === "moving-x" ? 40 + random() * 30 : 0;
    const needsDouble = previousKind !== "crumble" && kind !== "crumble" && random() < doubleChance;
    let y;
    let gapBase;
    if (needsDouble) {
      y = clamp(previousY - (-60 + random() * (MAX_DOUBLE_RISE + 60)), 265, 420);
      const reach = doubleJumpReach(previousY - y) * JUMP_SAFETY;
      const single = clamp(jumpReach(previousY - y) + cat.width, 45, reach);
      gapBase = single + random() * (reach - single);
    } else {
      const step = Math.min(MAX_RISE, 55 + tier * 6);
      y = clamp(previousY + (random() * 2 - 1) * step, 265, 420);
      gapBase = Math.min(45 + random() * (40 + tier * 6), jumpReach(previousY - y) * JUMP_SAFETY);
    }
    const gap = gapBase + amplitude;
    const x = cursor + gap;
    const room = homeX - 180 - x - amplitude;
    if (room < 110) break;
    const width = Math.min(room, moving ? 100 + random() * 40 : Math.max(110, 130 + random() * 140 - tier * 4));
    const platform = makePlatform(x, y, width, 30);
    platform.needsDouble = needsDouble;
    if (kind === "moving-x") {
      platform.motion = { axis: "x", amplitude, speed: 0.8 + random() * 0.5 + tier * 0.03, phase: random() * Math.PI * 2 };
    } else if (kind === "moving-y") {
      platform.motion = { axis: "y", amplitude: 30 + random() * 25, speed: 0.8 + random() * 0.5 + tier * 0.03, phase: random() * Math.PI * 2 };
    } else if (kind === "crumble") {
      platform.crumble = { state: "idle", timer: 0, vy: 0, fadeIn: 1 };
    }
    platforms.push(platform);
    if (!moving && random() > 0.36) collectibles.push({ x: x + width * (0.25 + random() * 0.5), y: y - 35, collected: false });
    if (kind === "plain") decoratePlatform(platform, levelNumber, random);
    cursor = x + width + amplitude;
    previousY = y;
    previousKind = kind;
  }

  const distance = homeX - 120 - cursor;
  if (distance > 95) {
    const width = clamp(distance - 90, 60, 280);
    const x = cursor + (distance - width) / 2;
    platforms.push(makePlatform(x, clamp((previousY + 405) / 2, 300, 420), width, 30));
  }
  platforms.push(makePlatform(homeX - 120, 405, 300, 135));
  platforms.forEach((platform, index) => {
    platform.decor = buildPlatformDecor(platform, levelNumber * 100 + index);
  });
  drifters = buildDrifters(levelNumber);
}

function jumpReach(rise, doubleAt = 0) {
  const speed = BASE_SPEED * SPRINT_MULTIPLIER;
  let vy = JUMP_POWER;
  let height = 0;
  for (let frame = 1; frame < 300; frame++) {
    if (frame === doubleAt) vy = JUMP_POWER * 0.92;
    vy += GRAVITY;
    height -= vy;
    if (vy > 0 && height < rise && frame > doubleAt) return speed * frame;
  }
  return 0;
}

function doubleJumpReach(rise) {
  let best = 0;
  for (let doubleAt = 2; doubleAt < 45; doubleAt++) best = Math.max(best, jumpReach(rise, doubleAt));
  return best;
}

function makePlatform(x, y, width, height) {
  return { x, y, width, height, baseX: x, baseY: y, prevY: y, dx: 0, dy: 0 };
}

function pickPlatformKind(levelNumber, random) {
  const roll = random();
  const moving = levelNumber >= 2 ? Math.min(0.4, 0.18 + 0.04 * (levelNumber - 2)) : 0;
  const crumble = levelNumber >= 4 ? Math.min(0.35, 0.15 + 0.04 * (levelNumber - 4)) : 0;
  if (roll < moving) return random() > 0.5 ? "moving-x" : "moving-y";
  if (roll < moving + crumble) return "crumble";
  return "plain";
}

function decoratePlatform(p, levelNumber, random) {
  const tier = Math.min(levelNumber, 10);
  const taken = [];
  const claim = (width, edge = 12) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const start = p.x + edge + random() * Math.max(1, p.width - width - edge * 2);
      if (taken.every(([a, b]) => start + width < a - 30 || start > b + 30)) {
        taken.push([start, start + width]);
        return start;
      }
    }
    return null;
  };

  const dogChance = levelNumber >= 4 ? Math.min(0.4, 0.25 + 0.04 * (levelNumber - 4)) : 0;
  if (p.width >= 200 && random() < dogChance) {
    dogs.push({
      x: p.x + p.width / 2, y: p.y, dir: random() > 0.5 ? 1 : -1,
      minX: p.x + 26, maxX: p.x + p.width - 26, speed: 0.7 + tier * 0.05, step: 0, barkAt: 0,
    });
  } else {
    const lowChance = levelNumber >= 2 ? Math.min(0.45, 0.2 + 0.03 * (levelNumber - 2)) : 0;
    if (p.width >= 110 + LOW_EDGE_CLEARANCE * 2 && random() < lowChance) {
      const isLog = random() > 0.5;
      const width = isLog ? 80 + random() * 30 : 70 + random() * 30;
      const start = claim(width, LOW_EDGE_CLEARANCE);
      if (start !== null) {
        const height = isLog ? 16 : 48;
        obstacles.push({ kind: isLog ? "hollow" : "bough", x: start, y: p.y - LOW_CLEARANCE - height, width, height, low: true, platformY: p.y });
      }
    }
    if (random() > 0.52) {
      const width = 42 + random() * 35;
      const start = claim(width);
      if (start !== null) catnipPatches.push({ x: start, y: p.y - 9, width });
    }
    if (random() > 0.48) {
      const start = claim(20);
      if (start !== null) obstacles.push({ kind: random() > 0.5 ? "log" : "rock", x: start, y: p.y - 24, width: 20, height: 24 });
    }
  }

  const crowChance = levelNumber >= 3 ? Math.min(0.5, 0.2 + 0.05 * (levelNumber - 3)) : 0;
  if (random() < crowChance) {
    crows.push({
      x: p.x + random() * p.width, baseY: p.y - 44, y: p.y - 44, dir: random() > 0.5 ? 1 : -1,
      minX: p.x - 20, maxX: p.x + p.width + 20, speed: 1.1 + tier * 0.08, flap: random() * 6,
      phase: random() * 6, cawAt: 0,
    });
  }
}

function buildDrifters(levelNumber) {
  const items = [];
  for (let i = 0; i < 70; i++) {
    const seed = levelNumber * 31 + i;
    const roll = hash(seed * 1.3);
    items.push({
      base: hash(seed) * (WORLD_WIDTH + 200),
      kind: roll < 0.3 ? "lily" : roll < 0.75 ? "leaf" : "petal",
      speed: (roll < 0.3 ? 0.6 : 0.9 + hash(seed * 2.1) * 0.5) * RIVER_FLOW,
      depth: hash(seed * 3.7) * 22,
      spin: hash(seed * 5.9) * Math.PI * 2,
      color: ["#e9a23b", "#d9643a", "#b8c94e", "#f2c14e"][Math.floor(hash(seed * 7.3) * 4)],
    });
  }
  return items;
}

function buildPlatformDecor(p, seed) {
  const tufts = [];
  const pebbles = [];
  const flowers = [];
  for (let x = p.x + 6; x < p.x + p.width - 6; x += 9 + hash(seed + x) * 10) {
    tufts.push({ x, h: 4 + hash(seed + x * 1.7) * 6 });
  }
  const depth = Math.max(4, Math.min(p.height, 80) - 22);
  for (let i = 0; i < Math.floor(p.width / 26); i++) {
    pebbles.push({
      x: p.x + 10 + hash(seed + i * 3.1) * (p.width - 20),
      y: p.y + 16 + hash(seed + i * 5.3) * depth,
      r: 1.5 + hash(seed + i * 7.7) * 3,
    });
  }
  const petals = ["#ffd7e8", "#fff3b0", "#d9c8ff", "#ffffff"];
  for (let i = 0; i < p.width / 55; i++) {
    if (hash(seed + i * 11.3) > 0.5) {
      flowers.push({
        x: p.x + 12 + hash(seed + i * 13.1) * (p.width - 24),
        color: petals[Math.floor(hash(seed + i * 2.9) * petals.length)],
      });
    }
  }
  return { tufts, pebbles, flowers };
}

level = save.level;
generateLevel(level);

/* ---------- input & menus ---------- */

const GAME_KEYS = ["w", "a", "s", "d", "p", "escape", "enter", "arrowup", "arrowdown", "arrowleft", "arrowright"];

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const key = event.key.toLowerCase();
  if (event.code === "Space" || GAME_KEYS.includes(key)) event.preventDefault();
  Sound.unlock();
  if (key === "m" && !event.repeat) {
    toggleMute();
    return;
  }
  if (gameState !== "playing") {
    if (!event.repeat) handleMenuKey(key, event.code);
    return;
  }
  keys[key] = true;
  if ((key === "p" || key === "escape") && !event.repeat) {
    openPause();
    return;
  }
  if ((event.code === "Space" || key === "w") && !event.repeat) jump();
});
window.addEventListener("keyup", (event) => { keys[event.key.toLowerCase()] = false; });

function menuItems() {
  if (gameState === "title") {
    const items = [];
    if (save.level > 1) items.push({ label: `Continue · Level ${save.level}`, action: () => startGame(save.level) });
    items.push({ label: save.level > 1 ? "New game" : "Play", action: () => startGame(1) });
    items.push({ label: "Leaderboard", action: () => openLeaderboard("title") });
    items.push({ label: `Sound: ${save.muted ? "Off" : "On"}`, action: toggleMute });
    return items;
  }
  if (gameState === "results") {
    return finishedRun && finishedRun.startLevel === 1 ? [] : [{ label: "View leaderboard", action: () => openLeaderboard("finish") }];
  }
  if (gameState === "leaderboard") {
    return leaderboardFrom === "finish"
      ? [{ label: "Play again", action: () => startGame(1) }, { label: "Title screen", action: quitToTitle }]
      : [{ label: "Back", action: () => { gameState = "title"; menuIndex = 0; } }];
  }
  return [
    { label: "Resume", action: closePause },
    { label: "Restart level", action: () => { closePause(); restartLevel(); } },
    { label: `Sound: ${save.muted ? "Off" : "On"}`, action: toggleMute },
    { label: "Quit to title", action: quitToTitle },
  ];
}

function handleMenuKey(key, code) {
  const items = menuItems();
  if (!items.length) return;
  if (key === "w" || key === "arrowup" || key === "a" || key === "arrowleft") {
    menuIndex = (menuIndex + items.length - 1) % items.length;
    Sound.play("tick");
  } else if (key === "s" || key === "arrowdown" || key === "d" || key === "arrowright") {
    menuIndex = (menuIndex + 1) % items.length;
    Sound.play("tick");
  } else if (code === "Space" || key === "enter") {
    Sound.play("select");
    items[menuIndex].action();
  } else if (gameState === "paused" && (key === "p" || key === "escape")) {
    closePause();
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * VIEW_W, y: ((event.clientY - rect.top) / rect.height) * VIEW_H };
}

function menuHit(event) {
  const point = canvasPoint(event);
  return menuHitboxes.find((box) => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h);
}

canvas.addEventListener("mousemove", (event) => {
  if (gameState === "playing") return;
  const hit = menuHit(event);
  canvas.style.cursor = hit ? "pointer" : "default";
  if (hit && hit.index !== menuIndex) {
    menuIndex = hit.index;
    Sound.play("tick");
  }
});

canvas.addEventListener("click", (event) => {
  Sound.unlock();
  if (gameState === "playing") return;
  const hit = menuHit(event);
  if (!hit) return;
  Sound.play("select");
  menuItems()[hit.index].action();
});

function startGame(startLevel) {
  hideNameForm();
  level = startLevel;
  save.level = startLevel;
  if (startLevel === 1 || !save.run) save.run = newRun(startLevel);
  writeSave();
  restartLevel();
  gameState = "playing";
  menuIndex = 0;
  canvas.style.cursor = "default";
}

function restartLevel() {
  generateLevel(level);
  respawn();
  particles = [];
  pendingRockets = [];
  transition = null;
  cameraX = 0;
}

function openPause() {
  gameState = "paused";
  menuIndex = 0;
  Sound.setPurr(false);
}

function closePause() {
  gameState = "playing";
  canvas.style.cursor = "default";
}

function quitToTitle() {
  hideNameForm();
  setTouchSprint(false);
  writeSave();
  level = save.level;
  restartLevel();
  gameState = "title";
  menuIndex = 0;
}

function toggleMute() {
  save.muted = !save.muted;
  Sound.setMuted(save.muted);
  writeSave();
}

/* ---------- gameplay ---------- */

function sprinting() {
  return Boolean(keys.shift) || touchSprint;
}

function jump() {
  if (gameState !== "playing" || transition || cat.sinkingUntil || gameTime < cat.stunnedUntil) return;
  const feetX = cat.x + cat.width / 2;
  const feetY = cat.y + cat.height;
  if (cat.grounded) {
    if (blockedOverhead()) return;
    cat.vy = JUMP_POWER;
    cat.grounded = false;
    cat.ground = null;
    cat.jumps = 1;
    cat.sniffing = false;
    spawnDust(feetX, feetY, 5);
    Sound.play("jump");
  } else if (cat.jumps === 1 && gameTime >= cat.doubleJumpReadyAt) {
    cat.vy = JUMP_POWER * 0.92;
    cat.jumps = 2;
    cat.doubleJumpReadyAt = gameTime + DOUBLE_JUMP_COOLDOWN;
    cat.sniffing = false;
    countStat("doubleJumps");
    Sound.play("doubleJump");
    spawn({ x: feetX, y: feetY, size: 6, grow: 1.1, decay: 0.045, color: "#ffffff", shape: "ring", glow: true });
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI * (0.15 + 0.7 * (i / 7));
      spawn({
        x: feetX, y: feetY, vx: Math.cos(angle) * 2.2, vy: Math.sin(angle) * 1.2,
        drag: 0.92, decay: 0.04, size: 2, color: "#fff6d8", shape: "star", glow: true,
      });
    }
  }
}

const catTop = () => cat.y + (cat.crouching ? CROUCH_DROP : 0);
const overlapsX = (o, inset = 6) => cat.x + cat.width - inset > o.x && cat.x + inset < o.x + o.width;
const overlapsSolid = (o, top) => overlapsX(o) && cat.y + cat.height > o.y + 0.5 && top < o.y + o.height;
const catBox = () => {
  const top = catTop();
  return { x: cat.x + 6, y: top, w: cat.width - 12, h: cat.y + cat.height - top };
};
const isSolidPlatform = (p) => !(p.crumble && p.crumble.state === "falling");

function blockedOverhead() {
  return obstacles.some((o) => o.low && overlapsSolid(o, cat.y));
}

function resolveHorizontal(dx) {
  const top = catTop();
  for (const o of obstacles) {
    if (!overlapsSolid(o, top)) continue;
    const pushLeft = dx > 0 || (dx === 0 && cat.x + cat.width / 2 < o.x + o.width / 2);
    cat.x = pushLeft ? o.x - cat.width + 6 : o.x + o.width - 6;
    cat.vx = 0;
  }
}

function knockBack(fromX) {
  const dir = cat.x + cat.width / 2 < fromX ? -1 : 1;
  cat.vx = dir * 4.5;
  cat.vy = -6.5;
  cat.grounded = false;
  cat.ground = null;
  cat.crouching = false;
  cat.sniffing = false;
  cat.jumps = 1;
  cat.stunnedUntil = gameTime + 450;
  cat.invulnerableUntil = gameTime + 1300;
  countStat("bumps");
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 + (i - 2.5) * 0.45;
    spawn({
      x: cat.x + cat.width / 2, y: cat.y + 6, vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2,
      drag: 0.9, decay: 0.03, size: 3, color: "#fff2a8", shape: "star", glow: true,
    });
  }
  Sound.play("hurt");
}

function stepCat(delta) {
  const frozen = transition !== null;
  const stunned = gameTime < cat.stunnedUntil;
  if (cat.grounded && cat.ground) {
    cat.x += cat.ground.dx;
    cat.y += cat.ground.dy;
  }
  const forcedCrouch = cat.grounded && blockedOverhead();
  cat.crouching = cat.grounded && !cat.sniffing && !frozen && (Boolean(keys.s) || forcedCrouch);
  const stride = sprinting() ? 8 : 6;
  const speed = BASE_SPEED * (sprinting() ? SPRINT_MULTIPLIER : 1) * (cat.crouching ? CROUCH_MULTIPLIER : 1);
  const canMove = !cat.sniffing && !frozen && !stunned;
  if (canMove && (keys.arrowleft || keys.a)) { cat.vx = -speed; cat.facing = -1; }
  else if (canMove && (keys.arrowright || keys.d)) { cat.vx = speed; cat.facing = 1; }
  else cat.vx *= Math.pow(stunned ? 0.94 : 0.78, delta);
  if ((cat.sniffing || frozen) && !stunned) cat.vx = 0;

  const dx = cat.vx * delta;
  cat.x = clamp(cat.x + dx, 0, WORLD_WIDTH - cat.width);
  resolveHorizontal(dx);

  const previousBottom = cat.y + cat.height;
  const previousTop = catTop();
  const wasGrounded = cat.grounded;
  const impact = cat.vy;
  cat.vy += GRAVITY * delta;
  cat.y += cat.vy * delta;
  cat.grounded = false;
  cat.ground = null;

  const land = (surfaceY, platform) => {
    cat.y = surfaceY - cat.height;
    cat.vy = 0;
    cat.grounded = true;
    cat.jumps = 0;
    cat.ground = platform;
  };
  for (const p of platforms) {
    if (!isSolidPlatform(p) || !overlapsX(p)) continue;
    if (previousBottom <= Math.max(p.y, p.prevY) + 0.5 && cat.y + cat.height >= p.y && cat.vy >= 0) land(p.y, p);
  }
  for (const o of obstacles) {
    if (overlapsX(o) && previousBottom <= o.y + 0.5 && cat.y + cat.height >= o.y && cat.vy >= 0) land(o.y, null);
  }
  if (cat.vy < 0) {
    for (const o of obstacles) {
      const bottom = o.y + o.height;
      if (overlapsX(o) && previousTop >= bottom - 0.5 && cat.y < bottom) {
        cat.y = bottom;
        cat.vy = 0;
      }
    }
  }
  if (cat.ground && cat.ground.crumble && cat.ground.crumble.state === "idle") {
    cat.ground.crumble.state = "shaking";
    cat.ground.crumble.timer = 0;
  }
  if (!wasGrounded && cat.grounded && impact > 1.5) {
    cat.landTimer = 0;
    cat.landStrength = clamp(impact / 12, 0.35, 1);
  }
  if (!wasGrounded && cat.grounded && impact > 3) {
    spawnDust(cat.x + cat.width / 2, cat.y + cat.height, 8);
    Sound.play("land");
  }
  cat.landTimer += delta;
  if (cat.grounded) {
    cat.pitch *= Math.pow(0.8, delta);
  } else {
    const targetPitch = 0.25 * clamp(-cat.vy / 10, 0, 1) - 0.22 * clamp(cat.vy / 10, 0, 1);
    cat.pitch += (targetPitch - cat.pitch) * (1 - Math.pow(0.75, delta));
  }

  cat.sniffing = cat.grounded && catnipPatches.some((patch) => overlapsX(patch));
  if (cat.sniffing) cat.vx = 0;
  Sound.setPurr(cat.sniffing);

  if (cat.y + cat.height >= RIVER_Y + 4) {
    createSplash(cat.x + cat.width / 2, RIVER_Y);
    countStat("falls");
    Sound.play("splash");
    Sound.setPurr(false);
    cat.sinkingUntil = gameTime + SINK_DURATION;
    cat.vx = 0;
    cat.vy = 0;
    return;
  }

  if (gameTime >= cat.invulnerableUntil && !frozen) {
    const box = catBox();
    const crow = crows.find((c) => boxesOverlap(box, { x: c.x - 13, y: c.y - 7, w: 26, h: 14 }));
    const dog = dogs.find((d) => boxesOverlap(box, { x: d.x - 18, y: d.y - 26, w: 36, h: 26 }));
    const hit = crow || dog;
    if (hit) knockBack(hit.x);
  }

  const move = cat.grounded && !cat.sniffing ? clamp(Math.abs(cat.vx) / BASE_SPEED, 0, 1) : 0;
  if (move > 0.02) cat.animTime += (Math.abs(cat.vx) * delta) / (4 * stride * Math.max(move, 0.35));
  const ease = 1 - Math.pow(0.7, delta);
  cat.crouchAmount += ((cat.crouching ? 1 : 0) - cat.crouchAmount) * ease;
  cat.sniffAmount += ((cat.sniffing ? 1 : 0) - cat.sniffAmount) * ease * 0.6;

  if (sprinting() && move > 0.5) {
    cat.dustTimer += Math.abs(cat.vx) * delta;
    if (cat.dustTimer > 26) {
      cat.dustTimer = 0;
      spawnDust(cat.x + cat.width / 2 - cat.facing * 14, cat.y + cat.height, 2);
    }
  }
  if (cat.sniffing) {
    cat.sparkleTimer += delta;
    if (cat.sparkleTimer > 9) {
      cat.sparkleTimer = 0;
      const heart = Math.random() > 0.4;
      spawn({
        x: cat.x + cat.width / 2 + cat.facing * 22 + (Math.random() - 0.5) * 8,
        y: cat.y + 10,
        vx: (Math.random() - 0.5) * 0.6, vy: -0.6 - Math.random() * 0.4, gravity: -0.005, drag: 0.99,
        decay: 0.012, size: 3.5 + Math.random() * 2, color: Math.random() > 0.5 ? "#ff9ec7" : "#cdb6ff",
        shape: heart ? "heart" : "star", glow: true,
      });
    }
  }

  if (cat.y > VIEW_H + 100) respawn();
  collectibles.forEach((fish) => {
    if (!fish.collected && Math.abs(cat.x + cat.width / 2 - fish.x) < 28 && Math.abs(cat.y + cat.height / 2 - fish.y) < 35) {
      fish.collected = true;
      score += 1;
      Sound.play("fish");
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        spawn({
          x: fish.x, y: fish.y, vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2, drag: 0.9,
          decay: 0.035, size: 2.5, color: "#ffd77a", shape: "star", glow: true,
        });
      }
    }
  });

  if (!transition && cat.x + cat.width > homeX && cat.y + cat.height > 350) beginLevelTransition();
}

function updatePlatforms(delta) {
  for (const p of platforms) {
    p.prevY = p.y;
    p.dx = 0;
    p.dy = 0;
    if (p.motion) {
      const m = p.motion;
      const offset = Math.sin(gameTime * 0.001 * m.speed + m.phase) * m.amplitude;
      const nx = m.axis === "x" ? p.baseX + offset : p.baseX;
      const ny = m.axis === "y" ? p.baseY + offset : p.baseY;
      p.dx = nx - p.x;
      p.dy = ny - p.y;
      p.x = nx;
      p.y = ny;
    }
    if (p.crumble) {
      const c = p.crumble;
      c.fadeIn = Math.min(1, c.fadeIn + 0.04 * delta);
      if (c.state === "shaking") {
        c.timer += delta;
        if (c.timer > 36) {
          c.state = "falling";
          c.timer = 0;
          c.vy = 0;
          Sound.play("crumble");
          for (let i = 0; i < 14; i++) {
            spawn({
              x: p.x + Math.random() * p.width, y: p.y + 6 + Math.random() * 18,
              vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 1.5, gravity: 0.25,
              decay: 0.02, size: 1.5 + Math.random() * 2.5, color: "#a07a52", shape: "soft",
            });
          }
        }
      } else if (c.state === "falling") {
        c.timer += delta;
        c.vy += 0.4 * delta;
        p.y += c.vy * delta;
        if (c.timer > 180) {
          c.state = "idle";
          c.timer = 0;
          c.fadeIn = 0;
          p.y = p.baseY;
          p.prevY = p.y;
        }
      }
    }
  }
}

function updateCreatures(delta) {
  for (const crow of crows) {
    crow.x += crow.dir * crow.speed * delta;
    if (crow.x > crow.maxX) { crow.x = crow.maxX; crow.dir = -1; }
    else if (crow.x < crow.minX) { crow.x = crow.minX; crow.dir = 1; }
    crow.flap += delta * 0.35;
    crow.y = crow.baseY + Math.sin(gameTime * 0.004 + crow.phase) * 1.8;
    if (gameState === "playing" && onScreen(crow.x, -40) && gameTime > crow.cawAt && Math.random() < 0.004 * delta) {
      crow.cawAt = gameTime + 4000;
      Sound.play("caw");
    }
  }
  for (const dog of dogs) {
    dog.x += dog.dir * dog.speed * delta;
    if (dog.x > dog.maxX) { dog.x = dog.maxX; dog.dir = -1; }
    else if (dog.x < dog.minX) { dog.x = dog.minX; dog.dir = 1; }
    dog.step += delta * 0.09;
    const near = Math.abs(cat.x + cat.width / 2 - dog.x) < 150 && Math.abs(cat.y + cat.height - dog.y) < 60;
    if (gameState === "playing" && near && gameTime > dog.barkAt) {
      dog.barkAt = gameTime + 2200;
      Sound.play("woof");
      spawn({ x: dog.x + dog.dir * 18, y: dog.y - 40, vy: -0.5, decay: 0.016, size: 13, color: "#ffffff", shape: "text", text: "Woof!" });
    }
  }
}

function update(delta) {
  updatePlatforms(delta);
  updateCreatures(delta);
  if (gameState === "playing" && !transition && save.run) save.run.time += delta * 16.67;
  if (transition && transition.phase === "finale") updateFinale(delta);
  if (gameState === "results" || gameState === "leaderboard") updateEncoreFireworks(delta);
  if (gameState === "playing") {
    if (cat.sinkingUntil) {
      if (gameTime >= cat.sinkingUntil) {
        cat.sinkingUntil = 0;
        respawn();
      }
    } else {
      stepCat(delta);
    }
  }

  pendingRockets = pendingRockets.filter((rocket) => {
    if (gameTime < rocket.at) return true;
    launchRocket(rocket.x);
    return false;
  });

  if (onScreen(homeX)) {
    smokeTimer += delta;
    if (smokeTimer > 14) {
      smokeTimer = 0;
      spawn({
        x: homeX + 74, y: 282, vx: 0.15 + Math.random() * 0.2, vy: -0.45 - Math.random() * 0.2,
        drag: 0.995, decay: 0.006, size: 4, grow: 0.07, color: "#ece6ef", alpha: 0.45, shape: "soft",
      });
    }
  }

  updateParticles(delta);
  updateTransition();
  cameraX += (Math.max(0, Math.min(WORLD_WIDTH - VIEW_W, cat.x - VIEW_W * 0.38)) - cameraX) * Math.min(1, 0.1 * delta);
}

function respawn() {
  cat.x = SPAWN_X; cat.y = 456 - cat.height; cat.vx = 0; cat.vy = 0; cat.jumps = 0;
  cat.grounded = true; cat.ground = platforms[0];
  cat.sniffing = false; cat.crouching = false; cat.sniffAmount = 0; cat.crouchAmount = 0;
  cat.stunnedUntil = 0; cat.invulnerableUntil = 0;
  cat.pitch = 0; cat.landStrength = 0;
  collectibles.forEach((fish) => { fish.collected = false; });
  score = 0;
  Sound.setPurr(false);
}

function beginLevelTransition() {
  save.bank += score;
  if (save.run) save.run.fish += score;
  Sound.setPurr(false);
  if (level >= FINAL_LEVEL) {
    beginFinale();
    return;
  }
  transition = { phase: "celebrate", startedAt: gameTime, banked: score };
  save.level = level + 1;
  writeSave();
  refreshWardrobe();
  Sound.play("fanfare");
  Sound.play("meow");
  pendingRockets = [0, 220, 480, 760, 1000].map((delay) => ({
    at: gameTime + delay,
    x: homeX + 40 + (Math.random() - 0.5) * 220,
  }));
}

function updateTransition() {
  if (!transition) return;
  const elapsed = gameTime - transition.startedAt;
  if (transition.phase === "celebrate" && elapsed > 1500) {
    transition = { phase: "out", startedAt: gameTime };
  } else if (transition.phase === "out" && elapsed > 900) {
    level += 1;
    generateLevel(level);
    respawn();
    particles = [];
    pendingRockets = [];
    cameraX = 0;
    transition = { phase: "in", startedAt: gameTime };
  } else if (transition.phase === "in" && elapsed > 1200) {
    transition = null;
  } else if (transition.phase === "finale" && elapsed > FINALE_DURATION) {
    transition = { phase: "finaleOut", startedAt: gameTime };
  } else if (transition.phase === "finaleOut" && elapsed > 900) {
    transition = null;
    showResults();
  }
}

const CONFETTI_COLORS = ["#ff7eb6", "#ffd36b", "#8fe27b", "#7cc7ff", "#c9a2ff", "#ff9a6b"];

function beginFinale() {
  transition = { phase: "finale", startedAt: gameTime, banked: score };
  finishedRun = save.run ? { ...save.run } : null;
  save.run = null;
  save.level = 1;
  writeSave();
  refreshWardrobe();
  Sound.play("finale");
  Sound.play("meow");
  finaleTimers = { hop: 30, hearts: 0, confetti: 0, rockets: 0 };
  pendingRockets = [];
}

function updateFinale(delta) {
  const elapsed = gameTime - transition.startedAt;
  finaleTimers.rockets -= delta;
  if (elapsed < FINALE_DURATION - 1500 && finaleTimers.rockets <= 0) {
    finaleTimers.rockets = 8 + Math.random() * 12;
    launchRocket(cameraX + 120 + Math.random() * (VIEW_W - 240), Math.random() < 0.3 ? "heart" : "burst", Math.random() * 2.2);
  }
  finaleTimers.confetti -= delta;
  while (finaleTimers.confetti <= 0) {
    finaleTimers.confetti += 1.2;
    spawn({
      x: cameraX + Math.random() * VIEW_W, y: -10, vx: (Math.random() - 0.5) * 1.2, vy: 1 + Math.random() * 1.2,
      gravity: 0.02, drag: 0.99, decay: 0.004, size: 2.5 + Math.random() * 2.5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      shape: "confetti", angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.3,
    });
  }
  if (cat.grounded) {
    finaleTimers.hop -= delta;
    if (finaleTimers.hop <= 0) {
      finaleTimers.hop = 36 + Math.random() * 12;
      cat.vy = -7;
      cat.grounded = false;
      cat.ground = null;
      if (Math.random() < 0.35) cat.facing *= -1;
      spawnDust(cat.x + cat.width / 2, cat.y + cat.height, 4);
    }
  }
  finaleTimers.hearts -= delta;
  if (finaleTimers.hearts <= 0) {
    finaleTimers.hearts = 10;
    spawn({
      x: cat.x + cat.width / 2 + (Math.random() - 0.5) * 30, y: cat.y + 4,
      vx: (Math.random() - 0.5) * 0.8, vy: -0.8 - Math.random() * 0.5, gravity: -0.005, drag: 0.99,
      decay: 0.012, size: 4 + Math.random() * 2.5, color: Math.random() > 0.5 ? "#ff9ec7" : "#ffd1e6", shape: "heart", glow: true,
    });
  }
}

function updateEncoreFireworks(delta) {
  finaleTimers.rockets -= delta;
  if (finaleTimers.rockets <= 0) {
    finaleTimers.rockets = 70 + Math.random() * 60;
    launchRocket(cameraX + 150 + Math.random() * (VIEW_W - 300), Math.random() < 0.3 ? "heart" : "burst", Math.random() * 1.5);
  }
}

function showResults() {
  gameState = "results";
  menuIndex = 0;
  const form = document.querySelector("#nameForm");
  if (form && finishedRun && finishedRun.startLevel === 1) {
    form.hidden = false;
    const input = document.querySelector("#playerName");
    input.value = "";
    input.focus();
  }
}

function hideNameForm() {
  const form = document.querySelector("#nameForm");
  if (form) form.hidden = true;
}

function submitName(event) {
  event.preventDefault();
  if (!finishedRun) return;
  const input = document.querySelector("#playerName");
  const entry = {
    name: (input.value.trim() || "Anonymous cat").slice(0, 16),
    time: Math.round(finishedRun.time),
    fish: finishedRun.fish,
    falls: finishedRun.falls,
    bumps: finishedRun.bumps,
    doubleJumps: finishedRun.doubleJumps,
    coat: cat.skin,
    date: new Date().toISOString(),
  };
  writeLeaderboard(rankEntries([...loadLeaderboard(), entry]).slice(0, 50));
  highlightDate = entry.date;
  finishedRun = null;
  input.blur();
  Sound.play("buy");
  openLeaderboard("finish");
}

function openLeaderboard(from) {
  hideNameForm();
  leaderboardFrom = from;
  gameState = "leaderboard";
  menuIndex = 0;
}

/* ---------- particles ---------- */

function spawn(options) {
  particles.push(Object.assign({
    vx: 0, vy: 0, gravity: 0, drag: 1, life: 1, decay: 0.02, size: 3, grow: 0,
    color: "#ffffff", alpha: 1, shape: "soft", glow: false,
  }, options));
}

function spawnDust(x, y, count) {
  for (let i = 0; i < count; i++) {
    spawn({
      x: x + (Math.random() - 0.5) * 18, y: y - 2,
      vx: (Math.random() - 0.5) * 1.8, vy: -Math.random() * 0.9 - 0.2, gravity: 0.02, drag: 0.94,
      decay: 0.03 + Math.random() * 0.02, size: 2.5 + Math.random() * 2.5, grow: 0.06,
      color: "#efe2cf", alpha: 0.75, shape: "soft",
    });
  }
}

function createSplash(x, y) {
  for (let i = 0; i < 26; i++) {
    spawn({
      x: x + (Math.random() - 0.5) * 14, y,
      vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 6.5, gravity: 0.32,
      decay: 0.02, size: 1.5 + Math.random() * 2, color: "#e2f9ff", shape: "drop",
    });
  }
  for (let i = 0; i < 3; i++) {
    spawn({ x, y: y + 2, size: 4 + i * 4, grow: 0.9 + i * 0.35, decay: 0.022, color: "#e8fdff", shape: "ring" });
  }
  for (let i = 0; i < 8; i++) {
    spawn({
      x: x + (Math.random() - 0.5) * 30, y: y + 2, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.6,
      drag: 0.95, decay: 0.025, size: 3 + Math.random() * 3, grow: 0.08, color: "#ffffff", alpha: 0.7, shape: "soft",
    });
  }
}

function launchRocket(x, pattern = "burst", power = 0) {
  const palette = ROCKET_PALETTES[Math.floor(Math.random() * ROCKET_PALETTES.length)];
  spawn({
    x, y: 400, vx: (Math.random() - 0.5) * 0.8, vy: -7 - Math.random() * 1.6 - power, gravity: 0.16,
    decay: 0.003, size: 2.5, color: "#fff4d6", shape: "rocket", glow: true, palette, pattern,
  });
  Sound.play("launch");
}

function explode(rocket) {
  Sound.play("pop");
  spawn({ x: rocket.x, y: rocket.y, size: 34, decay: 0.09, color: "#fff6e0", shape: "soft", glow: true, alpha: 0.6 });
  if (rocket.pattern === "heart") {
    for (let i = 0; i < 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      spawn({
        x: rocket.x, y: rocket.y, vx: hx * 0.17, vy: hy * 0.17, gravity: 0.02, drag: 0.965,
        decay: 0.012, size: 2.2, color: i % 2 ? "#ff7eb6" : "#ffd1e6", shape: "spark", glow: true,
      });
    }
    return;
  }
  for (let i = 0; i < 52; i++) {
    const angle = (i / 52) * Math.PI * 2 + Math.random() * 0.12;
    const speed = 2 + Math.random() * 3.4;
    spawn({
      x: rocket.x, y: rocket.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      gravity: 0.05, drag: 0.982, decay: 0.011 + Math.random() * 0.008, size: 2.2,
      color: rocket.palette[i % 2], shape: "spark", glow: true,
    });
  }
}

function updateParticles(delta) {
  for (const p of particles) {
    p.vy += p.gravity * delta;
    const drag = Math.pow(p.drag, delta);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.life -= p.decay * delta;
    p.size += p.grow * delta;
    if (p.spin) p.angle += p.spin * delta;
    if (p.shape === "rocket" && p.vy > -1.2 && !p.exploded) {
      p.exploded = true;
      p.life = 0;
      explode(p);
    }
  }
  particles = particles.filter((p) => p.life > 0);
}

function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.45, y - s, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.35, x, y + s * 0.35);
  g.closePath();
}

function sparklePath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x, y, x + s, y);
  g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y);
  g.quadraticCurveTo(x, y, x, y - s);
  g.closePath();
}

function drawParticle(g, p) {
  const alpha = clamp(p.life, 0, 1) * p.alpha;
  if (alpha <= 0) return;
  switch (p.shape) {
    case "ring":
      g.strokeStyle = rgba(p.color, alpha);
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(p.x, p.y, p.size, p.size * 0.3, 0, 0, Math.PI * 2);
      g.stroke();
      break;
    case "spark":
    case "rocket": {
      const trail = p.shape === "rocket" ? 3.5 : 2.6;
      g.strokeStyle = rgba(p.color, alpha);
      g.lineWidth = p.size;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(p.x - p.vx * trail, p.y - p.vy * trail);
      g.lineTo(p.x, p.y);
      g.stroke();
      break;
    }
    case "heart":
      heartPath(g, p.x, p.y, p.size);
      g.fillStyle = rgba(p.color, alpha);
      g.fill();
      break;
    case "star":
      sparklePath(g, p.x, p.y, p.size);
      g.fillStyle = rgba(p.color, alpha);
      g.fill();
      break;
    case "drop":
      g.fillStyle = rgba(p.color, alpha);
      g.beginPath();
      g.ellipse(p.x, p.y, p.size * 0.8, p.size * 1.3, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2);
      g.fill();
      break;
    case "confetti":
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.angle);
      g.scale(1, 0.25 + Math.abs(Math.cos(p.angle * 1.7)) * 0.75);
      g.fillStyle = rgba(p.color, alpha);
      g.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      g.restore();
      break;
    case "text":
      g.font = `600 ${p.size}px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 3.5;
      g.strokeStyle = rgba("#4a3a2c", alpha * 0.85);
      g.strokeText(p.text, p.x, p.y);
      g.fillStyle = rgba(p.color, alpha);
      g.fillText(p.text, p.x, p.y);
      break;
    default:
      g.fillStyle = rgba(p.color, alpha);
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
  }
}

/* ---------- cat sprite ---------- */

function solveKnee(hx, hy, fx, fy, length) {
  const dx = fx - hx;
  const dy = fy - hy;
  const dist = Math.hypot(dx, dy) || 1;
  const reach = Math.min(dist, length * 2 - 0.01);
  const along = reach / 2;
  const bend = Math.sqrt(Math.max(0, length * length - along * along));
  const ux = dx / dist;
  const uy = dy / dist;
  return [hx + ux * along - uy * bend, hy + uy * along + ux * bend];
}

function computeLegs(by, pose) {
  const p = pose.phase * Math.PI * 2;
  const legs = [
    { hip: [-16, by + 7], off: Math.PI, rear: true, near: false },
    { hip: [12, by + 6], off: 0, rear: false, near: false },
    { hip: [-12, by + 8], off: 0, rear: true, near: true },
    { hip: [16, by + 7], off: Math.PI, rear: false, near: true },
  ];
  for (const leg of legs) {
    const [hx, hy] = leg.hip;
    let fx;
    let fy;
    if (pose.air !== null) {
      const rise = Math.max(0, -pose.air);
      const fall = Math.max(0, pose.air);
      if (leg.rear) { fx = hx - 9 * rise + 4 * fall; fy = hy + 14 - 4 * rise - 4 * fall; }
      else { fx = hx + 9 * rise + 5 * fall; fy = hy + 12 - 4 * rise + 3 * fall; }
      if (!leg.near) fx += leg.rear ? 2 : -2;
    } else {
      fx = hx + Math.sin(p + leg.off) * pose.stride * pose.move + (leg.rear ? -4 : 4) * pose.crouch;
      fy = -Math.max(0, Math.cos(p + leg.off)) * 5 * pose.move;
    }
    leg.foot = [fx, fy];
    leg.ankle = [fx, fy - 2.5];
    leg.width = (leg.rear ? 7.5 : 6.5) - (leg.near ? 0 : 0.6);
    leg.knee = solveKnee(hx, hy, fx, fy - 2.5, leg.rear ? 8 : 7.6);
  }
  return legs;
}

function strokeLeg(g, leg, width, color) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(leg.hip[0], leg.hip[1]);
  g.lineTo(leg.knee[0], leg.knee[1]);
  g.lineTo(leg.ankle[0], leg.ankle[1]);
  g.stroke();
}

function strokeLowerLeg(g, leg, width, color) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(leg.knee[0], leg.knee[1]);
  g.lineTo(leg.ankle[0], leg.ankle[1]);
  g.stroke();
}

function pawPath(g, leg, extra) {
  g.beginPath();
  g.ellipse(leg.foot[0] + 1.5, leg.foot[1] - 2.6, 4.6 + extra, 3 + extra, 0, 0, Math.PI * 2);
}

function catBodyPath(g, by) {
  g.beginPath();
  g.moveTo(-25, by + 1);
  g.bezierCurveTo(-25, by - 10, -16, by - 13, -4, by - 12);
  g.bezierCurveTo(8, by - 12, 16, by - 11, 20, by - 4);
  g.bezierCurveTo(23, by + 2, 20, by + 10, 12, by + 11);
  g.bezierCurveTo(4, by + 12, -10, by + 12, -18, by + 10);
  g.bezierCurveTo(-24, by + 9, -26, by + 6, -25, by + 1);
  g.closePath();
}

function addEllipse(g, x, y, rx, ry, rotation) {
  g.moveTo(x + rx * Math.cos(rotation), y + rx * Math.sin(rotation));
  g.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
}

function catTorsoPath(g, by) {
  catBodyPath(g, by);
  addEllipse(g, -15, by + 2, 10.5, 9.5, -0.2);
  addEllipse(g, 15, by + 1, 8.5, 9.5, 0.15);
  addEllipse(g, 19, by - 6, 7, 8, 0.4);
}

function catHeadPath(g) {
  g.beginPath();
  g.moveTo(-11, 1);
  g.bezierCurveTo(-12, -8, -5, -13, 2, -13);
  g.bezierCurveTo(10, -13, 15, -7, 15, 0);
  g.bezierCurveTo(15, 6, 10, 10, 3, 10.5);
  g.bezierCurveTo(-5, 11, -11, 8, -11, 1);
  g.closePath();
}

function backEarPath(g) {
  g.beginPath();
  g.moveTo(-10, -4);
  g.quadraticCurveTo(-12, -15, -8, -19.5);
  g.quadraticCurveTo(-3, -16, 1, -10);
  g.closePath();
}

function frontEarPath(g) {
  g.beginPath();
  g.moveTo(1, -10);
  g.quadraticCurveTo(6, -18, 10.5, -20.5);
  g.quadraticCurveTo(13, -12, 12, -4);
  g.closePath();
}

function tailColor(s, u) {
  switch (s.pattern) {
    case "tabby":
      return u > 0.88 || (u > 0.15 && Math.floor(u * 7) % 2 === 1) ? s.markings : s.base;
    case "points":
      return mix(s.base, s.markings, clamp((u - 0.1) * 1.6, 0, 1));
    case "calico":
      return u < 0.4 ? s.markings : u < 0.75 ? s.markings2 : s.markings;
    default:
      return s.base;
  }
}

function drawTail(g, s, by, t, pose, outlineWidth) {
  const sway = Math.sin(t * 2.2) * 3.5 * (1 - pose.move * 0.6) + Math.sin(pose.phase * Math.PI * 2) * 1.5 * pose.move;
  const k = clamp(pose.move + (pose.air !== null ? 0.5 : 0), 0, 1);
  const low = pose.crouch * (1 - k * 0.5);
  const p0 = [-22, by - 5];
  const p1 = [lerp(-33, -36, k), lerp(by - 3, by - 6, k) + 2 * low];
  const p2 = [lerp(-41, -46, k) - 4 * low, lerp(by - 15, by - 10, k) + 8 * low];
  const p3 = [lerp(-35 + sway, -55, k) - 10 * low, lerp(by - 28, by - 17 + sway * 0.5, k) + 16 * low];
  const points = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    points.push([bezier(p0[0], p1[0], p2[0], p3[0], u), bezier(p0[1], p1[1], p2[1], p3[1], u), u]);
  }
  const radius = (u) => 4.6 - u * 1.7 + Math.sin(u * Math.PI) * 0.4;
  g.fillStyle = s.outline;
  for (const [x, y, u] of points) {
    g.beginPath();
    g.arc(x, y, radius(u) + outlineWidth / 2, 0, Math.PI * 2);
    g.fill();
  }
  for (const [x, y, u] of points) {
    g.fillStyle = tailColor(s, u);
    g.beginPath();
    g.arc(x, y, radius(u), 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(255,255,255,0.14)";
  for (const [x, y, u] of points) {
    if (u > 0.92) continue;
    g.beginPath();
    g.arc(x + 0.6, y - radius(u) * 0.4, radius(u) * 0.45, 0, Math.PI * 2);
    g.fill();
  }
}

function paintBodyPattern(g, s, by) {
  if (s.pattern === "tabby") {
    g.strokeStyle = rgba(s.markings, 0.85);
    g.lineWidth = 2.6;
    for (let i = 0; i < 5; i++) {
      const x = -18 + i * 7.5;
      g.beginPath();
      g.moveTo(x, by - 14);
      g.quadraticCurveTo(x + 2.5, by - 8, x - 1, by - 2 + (i % 2) * 2);
      g.stroke();
    }
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(-15, by + 2, 5, -0.5, Math.PI * 1.3);
    g.stroke();
    g.fillStyle = rgba(s.light, 0.95);
    g.beginPath();
    g.ellipse(18, by + 5, 6, 7.5, 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rgba(s.light, 0.55);
    g.beginPath();
    g.ellipse(0, by + 12, 13, 4, 0, 0, Math.PI * 2);
    g.fill();
  } else if (s.pattern === "tuxedo") {
    g.fillStyle = s.light;
    g.beginPath();
    g.ellipse(18, by + 4, 7.5, 9, 0.15, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(2, by + 12.5, 12, 4.5, 0, 0, Math.PI * 2);
    g.fill();
  } else if (s.pattern === "points") {
    g.fillStyle = rgba(s.markings, 0.16);
    g.beginPath();
    g.ellipse(-4, by - 10, 19, 6, 0, 0, Math.PI * 2);
    g.fill();
  } else if (s.pattern === "calico") {
    g.fillStyle = s.markings;
    g.beginPath();
    g.ellipse(-5, by - 7, 10, 7, -0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(12, by - 9, 5, 4, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = s.markings2;
    g.beginPath();
    g.ellipse(-20, by + 1, 8, 10, 0.3, 0, Math.PI * 2);
    g.fill();
  }
}

function paintHeadPattern(g, s) {
  if (s.pattern === "tabby") {
    g.strokeStyle = rgba(s.markings, 0.85);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-2, -11.5); g.lineTo(-1, -6.5);
    g.moveTo(2.5, -12.5); g.lineTo(2.5, -7);
    g.moveTo(7, -11.5); g.lineTo(6, -6.5);
    g.moveTo(-10, 0.5); g.lineTo(-5, 1.5);
    g.moveTo(-10, 3.5); g.lineTo(-5, 4);
    g.stroke();
  } else if (s.pattern === "tuxedo") {
    g.fillStyle = s.light;
    g.beginPath();
    g.ellipse(8.5, 5.5, 7.5, 5.5, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(7, 1); g.lineTo(8.6, -7); g.lineTo(10.4, 1);
    g.closePath();
    g.fill();
  } else if (s.pattern === "points") {
    const mask = g.createRadialGradient(8.5, 3.5, 0.5, 8.5, 3.5, 12);
    mask.addColorStop(0, rgba(s.markings, 0.95));
    mask.addColorStop(0.55, rgba(s.markings, 0.55));
    mask.addColorStop(1, rgba(s.markings, 0));
    g.fillStyle = mask;
    g.fillRect(-12, -14, 28, 26);
  } else if (s.pattern === "calico") {
    g.fillStyle = s.markings;
    g.beginPath();
    g.ellipse(-4, -8, 8, 6, -0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = s.markings2;
    g.beginPath();
    g.ellipse(10, -10, 4.5, 3.5, 0.3, 0, Math.PI * 2);
    g.fill();
  }
}

function drawEye(g, x, y, rx, ry, s, state) {
  if (state === "blink") {
    g.strokeStyle = s.outline;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - rx, y + 0.5);
    g.quadraticCurveTo(x, y + 1.8, x + rx, y + 0.5);
    g.stroke();
    return;
  }
  if (state === "bliss") {
    g.strokeStyle = s.outline;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - rx, y + 1);
    g.quadraticCurveTo(x, y - 2.2, x + rx, y + 1);
    g.stroke();
    return;
  }
  g.fillStyle = s.outline;
  g.beginPath();
  g.ellipse(x, y, rx + 0.7, ry + 0.7, 0, 0, Math.PI * 2);
  g.fill();
  const iris = g.createRadialGradient(x, y + ry * 0.35, 0.2, x, y, ry);
  iris.addColorStop(0, s.eyeLight);
  iris.addColorStop(1, s.eye);
  g.fillStyle = iris;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c1622";
  g.beginPath();
  g.ellipse(x + rx * 0.15, y, rx * 0.42, ry * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(x - rx * 0.3, y - ry * 0.4, rx * 0.38, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(x + rx * 0.35, y + ry * 0.45, rx * 0.18, 0, Math.PI * 2);
  g.fill();
}

function drawFace(g, s, pose, t) {
  const lightMuzzle = s.pattern !== "points";
  if (lightMuzzle) {
    g.fillStyle = s.pattern === "tuxedo" ? s.light : rgba(s.light, 0.95);
    g.beginPath();
    g.ellipse(8.5, 5, 6, 4.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(255,143,163,0.3)";
  g.beginPath();
  g.ellipse(1.5, 4.5, 2.7, 1.6, 0, 0, Math.PI * 2);
  g.fill();

  const blinking = (t + 1.3) % 4.6 < 0.13;
  const state = pose.sniff > 0.5 ? "bliss" : blinking ? "blink" : "open";
  drawEye(g, 3, -2, 2.9, 3.5, s, state);
  drawEye(g, 11.6, -2.4, 2.1, 3.1, s, state);

  const twitch = pose.sniff > 0.5 ? Math.sin(t * 22) * 0.4 : 0;
  g.fillStyle = s.nose;
  g.beginPath();
  g.moveTo(7.3, 2.2 + twitch);
  g.lineTo(10.7, 2.2 + twitch);
  g.quadraticCurveTo(10.4, 3.6 + twitch, 9, 4.4 + twitch);
  g.quadraticCurveTo(7.6, 3.6 + twitch, 7.3, 2.2 + twitch);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(8.4, 2.7 + twitch, 0.9, 0.5, 0, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = rgba(s.outline, 0.8);
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(9, 4.4); g.lineTo(9, 5.4);
  g.quadraticCurveTo(8, 6.6, 6.8, 5.9);
  g.moveTo(9, 5.4);
  g.quadraticCurveTo(10, 6.6, 11.2, 5.9);
  g.stroke();

  g.strokeStyle = s.whisker;
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(12, 4.5); g.quadraticCurveTo(17, 3, 21.5, 2.6);
  g.moveTo(12.3, 5.6); g.quadraticCurveTo(17, 5.6, 22, 6.4);
  g.moveTo(12, 6.6); g.quadraticCurveTo(16.5, 7.8, 20.5, 9.6);
  g.moveTo(5, 5); g.quadraticCurveTo(1, 3.8, -3, 3.6);
  g.moveTo(5, 6.2); g.quadraticCurveTo(1, 6.4, -3, 7);
  g.stroke();
}

function drawCollar(g, id, by) {
  g.lineCap = "round";
  if (id === "bell") {
    g.strokeStyle = "#5a1c22";
    g.lineWidth = 4.6;
    g.beginPath();
    g.moveTo(11.5, by - 9);
    g.quadraticCurveTo(15, by + 1.5, 27, by + 1);
    g.stroke();
    g.strokeStyle = "#d9363e";
    g.lineWidth = 2.8;
    g.stroke();
    g.fillStyle = "#5a3d12";
    g.beginPath();
    g.arc(24, by + 4, 3.3, 0, Math.PI * 2);
    g.fill();
    const shine = g.createRadialGradient(23, by + 3, 0.3, 24, by + 4, 2.6);
    shine.addColorStop(0, "#fff6c4");
    shine.addColorStop(1, "#e3a92b");
    g.fillStyle = shine;
    g.beginPath();
    g.arc(24, by + 4, 2.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5a3d12";
    g.fillRect(23.6, by + 4.6, 0.8, 1.6);
  } else if (id === "bandana") {
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(12, by - 7);
    g.quadraticCurveTo(16, by + 1, 28, by + 0.5);
    g.lineTo(23, by + 10);
    g.quadraticCurveTo(17, by + 5, 12, by - 7);
    g.closePath();
    g.fillStyle = "#1e3560";
    g.strokeStyle = "#1e3560";
    g.lineWidth = 2.4;
    g.stroke();
    g.fillStyle = "#3f7ad1";
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)";
    for (const [x, y] of [[17, by + 1], [22, by + 2.5], [21, by + 6], [25, by + 2]]) {
      g.beginPath();
      g.arc(x, y, 0.8, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawHat(g, id, t) {
  const ink = "#3a2626";
  g.lineJoin = "round";
  g.lineCap = "round";
  if (id === "beret") {
    g.save();
    g.translate(-1, -14);
    g.rotate(-0.18);
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(0, 0, 12.5, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#c2313f";
    g.beginPath();
    g.ellipse(0, -0.3, 11.2, 4.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.beginPath();
    g.ellipse(-3, -2, 5, 1.6, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(1, -4.5);
    g.lineTo(1.5, -7.5);
    g.stroke();
    g.restore();
  } else if (id === "flowers") {
    g.strokeStyle = "#4f7a32";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-10, -9);
    g.quadraticCurveTo(2, -19, 14, -9);
    g.stroke();
    const colors = ["#ff8fb1", "#ffe17a", "#ffffff", "#b99cff", "#ff8fb1"];
    for (let i = 0; i < 5; i++) {
      const u = i / 4;
      const x = lerp(-9, 13, u);
      const y = -9 - Math.sin(u * Math.PI) * 5.5;
      g.fillStyle = "#6ba045";
      g.beginPath();
      g.ellipse(x + 2.5, y + 1, 2.2, 1, 0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = colors[i];
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 + i;
        g.beginPath();
        g.arc(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 1.45, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#e89a2c";
      g.beginPath();
      g.arc(x, y, 1, 0, Math.PI * 2);
      g.fill();
    }
  } else if (id === "witch") {
    const sway = Math.sin(t * 1.8) * 1.2;
    const cone = () => {
      g.beginPath();
      g.moveTo(-8, -13);
      g.quadraticCurveTo(-4, -24, -6 + sway, -30);
      g.quadraticCurveTo(-9 + sway, -34, -14 + sway, -35);
      g.quadraticCurveTo(-5 + sway, -29, 1 + sway * 0.4, -26);
      g.quadraticCurveTo(7, -20, 10, -13);
      g.closePath();
    };
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineWidth = 2.4;
    cone();
    g.stroke();
    g.beginPath();
    g.ellipse(1, -13, 16.5, 4.4, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4b3a74";
    g.beginPath();
    g.ellipse(1, -13.3, 15.2, 3.3, -0.05, 0, Math.PI * 2);
    g.fill();
    cone();
    g.fill();
    g.fillStyle = "#e7a33c";
    g.beginPath();
    g.moveTo(-7.4, -15);
    g.quadraticCurveTo(1, -17.5, 9.4, -15);
    g.lineTo(8.8, -17.6);
    g.quadraticCurveTo(1, -20, -6.4, -17.6);
    g.closePath();
    g.fill();
    g.fillStyle = "#fff0b0";
    sparklePath(g, -12 + sway, -33, 2);
    g.fill();
  } else if (id === "crown") {
    const crown = () => {
      g.beginPath();
      g.moveTo(-6, -11.5);
      g.lineTo(-7, -21);
      g.lineTo(-2.5, -16.5);
      g.lineTo(1.5, -23);
      g.lineTo(5.5, -16.5);
      g.lineTo(10, -21);
      g.lineTo(9, -11.5);
      g.quadraticCurveTo(1.5, -13, -6, -11.5);
      g.closePath();
    };
    g.strokeStyle = "#6b4410";
    g.lineWidth = 2.4;
    crown();
    g.stroke();
    const gold = g.createLinearGradient(0, -23, 0, -11);
    gold.addColorStop(0, "#fff1a6");
    gold.addColorStop(0.5, "#f2c440");
    gold.addColorStop(1, "#c98d1c");
    g.fillStyle = gold;
    crown();
    g.fill();
    g.fillStyle = "#e0405a";
    g.beginPath();
    g.arc(1.5, -14.5, 1.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#58a7e8";
    g.beginPath();
    g.arc(-3.5, -14, 1.1, 0, Math.PI * 2);
    g.moveTo(7.6, -14);
    g.arc(6.5, -14, 1.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff9d8";
    for (const [x, y] of [[-7, -21], [1.5, -23], [10, -21]]) {
      g.beginPath();
      g.arc(x, y, 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawCatSprite(g, skinKey, pose, outfit = null) {
  const s = SKINS[skinKey];
  const t = pose.time / 1000;
  const breathe = Math.sin(t * 2.4) * (1 - pose.move);
  const bob = pose.air === null ? Math.abs(Math.sin(pose.phase * Math.PI * 2)) * 1.5 * pose.move : 0;
  const by = -24 + pose.crouch * CROUCH_DROP - bob;
  const legs = computeLegs(by, pose);
  const farLegs = legs.filter((leg) => !leg.near);
  const nearLegs = legs.filter((leg) => leg.near);
  const rising = pose.air !== null ? Math.max(0, -pose.air) : 0;
  const head = {
    x: 24 + 4 * pose.sniff,
    y: by - 11 + 11 * pose.sniff - breathe * 0.4,
    rot: 0.38 * pose.sniff - 0.12 * rising,
  };
  const OUT = 3.2;
  const farPaw = s.pattern === "points" ? s.markings : mix(s.paw, s.shade, 0.45);
  const lowerLeg = s.pattern === "points" ? mix(s.base, s.markings, 0.8) : null;

  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  const pitch = pose.pitch || 0;
  if (pitch) {
    const pivotX = pitch > 0 ? -12 : 16;
    g.translate(pivotX, 0);
    g.rotate(-pitch);
    g.translate(-pivotX, 0);
  }

  drawTail(g, s, by, t, pose, OUT);

  for (const leg of farLegs) {
    strokeLeg(g, leg, leg.width + OUT, s.outline);
    pawPath(g, leg, OUT / 2);
    g.fillStyle = s.outline;
    g.fill();
  }
  for (const leg of farLegs) {
    strokeLeg(g, leg, leg.width, s.shade);
    if (lowerLeg) strokeLowerLeg(g, leg, leg.width, mix(s.shade, s.markings, 0.8));
    pawPath(g, leg, 0);
    g.fillStyle = farPaw;
    g.fill();
  }

  g.fillStyle = s.outline;
  g.strokeStyle = s.outline;
  g.lineWidth = OUT;
  catTorsoPath(g, by);
  g.fill();
  g.stroke();
  g.save();
  g.translate(head.x, head.y);
  g.rotate(head.rot);
  for (const shape of [backEarPath, frontEarPath, catHeadPath]) {
    shape(g);
    g.fill();
    g.stroke();
  }
  g.restore();
  for (const leg of nearLegs) {
    strokeLeg(g, leg, leg.width + OUT, s.outline);
    pawPath(g, leg, OUT / 2);
    g.fillStyle = s.outline;
    g.fill();
  }

  for (const leg of nearLegs) {
    strokeLeg(g, leg, leg.width, s.base);
    if (lowerLeg) strokeLowerLeg(g, leg, leg.width, lowerLeg);
    pawPath(g, leg, 0);
    g.fillStyle = s.paw;
    g.fill();
    g.strokeStyle = rgba(s.outline, 0.35);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(leg.foot[0] + 3, leg.foot[1] - 4.3);
    g.lineTo(leg.foot[0] + 3, leg.foot[1] - 1.5);
    g.moveTo(leg.foot[0] + 5, leg.foot[1] - 4);
    g.lineTo(leg.foot[0] + 5, leg.foot[1] - 1.8);
    g.stroke();
  }

  g.fillStyle = s.base;
  catTorsoPath(g, by);
  g.fill();

  g.save();
  catTorsoPath(g, by);
  g.clip();
  paintBodyPattern(g, s, by);
  const bodyShade = g.createLinearGradient(0, by - 13, 0, by + 13);
  bodyShade.addColorStop(0, "rgba(255,255,255,0.2)");
  bodyShade.addColorStop(0.45, "rgba(255,255,255,0)");
  bodyShade.addColorStop(1, rgba(s.shade, 0.7));
  g.fillStyle = bodyShade;
  g.fillRect(-40, by - 22, 80, 44);
  g.restore();

  if (outfit && outfit.collar) drawCollar(g, outfit.collar, by);

  g.save();
  g.translate(head.x, head.y);
  g.rotate(head.rot);
  g.fillStyle = s.base;
  catHeadPath(g);
  g.fill();
  backEarPath(g);
  g.fillStyle = s.pattern === "points" ? s.markings : s.pattern === "calico" ? s.markings2 : s.base;
  g.fill();
  frontEarPath(g);
  g.fillStyle = s.pattern === "points" ? s.markings : s.base;
  g.fill();

  g.fillStyle = rgba(s.nose, 0.5);
  g.beginPath();
  g.moveTo(-8.5, -7); g.quadraticCurveTo(-9.8, -14, -7.6, -16.5); g.quadraticCurveTo(-4.5, -14, -2, -10.5);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(240,165,173,0.9)";
  g.beginPath();
  g.moveTo(3, -10); g.quadraticCurveTo(6.5, -15.5, 9.8, -17.5); g.quadraticCurveTo(11.4, -12, 10.6, -7);
  g.closePath();
  g.fill();

  g.save();
  catHeadPath(g);
  g.clip();
  g.fillStyle = s.base;
  g.fillRect(-12, -14, 28, 26);
  paintHeadPattern(g, s);
  const headLight = g.createRadialGradient(-2, -6, 1, -2, -6, 16);
  headLight.addColorStop(0, "rgba(255,255,255,0.18)");
  headLight.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = headLight;
  g.fillRect(-12, -14, 28, 26);
  const headShade = g.createLinearGradient(0, 2, 0, 11);
  headShade.addColorStop(0, "rgba(0,0,0,0)");
  headShade.addColorStop(1, rgba(s.shade, 0.5));
  g.fillStyle = headShade;
  g.fillRect(-12, -14, 28, 26);
  drawFace(g, s, pose, t);
  g.restore();
  if (outfit && outfit.hat) drawHat(g, outfit.hat, t);
  g.restore();

  g.restore();
}

/* ---------- world rendering ---------- */

const SCENERY_LAYERS = [
  { parallax: 0.12, paint: (g, w) => { drawHills(g, w, 300, 42, "#a5c9dd", 1.7); drawMist(g, w, 260, 380, "236,240,246", 0.45); } },
  { parallax: 0.28, paint: (g, w) => { drawHills(g, w, 348, 34, "#82b5a3", 4.1); drawMist(g, w, 320, 410, "226,238,232", 0.35); } },
  { parallax: 0.5, paint: (g, w) => { drawTreeLine(g, w); drawValley(g, w); } },
];
const caches = { scale: 0, vignette: null, sky: null, skyNight: -1, skyTwilight: -1, scenery: [] };

function makeCanvas(width, height) {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  return el;
}

function blit(g, image) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(image, 0, 0);
  g.restore();
}

function ensureCaches() {
  if (caches.scale === pixelScale) return;
  caches.scale = pixelScale;
  caches.vignette = makeCanvas(canvas.width, canvas.height);
  paintVignette(caches.vignette.getContext("2d"));
  caches.sky = makeCanvas(canvas.width, canvas.height);
  caches.skyNight = -1;
  caches.scenery = SCENERY_LAYERS.map((def) => {
    const width = VIEW_W + (WORLD_WIDTH - VIEW_W) * def.parallax + 4;
    const el = makeCanvas(Math.ceil(width * pixelScale), Math.ceil((VIEW_H - SCENERY_TOP) * pixelScale));
    const g = el.getContext("2d");
    g.setTransform(pixelScale, 0, 0, pixelScale, 0, -SCENERY_TOP * pixelScale);
    def.paint(g, width);
    return el;
  });
}

function paintSkyGradient(g, night, twilight) {
  const top = mixRgb(mixRgb(hexToRgb("#76bde6"), hexToRgb("#0e1433"), night), hexToRgb("#5a6cb8"), twilight * 0.7);
  const bottom = mixRgb(mixRgb(hexToRgb("#ffe7c7"), hexToRgb("#2e2c5e"), night), hexToRgb("#ffa77e"), twilight * 0.7);
  g.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, VIEW_H * 0.8);
  sky.addColorStop(0, css(top));
  sky.addColorStop(1, css(bottom));
  g.fillStyle = sky;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawSky(g, night, twilight, t) {
  ensureCaches();
  if (Math.abs(night - caches.skyNight) > 0.01 || Math.abs(twilight - caches.skyTwilight) > 0.01) {
    paintSkyGradient(caches.sky.getContext("2d"), night, twilight);
    caches.skyNight = night;
    caches.skyTwilight = twilight;
  }
  blit(g, caches.sky);

  const starAlpha = Math.pow(clamp((night - 0.3) / 0.7, 0, 1), 1.3);
  if (starAlpha > 0) {
    for (let i = 0; i < 90; i++) {
      const x = (hash(i) * VIEW_W * 1.2 - cameraX * 0.01) % VIEW_W;
      const y = hash(i + 50) * 260;
      const twinkle = 0.5 + 0.5 * Math.sin(t * (1 + hash(i + 9)) * 2 + i);
      const size = 0.6 + hash(i + 3) * 1.2;
      g.fillStyle = `rgba(255,250,230,${starAlpha * twinkle})`;
      g.beginPath();
      g.arc((x + VIEW_W) % VIEW_W, y, size, 0, Math.PI * 2);
      g.fill();
      if (size > 1.5) {
        sparklePath(g, (x + VIEW_W) % VIEW_W, y, size * 3);
        g.fillStyle = `rgba(255,250,230,${starAlpha * twinkle * 0.5})`;
        g.fill();
      }
    }
  }

  const sunAlpha = clamp(1 - night * 1.8, 0, 1);
  if (sunAlpha > 0) {
    const sx = 780 - cameraX * 0.02;
    const sy = 90 + night * 260;
    radialGlow(g, sx, sy, 130, "255,236,180", 0.55 * sunAlpha);
    g.fillStyle = css(mixRgb(hexToRgb("#fff4cf"), hexToRgb("#ffb27a"), twilight), sunAlpha);
    g.beginPath();
    g.arc(sx, sy, 30, 0, Math.PI * 2);
    g.fill();
  }
  const moonAlpha = clamp((night - 0.35) * 2.2, 0, 1);
  if (moonAlpha > 0) {
    const mx = 210 - cameraX * 0.02;
    const my = 90 + (1 - night) * 240;
    radialGlow(g, mx, my, 100, "190,210,255", 0.35 * moonAlpha);
    g.fillStyle = `rgba(246,243,232,${moonAlpha})`;
    g.beginPath();
    g.arc(mx, my, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(200,196,190,${0.5 * moonAlpha})`;
    for (const [dx, dy, r] of [[-7, -5, 4.5], [6, 4, 3.2], [-2, 9, 2.4], [8, -8, 2]]) {
      g.beginPath();
      g.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawClouds(g, night, twilight, t) {
  const light = mixRgb(mixRgb(hexToRgb("#ffffff"), hexToRgb("#4a5282"), night), hexToRgb("#ffd5c4"), twilight * 0.6);
  const shadow = mixRgb(light, hexToRgb("#3a3f6a"), 0.22);
  const alpha = lerp(0.92, 0.45, night);
  const puffs = [[0, 0, 22], [24, -10, 26], [50, -2, 20], [-22, 4, 16], [72, 6, 14]];
  for (let i = 0; i < 8; i++) {
    const span = VIEW_W + 400;
    const speed = 4 + hash(i + 4) * 6;
    const x = ((hash(i) * span - cameraX * 0.1 + t * speed) % span + span) % span - 200;
    const y = 60 + hash(i + 9) * 130;
    const scale = 0.6 + hash(i + 2) * 0.8;
    for (const [color, offset] of [[shadow, 5], [light, 0]]) {
      g.fillStyle = css(color, alpha);
      g.beginPath();
      for (const [dx, dy, r] of puffs) {
        g.moveTo(x + dx * scale + r * scale, y + dy * scale + offset);
        g.arc(x + dx * scale, y + dy * scale + offset, r * scale, 0, Math.PI * 2);
      }
      g.fill();
    }
  }
}

function hillY(worldX, base, amp, seed) {
  return base
    + Math.sin(worldX * 0.004 + seed) * amp
    + Math.sin(worldX * 0.011 + seed * 2.3) * amp * 0.45
    + Math.sin(worldX * 0.023 + seed) * amp * 0.15;
}

function drawHills(g, width, base, amp, color, seed) {
  g.beginPath();
  g.moveTo(0, VIEW_H);
  for (let sx = 0; sx <= width + 10; sx += 10) g.lineTo(sx, hillY(sx, base, amp, seed));
  g.lineTo(width + 10, VIEW_H);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

function drawMist(g, width, top, bottom, rgb, alpha) {
  const mist = g.createLinearGradient(0, top, 0, bottom);
  mist.addColorStop(0, `rgba(${rgb},0)`);
  mist.addColorStop(1, `rgba(${rgb},${alpha})`);
  g.fillStyle = mist;
  g.fillRect(0, top, width, bottom - top);
}

function drawTreeLine(g, width) {
  const spacing = 58;
  for (let i = -3; i < width / spacing + 3; i++) {
    const x = i * spacing + hash(i) * 30;
    const height = 60 + hash(i + 3.3) * 55;
    const base = 400 + hash(i + 7) * 14;
    const r = 17 + hash(i + 1.1) * 10;
    g.fillStyle = "#4d6a57";
    g.fillRect(x - 3, base - height * 0.4, 6, height * 0.4 + 50);
    g.fillStyle = hash(i + 2.2) > 0.5 ? "#5e9b79" : "#4f8b6c";
    g.beginPath();
    for (const [dx, dy, rr] of [[0, -0.5, 1], [-0.6, -0.32, 0.78], [0.6, -0.34, 0.82], [0, -0.7, 0.72]]) {
      const cx = x + dx * r;
      const cy = base + dy * height;
      g.moveTo(cx + r * rr, cy);
      g.arc(cx, cy, r * rr, 0, Math.PI * 2);
    }
    g.fill();
    g.fillStyle = "rgba(220,255,200,0.16)";
    g.beginPath();
    g.arc(x - r * 0.3, base - height * 0.66, r * 0.45, 0, Math.PI * 2);
    g.fill();
  }
}

function drawValley(g, width) {
  const valley = g.createLinearGradient(0, 380, 0, VIEW_H);
  valley.addColorStop(0, "rgba(140,185,175,0)");
  valley.addColorStop(0.35, "rgba(106,154,148,0.9)");
  valley.addColorStop(1, "#2c4d56");
  g.fillStyle = valley;
  g.fillRect(0, 380, width, VIEW_H - 380);
}

function drawScenery(g) {
  ensureCaches();
  const w = layer.width;
  const y = Math.round(SCENERY_TOP * pixelScale);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  SCENERY_LAYERS.forEach((def, i) => {
    const strip = caches.scenery[i];
    const sx = clamp(Math.round(cameraX * def.parallax * pixelScale), 0, strip.width - w);
    g.drawImage(strip, sx, 0, w, strip.height, 0, y, w, strip.height);
  });
  g.restore();
}

function drawPlatform(g, p, t) {
  if (p.motion) {
    drawCloudPlatform(g, p, t);
    return;
  }
  if (p.crumble) {
    drawCrumblePlatform(g, p);
    return;
  }
  const floating = p.height <= 40;
  const bottom = floating ? p.y + p.height + 10 : VIEW_H + 20;
  const soil = g.createLinearGradient(0, p.y, 0, floating ? bottom : p.y + 130);
  soil.addColorStop(0, "#a3714f");
  soil.addColorStop(1, "#5a3a2c");
  g.fillStyle = soil;
  if (floating) {
    g.beginPath();
    g.moveTo(p.x, p.y + 4);
    g.lineTo(p.x + p.width, p.y + 4);
    g.quadraticCurveTo(p.x + p.width - 3, p.y + p.height, p.x + p.width * 0.66, bottom - 2);
    g.quadraticCurveTo(p.x + p.width * 0.5, bottom + 6, p.x + p.width * 0.34, bottom - 2);
    g.quadraticCurveTo(p.x + 3, p.y + p.height, p.x, p.y + 4);
    g.fill();
    g.strokeStyle = "rgba(90,58,44,0.8)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const rx = p.x + p.width * (0.3 + i * 0.2 + hash(p.x + i) * 0.08);
      g.beginPath();
      g.moveTo(rx, bottom - 4);
      g.quadraticCurveTo(rx + 4, bottom + 6, rx - 2, bottom + 12 + hash(p.x + i * 3) * 8);
      g.stroke();
    }
  } else {
    roundRectPath(g, p.x, p.y + 4, p.width, bottom - p.y, 8);
    g.fill();
    g.strokeStyle = "rgba(70,45,35,0.35)";
    g.lineWidth = 2;
    for (let y = p.y + 40; y < Math.min(bottom, VIEW_H); y += 34) {
      g.beginPath();
      g.moveTo(p.x + 6, y);
      for (let x = p.x + 6; x < p.x + p.width - 6; x += 24) g.lineTo(x, y + Math.sin(x * 0.07) * 2.5);
      g.stroke();
    }
  }
  for (const pebble of p.decor.pebbles) {
    if (pebble.y > bottom - 8) continue;
    g.fillStyle = "rgba(60,38,30,0.35)";
    g.beginPath();
    g.ellipse(pebble.x, pebble.y + 1, pebble.r * 1.3, pebble.r, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,230,200,0.2)";
    g.beginPath();
    g.ellipse(pebble.x - pebble.r * 0.3, pebble.y - pebble.r * 0.2, pebble.r * 0.6, pebble.r * 0.4, 0, 0, Math.PI * 2);
    g.fill();
  }

  const grass = g.createLinearGradient(0, p.y - 3, 0, p.y + 14);
  grass.addColorStop(0, "#a2dc72");
  grass.addColorStop(1, "#5a9e4b");
  g.fillStyle = grass;
  g.beginPath();
  g.moveTo(p.x - 3, p.y + 2);
  g.quadraticCurveTo(p.x - 3, p.y - 3, p.x + 4, p.y - 3);
  g.lineTo(p.x + p.width - 4, p.y - 3);
  g.quadraticCurveTo(p.x + p.width + 3, p.y - 3, p.x + p.width + 3, p.y + 2);
  let x = p.x + p.width + 3;
  g.lineTo(x, p.y + 8);
  while (x > p.x - 3) {
    const next = Math.max(p.x - 3, x - 12);
    g.quadraticCurveTo((x + next) / 2, p.y + 15, next, p.y + 8);
    x = next;
  }
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(225,255,195,0.65)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(p.x + 4, p.y - 2);
  g.lineTo(p.x + p.width - 4, p.y - 2);
  g.stroke();

  g.strokeStyle = "#6db354";
  g.lineWidth = 1.5;
  g.lineCap = "round";
  for (const tuft of p.decor.tufts) {
    const sway = Math.sin(t * 2 + tuft.x * 0.05) * 1.2;
    g.beginPath();
    g.moveTo(tuft.x - 2, p.y - 2);
    g.quadraticCurveTo(tuft.x - 2, p.y - 2 - tuft.h * 0.6, tuft.x - 3 + sway, p.y - 2 - tuft.h);
    g.moveTo(tuft.x + 1, p.y - 2);
    g.quadraticCurveTo(tuft.x + 1, p.y - 2 - tuft.h * 0.7, tuft.x + 2 + sway, p.y - 2 - tuft.h * 0.85);
    g.stroke();
  }
  for (const flower of p.decor.flowers) {
    const sway = Math.sin(t * 1.6 + flower.x) * 1;
    const fx = flower.x + sway;
    const fy = p.y - 10;
    g.strokeStyle = "#5c9c4a";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(flower.x, p.y - 2);
    g.quadraticCurveTo(flower.x, p.y - 6, fx, fy);
    g.stroke();
    g.fillStyle = flower.color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(fx + Math.cos(a) * 2.2, fy + Math.sin(a) * 2.2, 1.7, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#ffcf5a";
    g.beginPath();
    g.arc(fx, fy, 1.3, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCloudPlatform(g, p, t) {
  const puffs = Math.max(3, Math.round(p.width / 26));
  const outline = () => {
    g.beginPath();
    for (let i = 0; i < puffs; i++) {
      const u = (i + 0.5) / puffs;
      const r = 13 + hash(p.baseX + i) * 5;
      const cx = p.x + u * p.width;
      const cy = p.y + r - 4 + Math.sin(t * 1.4 + i) * 0.8;
      g.moveTo(cx + r, cy);
      g.arc(cx, cy, r, 0, Math.PI * 2);
    }
    addEllipse(g, p.x + p.width / 2, p.y + 16, p.width / 2 + 6, 10, 0);
  };
  g.fillStyle = "rgba(120,140,190,0.35)";
  g.save();
  g.translate(0, 4);
  outline();
  g.fill();
  g.restore();
  const body = g.createLinearGradient(0, p.y - 6, 0, p.y + 26);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.6, "#eef3ff");
  body.addColorStop(1, "#c7d3f0");
  g.fillStyle = body;
  outline();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.beginPath();
  g.ellipse(p.x + p.width * 0.35, p.y + 1, p.width * 0.22, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(170,190,240,0.5)";
  const arrows = p.motion.axis === "x" ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
  for (const [ax, ay] of arrows) {
    const cx = p.x + p.width / 2 + ax * 10;
    const cy = p.y + 14 + ay * 3;
    g.beginPath();
    g.moveTo(cx + ax * 4 + ay * 0, cy + ay * 4);
    g.lineTo(cx - ay * 3 - ax * 1, cy + ax * 3 - ay * 1);
    g.lineTo(cx + ay * 3 - ax * 1, cy - ax * 3 - ay * 1);
    g.closePath();
    g.fill();
  }
}

function drawCrumblePlatform(g, p) {
  const c = p.crumble;
  const shake = c.state === "shaking" ? Math.sin(gameTime * 0.09) * (1 + c.timer / 18) : 0;
  const alpha = c.state === "falling" ? clamp(1 - c.timer / 60, 0, 1) : c.fadeIn;
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(shake, 0);
  const bottom = p.y + p.height;
  const rock = g.createLinearGradient(0, p.y, 0, bottom + 8);
  rock.addColorStop(0, "#e7cfa0");
  rock.addColorStop(1, "#a57d55");
  g.fillStyle = rock;
  g.beginPath();
  g.moveTo(p.x, p.y);
  g.lineTo(p.x + p.width, p.y);
  g.lineTo(p.x + p.width - 6, bottom - 4);
  for (let i = 5; i >= 0; i--) {
    const x = p.x + 6 + ((p.width - 12) * i) / 5;
    g.lineTo(x, bottom + (i % 2 ? 6 : 1) + hash(p.baseX + i) * 4);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(110,76,48,0.6)";
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = p.x + p.width * (0.25 + i * 0.25) + (hash(p.baseX * 2 + i) - 0.5) * 12;
    g.moveTo(x, p.y + 1);
    g.lineTo(x + 4, p.y + 9);
    g.lineTo(x - 2, p.y + 16);
    g.lineTo(x + 3, bottom);
  }
  g.stroke();
  g.fillStyle = "#cdb98a";
  g.fillRect(p.x, p.y - 2, p.width, 4);
  g.fillStyle = "rgba(255,248,225,0.6)";
  g.fillRect(p.x + 3, p.y - 2, p.width - 6, 1.2);
  g.restore();
}

function riverSurfaceY(x, t) {
  return RIVER_Y + Math.sin(x * 0.045 + t * 2.4) * 1.4 + Math.sin(x * 0.012 - t * 1.3) * 1.8;
}

function riverSurfacePath(g, x0, x1, t) {
  g.moveTo(x0, riverSurfaceY(x0, t));
  for (let x = x0; x <= x1; x += 6) g.lineTo(x, riverSurfaceY(x, t));
}

function drawRiver(g, t, night) {
  const x0 = Math.floor(cameraX / 6) * 6 - 12;
  const x1 = x0 + VIEW_W + 30;
  const body = g.createLinearGradient(0, RIVER_Y - 4, 0, VIEW_H);
  body.addColorStop(0, "#7fd3dc");
  body.addColorStop(0.35, "#3f9fbc");
  body.addColorStop(1, "#1f5d86");
  g.fillStyle = body;
  g.beginPath();
  riverSurfacePath(g, x0, x1, t);
  g.lineTo(x1, VIEW_H + 4);
  g.lineTo(x0, VIEW_H + 4);
  g.closePath();
  g.fill();

  const sky = g.createLinearGradient(0, RIVER_Y, 0, RIVER_Y + 18);
  sky.addColorStop(0, `rgba(255,236,200,${0.35 * (1 - night)})`);
  sky.addColorStop(1, "rgba(255,236,200,0)");
  g.fillStyle = sky;
  g.fillRect(x0, RIVER_Y, x1 - x0, 18);

  g.lineCap = "round";
  for (let i = 0; i < 160; i++) {
    const length = 10 + hash(i * 1.9) * 18;
    const speed = (24 + hash(i * 2.7) * 30) * RIVER_FLOW;
    const sx = wrap(hash(i) * WORLD_WIDTH - t * speed, WORLD_WIDTH);
    if (sx < x0 - 30 || sx > x1) continue;
    const depth = hash(i * 3.1);
    const sy = RIVER_Y + 7 + depth * 34 + Math.sin(t * 1.7 + i) * 0.8;
    g.strokeStyle = `rgba(225,250,255,${0.18 + (1 - depth) * 0.3})`;
    g.lineWidth = 1 + (1 - depth) * 0.6;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(sx + length / 2, sy - 1.2, sx + length, sy);
    g.stroke();
  }
  g.strokeStyle = "rgba(240,255,255,0.85)";
  g.lineWidth = 1.8;
  g.beginPath();
  riverSurfacePath(g, x0, x1, t);
  g.stroke();

  const span = WORLD_WIDTH + 200;
  for (const d of drifters) {
    const x = wrap(d.base - t * 60 * d.speed, span) - 100;
    if (x < x0 - 20 || x > x1 + 20) continue;
    const y = riverSurfaceY(x, t) + 3 + d.depth * 0.6;
    const bobAngle = Math.sin(t * 1.5 + d.spin) * 0.2;
    g.save();
    g.translate(x, y);
    if (d.kind === "lily") {
      g.rotate(bobAngle * 0.3);
      g.fillStyle = "#3f7d3a";
      g.beginPath();
      g.ellipse(0, 1, 11, 4.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#6fb34e";
      g.beginPath();
      g.ellipse(0, 0, 10, 3.6, 0, 0.35, Math.PI * 2 - 0.05);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();
      if (d.spin > 3.5) {
        g.fillStyle = "#ffc6dc";
        for (const a of [-0.7, 0, 0.7]) {
          g.beginPath();
          g.ellipse(-2 + a * 3, -2.5, 1.8, 3.2, a, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#ffe17a";
        g.beginPath();
        g.arc(-2, -2.4, 1.1, 0, Math.PI * 2);
        g.fill();
      }
    } else if (d.kind === "leaf") {
      g.rotate(d.spin + bobAngle);
      g.scale(1, 0.45);
      g.fillStyle = d.color;
      g.beginPath();
      g.moveTo(-6, 0);
      g.quadraticCurveTo(0, -5, 6, 0);
      g.quadraticCurveTo(0, 5, -6, 0);
      g.fill();
      g.strokeStyle = "rgba(90,50,20,0.5)";
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(-6, 0);
      g.lineTo(5, 0);
      g.stroke();
    } else {
      g.fillStyle = "#ffd6e6";
      g.beginPath();
      g.ellipse(0, 0, 2.6, 1.3, d.spin, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.fillStyle = "rgba(240,255,255,0.35)";
    g.fillRect(x - 6, y + 3, 12, 0.9);
  }
}

function drawBough(g, o, t) {
  const ground = o.platformY;
  const trunkX = o.x + o.width + 4;
  g.fillStyle = "#5b3f33";
  g.beginPath();
  g.moveTo(trunkX - 6, ground);
  g.quadraticCurveTo(trunkX - 3, ground - 50, trunkX - 5, o.y + 12);
  g.lineTo(trunkX + 5, o.y + 12);
  g.quadraticCurveTo(trunkX + 3, ground - 50, trunkX + 7, ground);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(40,26,20,0.4)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(trunkX, ground - 4);
  g.lineTo(trunkX - 1, ground - 40);
  g.stroke();
  g.strokeStyle = "#6b4a3a";
  g.lineCap = "round";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(trunkX, o.y + o.height - 12);
  g.quadraticCurveTo(o.x + o.width * 0.5, o.y + o.height - 4, o.x - 4, o.y + o.height - 9);
  g.stroke();
  const sway = Math.sin(t * 1.3 + o.x) * 1.5;
  const clusters = Math.round(o.width / 16) + 2;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < clusters; i++) {
      const u = i / (clusters - 1);
      const cx = o.x - 6 + u * (o.width + 12) + (pass ? sway : 0);
      const cy = o.y + 10 + hash(o.x + i) * (o.height - 26) + (pass ? 3 : 0);
      const r = 11 + hash(o.x * 1.7 + i) * 6 - pass * 3;
      g.fillStyle = pass ? "#7cc062" : "#4d8c48";
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = "rgba(220,255,190,0.5)";
  for (let i = 0; i < clusters; i++) {
    g.beginPath();
    g.arc(o.x + (i / clusters) * o.width + sway, o.y + 6 + hash(o.x + i * 4) * 8, 2.5, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "#4d8c48";
  g.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const vx = o.x + o.width * (0.15 + i * 0.22);
    g.beginPath();
    g.moveTo(vx, o.y + o.height - 4);
    g.quadraticCurveTo(vx + sway, o.y + o.height + 1, vx + 1 + sway, o.y + o.height + 2);
    g.stroke();
  }
}

function drawHollowLogBack(g, o) {
  const ground = o.platformY;
  const inside = g.createLinearGradient(0, o.y + o.height, 0, ground);
  inside.addColorStop(0, "#2a1a14");
  inside.addColorStop(1, "#4a3022");
  g.fillStyle = inside;
  g.fillRect(o.x + 4, o.y + o.height - 2, o.width - 8, ground - o.y - o.height + 2);
  g.fillStyle = "rgba(160,110,70,0.35)";
  g.fillRect(o.x + 4, ground - 4, o.width - 8, 4);
}

function drawHollowLogFront(g, o) {
  const ground = o.platformY;
  const bark = g.createLinearGradient(0, o.y, 0, o.y + o.height + 4);
  bark.addColorStop(0, "#a0714d");
  bark.addColorStop(1, "#5c3b29");
  g.fillStyle = bark;
  roundRectPath(g, o.x, o.y, o.width, o.height + 4, 6);
  g.fill();
  g.strokeStyle = "rgba(60,36,24,0.55)";
  g.lineWidth = 1;
  g.beginPath();
  for (let x = o.x + 14; x < o.x + o.width - 10; x += 16) {
    g.moveTo(x, o.y + 4);
    g.quadraticCurveTo(x + 6, o.y + o.height * 0.5, x + 2, o.y + o.height);
  }
  g.stroke();
  g.fillStyle = "#77b45e";
  g.beginPath();
  g.ellipse(o.x + o.width * 0.6, o.y + 1, 14, 3, 0, 0, Math.PI * 2);
  g.fill();
  const h = ground - o.y;
  for (const ex of [o.x, o.x + o.width]) {
    g.fillStyle = "#e3bc8c";
    g.beginPath();
    g.ellipse(ex, o.y + h / 2, 10, h / 2, 0, 0, Math.PI * 2);
    g.moveTo(ex + 6, o.y + h / 2 + 2);
    g.ellipse(ex, o.y + h / 2 + 2, 6, h / 2 - 9, 0, 0, Math.PI * 2, true);
    g.fill("evenodd");
    g.strokeStyle = "rgba(120,80,50,0.7)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(ex, o.y + h / 2, 10, h / 2, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

function drawCrow(g, c) {
  g.save();
  g.translate(c.x, c.y);
  g.scale(c.dir, 1);
  const flap = Math.sin(c.flap);
  g.fillStyle = "#2b2838";
  g.beginPath();
  g.moveTo(-6, -1);
  g.quadraticCurveTo(-2, -12 * flap - 2, 6, -2);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(0, 0, 10, 5.5, -0.1, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-8, -1);
  g.lineTo(-16, -3);
  g.lineTo(-15, 2);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(9, -3, 4.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#e0a640";
  g.beginPath();
  g.moveTo(12.5, -4);
  g.lineTo(18, -2.5);
  g.lineTo(12.5, -1);
  g.closePath();
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(10, -4, 1.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(10.4, -4, 0.7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#3d3a50";
  g.beginPath();
  g.moveTo(-5, 0);
  g.quadraticCurveTo(0, 12 * flap + 2, 5, 0);
  g.closePath();
  g.fill();
  g.restore();
}

function drawDog(g, d) {
  g.save();
  g.translate(d.x, d.y);
  g.scale(d.dir, 1);
  const s = Math.sin(d.step);
  const legs = [[-10, s], [-6, -s], [8, -s], [12, s]];
  g.lineCap = "round";
  for (const [lx, swing] of legs) {
    g.strokeStyle = "#7a4520";
    g.lineWidth = 4.6;
    g.beginPath();
    g.moveTo(lx, -10);
    g.lineTo(lx + swing * 2.5, -2);
    g.stroke();
    g.fillStyle = "#fff5ea";
    g.beginPath();
    g.ellipse(lx + swing * 2.5 + 0.5, -1.5, 2.6, 1.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#d9813b";
  g.beginPath();
  g.ellipse(0, -14, 17, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff5ea";
  g.beginPath();
  g.ellipse(4, -9.5, 11, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d9813b";
  g.beginPath();
  g.ellipse(-17, -17 + s * 0.8, 4, 3, -0.6, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(17, -20);
  g.rotate(s * 0.05);
  g.fillStyle = "#c46f2c";
  for (const ex of [-5, 1]) {
    g.beginPath();
    g.moveTo(ex - 3, -4);
    g.lineTo(ex, -14);
    g.lineTo(ex + 4, -4);
    g.closePath();
    g.fill();
  }
  g.fillStyle = "#ffc0b8";
  g.beginPath();
  g.moveTo(1 - 1.5, -5);
  g.lineTo(1, -11);
  g.lineTo(1 + 2, -5);
  g.closePath();
  g.fill();
  g.fillStyle = "#d9813b";
  g.beginPath();
  g.ellipse(0, 0, 8, 6.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff5ea";
  g.beginPath();
  g.ellipse(5, 2.5, 6, 3.6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2a1c18";
  g.beginPath();
  g.arc(10.5, 1, 1.6, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(3, -2, 1.3, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#2a1c18";
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(10, 3);
  g.quadraticCurveTo(8, 5.5, 5.5, 4);
  g.stroke();
  g.fillStyle = "#ff8a9a";
  g.beginPath();
  g.ellipse(7, 5.4, 1.6, 1.2, 0, 0, Math.PI);
  g.fill();
  g.restore();
  g.restore();
}

function drawRock(g, o) {
  const body = g.createLinearGradient(o.x, o.y, o.x + 6, o.y + o.height);
  body.addColorStop(0, "#b7bbc7");
  body.addColorStop(1, "#636878");
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(o.x - 3, o.y + o.height);
  g.bezierCurveTo(o.x - 4, o.y + 9, o.x + 2, o.y - 1, o.x + 10, o.y);
  g.bezierCurveTo(o.x + 19, o.y + 1, o.x + 24, o.y + 10, o.x + 23, o.y + o.height);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(50,52,64,0.55)";
  g.lineWidth = 1.2;
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.3)";
  g.beginPath();
  g.ellipse(o.x + 6, o.y + 6, 4, 2.5, -0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#77b45e";
  g.beginPath();
  g.ellipse(o.x + 12, o.y + 2, 7, 2.6, 0.1, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(60,62,75,0.5)";
  g.beginPath();
  g.moveTo(o.x + 14, o.y + 9);
  g.lineTo(o.x + 12, o.y + 14);
  g.lineTo(o.x + 15, o.y + 18);
  g.stroke();
}

function drawStump(g, o) {
  const bark = g.createLinearGradient(o.x, 0, o.x + o.width, 0);
  bark.addColorStop(0, "#6a432f");
  bark.addColorStop(0.45, "#a8744f");
  bark.addColorStop(1, "#5e3b29");
  g.fillStyle = bark;
  g.beginPath();
  g.moveTo(o.x - 4, o.y + o.height);
  g.quadraticCurveTo(o.x + 1, o.y + o.height - 4, o.x + 1, o.y + 5);
  g.lineTo(o.x + o.width - 1, o.y + 5);
  g.quadraticCurveTo(o.x + o.width - 1, o.y + o.height - 4, o.x + o.width + 4, o.y + o.height);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(60,36,24,0.5)";
  g.lineWidth = 1;
  for (const dx of [5, 10, 15]) {
    g.beginPath();
    g.moveTo(o.x + dx, o.y + 8);
    g.lineTo(o.x + dx + 0.5, o.y + o.height - 2);
    g.stroke();
  }
  g.fillStyle = "#e3bc8c";
  g.beginPath();
  g.ellipse(o.x + o.width / 2, o.y + 5, o.width / 2, 3.6, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(150,100,60,0.7)";
  g.beginPath();
  g.ellipse(o.x + o.width / 2, o.y + 5, o.width / 4, 1.8, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#e0574f";
  g.beginPath();
  g.ellipse(o.x + o.width + 2, o.y + o.height - 6, 4, 2.6, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = "#f6e9d8";
  g.fillRect(o.x + o.width + 1.2, o.y + o.height - 6, 1.6, 4);
}

function drawLeaf(g, x, y, angle, size) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = "#7cc56b";
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(size * 0.5, -size * 0.5, size, 0);
  g.quadraticCurveTo(size * 0.5, size * 0.5, 0, 0);
  g.fill();
  g.strokeStyle = "rgba(60,120,60,0.6)";
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(size * 0.85, 0);
  g.stroke();
  g.restore();
}

function drawCatnip(g, patch, t) {
  const ground = patch.y + 9;
  const count = Math.max(3, Math.floor(patch.width / 9));
  for (let i = 0; i < count; i++) {
    const sx = patch.x + 4 + (i / (count - 1)) * (patch.width - 8) + (hash(patch.x + i) - 0.5) * 4;
    const h = 13 + hash(patch.x * 1.3 + i) * 9;
    const sway = Math.sin(t * 1.8 + sx * 0.07) * 2;
    g.strokeStyle = "#4f8a4a";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(sx, ground);
    g.quadraticCurveTo(sx, ground - h * 0.6, sx + sway, ground - h);
    g.stroke();
    for (const k of [0.35, 0.65]) {
      const lx = sx + sway * k * k;
      const ly = ground - h * k;
      drawLeaf(g, lx, ly, -0.6, 6);
      drawLeaf(g, lx, ly, Math.PI + 0.6, 6);
    }
    const tipX = sx + sway;
    const tipY = ground - h;
    for (let j = 0; j < 3; j++) {
      g.fillStyle = j % 2 ? "#e6dbff" : "#c3a9f0";
      g.beginPath();
      g.arc(tipX + (j - 1) * 1.2, tipY - j * 2.2, 2 - j * 0.3, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function fishBob(fish, t) {
  return Math.sin(t * 2.5 + fish.x * 0.01) * 3;
}

function drawFishShape(g, x, y, scale, tilt) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.scale(scale, scale);
  const body = g.createLinearGradient(0, -7, 0, 7);
  body.addColorStop(0, "#ffd98a");
  body.addColorStop(1, "#ef8547");
  g.fillStyle = "#f07a4b";
  g.beginPath();
  g.moveTo(7, 0);
  g.lineTo(15, -6.5);
  g.quadraticCurveTo(12.5, 0, 15, 6.5);
  g.closePath();
  g.fill();
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-11, 0);
  g.bezierCurveTo(-6, -8, 5, -8, 9, 0);
  g.bezierCurveTo(5, 8, -6, 8, -11, 0);
  g.fill();
  g.strokeStyle = "rgba(150,70,35,0.8)";
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = "rgba(255,240,200,0.7)";
  g.beginPath();
  g.arc(-1, 0, 4, -1, 1);
  g.moveTo(3.5, -3);
  g.arc(2, 0, 4, -1, 1);
  g.stroke();
  g.fillStyle = "#3a2630";
  g.beginPath();
  g.arc(-6, -1.5, 1.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(-6.4, -2, 0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawFish(g, fish, t) {
  if (fish.collected) return;
  drawFishShape(g, fish.x, fish.y + fishBob(fish, t), 1, Math.sin(t * 2 + fish.x) * 0.08);
}

function drawHome(g, night) {
  const x = homeX;
  const ground = 405;
  g.fillStyle = "#9c6b5b";
  g.fillRect(x + 68, ground - 118, 13, 30);
  g.fillStyle = "#7d5246";
  g.fillRect(x + 66, ground - 121, 17, 5);

  const wall = g.createLinearGradient(0, ground - 74, 0, ground);
  wall.addColorStop(0, "#fff0d6");
  wall.addColorStop(1, "#eacda2");
  g.fillStyle = wall;
  roundRectPath(g, x, ground - 74, 100, 74, 4);
  g.fill();
  g.strokeStyle = "#9a6a50";
  g.lineWidth = 3;
  g.strokeRect(x + 1.5, ground - 72.5, 97, 71);
  g.beginPath();
  g.moveTo(x + 50, ground - 72);
  g.lineTo(x + 50, ground - 8);
  g.stroke();
  g.fillStyle = "#a99d95";
  g.fillRect(x - 2, ground - 8, 104, 8);
  g.strokeStyle = "rgba(90,80,75,0.5)";
  g.lineWidth = 1;
  for (let sx = x + 8; sx < x + 100; sx += 14) {
    g.beginPath();
    g.moveTo(sx, ground - 8);
    g.lineTo(sx, ground);
    g.stroke();
  }

  const roof = g.createLinearGradient(0, ground - 125, 0, ground - 66);
  roof.addColorStop(0, "#dc766c");
  roof.addColorStop(1, "#a84e49");
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - 16, ground - 66);
  g.quadraticCurveTo(x + 20, ground - 96, x + 50, ground - 124);
  g.quadraticCurveTo(x + 80, ground - 96, x + 116, ground - 66);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = "rgba(120,40,40,0.35)";
  g.lineWidth = 1.2;
  for (let row = 0; row < 6; row++) {
    const yy = ground - 66 - row * 10;
    for (let sx = x - 16 + (row % 2) * 4.5; sx < x + 116; sx += 9) {
      g.beginPath();
      g.arc(sx + 4.5, yy, 4.5, 0, Math.PI);
      g.stroke();
    }
  }
  g.restore();
  g.strokeStyle = "#7c3a38";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x - 16, ground - 66);
  g.quadraticCurveTo(x + 20, ground - 96, x + 50, ground - 124);
  g.quadraticCurveTo(x + 80, ground - 96, x + 116, ground - 66);
  g.stroke();

  g.fillStyle = "#86523d";
  g.beginPath();
  g.moveTo(x + 14, ground - 8);
  g.lineTo(x + 14, ground - 38);
  g.arc(x + 26, ground - 38, 12, Math.PI, 0);
  g.lineTo(x + 38, ground - 8);
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(60,30,20,0.4)";
  g.lineWidth = 1;
  for (const dx of [20, 26, 32]) {
    g.beginPath();
    g.moveTo(x + dx, ground - 46);
    g.lineTo(x + dx, ground - 8);
    g.stroke();
  }
  g.fillStyle = "#f2c35b";
  g.beginPath();
  g.arc(x + 34, ground - 24, 1.7, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "#7a4b3a";
  g.beginPath();
  g.arc(x + 70, ground - 40, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = mix("#bfe2ee", "#ffd27d", night);
  g.beginPath();
  g.arc(x + 70, ground - 40, 10.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#7a4b3a";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 59.5, ground - 40);
  g.lineTo(x + 80.5, ground - 40);
  g.moveTo(x + 70, ground - 50.5);
  g.lineTo(x + 70, ground - 29.5);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.45)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x + 70, ground - 40, 7.5, Math.PI * 1.1, Math.PI * 1.45);
  g.stroke();
  g.fillStyle = "#8e5a44";
  g.fillRect(x + 56, ground - 26, 28, 6);
  for (const [dx, color] of [[59, "#ff9fb5"], [65, "#fff0a0"], [71, "#ff9fb5"], [77, "#cdb6ff"], [82, "#fff0a0"]]) {
    g.fillStyle = "#5c9c4a";
    g.fillRect(x + dx - 0.5, ground - 30, 1, 4);
    g.fillStyle = color;
    g.beginPath();
    g.arc(x + dx, ground - 30, 2.2, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = "#3d3540";
  g.fillRect(x + 42, ground - 52, 6, 10);
  g.fillStyle = mix("#f3e3b0", "#ffd36b", night);
  g.fillRect(x + 43, ground - 51, 4, 8);

  const sx = x - 34;
  g.fillStyle = "#7d5440";
  g.fillRect(sx + 14, ground - 34, 4, 34);
  roundRectPath(g, sx - 2, ground - 48, 36, 17, 4);
  g.fillStyle = "#b07b52";
  g.fill();
  g.strokeStyle = "#6e4734";
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = "#fff6e6";
  g.font = `600 10px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("HOME", sx + 16, ground - 39);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

function drawCatShadow(g) {
  const cx = cat.x + cat.width / 2;
  const bottom = cat.y + cat.height;
  let groundY = null;
  for (const p of platforms) {
    if (cx > p.x && cx < p.x + p.width && p.y >= bottom - 1 && (groundY === null || p.y < groundY)) groundY = p.y;
  }
  if (groundY === null) return;
  const k = clamp(1 - (groundY - bottom) / 160, 0.25, 1);
  g.fillStyle = `rgba(30,20,30,${0.25 * k})`;
  g.beginPath();
  g.ellipse(cx, groundY, 24 * k, 4.5 * k, 0, 0, Math.PI * 2);
  g.fill();
}

function landingSquat() {
  const t = cat.landTimer / 16;
  if (!cat.grounded || t >= 1) return 0;
  return cat.landStrength * Math.sin(Math.PI * Math.pow(t, 0.7));
}

function catPose() {
  const move = cat.grounded && !cat.sniffing ? clamp(Math.abs(cat.vx) / BASE_SPEED, 0, 1) : 0;
  return {
    phase: cat.animTime,
    move,
    stride: sprinting() ? 8 : 6,
    crouch: Math.max(cat.crouchAmount, landingSquat() * 0.55),
    pitch: cat.pitch,
    air: cat.grounded ? null : clamp(cat.vy / 10, -1, 1),
    sniff: cat.sniffAmount,
    time: gameTime,
  };
}

function drawCat(g) {
  if (cat.sinkingUntil) return;
  drawCatShadow(g);
  g.save();
  if (gameTime < cat.invulnerableUntil && Math.floor(gameTime / 90) % 2) g.globalAlpha = 0.4;
  g.translate(cat.x + cat.width / 2, cat.y + cat.height);
  g.scale(cat.facing * CAT_SCALE, CAT_SCALE);
  g.translate(-6, 0);
  drawCatSprite(g, cat.skin, catPose(), save.equipped);
  g.restore();
}

function drawGlows(g, night, t) {
  for (const fish of collectibles) {
    if (!fish.collected && onScreen(fish.x)) radialGlow(g, fish.x, fish.y + fishBob(fish, t), 24, "255,214,120", 0.35);
  }
  for (const patch of catnipPatches) {
    if (onScreen(patch.x)) {
      radialGlow(g, patch.x + patch.width / 2, patch.y - 2, patch.width * 0.7, "200,170,255", 0.1 + 0.05 * Math.sin(t * 2 + patch.x));
    }
  }
  if (onScreen(homeX)) {
    radialGlow(g, homeX + 70, 365, 70, "255,196,110", 0.1 + 0.5 * night);
    radialGlow(g, homeX + 45, 358, 40, "255,210,120", 0.05 + 0.5 * night);
  }
  if (night > 0.3) {
    const fade = clamp((night - 0.3) / 0.4, 0, 1);
    for (let i = 0; i < 70; i++) {
      const fx = hash(i * 1.7) * WORLD_WIDTH + Math.sin(t * 0.6 + i) * 30;
      if (!onScreen(fx, 20)) continue;
      const fy = 250 + hash(i * 2.3) * 190 + Math.sin(t * 0.9 + i * 2) * 14;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3);
      radialGlow(g, fx, fy, 9, "220,255,140", 0.6 * fade * pulse);
      g.fillStyle = `rgba(250,255,210,${fade * pulse})`;
      g.beginPath();
      g.arc(fx, fy, 1.3, 0, Math.PI * 2);
      g.fill();
    }
  }
  for (const p of particles) if (p.glow) drawParticle(g, p);
}

/* ---------- HUD & overlays ---------- */

function glassPanel(g, x, y, w, h) {
  roundRectPath(g, x, y, w, h, 14);
  g.fillStyle = "rgba(24,20,44,0.45)";
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.18)";
  g.lineWidth = 1;
  g.stroke();
}

function drawHud(g, night, twilight, phase) {
  g.textBaseline = "middle";
  glassPanel(g, 18, 16, 206, 50);
  drawFishShape(g, 46, 41, 1.05, -0.15);
  g.fillStyle = "#ffffff";
  g.font = `600 22px ${FONT}`;
  g.fillText(String(score), 68, 42);
  g.fillStyle = "rgba(255,255,255,0.18)";
  g.fillRect(118, 28, 1, 26);
  g.fillStyle = "rgba(255,255,255,0.65)";
  g.font = `600 11px ${FONT}`;
  g.fillText("LEVEL", 134, 32);
  g.fillStyle = "#ffffff";
  g.font = `600 20px ${FONT}`;
  g.fillText(String(level), 134, 51);
  const levelWidth = g.measureText(String(level)).width;
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = `600 14px ${FONT}`;
  g.fillText(`/${FINAL_LEVEL}`, 136 + levelWidth, 52);

  const label = night > 0.62 ? "Night" : twilight > 0.45 ? (phase < 0.5 ? "Dusk" : "Dawn") : "Day";
  const chipW = 118;
  const chipX = (VIEW_W - chipW) / 2;
  glassPanel(g, chipX, 18, chipW, 36);
  const iconX = chipX + 26;
  if (label === "Night") {
    g.fillStyle = "#f4f0dc";
    g.beginPath();
    g.arc(iconX, 36, 8, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(iconX + 4, 33, 7, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  } else {
    g.strokeStyle = "#ffd36b";
    g.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(iconX + Math.cos(a) * 8.5, 36 + Math.sin(a) * 8.5);
      g.lineTo(iconX + Math.cos(a) * 11, 36 + Math.sin(a) * 11);
      g.stroke();
    }
    g.fillStyle = label === "Day" ? "#ffd36b" : "#ffab70";
    g.beginPath();
    g.arc(iconX, 36, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#ffffff";
  g.font = `600 16px ${FONT}`;
  g.fillText(label, chipX + 48, 37);

  const panelW = 196;
  const panelX = VIEW_W - 18 - panelW;
  glassPanel(g, panelX, 16, panelW, 50);
  const cooldown = Math.max(0, cat.doubleJumpReadyAt - gameTime);
  const ready = cooldown === 0;
  const ringX = panelX + panelW - 30;
  g.lineCap = "round";
  g.strokeStyle = "rgba(255,255,255,0.2)";
  g.lineWidth = 4.5;
  g.beginPath();
  g.arc(ringX, 41, 15, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = ready ? "#8fe27b" : "#ffd36b";
  g.beginPath();
  g.arc(ringX, 41, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cooldown / DOUBLE_JUMP_COOLDOWN));
  g.stroke();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 2;
  for (const dy of [-3, 3]) {
    g.beginPath();
    g.moveTo(ringX - 5, 43 + dy);
    g.lineTo(ringX, 38 + dy);
    g.lineTo(ringX + 5, 43 + dy);
    g.stroke();
  }
  g.textAlign = "right";
  g.fillStyle = "rgba(255,255,255,0.65)";
  g.font = `600 11px ${FONT}`;
  g.fillText("DOUBLE JUMP", ringX - 26, 32);
  g.fillStyle = ready ? "#c9f5bd" : "#ffe3a3";
  g.font = `600 18px ${FONT}`;
  g.fillText(ready ? "Ready" : `${(cooldown / 1000).toFixed(1)}s`, ringX - 26, 51);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

function paintVignette(g) {
  g.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  const vignette = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.68);
  vignette.addColorStop(0, "rgba(10,8,24,0)");
  vignette.addColorStop(1, "rgba(10,8,24,0.38)");
  g.fillStyle = vignette;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawVignette(g) {
  ensureCaches();
  blit(g, caches.vignette);
}

function drawTransition(g) {
  const elapsed = gameTime - transition.startedAt;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (transition.phase === "celebrate") {
    const a = clamp(elapsed / 300, 0, 1);
    g.fillStyle = `rgba(255,248,232,${a})`;
    g.font = `600 34px ${FONT}`;
    g.shadowColor = "rgba(40,20,60,0.5)";
    g.shadowBlur = 12;
    g.fillText("Home sweet home!", VIEW_W / 2, 118);
    if (transition.banked > 0) {
      const b = clamp((elapsed - 250) / 300, 0, 1);
      g.fillStyle = `rgba(255,215,130,${b})`;
      g.font = `600 20px ${FONT}`;
      g.fillText(`+${transition.banked} fish banked`, VIEW_W / 2, 156 - 6 * (1 - b));
    }
    g.shadowBlur = 0;
  } else if (transition.phase === "finale" || transition.phase === "finaleOut") {
    const out = transition.phase === "finaleOut" ? clamp(elapsed / 900, 0, 1) : 0;
    if (out > 0) {
      g.fillStyle = `rgba(14,10,32,${out * 0.6})`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    const intro = transition.phase === "finale" ? clamp(elapsed / 500, 0, 1) : 1;
    const a = intro * (1 - out);
    const pop = 1 + 0.18 * Math.sin(intro * Math.PI);
    g.shadowColor = "rgba(40,20,60,0.55)";
    g.shadowBlur = 14;
    g.save();
    g.translate(VIEW_W / 2, 116);
    g.scale(pop, pop);
    g.fillStyle = `rgba(255,248,232,${a})`;
    g.font = `600 46px ${FONT}`;
    g.fillText("You made it home!", 0, 0);
    g.restore();
    const b = transition.phase === "finale" ? clamp((elapsed - 450) / 400, 0, 1) * (1 - out) : 1 - out;
    g.fillStyle = `rgba(255,226,190,${b})`;
    g.font = `600 20px ${FONT}`;
    g.fillText(`All ${FINAL_LEVEL} levels complete`, VIEW_W / 2, 160);
    if (transition.banked > 0) {
      g.fillStyle = `rgba(255,215,130,${b})`;
      g.font = `600 18px ${FONT}`;
      g.fillText(`+${transition.banked} fish banked`, VIEW_W / 2, 190);
    }
    g.shadowBlur = 0;
  } else {
    const fade = transition.phase === "out"
      ? clamp(elapsed / 900, 0, 1)
      : 1 - clamp((elapsed - 300) / 900, 0, 1);
    g.fillStyle = `rgba(6,5,14,${fade})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const textAlpha = transition.phase === "out" ? clamp((elapsed - 450) / 450, 0, 1) : fade;
    if (textAlpha > 0) {
      g.fillStyle = `rgba(255,244,222,${textAlpha})`;
      g.font = `600 46px ${FONT}`;
      g.fillText(`Level ${transition.phase === "out" ? level + 1 : level}`, VIEW_W / 2, VIEW_H / 2 - 8);
      g.fillStyle = `rgba(255,244,222,${textAlpha * 0.7})`;
      g.font = `400 17px ${FONT}`;
      const upcoming = transition.phase === "out" ? level + 1 : level;
      g.fillText(upcoming === FINAL_LEVEL ? "The final stretch home…" : "The path grows trickier…", VIEW_W / 2, VIEW_H / 2 + 32);
    }
  }
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

function drawMenu(g, items, top, horizontal = false) {
  menuHitboxes = [];
  const w = horizontal ? 220 : 280;
  const h = 46;
  const rowLeft = (VIEW_W - (items.length * w + (items.length - 1) * 16)) / 2;
  items.forEach((item, index) => {
    const x = horizontal ? rowLeft + index * (w + 16) : (VIEW_W - w) / 2;
    const y = horizontal ? top : top + index * (h + 12);
    const selected = index === menuIndex;
    roundRectPath(g, x, y, w, h, 14);
    g.fillStyle = selected ? "rgba(255,179,107,0.95)" : "rgba(255,255,255,0.1)";
    g.fill();
    g.strokeStyle = selected ? "rgba(255,226,190,0.9)" : "rgba(255,255,255,0.22)";
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = selected ? "#3a2418" : "#fff6ea";
    g.font = `600 19px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(item.label, x + w / 2, y + h / 2 + 1);
    menuHitboxes.push({ x, y, w, h, index });
  });
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

function drawTitle(g) {
  const shade = g.createLinearGradient(0, 0, 0, VIEW_H);
  shade.addColorStop(0, "rgba(16,12,40,0.55)");
  shade.addColorStop(1, "rgba(16,12,40,0.25)");
  g.fillStyle = shade;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(20,10,40,0.6)";
  g.shadowBlur = 18;
  g.fillStyle = "#fff4e2";
  g.font = `600 64px ${FONT}`;
  g.fillText("Whisker Way", VIEW_W / 2, 118);
  g.shadowBlur = 0;
  g.fillStyle = "rgba(255,226,190,0.85)";
  g.font = `400 18px ${FONT}`;
  g.fillText("A cozy cat platformer -- by Izabelle Tsai", VIEW_W / 2, 164);
  if (save.bank > 0) {
    drawFishShape(g, VIEW_W / 2 - 40, 200, 0.9, -0.15);
    g.fillStyle = "#ffd98a";
    g.font = `600 16px ${FONT}`;
    g.textAlign = "left";
    g.fillText(`${save.bank} fish saved`, VIEW_W / 2 - 22, 201);
  }
  drawMenu(g, menuItems(), 230);
  drawControlsLegend(g, VIEW_H - 42);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

const COARSE_POINTER = window.matchMedia("(pointer: coarse)");

function drawControlsLegend(g, y) {
  const groups = COARSE_POINTER.matches
    ? [[["Tap"], "Choose"], [["◀", "▶"], "Move"], [["▲"], "Jump"], [["▼"], "Crouch"], [["Center"], "Double jump"], [["Left block"], "Sprint"]]
    : [[["A", "D"], "Move"], [["W"], "Jump · twice to double jump"], [["S"], "Crouch"], [["Shift"], "Sprint"], [["Space"], "Select"], [["P"], "Pause"], [["M"], "Sound"]];
  const capFont = `600 13px ${FONT}`;
  const labelFont = `400 14px ${FONT}`;
  const layout = groups.map(([caps, label]) => {
    g.font = capFont;
    const capWidths = caps.map((cap) => Math.max(24, g.measureText(cap).width + 14));
    g.font = labelFont;
    const labelWidth = g.measureText(label).width;
    const width = capWidths.reduce((sum, w) => sum + w, 0) + (caps.length - 1) * 4 + 7 + labelWidth;
    return { caps, label, capWidths, labelWidth, width };
  });
  const total = layout.reduce((sum, item) => sum + item.width, 0) + (layout.length - 1) * 20;
  let x = (VIEW_W - total) / 2;
  glassPanel(g, x - 16, y - 19, total + 32, 38);
  g.textBaseline = "middle";
  for (const item of layout) {
    item.caps.forEach((cap, index) => {
      const w = item.capWidths[index];
      roundRectPath(g, x, y - 12, w, 24, 6);
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = "#fff6ea";
      g.font = capFont;
      g.textAlign = "center";
      g.fillText(cap, x + w / 2, y + 1);
      x += w + 4;
    });
    x += 3;
    g.fillStyle = "rgba(255,255,255,0.78)";
    g.font = labelFont;
    g.textAlign = "left";
    g.fillText(item.label, x, y + 1);
    x += item.labelWidth + 20;
  }
}

function drawPause(g) {
  g.fillStyle = "rgba(14,10,32,0.6)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff4e2";
  g.font = `600 44px ${FONT}`;
  g.fillText("Paused", VIEW_W / 2, 132);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  drawMenu(g, menuItems(), 190);
}

function drawResultsPanel(g, x, y, w, h) {
  g.fillStyle = "rgba(14,10,32,0.6)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  roundRectPath(g, x, y, w, h, 22);
  g.fillStyle = "rgba(34,26,64,0.86)";
  g.fill();
  g.strokeStyle = "rgba(255,226,190,0.35)";
  g.lineWidth = 1.4;
  g.stroke();
  g.textAlign = "center";
  g.textBaseline = "middle";
}

function drawResults(g) {
  drawResultsPanel(g, 150, 46, 660, 420);
  g.fillStyle = "#fff4e2";
  g.font = `600 38px ${FONT}`;
  g.fillText("You made it home!", VIEW_W / 2, 96);
  g.fillStyle = "rgba(255,226,190,0.85)";
  g.font = `400 17px ${FONT}`;
  g.fillText(`All ${FINAL_LEVEL} levels complete`, VIEW_W / 2, 132);
  const run = finishedRun || newRun(1);
  const stats = [
    ["TIME", formatTime(run.time)],
    ["FISH", String(run.fish)],
    ["FALLS", String(run.falls)],
    ["BUMPS", String(run.bumps)],
    ["DOUBLE JUMPS", String(run.doubleJumps)],
  ];
  const tileW = 116;
  const left = (VIEW_W - (stats.length * tileW + (stats.length - 1) * 12)) / 2;
  stats.forEach(([label, value], index) => {
    const x = left + index * (tileW + 12);
    roundRectPath(g, x, 160, tileW, 86, 14);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.font = `600 11px ${FONT}`;
    g.fillText(label, x + tileW / 2, 184);
    g.fillStyle = index === 0 ? "#ffd98a" : "#ffffff";
    g.font = `600 24px ${FONT}`;
    g.fillText(value, x + tileW / 2, 218);
  });
  if (run.startLevel === 1) {
    g.fillStyle = "#fff4e2";
    g.font = `600 18px ${FONT}`;
    g.fillText("Enter your name for the leaderboard", VIEW_W / 2, 292);
    const candidate = { name: "", time: Math.round(run.time), fish: run.fish, date: "~" };
    const rank = rankEntries([...loadLeaderboard(), candidate]).indexOf(candidate) + 1;
    g.fillStyle = "rgba(255,226,190,0.8)";
    g.font = `400 15px ${FONT}`;
    g.fillText(`That's #${rank} on the board · press Enter to save`, VIEW_W / 2, 412);
  } else {
    g.fillStyle = "rgba(255,226,190,0.85)";
    g.font = `400 16px ${FONT}`;
    g.fillText(`This run started at level ${run.startLevel}, so it isn't ranked.`, VIEW_W / 2, 296);
    g.fillText("Start a new game from level 1 to get on the leaderboard.", VIEW_W / 2, 320);
    drawMenu(g, menuItems(), 362);
  }
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

function drawLeaderboard(g) {
  drawResultsPanel(g, 150, 34, 660, 396);
  g.fillStyle = "#fff4e2";
  g.font = `600 34px ${FONT}`;
  g.fillText("Leaderboard", VIEW_W / 2, 74);
  const entries = rankEntries(loadLeaderboard());
  const columns = [[190, "#", "center"], [218, "NAME", "left"], [470, "TIME", "right"], [550, "FISH", "right"], [620, "FALLS", "right"], [770, "DATE", "right"]];
  g.font = `600 11px ${FONT}`;
  g.fillStyle = "rgba(255,255,255,0.55)";
  columns.forEach(([x, label, align]) => { g.textAlign = align; g.fillText(label, x, 112); });
  if (!entries.length) {
    g.textAlign = "center";
    g.fillStyle = "rgba(255,226,190,0.85)";
    g.font = `400 17px ${FONT}`;
    g.fillText(`No runs yet. Finish all ${FINAL_LEVEL} levels to get on the board!`, VIEW_W / 2, 240);
  }
  entries.slice(0, 10).forEach((entry, index) => {
    const y = 140 + index * 26;
    const mine = entry.date === highlightDate;
    if (mine) {
      roundRectPath(g, 172, y - 12, 616, 24, 8);
      g.fillStyle = "rgba(255,179,107,0.28)";
      g.fill();
    }
    const date = new Date(entry.date);
    const cells = [
      String(index + 1),
      entry.name,
      formatTime(entry.time),
      String(entry.fish),
      String(entry.falls ?? 0),
      Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    ];
    g.font = `${index < 3 || mine ? 600 : 400} 16px ${FONT}`;
    columns.forEach(([x, , align], column) => {
      g.textAlign = align;
      g.fillStyle = column === 0 && index < 3 ? ["#ffd36b", "#e3e7ef", "#e6a874"][index] : mine ? "#ffe8c8" : "#fff6ea";
      g.fillText(cells[column], x, y + 1);
    });
  });
  const myRank = entries.findIndex((entry) => entry.date === highlightDate);
  if (myRank >= 10) {
    g.textAlign = "center";
    g.fillStyle = "#ffd98a";
    g.font = `600 15px ${FONT}`;
    g.fillText(`Your run: #${myRank + 1} · ${formatTime(entries[myRank].time)} · ${entries[myRank].fish} fish`, VIEW_W / 2, 408);
  }
  drawMenu(g, menuItems(), 448, true);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
}

/* ---------- frame ---------- */

function dayCycle() {
  const phase = (gameTime % DAY_LENGTH) / DAY_LENGTH;
  const night = Math.sin((phase - 0.25) * Math.PI * 2) * 0.5 + 0.5;
  const twilight = clamp(1 - Math.abs(night - 0.5) * 2.4, 0, 1);
  return { phase, night, twilight };
}

function render() {
  const t = gameTime / 1000;
  const { phase, night, twilight } = dayCycle();

  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  drawSky(ctx, night, twilight, t);
  drawClouds(ctx, night, twilight, t);

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, layer.width, layer.height);
  lctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  drawScenery(lctx);
  lctx.save();
  lctx.translate(-cameraX, 0);
  drawRiver(lctx, t, night);
  platforms.forEach((p) => { if (onScreen(p.x, p.width + 40)) drawPlatform(lctx, p, t); });
  obstacles.forEach((o) => {
    if (!onScreen(o.x, o.width + 40)) return;
    if (o.kind === "rock") drawRock(lctx, o);
    else if (o.kind === "log") drawStump(lctx, o);
    else if (o.kind === "bough") drawBough(lctx, o, t);
    else drawHollowLogBack(lctx, o);
  });
  catnipPatches.forEach((patch) => { if (onScreen(patch.x)) drawCatnip(lctx, patch, t); });
  collectibles.forEach((fish) => { if (onScreen(fish.x)) drawFish(lctx, fish, t); });
  if (onScreen(homeX, 200)) drawHome(lctx, night);
  dogs.forEach((dog) => { if (onScreen(dog.x)) drawDog(lctx, dog); });
  drawCat(lctx);
  obstacles.forEach((o) => { if (o.kind === "hollow" && onScreen(o.x, o.width + 40)) drawHollowLogFront(lctx, o); });
  crows.forEach((crow) => { if (onScreen(crow.x)) drawCrow(lctx, crow); });
  for (const p of particles) if (!p.glow) drawParticle(lctx, p);
  lctx.restore();

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  const nightAlpha = 0.5 * night;
  const duskAlpha = 0.13 * twilight;
  const tintAlpha = 1 - (1 - nightAlpha) * (1 - duskAlpha);
  if (tintAlpha > 0.002) {
    const tint = [[22, 255], [26, 140], [70, 90]].map(([n, d]) => Math.round((duskAlpha * d + (1 - duskAlpha) * nightAlpha * n) / tintAlpha));
    lctx.globalCompositeOperation = "source-atop";
    lctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tintAlpha})`;
    lctx.fillRect(0, 0, layer.width, layer.height);
    lctx.globalCompositeOperation = "source-over";
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  ctx.save();
  ctx.translate(-cameraX, 0);
  ctx.globalCompositeOperation = "lighter";
  drawGlows(ctx, night, t);
  ctx.restore();
  drawVignette(ctx);
  menuHitboxes = [];
  if (gameState === "title") {
    drawTitle(ctx);
    return;
  }
  if (gameState === "results") {
    drawResults(ctx);
    return;
  }
  if (gameState === "leaderboard") {
    drawLeaderboard(ctx);
    return;
  }
  drawHud(ctx, night, twilight, phase);
  if (transition) drawTransition(ctx);
  if (gameState === "paused") drawPause(ctx);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = clamp(Math.round(rect.width * dpr), VIEW_W, VIEW_W * MAX_PIXEL_SCALE);
  canvas.width = width;
  canvas.height = Math.round((width * VIEW_H) / VIEW_W);
  layer.width = canvas.width;
  layer.height = canvas.height;
  pixelScale = canvas.width / VIEW_W;
}

function drawPortrait(el, skinKey, outfit) {
  const dpr = window.devicePixelRatio || 1;
  const w = 112;
  const h = 80;
  el.width = w * dpr * 2;
  el.height = h * dpr * 2;
  const g = el.getContext("2d");
  g.setTransform(el.width / w, 0, 0, el.height / h, 0, 0);
  g.clearRect(0, 0, w, h);
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(w / 2 + 4, 74, 28, 4.2, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(w / 2 + 2, 74);
  g.scale(0.95, 0.95);
  drawCatSprite(g, skinKey, IDLE_POSE, outfit);
  g.restore();
}

function renderPortraits() {
  document.querySelectorAll(".skin-portrait").forEach((el) => drawPortrait(el, el.dataset.skin, save.equipped));
  document.querySelectorAll(".shop-portrait").forEach((el) => {
    const item = ACCESSORIES.find((entry) => entry.id === el.dataset.item);
    drawPortrait(el, cat.skin, { collar: item.slot === "collar" ? item.id : null, hat: item.slot === "hat" ? item.id : null });
  });
}

function buildShop() {
  const shop = document.querySelector("#shop");
  if (!shop) return;
  shop.innerHTML = "";
  for (const item of ACCESSORIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-item";
    button.dataset.item = item.id;
    const portrait = document.createElement("canvas");
    portrait.className = "shop-portrait";
    portrait.dataset.item = item.id;
    const name = document.createElement("span");
    name.className = "shop-name";
    name.textContent = item.name;
    const status = document.createElement("span");
    status.className = "shop-status";
    button.append(portrait, name, status);
    button.addEventListener("click", () => onShopClick(item, button));
    shop.append(button);
  }
}

function onShopClick(item, button) {
  Sound.unlock();
  button.blur();
  if (!save.owned.includes(item.id)) {
    if (save.bank < item.price) {
      Sound.play("deny");
      return;
    }
    save.bank -= item.price;
    save.owned.push(item.id);
    save.equipped[item.slot] = item.id;
    Sound.play("buy");
  } else {
    save.equipped[item.slot] = save.equipped[item.slot] === item.id ? null : item.id;
    Sound.play("select");
  }
  writeSave();
  refreshWardrobe();
}

function refreshWardrobe() {
  const bank = document.querySelector("#fishBank");
  if (bank) bank.textContent = String(save.bank);
  document.querySelectorAll(".skin-button").forEach((button) => {
    const selected = button.dataset.skin === cat.skin;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelectorAll(".shop-item").forEach((button) => {
    const item = ACCESSORIES.find((entry) => entry.id === button.dataset.item);
    const owned = save.owned.includes(item.id);
    const wearing = save.equipped[item.slot] === item.id;
    const affordable = save.bank >= item.price;
    button.classList.toggle("selected", wearing);
    button.classList.toggle("locked", !owned && !affordable);
    button.setAttribute("aria-pressed", String(wearing));
    button.querySelector(".shop-status").textContent = wearing ? "Wearing" : owned ? "Owned" : `${item.price} fish`;
  });
  renderPortraits();
}

document.querySelectorAll(".skin-button").forEach((button) => {
  button.addEventListener("click", () => {
    Sound.unlock();
    cat.skin = button.dataset.skin;
    save.skin = cat.skin;
    writeSave();
    refreshWardrobe();
    Sound.play("meow");
    button.blur();
  });
});

const JOYSTICK_DEAD_ZONE = 0.35;
const JOYSTICK_CROUCH = 0.5;
const joystick = document.querySelector(".touch-joystick");
const joystickKnob = joystick.querySelector(".touch-knob");
let joystickPointer = null;

function moveJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const travel = rect.width * 0.29;
  let dx = event.clientX - (rect.left + rect.width / 2);
  let dy = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy);
  if (distance > travel) {
    dx *= travel / distance;
    dy *= travel / distance;
  }
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  keys.a = dx / travel < -JOYSTICK_DEAD_ZONE;
  keys.d = dx / travel > JOYSTICK_DEAD_ZONE;
  keys.s = dy / travel > JOYSTICK_CROUCH;
}

function releaseJoystick() {
  joystickPointer = null;
  keys.a = false;
  keys.d = false;
  keys.s = false;
  joystickKnob.style.transform = "";
  joystick.classList.remove("is-pressed");
}

joystick.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  Sound.unlock();
  if (gameState !== "playing" || transition) return;
  joystick.setPointerCapture(event.pointerId);
  joystickPointer = event.pointerId;
  joystick.classList.add("is-pressed");
  moveJoystick(event);
});
joystick.addEventListener("pointermove", (event) => { if (event.pointerId === joystickPointer) moveJoystick(event); });
joystick.addEventListener("pointerup", releaseJoystick);
joystick.addEventListener("pointercancel", releaseJoystick);
joystick.addEventListener("lostpointercapture", releaseJoystick);

const jumpButton = document.querySelector("#touchJump");
jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  Sound.unlock();
  if (gameState !== "playing" || transition) return;
  jumpButton.setPointerCapture(event.pointerId);
  jumpButton.classList.add("is-pressed");
  jump();
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  jumpButton.addEventListener(type, () => jumpButton.classList.remove("is-pressed"));
}

function setTouchSprint(on) {
  touchSprint = on;
  document.querySelector("#touchSprint").setAttribute("aria-pressed", String(on));
}

document.querySelector("#touchSprint").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  Sound.unlock();
  if (gameState !== "playing") return;
  setTouchSprint(!touchSprint);
  Sound.play("tick");
});

const nameForm = document.querySelector("#nameForm");
if (nameForm) nameForm.addEventListener("submit", submitName);
window.addEventListener("pagehide", writeSave);
document.addEventListener("visibilitychange", () => { if (document.hidden) writeSave(); });

function frame(now) {
  const elapsed = Math.min(100, Math.max(0, now - lastTime));
  lastTime = now;
  if (gameState !== "paused") {
    let remaining = elapsed / 16.67;
    while (remaining > 0) {
      const step = Math.min(2, remaining);
      gameTime += step * 16.67;
      update(step);
      remaining -= step;
    }
  }
  Sound.setNight(dayCycle().night);
  if (document.body.dataset.state !== gameState) document.body.dataset.state = gameState;
  render();
  requestAnimationFrame(frame);
}

new ResizeObserver(resizeCanvas).observe(canvas);
Sound.setMuted(save.muted);
resizeCanvas();
buildShop();
refreshWardrobe();
render();
requestAnimationFrame(frame);
