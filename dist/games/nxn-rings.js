
/* Ring Atlas: 3N intersecting circles encode all 6N² facelets.
 * Each slice belt has 4N dots; a quarter-turn advances exactly N slots.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const AXES = ['x', 'y', 'z'];
  const centers = [
    {x: 325, y: 314.903810568}, // x: lower-right family
    {x: 250, y: 185},          // y: upper family
    {x: 175, y: 314.903810568}  // z: lower-left family
  ];
  const E=root.CubeEngine,levels=E.levels;
  const radii=levels.map((_,i)=>98+57*i/(levels.length-1));
  const names=[0,1,2].map(axis=>levels.map(layer=>Object.keys(E.configs).find(name=>E.configs[name].axis===axis&&E.configs[name].layer===layer)));
  const faceNames=Object.fromEntries(Object.entries(E.configs).map(([name,cfg])=>[name,cfg.label]));
  const rings = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const layer of levels) {
      rings.push({
        name: names[axis][levels.indexOf(layer)],
        label: faceNames[names[axis][levels.indexOf(layer)]],
        axis, axisName: AXES[axis], layer,
        cx: centers[axis].x, cy: centers[axis].y, r: radii[levels.indexOf(layer)]
      });
    }
  }
  const byName = Object.fromEntries(rings.map(r => [r.name, r]));
  const getRing = name => typeof name === 'object' ? name : byName[String(name).replace(/[′'2]/g, '')];
  const coord = (v, axis) => Array.isArray(v) ? v[axis] : v[AXES[axis]];
  const mod = (x, n) => ((x % n) + n) % n;
  const radius = layer => radii[levels.indexOf(layer)];

  function circleIntersection(a, ra, b, rb, normalSign) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const along = (ra * ra - rb * rb + d * d) / (2 * d);
    const height = Math.sqrt(Math.max(0, ra * ra - along * along));
    // Positive face normals select the negative perpendicular intersection.
    return {
      x: a.x + along * dx / d + normalSign * height * dy / d,
      y: a.y + along * dy / d - normalSign * height * dx / d
    };
  }

  function position(sticker) {
    const n = sticker.n, p = sticker.p;
    const normal = [0, 1, 2].find(a => Math.abs(coord(n, a)) > 0.5);
    const a = (normal + 1) % 3, b = (normal + 2) % 3;
    return circleIntersection(centers[a], radius(coord(p, a)), centers[b], radius(coord(p, b)), coord(n, normal));
  }

  function angleAt(point, ring) {
    return Math.atan2(point.y - ring.cy, point.x - ring.cx);
  }

  function arcPosition(before, after, ringOrName, t, quarterTurns) {
    const ring = getRing(ringOrName);
    const a = before.p ? position(before) : before;
    const b = after.p ? position(after) : after;
    if (t <= 0) return {x: a.x, y: a.y};
    if (t >= 1) return {x: b.x, y: b.y};
    const start = angleAt(a, ring), end = angleAt(b, ring);
    // Canvas angles increase clockwise; physical positive rotation is CCW.
    const direction = quarterTurns >= 0 ? -1 : 1;
    let delta = direction * mod(direction * (end - start), TAU);
    if (Math.abs(quarterTurns) >= 4) delta += direction * TAU * Math.floor(Math.abs(quarterTurns) / 4);
    const angle = start + delta * t;
    return {x: ring.cx + ring.r * Math.cos(angle), y: ring.cy + ring.r * Math.sin(angle)};
  }

  function interpolateSticker(before, after, ringOrName, t, quarterTurns) {
    const ring = getRing(ringOrName);
    const a = position(before), b = position(after);
    if (coord(before.p, ring.axis) === ring.layer && coord(before.n, ring.axis) === 0) {
      return arcPosition(a, b, ring, t, quarterTurns);
    }
    // Outer-slice facelets also turn. They belong to two other ring families,
    // so they move through their face cluster rather than on the selected ring.
    return {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
  }

  const slots = [];
  for (let normal = 0; normal < 3; normal++) {
    for (const sign of [-1, 1]) {
      for (const u of levels) {
        for (const v of levels) {
          const p = [0, 0, 0], n = [0, 0, 0];
          p[normal] = E.extent*sign; n[normal] = sign;
          p[(normal + 1) % 3] = u;
          p[(normal + 2) % 3] = v;
          const sticker = {p, n};
          slots.push({...sticker, ...position(sticker)});
        }
      }
    }
  }
  for (const ring of rings) {
    ring.slots = slots.filter(s => s.p[ring.axis] === ring.layer && s.n[ring.axis] === 0)
      .map(s => ({...s, angle: angleAt(s, ring)}))
      .sort((a, b) => a.angle - b.angle);
  }
  const api = {rings, slots, centers, radii, position, getRing, angleAt, arcPosition, interpolateSticker, width:500, height:500};
  root.RingGeometry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

