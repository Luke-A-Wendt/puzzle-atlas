'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const {createCascade}=require('./css-budget-helper.cjs');
const manifest=require('../dist/games/constrained-solver-models/manifest.json');
const puzzles=Object.keys(manifest.fullSolveCaches);
for(const puzzle of puzzles)test(puzzle+': obsolete tile labels cannot be enabled through controls or public bridges',async()=>{
 const app=createPage(puzzle),display=app.context.PuzzleAxisDisplay,button=app.element('pieceLabels'),bridge=app.context.PUZZLE_SOLVER_BRIDGE;
 await app.flush();const physical=JSON.stringify(app.snapshot().stickers||app.snapshot().pieces);
 assert.equal(display.tileLabelsAvailable(),false);assert.equal(bridge?.tileLabelsAvailable?.()===true,false);
 if(button){assert.equal(createCascade(app,puzzle,320)(button).display,'none','legacy element retains engine references without consuming visible space');assert.equal(button.disabled,true);app.click('pieceLabels');}
 display.setTileLabels(true);bridge?.setTileLabels?.(true);await app.advance(0);
 assert.equal(display.tileLabelsVisible(),false);assert.equal(!!bridge?.tileLabelsOn?.(),false,'legacy engine API cannot reactivate tile labels');
 const texts=[];app.element('cube').drawing.fillText=text=>texts.push(String(text));
 display.setLabelMode('none');bridge?.setTileLabels?.(true);await app.advance(0);
 assert.deepEqual(texts,[],'no tile-label text leaks into the 3D renderer with all labels off');
 display.setLabelMode('more');assert.equal(display.labelMode(),'all','more remains a compatible API alias');
 assert.equal(display.tileLabelsVisible(),false,'more labels adds axes, never the obsolete tile layer');
 display.setHighlights3D(puzzle==='homer');display.toggleRingLabels();display.choose('R');
 display.resetDefaults();await app.advance(0);
 assert.equal(display.tileLabelsVisible(),false);assert.equal(display.labelMode(),'all');assert.equal(display.highlights3D(),puzzle==='homer');assert.equal(display.ringLabelsVisible(),true);assert.equal(display.selection('R'),null);
 assert.equal(JSON.stringify(app.snapshot().stickers||app.snapshot().pieces),physical,'presentation preferences never alter sticker locations');
 app.document.dispatch('DOMContentLoaded');await app.flush();assert.equal(app.document.querySelectorAll('#pieceLabels').length,button?1:0,'initialization does not duplicate legacy references');
});

test('Ghost retains clickable axis badges without adding a duplicate tile-label layer',async()=>{
 const app=createPage('ghost'),renderer=app.context.ShapeRenderer;let result;
 app.context.ShapeRenderer={...renderer,render(...args){result=renderer.render(...args);return result;}};
 app.context.PuzzleAxisDisplay.setLabelMode('some');app.context.PuzzleAxisDisplay.setTileLabels(true);app.context.PUZZLE_SOLVER_BRIDGE.setTileLabels(true);await app.advance(0);
 assert(result.targets.some(target=>target.face==='U'),'the irregular top face retains its axis badge');
 assert.equal(result.labels.length,0,'no tile labels remain, including labels different from axis names');
 app.context.PuzzleAxisDisplay.setLabelMode('none');await app.advance(0);
 assert.equal(result.targets.length,0);assert.equal(result.labels.length,0);
});
