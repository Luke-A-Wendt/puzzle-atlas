'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=value=>JSON.parse(JSON.stringify(value));
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
const catalog=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'))).models;
function host(id='cube2'){
  const workers=[];
  class Worker{constructor(){workers.push(this);}postMessage(request){this.request=clean(request);}terminate(){this.terminated=true;}addEventListener(){}removeEventListener(){}}
  const app=createPage(id,{globals:{Worker,fetch:fetchFile}});app.workers=workers;
  app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json')));
  app.ui=app.context.ConstrainedSolverUI;app.core=app.context.ConstrainedSolverCore;
  app.ready=async()=>{app.ui.setActive(true);for(let i=0;i<100&&app.ui.state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui.state().phase,'selecting',id);};
  app.map=()=>app.core.mapSnapshot(app.model,app.snapshot());
  return app;
}
function goalAt(model){const goal=new Map();for(const [id,node]of Object.entries(model.homeBySticker))goal.set(node,String(model.colorBySticker[id]));return goal;}

test('all catalog puzzles suggest exactly the current color matches and show canonical goal fills without changing the puzzle',async()=>{
  for(const {id}of catalog){
    const app=host(id),move=app.model.moves[0].engineMove;
    assert.equal(app.context.PUZZLE_API.runMoves([move]),true,id);await app.settle();await app.ready();
    const before=app.snapshot(),mapping=app.map(),colors=app.core.colorsFromSnapshot(app.model,before,mapping),goal=goalAt(app.model);
    const list=Array.from(app.context.PUZZLE_SOLVER_BRIDGE.nodes()),first=String(list[0].stickerId),second=String(list[1].stickerId);
    app.ui.selectNode(first);app.ui.setTool('swap');app.ui.selectNode(first);app.ui.selectNode(second);
    app.click('csSuggestHolds');
    const expected=Object.entries(mapping.stickerToNode).filter(([,node])=>goal.has(node)&&goal.get(node)===colors[node]).map(([id])=>id).sort();
    assert.deepEqual(clean(app.ui.state().held).sort(),expected,id+' suggested holds');assert.deepEqual(clean(app.ui.state().pair),[],id+' cleared pair');assert.equal(app.ui.state().tool,'hold');
    const palette=new Map(list.map(n=>[String(app.model.colorBySticker[String(n.stickerId)]),n.color]));
    const ctx=app.element('csNodeOverlay').drawing,paint=[];let arc;
    ctx.arc=(x,y,r)=>arc={x,y,r};ctx.fill=()=>{if(arc)paint.push({...arc,color:ctx.fillStyle});};
    app.element('csShowGoal').dispatch('pointerdown',{pointerId:7});assert.equal(app.ui.state().goalPreview,true,id);await app.advance(0);
    for(const n of list){const target=goal.get(mapping.stickerToNode[String(n.stickerId)]),expectedColor=target===undefined?'#24252e':palette.get(target)||target;
      assert(paint.some(p=>p.x===n.x&&p.y===n.y&&p.color===expectedColor),id+' correct goal at '+n.stickerId);
    }
    app.element('csShowGoal').dispatch('pointerup',{pointerId:7});assert.equal(app.ui.state().goalPreview,false,id);assert.deepEqual(app.snapshot(),before,id+' no engine mutation');
  }
});

test('goal preview releases for pointer cancel/lost capture/outside release, keyboard, blur, page hide, and mode close',async()=>{
  const app=host();await app.ready();const button=app.element('csShowGoal');
  const down=()=>{button.dispatch('pointerdown',{pointerId:6});assert.equal(app.ui.state().goalPreview,true);assert.equal(button.getAttribute('aria-pressed'),'true');};
  const released=()=>{assert.equal(app.ui.state().goalPreview,false);assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(app.element('ringPanel').classList.contains('cs-goal-preview'),false);};
  for(const event of ['pointercancel','lostpointercapture']){down();button.dispatch(event,{pointerId:6});released();}
  down();app.document.dispatch('pointerup',{pointerId:6});released();
  for(const key of [' ','Enter']){button.dispatch('keydown',{key});assert.equal(app.ui.state().goalPreview,true);app.document.dispatch('keyup',{key});released();}
  down();button.dispatch('blur');released();down();app.win.dispatch('blur');released();
  down();app.document.hidden=true;app.document.dispatch('visibilitychange');released();app.document.hidden=false;
  down();app.document.dispatch('keydown',{key:'Escape'});released();down();app.ui.closePanel();released();
});

