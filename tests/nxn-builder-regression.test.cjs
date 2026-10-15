'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('N×N builder preserves generated layer counts, companion pointer support and timer controls',()=>{
 const file=path.resolve(__dirname,'../scripts/build-nxn.cjs'),outputs=new Map();
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{__dirname:path.dirname(file),console:{log(){}},require:name=>name==='node:fs'?{readFileSync:fs.readFileSync,writeFileSync:(target,data)=>outputs.set(path.basename(target),String(data))}:require(name)},{filename:file});
 for(const size of [5,6,7,8,9,10]){
  const context={CUBE_SIZE:size};vm.createContext(context);
  vm.runInContext(outputs.get('nxn-engine.js'),context);vm.runInContext(outputs.get('nxn-rings.js'),context);
  assert.equal(Object.keys(context.CubeEngine.configs).length,3*size);assert.equal(context.RingGeometry.rings.length,3*size);assert.equal(context.RingGeometry.slots.length,6*size*size);
  assert(context.RingGeometry.slots.every(slot=>{const p=context.RingGeometry.position(slot);return Number.isFinite(p.x)&&Number.isFinite(p.y);}));
  assert.match(outputs.get('cube'+size+'.html'),/<script src="play-timer.js"><\/script>/);
  for(const helper of ['play-controls.js','puzzle-axis-display.js','move-journal.js','puzzle-selection-3d.js','cube-face-tracks.js','ring-panel.js','constrained-solver.js'])assert(outputs.get('cube'+size+'.html').includes(helper),'generated page retains '+helper);
 }
 assert.match(outputs.get('nxn-app.js'),/ringLabelTargets=G\.drawAxisLabels/);
 assert.match(outputs.get('nxn-app.js'),/r=ringDrag\.r\|\|G\.getRing\(selected\),a=G\.angleAt/);
 assert.match(outputs.get('nxn-engine.js'),/third inner/);
});
