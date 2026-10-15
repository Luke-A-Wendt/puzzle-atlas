'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function host() {
  const frames = [], classes = new Set(); let renders = 0;
  const context = {requestAnimationFrame: callback => frames.push(callback), document: {body: {classList: {toggle(name, on) {on ? classes.add(name) : classes.delete(name);}}}}, PUZZLE_SOLVER_BRIDGE: {requestRender() {renders++;}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/games/puzzle-axis-display.js'), 'utf8'), context);
  return {display:context.PuzzleAxisDisplay, context, classes, frames, renders:()=>renders};
}
test('clearing display selection preserves animation highlighting and a deliberate new choice restores it', () => {
  const h = host(), d = h.display;
  assert.equal(d.selection('U'), null,'opening a puzzle has no selected axis');d.choose('U');assert.equal(d.selection('U'), 'U');
  d.hover('R'); d.clear();
  assert.equal(d.hovered(), null);
  assert.equal(d.selection('U'), null);
  assert(h.classes.has('puzzle-axis-muted'));
  assert.equal(d.selection('U', {move:{face:'F2'}}), 'F2');
  assert(!h.classes.has('puzzle-axis-muted'), 'animated move remains legible while ordinary selection is cleared');
  assert.equal(d.selection('U'), null, 'ending animation does not restore a stale axis');
  d.choose('R'); assert.equal(d.selection('R'), 'R'); assert(!h.classes.has('puzzle-axis-muted'));
});
test('3D-to-ring label synchronization redraws once after the drawing frame and returns independent sets', () => {
  const h = host(), d = h.display;
  d.publish3DAxes(['U','R','U']);
  assert.equal(h.renders(),0); assert.equal(h.frames.length,1);
  d.publish3DAxes(['R','U']); assert.equal(h.frames.length,1);
  d.publish3DAxes(['U','F']); assert.equal(h.frames.length,1,'new visible axes coalesce into the existing scheduled redraw');
  d.hover('Fi'); assert.deepEqual(Array.from(d.ringAxes()),['F','U','Fi']);
  const labels=d.ringAxes(); labels.push('fake'); assert(!d.ringAxes().includes('fake'));
  const before=h.renders(); h.frames.shift()(); assert.equal(h.renders(),before+1);
  d.publish3DAxes(['F','U']); assert.equal(h.frames.length,0,'unchanged label sets do not cause frame loops');
  d.hover(null); assert.deepEqual(Array.from(d.ringAxes()),['F','U']);
});

test('label and outline preferences are independent and the palette uses only light and dark ink', () => {
  const h=host(), d=h.display;
  assert.equal(d.labelMode(),'some');assert.equal(d.highlights3D(),true);assert.equal(d.ringLabelsVisible(),true);
  d.choose('R');d.setLabelMode('none');d.setHighlights3D(false);d.toggleRingLabels();
  assert.equal(d.labelMode(),'none');assert.equal(d.highlights3D(),false);assert.equal(d.ringLabelsVisible(),false);
  assert.equal(d.selection('R'),'R','hiding 3D labels and highlights never clears a selected ring');
  d.setLabelMode('bad');assert.equal(d.labelMode(),'none');
  let solving=true;h.context.ConstrainedSolverUI={visualState:()=>({active:solving})};
  assert.equal(d.ringLabelsVisible(),true,'ring label visibility preference applies only to turn-ring mode');
  solving=false;assert.equal(d.ringLabelsVisible(),false,'returning to turn rings restores its display preference');
  const light=d.palette(true),dark=d.palette(false);
  assert.equal(light.fill,dark.text);assert.equal(light.stroke,dark.fill);assert.equal(light.text,dark.fill);assert.equal(dark.stroke,light.fill);
  assert(Object.isFrozen(light));assert.equal(h.renders(),4,'one deliberate selection and three actual preference changes request redraws');
});