test('goal preview blocks ring and 3D selection and Go without losing held endpoints or stale-search safety',async()=>{
  const app=host();await app.ready();const ids=Array.from(app.context.PUZZLE_SOLVER_BRIDGE.nodes().slice(0,3),n=>String(n.stickerId));
  app.ui.selectNode(ids[0]);app.ui.selectNode(ids[1]);app.ui.setTool('swap');app.ui.selectNode(ids[0]);app.ui.selectNode(ids[1]);
  const before=clean(app.ui.state());assert.equal(app.ui.canSelect3D(),true);app.element('csShowGoal').dispatch('pointerdown');
  assert.equal(app.ui.canSelect3D(),false);assert.equal(app.ui.selectNode(ids[2]),false);assert.equal(app.ui.setTool('hold'),false);assert.equal(app.ui.clearSelection(),false);assert.equal(app.ui.suggestHolds(),false);assert.equal(app.ui.go(),false);
  app.click('csPairA');assert.equal(app.element('csSuggest'),null);app.element('csShowGoal').dispatch('pointerup');
  assert.deepEqual(clean(app.ui.state().held),before.held);assert.deepEqual(clean(app.ui.state().pair),before.pair);assert.equal(app.ui.canSelect3D(),true);
  app.click('csSuggestHolds');assert.deepEqual(clean(app.ui.state().pair),[]);assert.equal(app.ui.state().held.length,app.model.stickerCount);assert.equal(app.ui.state().tool,'hold');
});

test('suggested holds recognize same-color replacements rather than exact home sticker identities',async()=>{
  const app=host();assert.equal(app.context.PUZZLE_API.runMoves(['U']),true);await app.settle();await app.ready();app.click('csSuggestHolds');
  const mapping=app.map(),held=clean(app.ui.state().held),goal=goalAt(app.model);
  const replacements=held.filter(id=>mapping.stickerToNode[id]!==app.model.homeBySticker[id]);assert(replacements.length>0,'U-face stickers rotate within their white goal');
  for(const id of replacements)assert.equal(String(app.model.colorBySticker[id]),goal.get(mapping.stickerToNode[id]));
});

test('overlay backing stores are reused across selection changes and resized only with the viewport',async()=>{
  const app=host();await app.ready();await app.advance(0);let writes=0;
  for(const id of ['csNodeOverlay','csAnchorBackdrop'])for(const dimension of ['width','height']){const el=app.element(id);let value=el[dimension];Object.defineProperty(el,dimension,{configurable:true,get:()=>value,set:next=>{writes++;value=next;}});}
  const ids=Array.from(app.context.PUZZLE_SOLVER_BRIDGE.nodes().slice(0,3),n=>String(n.stickerId));
  for(const id of ids){app.ui.selectNode(id);await app.advance(0);}assert.equal(writes,0,'same-size redraws reuse both canvas buffers');
  app.element('rings').bounds.width+=10;await app.advance(0);assert(writes>0,'real viewport change still resizes buffers');
});

test('Suggest holds discards a paused manual search and rejects its stale completion',async()=>{
  const app=host();await app.ready();const ids=Array.from(app.context.PUZZLE_SOLVER_BRIDGE.nodes().slice(0,2),n=>String(n.stickerId));
  app.ui.setTool('swap');ids.forEach(id=>app.ui.selectNode(id));app.ui.go();
  const worker=app.workers.find(w=>w.request?.task==='manual-swap');assert(worker);
  const request=worker.request;worker.onmessage({data:{id:request.id,type:'result',result:{status:'unknown',reason:'time_limit',search:{budgetMs:3000,nextBudgetMs:10000,canContinue:true,states:10}}}});
  assert.equal(app.ui.state().phase,'selecting');assert.equal(app.element('csRetry').hidden,false);
  app.click('csSuggestHolds');assert.equal(worker.terminated,true);assert.equal(app.ui.state().search,null);assert.equal(app.element('csRetry').hidden,true);
  const before=clean(app.ui.state());worker.onmessage({data:{id:request.id,type:'result',result:{status:'solved',moveIndices:[0]}}});
  assert.deepEqual(clean(app.ui.state()),before);assert.equal(app.snapshot().history.length,0);
});

test('Show goal is available on first opening in Turn rings for all catalog puzzles, without activating the solver',async()=>{
  for(const {id}of catalog){
    const app=host(id),button=app.element('csShowGoal'),before=app.snapshot();
    assert.equal(button.hidden,false,id);assert.equal(app.ui.state().active,false,id);
    button.dispatch('pointerdown',{pointerId:17});
    for(let i=0;i<100&&!app.ui.state().goalPreview;i++)await app.advance(0);
    assert.equal(app.ui.state().goalPreview,true,id);assert.equal(app.ui.state().active,false,id);
    assert.equal(app.element('csNodeOverlay').hidden,false,id);assert.equal(app.element('csNodeOverlay').style.pointerEvents,'none',id);
    app.document.dispatch('pointerup',{pointerId:17});assert.equal(app.ui.state().goalPreview,false,id);assert.equal(app.element('csNodeOverlay').hidden,true,id);
    assert.deepEqual(app.snapshot(),before,id+' preview makes no move');
  }
});

test('release before first goal load finishes cannot leave a delayed goal preview visible',async()=>{
  const app=host(),button=app.element('csShowGoal');button.dispatch('pointerdown',{pointerId:8});button.dispatch('pointerup',{pointerId:8});
  for(let i=0;i<25;i++)await app.advance(0);
  assert.equal(app.ui.state().goalPreview,false);assert.equal(app.element('csNodeOverlay').hidden,true);assert.equal(app.ui.state().active,false);
});
