'use strict';

// Build-time measurements of the actual production ring-map Canvas output.
// Nothing here runs on the public landing page or requires a network service.
// Reuses the independent path recorder/audit used by the renderer regression
// tests; it does not infer ring counts from the number of move buttons.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('../tests/game-harness.cjs');
const { recorder } = require('../tests/connected-map-recorder.cjs');
const { distinctPaths, incidence } = require('../tests/ring-intersection-audit.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist/atlas-metrics.json');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/games/constrained-solver-models/manifest.json'), 'utf8'));
const ids = manifest.models.map(model => model.id).filter(id => id !== 'homer').sort();
assert.equal(ids.length, 36, 'The public atlas has 36 puzzles; its bonus puzzle is excluded.');
assert.equal(new Set(ids).size, ids.length, 'Puzzle IDs must be unique.');

// Verified against exact engine shape predicates and transformed body vertices
// versus the solved hull planes. The other geometric cube/Skewb modifications
// retain their outer shape after completed legal turns. Mirror uses the fixed
// ordinary cube ring map; the five remaining shape shifters use occupied poses.
const shapeShifters = new Set(['mirror', 'axis', 'ghost', 'pyramorphix', 'mastermorphix', 'flatdiamond']);
const dynamicMaps = new Set(['axis', 'ghost', 'pyramorphix', 'mastermorphix', 'flatdiamond']);

const result = {
  methodology: {
    basis: 'Measured from production game scripts in the solved, colored view, with a 600 × 600 CSS-pixel ring canvas, device pixel ratio 1, and no selected axis.',
    nodes: 'One visible ring-map node per physical tile, including stationary reference tiles. This is not the number of rigid moving pieces.',
    colors: 'Distinct tile colors in the colored view. Colors are not necessarily geometric faces: a color can occur on multiple faces, and neutral tile colors count.',
    rings: 'Distinct visible closed paths in the solved ring map, including transport, companion, and reference loops. Overlapping duplicate paths count once. Rings are not rotation axes.',
    junctions: 'Occupied node locations lying on at least two distinct visible paths. Incidental crossings without a tile are not counted. Stationary reference nodes may not be junctions.',
    axisControls: 'Number of selectable turn controls, including independently selectable slices or tips. Opposite turning poles can share a geometric axis line.',
    shapeShifter: 'The outer shape can change after a completed legal turn, rather than merely while a turn is animating.',
    dynamicMap: 'Occupied map positions and required orbit paths can change after moves; the tile count stays constant. Ring and junction counts listed here are for the solved view. The Mirror Cube keeps a fixed cube map.',
    measurement: 'Independent Canvas recording via tests/game-harness.cjs, tests/connected-map-recorder.cjs, and tests/ring-intersection-audit.cjs. Distinct-path and incidence tolerances are those of the renderer audit (0.1 and 0.35 CSS pixels, respectively).',
    command: 'node scripts/measure-atlas-metrics.cjs',
    verificationCommand: 'node scripts/measure-atlas-metrics.cjs --check'
  },
  puzzles: {}
};

for (const id of ids) {
  const capture = recorder();
  const app = createHarness({
    htmlPath: path.join(root, 'dist/games', id + '.html'),
    bundled: true,
    canvasContexts: { rings: capture.context },
    dimensions: { rings: { width: 600, height: 600 } },
    devicePixelRatio: 1,
    speed: 5,
    search: '?color=1'
  });
  app.frame();
  const nodes = app.context.PUZZLE_SOLVER_BRIDGE.nodes();
  const paths = distinctPaths(capture);
  assert.equal(nodes.length, app.snapshot().stickers.length, id + ': exactly one visible node per physical tile');
  assert(nodes.length > 0 && paths.length > 0, id + ': complete ring map');
  const metrics = {
    nodes: nodes.length,
    colors: new Set(nodes.map(node => node.color)).size,
    rings: paths.length,
    junctions: nodes.filter(node => incidence(node, paths).paths >= 2).length,
    axisControls: app.document.querySelectorAll('.ring-key').length,
    shapeShifter: shapeShifters.has(id),
    dynamicMap: dynamicMaps.has(id)
  };
  assert(metrics.axisControls > 0, id + ': turn controls are present');
  result.puzzles[id] = metrics;
}

const serialized = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(output, 'utf8'), serialized, 'Atlas metrics must match current production rendering.');
  console.log('Verified solved-view ring metrics for all 36 public puzzles.');
} else {
  fs.writeFileSync(output, serialized);
  console.log('Wrote dist/atlas-metrics.json for all 36 public puzzles.');
}
