
/* Exact integer-coordinate N×N×N cube model. No runtime dependencies. */
(function (root) {
  'use strict';

  const size = Number(root.CUBE_SIZE || 5);
  if (!Number.isInteger(size) || size < 2 || size > 8) throw new Error('Unsupported cube size');
  const extent = size - 1;
  const levels = Object.freeze(Array.from({length:size}, (_,i) => 2*i-extent));
  const axisFaces = [['L','R','M'],['D','U','E'],['B','F','S']];
  const faceWords = {L:'Left',R:'Right',D:'Lower',U:'Upper',B:'Back',F:'Front',M:'Middle left / right',E:'Middle down / up',S:'Middle back / front'};
  const configs = Object.freeze(Object.fromEntries(axisFaces.flatMap(([negative,positive,middle],axis) => levels.map((layer,index) => {
    const depth = Math.min(index,size-1-index);
    const base = layer < 0 ? negative : positive;
    const face = layer === 0 ? middle : base+'i'.repeat(depth);
    const turn = layer === 0 ? (axis === 2 ? -1 : 1) : -Math.sign(layer);
    const label = layer === 0 ? faceWords[middle]+' slice' : faceWords[base]+(depth===0?' outer':depth===1?' inner':depth===2?' second inner':' third inner');
    return [face,Object.freeze({axis,layer,turn,inner:Math.abs(layer)!==extent,depth,label})];
  }))));
  const faceColors = Object.freeze({
    U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange'
  });
  const colors = Object.freeze({
    white: '#f4f2e8', yellow: '#ffd447', green: '#36bf85',
    blue: '#4394f7', red: '#f36c73', orange: '#ff9b52'
  });

  function normalizeMove(move) {
    if (typeof move === 'string') {
      const match = /^([UDLRFB]i{0,3}|[MES])(2?)(['’′]?)$/.exec(move.trim());
      if (!match || !configs[match[1]]) throw new Error('Invalid cube move: ' + move);
      return { face: match[1], dir: match[3] ? -1 : 1, turns: match[2] ? 2 : 1 };
    }
    if (!move || !configs[move.face]) throw new Error('Invalid cube move');
    const dir = move.dir === undefined ? 1 : move.dir;
    const turns = move.turns === undefined ? 1 : move.turns;
    if ((dir !== 1 && dir !== -1) || (turns !== 1 && turns !== 2)) {
      throw new Error('Moves need dir +1/-1 and turns 1/2');
    }
    return { face: move.face, dir: dir, turns: turns };
  }

  function makeSolved() {
    const stickers = [];
    for (const face of ['U', 'D', 'F', 'B', 'R', 'L']) {
      const cfg = configs[face];
      const otherAxes = [0, 1, 2].filter(axis => axis !== cfg.axis);
      for (const a of levels) {
        for (const b of levels) {
          const p = [0, 0, 0], n = [0, 0, 0];
          p[cfg.axis] = cfg.layer;
          p[otherAxes[0]] = a;
          p[otherAxes[1]] = b;
          n[cfg.axis] = Math.sign(cfg.layer);
          stickers.push({ id: face + ':' + a + ':' + b, p, n,
            color: faceColors[face], homeFace: face });
        }
      }
    }
    return stickers;
  }

  // Positive turns follow the right-hand rule in x-right/y-up/z-front coordinates.
  function rotateVector(v, axis, quarterTurns) {
    let [x, y, z] = v;
    const turns = ((quarterTurns % 4) + 4) % 4;
    for (let i = 0; i < turns; i++) {
      if (axis === 0) [y, z] = [-z, y];
      else if (axis === 1) [x, z] = [z, -x];
      else [x, y] = [-y, x];
    }
    // Canonicalize negative zero, making equality and serialization unambiguous.
    return [x || 0, y || 0, z || 0];
  }

  function selected(sticker, move) {
    const cfg = configs[normalizeMove(move).face];
    return sticker.p[cfg.axis] === cfg.layer;
  }

  function applyMove(stickers, move) {
    const m = normalizeMove(move), cfg = configs[m.face];
    const turns = cfg.turn * m.dir * m.turns;
    return stickers.map(sticker => {
      const included = sticker.p[cfg.axis] === cfg.layer;
      return Object.assign({}, sticker, {
        p: included ? rotateVector(sticker.p, cfg.axis, turns) : sticker.p.slice(),
        n: included ? rotateVector(sticker.n, cfg.axis, turns) : sticker.n.slice()
      });
    });
  }

  function invertMove(move) {
    const m = normalizeMove(move);
    return { face: m.face, dir: -m.dir, turns: m.turns };
  }

  function moveLabel(move) {
    const m = normalizeMove(move);
    return m.face + (m.turns === 2 ? '2' : m.dir === -1 ? "'" : '');
  }

  function isSolved(stickers) {
    if (!Array.isArray(stickers) || stickers.length !== 6*size*size) return false;
    const faces = new Map();
    for (const sticker of stickers) {
      const key = sticker.n.join(',');
      if (!faces.has(key)) faces.set(key, { color: sticker.color, count: 0 });
      const face = faces.get(key);
      if (face.color !== sticker.color) return false;
      face.count++;
    }
    return faces.size === 6 && [...faces.values()].every(face => face.count === size*size);
  }

  function seedNumber(seed) {
    const value = String(seed);
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  // A deterministic 32-bit PRNG: identical visible seeds reproduce identical scrambles.
  function seededRandom(seed) {
    let state = seedNumber(seed);
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function scramble(seed, length) {
    const count = length === undefined ? size*12 : length;
    if (!Number.isInteger(count) || count < 0) throw new Error('Invalid scramble length');
    const random = seededRandom(seed), faces = Object.keys(configs);
    const moves = [];
    let lastAxis = -1;
    for (let i = 0; i < count; i++) {
      const candidates = faces.filter(face => configs[face].axis !== lastAxis);
      const face = candidates[Math.floor(random() * candidates.length)];
      const amount = Math.floor(random() * 3);
      moves.push({ face, dir: amount === 1 ? -1 : 1, turns: amount === 2 ? 2 : 1 });
      lastAxis = configs[face].axis;
    }
    return moves;
  }

  root.CubeEngine = Object.freeze({
    size, extent, configs, levels, colors, faceColors, makeSolved, normalizeMove, rotateVector,
    selected, applyMove, invertMove, moveLabel, isSolved, seededRandom, scramble
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CubeEngine;
})(typeof window !== 'undefined' ? window : globalThis);

