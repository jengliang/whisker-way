"use strict";

const Sound = (() => {
  let ac = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let musicFilter = null;
  let noiseBuffer = null;
  let purr = null;
  let purring = false;
  let muted = false;
  let night = 0;
  let nextStepTime = 0;
  let step = 0;
  let melodyIndex = 4;

  const ROOT = 261.63;
  const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  const CHORDS = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]];
  const STEP_SECONDS = 60 / 76 / 2;

  const freq = (semitones) => ROOT * Math.pow(2, semitones / 12);

  function unlock() {
    if (!ac) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      ac = new Context();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ac.destination);
      sfxBus = ac.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);

      musicFilter = ac.createBiquadFilter();
      musicFilter.type = "lowpass";
      musicFilter.frequency.value = 1600;
      musicBus = ac.createGain();
      musicBus.gain.value = 0.55;
      const echo = ac.createDelay(1);
      echo.delayTime.value = STEP_SECONDS * 3;
      const feedback = ac.createGain();
      feedback.gain.value = 0.28;
      musicBus.connect(musicFilter);
      musicFilter.connect(master);
      musicFilter.connect(echo);
      echo.connect(feedback);
      feedback.connect(echo);
      echo.connect(master);

      noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      nextStepTime = ac.currentTime + 0.1;
      setInterval(scheduleMusic, 50);
    }
    if (ac.state === "suspended") ac.resume();
  }

  function envelope(gainNode, start, attack, duration, peak) {
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(peak, start + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  }

  function tone({ frequency, to = null, type = "sine", duration = 0.2, volume = 0.15, attack = 0.005, delay = 0, bus = sfxBus, filter = null }) {
    const start = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    envelope(gain, start, attack, duration, volume);
    let node = osc;
    if (filter) {
      const biquad = ac.createBiquadFilter();
      biquad.type = filter.type;
      biquad.frequency.setValueAtTime(filter.frequency, start);
      if (filter.to) biquad.frequency.exponentialRampToValueAtTime(filter.to, start + duration);
      biquad.Q.value = filter.q || 1;
      node.connect(biquad);
      node = biquad;
    }
    node.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise({ duration = 0.2, volume = 0.15, type = "lowpass", frequency = 800, to = null, q = 1, delay = 0 }) {
    const start = ac.currentTime + delay;
    const source = ac.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    filter.Q.value = q;
    const gain = ac.createGain();
    envelope(gain, start, 0.005, duration, volume);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.05);
  }

  function meow(pitch = 1, length = 0.5, volume = 0.13) {
    const start = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520 * pitch, start);
    osc.frequency.linearRampToValueAtTime(820 * pitch, start + length * 0.35);
    osc.frequency.linearRampToValueAtTime(480 * pitch, start + length);
    const formant = ac.createBiquadFilter();
    formant.type = "bandpass";
    formant.Q.value = 5;
    formant.frequency.setValueAtTime(900, start);
    formant.frequency.linearRampToValueAtTime(2100, start + length * 0.35);
    formant.frequency.linearRampToValueAtTime(850, start + length);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.06);
    gain.gain.setValueAtTime(volume, start + length * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(formant);
    formant.connect(gain);
    gain.connect(sfxBus);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  const EFFECTS = {
    jump: () => tone({ frequency: 360, to: 720, type: "triangle", duration: 0.14, volume: 0.1 }),
    doubleJump: () => {
      tone({ frequency: 880, duration: 0.35, volume: 0.08 });
      tone({ frequency: 1320, duration: 0.4, volume: 0.06, delay: 0.05 });
      tone({ frequency: 1760, duration: 0.3, volume: 0.04, delay: 0.1 });
    },
    land: () => noise({ duration: 0.09, volume: 0.12, frequency: 420 }),
    fish: () => {
      tone({ frequency: 988, duration: 0.12, volume: 0.09 });
      tone({ frequency: 1319, duration: 0.22, volume: 0.09, delay: 0.07 });
    },
    splash: () => {
      noise({ duration: 0.55, volume: 0.32, type: "bandpass", frequency: 1400, to: 260, q: 0.8 });
      tone({ frequency: 340, to: 110, duration: 0.3, volume: 0.08, delay: 0.05 });
    },
    meow: () => meow(),
    hurt: () => meow(1.35, 0.22, 0.12),
    caw: () => {
      for (const delay of [0, 0.22]) {
        tone({ frequency: 760, to: 520, type: "sawtooth", duration: 0.16, volume: 0.05, delay, filter: { type: "bandpass", frequency: 1300, q: 3 } });
      }
    },
    woof: () => {
      tone({ frequency: 260, to: 150, type: "square", duration: 0.14, volume: 0.09, filter: { type: "lowpass", frequency: 900 } });
      noise({ duration: 0.1, volume: 0.06, frequency: 700 });
    },
    crumble: () => {
      noise({ duration: 0.45, volume: 0.2, frequency: 700, to: 200 });
      for (let i = 0; i < 4; i++) noise({ duration: 0.04, volume: 0.08, type: "highpass", frequency: 1500, delay: 0.05 + i * 0.07 });
    },
    launch: () => tone({ frequency: 500, to: 1500, duration: 0.6, volume: 0.025 }),
    pop: () => {
      noise({ duration: 0.3, volume: 0.22, type: "lowpass", frequency: 1800, to: 300 });
      for (let i = 0; i < 6; i++) noise({ duration: 0.03, volume: 0.05, type: "highpass", frequency: 2500, delay: 0.12 + i * 0.06 + Math.random() * 0.04 });
    },
    fanfare: () => {
      [0, 4, 7, 12].forEach((semi, i) => tone({ frequency: freq(semi + 12), type: "triangle", duration: 0.4, volume: 0.08, delay: i * 0.11 }));
    },
    buy: () => {
      tone({ frequency: 1318, duration: 0.1, volume: 0.08 });
      tone({ frequency: 1760, duration: 0.3, volume: 0.08, delay: 0.08 });
    },
    deny: () => tone({ frequency: 220, to: 180, type: "triangle", duration: 0.18, volume: 0.08 }),
    tick: () => tone({ frequency: 660, duration: 0.06, volume: 0.05 }),
    select: () => tone({ frequency: 880, to: 1175, duration: 0.12, volume: 0.07 }),
  };

  function play(name) {
    if (!ac || muted || !EFFECTS[name]) return;
    EFFECTS[name]();
  }

  function ensurePurr() {
    if (purr) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 46;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    const tremolo = ac.createGain();
    tremolo.gain.value = 0.5;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 23;
    const depth = ac.createGain();
    depth.gain.value = 0.5;
    const out = ac.createGain();
    out.gain.value = 0;
    osc.connect(filter);
    filter.connect(tremolo);
    tremolo.connect(out);
    lfo.connect(depth);
    depth.connect(tremolo.gain);
    out.connect(sfxBus);
    osc.start();
    lfo.start();
    purr = out;
  }

  function setPurr(on) {
    if (on === purring) return;
    purring = on;
    if (!ac) return;
    ensurePurr();
    purr.gain.setTargetAtTime(on && !muted ? 0.22 : 0, ac.currentTime, 0.08);
  }

  function setMuted(value) {
    muted = value;
    if (!ac) return;
    master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.05);
  }

  function setNight(value) {
    night = value;
  }

  function scheduleStep(time) {
    const bar = Math.floor(step / 8) % CHORDS.length;
    const beat = step % 8;
    const chord = CHORDS[bar];
    const quiet = 1 - night * 0.45;
    if (beat === 0) {
      for (const semi of chord) {
        tone({ frequency: freq(semi), type: "triangle", duration: STEP_SECONDS * 8, volume: 0.03 * quiet, attack: 0.6, delay: time - ac.currentTime, bus: musicBus });
      }
    }
    if (beat === 0 || beat === 4) {
      tone({ frequency: freq(chord[0] - 12), type: "sine", duration: STEP_SECONDS * 3.5, volume: 0.07 * quiet, attack: 0.02, delay: time - ac.currentTime, bus: musicBus });
    }
    const density = 0.55 - night * 0.3;
    if (Math.random() < density) {
      melodyIndex = clampIndex(melodyIndex + Math.floor(Math.random() * 5) - 2);
      const octave = night > 0.6 ? 0 : 12;
      tone({ frequency: freq(PENTATONIC[melodyIndex] + octave), type: "sine", duration: STEP_SECONDS * 2.2, volume: 0.05 * quiet, attack: 0.01, delay: time - ac.currentTime, bus: musicBus });
    }
  }

  function clampIndex(index) {
    return Math.max(0, Math.min(PENTATONIC.length - 1, index));
  }

  function scheduleMusic() {
    if (!ac || ac.state !== "running") return;
    musicFilter.frequency.setTargetAtTime(1600 - night * 900, ac.currentTime, 1);
    while (nextStepTime < ac.currentTime + 0.25) {
      if (!muted) scheduleStep(nextStepTime);
      nextStepTime += STEP_SECONDS;
      step += 1;
    }
  }

  return { unlock, play, setPurr, setMuted, setNight };
})();
