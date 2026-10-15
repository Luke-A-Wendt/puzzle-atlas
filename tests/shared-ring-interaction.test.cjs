'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{createHarness}=require('./game-harness.cjs'),{dragPath,dispatchPath,screen}=require('./connected-ring-drag-helper.cjs');
const families={pyraminx:'TetraEngine',tetraminx:'TetraEngine',megaminx:'MegaEngine',rhombic:'ShapeEngine',flatdiamond:'ShapeEngine',cornerocta:'ShapeEngine',trajber:'ShapeEngine',pyramorphix:'ShapeEngine',jewel:'ShapeEngine',mastermorphix:'ShapeEngine',dino:'DinoEngine',rainbow:'DinoEngine',ultimate:'SkewbEngine',diamond:'SkewbEngine',skewb:'SkewbEngine',masterskewb:'SkewbEngine',jing:'SkewbEngine',fto:'FTOEngine',crystal:'CrystalEngine',helicopter:'HelicopterEngine'};
Object.assign(families,{diamondstyle:'ShapeEngine',diamondcube:'ShapeEngine'});
function run(types=Object.keys(families)){for(const type of types){const engineName=families[type];
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true,speed:5}),api=app.context.PUZZLE_API,inline=['pyraminx','tetraminx','megaminx'].includes(type),model=inline?app.context[engineName]:app.context[engineName].create(type),G=inline?app.context[type==='megaminx'?'MegaRings':'TetraRings']:app.context.FaceGroupedRings.create(model),configs=inline?Object.entries(model.configs).map(([id,c])=>({...c,id})):model.configs,canvas=app.elements.get('rings');
 const viewport=()=>G.render(canvas.getContext('2d'),{width:500,height:500,selected:app.snapshot().selected,state:inline?app.snapshot().stickers:undefined,focus:false}).viewport;
 assert.equal(app.elements.get('ringFocus').textContent,'Show all rings');app.click('ringFocus');assert.equal(app.elements.get('ringFocus').textContent,'Focus rings');app.click('ringFocus');
 // A click on an exposed, previously unselected curve selects that curve's
 // axis. Dragging that same curve performs the actual axis move.
 let unselected=null;for(const c of configs){if(c.id===app.snapshot().selected)continue;const found=dragPath(G,c.id,1,app.snapshot().selected);if(found){unselected={face:c.id,path:found};break;}}
 assert(unselected,type+' exposes a clickable unselected ring');dispatchPath(canvas,unselected.path,viewport());app.complete();assert.equal(app.snapshot().selected,unselected.face);assert.equal(app.snapshot().history.at(-1).face,unselected.face);assert.equal(app.snapshot().history.at(-1).dir,1);
 api.reset();app.frame(0);let intersection=null;
 for(const point of G.views()){const axes=configs.map(c=>c.id||c.face).filter(face=>{const near=G.nearestRing(point,face);return near&&near.ring.face===face&&near.distance<.02;});if(axes.length>1){intersection={point,axes};break;}}
 assert(intersection,type+' exposes shared sticker intersections');for(const face of intersection.axes.slice(0,2)){api.select(face);app.frame(0);canvas.dispatch('pointerdown',screen(intersection.point,viewport()));canvas.dispatch('pointerup',screen(intersection.point,viewport()));assert.equal(app.snapshot().selected,face,type+' keeps selected axis at an intersection');assert.equal(app.snapshot().history.length,0);}
 for(const focused of [false,true]){if(focused)app.click('ringFocus');for(const cfg of configs)for(const dir of [-1,1]){
  api.reset();api.select(cfg.id);app.frame(0);const path=dragPath(G,cfg.id,dir);assert(path,type+' '+cfg.id+' direction '+dir+' has a usable visible path');dispatchPath(canvas,path,viewport());app.complete();const move=app.snapshot().history.at(-1);assert(move,type+' '+cfg.id+' drag performs a move');assert.equal(move.face,cfg.id);assert.equal(move.dir,dir);
 }}
 api.reset();app.frame(0);
 if(app.elements.has('pieceInfo')){const dot=G.views()[0];canvas.dispatch('pointerdown',screen(dot,viewport()));canvas.dispatch('pointerup',screen(dot,viewport()));assert(!app.snapshot().animating);assert.match(app.elements.get('pieceInfo').textContent,/→|home|sticker/i,type+' keeps node inspection');}
 // Releasing or cancelling after only selecting a curve must not turn it.
 const selected=app.snapshot().selected,p=dragPath(G,selected,1);canvas.dispatch('pointerdown',screen(p.samples[0],viewport()));canvas.dispatch('pointercancel',screen(p.samples[0],viewport()));assert.equal(app.snapshot().history.length,0);
 console.log(type+': exposed-ring selection, every axis in both drag directions, focus labels, inspector and cancelled-click safety PASS');
}

}
module.exports={run};if(require.main===module)run();
