'use strict';
// Independent integration checks for the compact controls. These execute every
// shipped puzzle's real scripts in the deterministic DOM host, not a browser.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(model=>model.id);
const plain=value=>JSON.parse(JSON.stringify(value));
function settle(app){for(let step=0;step<500;step++){const s=app.snapshot();if(!s.animating&&s.mode==='idle'&&!app.context.PuzzleJournal.state().replaying)return;app.frame(2000);}throw Error('Unfinished native journal sequence');}
class DeferredWorker { constructor(){this.listeners={};} postMessage(){} addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);} removeEventListener(){} terminate(){} }
function host(id){return createPage(id,{globals:{Worker:DeferredWorker,fetch:async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};}}});}

for(const puzzle of puzzles)test(puzzle+': compact selected-axis controls, independent label settings, speed and journal preserve their shared contract',async()=>{
  const app=host(puzzle),api=app.context.PUZZLE_API,D=app.context.PuzzleAxisDisplay;
  await app.flush();D.resetDefaults();
  const canvas=app.element('cube').parentElement,bottom=app.element('viewRingControls'),group=bottom.querySelector('.turn-bar'),top=app.document.querySelector('.cube-top');
  assert.equal(top.nextSibling,canvas,'settings directly precede the canvas without a metrics strip');
  assert.equal(app.document.querySelector('.cube-bottom').hidden,true,'native counters are retained without occupying a row');
  assert.equal(canvas.nextSibling,bottom,'duplicate ring controls are immediately below the canvas');
  assert.equal(app.element('viewPrimaryTools'),null);assert.equal(app.element('viewAxisTurns'),null);assert.equal(app.element('viewActionsToggle'),null);
  assert.equal(group.parentElement,bottom);
  assert.deepEqual(app.element('viewDisplayTools').children.filter(el=>el.nodeType!==3).map(el=>el.id),['viewLabelMode','viewHighlightToggle']);
  for(const id of ['faceView','homeView']){const camera=app.element(id);if(camera){assert.equal(camera.hidden,true);assert.equal(camera.disabled,true);assert.equal(camera.getAttribute('aria-hidden'),'true');assert.equal(camera.getAttribute('tabindex'),'-1');}}
  assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');
  assert.equal(app.element('selectedName').textContent,'Select axis');
  for(const id of ['viewRingCCW','viewRingCW','ccw','cw'])assert.equal(app.element(id).disabled,true,id+' must be disabled with no selected axis');
  assert.equal(app.element('notationButtons').closest('.notation-panel').hidden,true);
  for(const id of ['viewLabelMode','ringLabelToggle'])assert.doesNotMatch(app.element(id).textContent,/axis|tile|piece/i);
  assert.equal(D.tileLabelsAvailable(),false,'axis-label presets are the only label visibility control');
  if(app.element('pieceLabels'))assert.equal(app.element('pieceLabels').disabled,true,'legacy tile-label controls cannot be activated');
  assert.equal(app.element('playTimerReadout'),null,'the retired timer is not installed');
  assert.equal(D.labelMode(),'none');
  app.element('playbackSpeed').value='2';app.element('playbackSpeed').dispatch('change');
  for(const mode of ['none','some','more']){
    D.setLabelMode(mode);assert.equal(String(app.element('speed').value),'2');assert.equal(String(app.element('playbackSpeed').value),'2','label changes preserve an independent speed choice');
  }
  D.resetDefaults();assert.equal(D.labelMode(),'all');assert.equal(String(app.element('playbackSpeed').value),'2','transient selection reset preserves settings');
  const axis=app.document.querySelector('.notation-key').dataset.face;
  api.select(axis);D.syncTurnControls();assert(app.element('viewRingSelectedName').textContent.length>0);
  for(const id of ['viewRingCCW','viewRingCW'])assert.equal(app.element(id).disabled,false,id+' enabled for a legal selected axis');
  D.clear();D.syncTurnControls();assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');

  const initial=plain(app.snapshot().stickers||app.snapshot().pieces);
  assert.equal(api.runMoves([{face:axis,dir:1},{face:axis,dir:1}],{label:'Playback preference check'}),true);settle(app);
  const changed=plain(app.snapshot().stickers||app.snapshot().pieces);
  D.setLabelMode('none');app.element('playbackSpeed').value='4';app.element('playbackSpeed').dispatch('change');
  for(const [button,expected]of [['undoSequence',initial],['redoSequence',changed]]){
    app.click(button);assert.equal(String(app.element('playbackSpeed').value),'4','sequence playback starts at the chosen rate');settle(app);
    assert.deepEqual(plain(app.snapshot().stickers||app.snapshot().pieces),expected);
    assert.equal(D.labelMode(),'none','journal playback leaves label preferences alone');assert.equal(String(app.element('playbackSpeed').value),'4','journal completion leaves the rate alone');
  }
  D.resetDefaults();assert.equal(D.labelMode(),'none');assert.equal(String(app.element('playbackSpeed').value),'4');

  const ui=app.context.ConstrainedSolverUI;
  await ui.setActive(true);for(let n=0;n<30&&ui.state().phase==='loading';n++)await app.advance(0);
  assert.equal(ui.state().phase,'selecting');ui.setTool('hold');
  assert.equal(ui.suggestHolds(),true);assert.equal(ui.state().tool,'swap','Suggest holds advances directly to the 1/2 selection tool');
  assert.equal(ui.state().pairTarget,0);assert.deepEqual(plain(ui.state().pair),[]);
  ui.setActive(false);
});
