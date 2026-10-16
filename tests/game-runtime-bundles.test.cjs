'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {groups,contents,packHTML}=require('../scripts/build-game-runtime.cjs'),scriptSources=require('./page-script-sources.cjs'),{createPage}=require('./solver-dom.cjs');
const games=path.resolve(__dirname,'../dist/games'),ids=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'),'utf8')).models.map(model=>model.id);
test('shared bundles contain byte-for-byte ordered sources and are regenerated for every release',()=>{
 for(const [bundle,files]of Object.entries(groups))assert.equal(fs.readFileSync(path.join(games,bundle),'utf8'),contents(files,games),bundle+' must match editable sources');
 const prepare=fs.readFileSync(path.resolve(__dirname,'../scripts/prepare-release.cjs'),'utf8');assert(prepare.indexOf("require('./build-game-runtime.cjs').build()")<prepare.indexOf('digest=crypto.createHash'));
});
test('all games replace nine component requests with two local bundles, without moving their execution',()=>{
 for(const id of ids){
  const html=fs.readFileSync(path.join(games,id+'.html'),'utf8'),scripts=scriptSources(html),requests=[...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)/g)].map(m=>m[1]);
  assert.deepEqual(scripts.slice(0,5),groups['game-controls.bundle.js'],id+' prefix order');assert.deepEqual(scripts.slice(-4),groups['game-solver.bundle.js'],id+' suffix order');
  assert.equal(requests.filter(name=>name.endsWith('.bundle.js')).length,2);assert.equal(scripts.length-requests.length,7,id+' removes seven network requests');
  for(const file of Object.values(groups).flat())assert(!requests.includes(file),id+' does not duplicate '+file);
  assert.equal(packHTML(html),html,id+' rebuild is idempotent');
 }
});
for(const id of ids)test(id+': production bundles initialize controls, solver bridge and exact inverse moves',async()=>{
 const app=createPage(id),before=app.snapshot(),bridge=app.context.PUZZLE_SOLVER_BRIDGE;
 assert(app.context.ConstrainedSolverCore);assert(app.context.ConstrainedSolverUI);assert(bridge?.nodes().length>0);assert.equal(bridge.nodes().length,before.stickers.length);
 const face=app.context.PUZZLE_API.axes?.()[0]?.face||before.selected||app.context.PUZZLE_API.getAxes?.()?.[0]?.face;
 // Each puzzle's own bridge supplies its legal moves; no common cube convention
 // is imposed on tetrahedral, corner-turning or dodecahedral engines.
 const model=app.context.PUZZLE_API.model?.();
 const axis=face||model?.moves?.[0]?.engineMove?.face;
 assert(axis,id+' has a native selectable axis');
 assert.equal(app.context.PUZZLE_API.move({face:axis,dir:1,turns:1}),true);await app.settle();
 assert.equal(app.context.PUZZLE_API.move({face:axis,dir:-1,turns:1}),true);await app.settle();
 assert.deepEqual(app.snapshot().stickers,before.stickers,id+' source composition preserves exact inverse state');
});
