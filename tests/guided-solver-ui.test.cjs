'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games'),clean=x=>JSON.parse(JSON.stringify(x));
const catalog=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'))).models;
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
function host(id='cube2'){
 const workers=[];class Worker{constructor(){workers.push(this);}postMessage(request){this.request=clean(request);}terminate(){this.terminated=true;}addEventListener(){}removeEventListener(){}}
 const app=createPage(id,{globals:{Worker,fetch:fetchFile}});app.ui=app.context.ConstrainedSolverUI;app.core=app.context.ConstrainedSolverCore;app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json')));app.workers=workers;
 app.ready=async()=>{await app.ui.setActive(true);assert.equal(app.ui.state().phase,'selecting');};
 app.payload=async worker=>{const responses=[],context={URL,performance,TextEncoder,console,fetch:fetchFile,location:{href:'https://atlas.test/games/constrained-solver-worker.js'},postMessage:result=>responses.push(clean(result))};context.self=context;context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(games,'constrained-solver-worker.js'),'utf8'),context);await context.onmessage({data:worker.request});return responses.at(-1);};
 app.settleSolver=async()=>{for(let i=0;i<2000;i++){await app.advance(2000);const snap=app.snapshot();if(!snap.animating&&snap.mode==='idle'&&!['solving','executing','loading','auto-gap'].includes(app.ui.state().phase))return;}throw Error('Solver did not settle');};
 return app;
}
test('all puzzles offer real constrained swaps and suggested holds without a disguised full-solve suggestion',async()=>{
 for(const {id}of catalog){const app=host(id);await app.ready();assert.equal(app.element('csSuggest'),null,id);assert(app.element('csSuggestHolds'),id);app.click('csSuggestHolds');assert.equal(app.workers.filter(w=>w.request?.task==='guided-solve'||w.request?.task==='full-solve').length,0,id+' selecting holds does not plan a full solution');assert.equal(app.ui.state().pair.length,0,id);assert.equal(app.ui.state().phase,'selecting',id);}
});

test('completed manual swap clears native default-reset flags before later ordinary turns',async()=>{
 const app=host(),api=app.context.PUZZLE_API,display=app.context.PuzzleAxisDisplay;await app.ready();
 const moveIndex=app.model.moves.findIndex(m=>m.name==='R2'),move=app.model.moves[moveIndex],map=app.core.mapSnapshot(app.model,app.snapshot());
 const a=map.occupiedNodes.find(n=>move.perm[n]!==n),b=move.perm[a];assert.equal(move.perm[b],a);
 app.ui.setTool('swap');app.ui.selectNode(String(map.nodeToSticker[a]));app.ui.selectNode(String(map.nodeToSticker[b]));app.ui.go();
 const worker=app.workers.findLast(w=>w.request?.task==='manual-swap');assert(worker);worker.onmessage({data:{id:worker.request.id,type:'result',result:{status:'solved',moveIndices:[moveIndex]},modelFingerprint:app.core.modelFingerprint(app.model)}});
 await app.settleSolver();assert.equal(app.ui.state().phase,'selecting');assert.equal(display.labelMode(),'none');
 display.setLabelMode('all');display.setHighlights3D(false);display.setTileLabels(true);
 app.ui.setActive(false);assert.equal(api.move('U'),true);await app.settleSolver();
 assert.equal(display.labelMode(),'all','an ordinary turn must not repeat a completed sequence reset');assert.equal(display.highlights3D(),false);assert.equal(display.tileLabelsAvailable(),false,'cube guides use fixed axis positions, not tile identifiers');assert.equal(display.tileLabelsVisible(),false);
});
