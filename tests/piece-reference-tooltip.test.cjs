'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const types=['ghost','mastermorphix','pyramorphix','masterpyraminx','kilominx','crystal','helicopter','dino','rainbow','ultimate','skewb','diamond','fto'];
const state=a=>JSON.stringify(a.snapshot().stickers||a.snapshot().pieces);
function settle(a){for(let i=0;i<12;i++){if(!a.snapshot().animating&&a.snapshot().mode==='idle')return;a.frame(2000);}throw Error('Move did not finish');}
for(const type of types)test(type+': exact piece references are transient, state-read-only, and available without tile labels',()=>{
 const a=createPage(type),c=a.context,B=c.PUZZLE_SOLVER_BRIDGE,rings=a.element('rings'),tip=a.element('pieceReferenceTooltip');
 assert(tip);assert.equal(tip.hidden,true);assert.equal(B.tileLabelsAvailable(),false);
 const nodes=B.nodes();assert(nodes.length);const before=state(a),references=new Map(nodes.map(n=>[n.stickerId,B.inspectNode(n.stickerId)]));
 for(const n of nodes){const text=B.inspectNode(n.stickerId);assert.match(text,/→/,type+' every sticker has a home/current reference');assert.equal(typeof text,'string');}
 assert.equal(state(a),before,'inspecting has no physical side effects');assert.equal(a.snapshot().history.length,0);
 const node=nodes.find(n=>nodes.every(other=>other.stickerId===n.stickerId||Math.hypot(n.x-other.x,n.y-other.y)>1));assert(node);
 const p={clientX:node.x,clientY:node.y,pointerType:'mouse'};
 rings.dispatch('pointermove',p);assert.equal(tip.hidden,false);assert.equal(tip.textContent,'Piece reference · '+B.inspectNode(node.stickerId));
 assert.match(tip.style.cssText,/position:fixed/);assert.match(tip.style.cssText,/100vw - 24px/);assert.match(tip.style.cssText,/pointer-events:none/);assert.match(tip.style.cssText,/overflow-wrap:anywhere/);
 rings.dispatch('pointerleave',p);assert.equal(tip.hidden,true);
 rings.dispatch('pointerdown',{...p,pointerType:'touch'});rings.dispatch('pointerup',{...p,pointerType:'touch'});
 assert.equal(tip.hidden,false,'stationary tap shows the same readout');assert.equal(state(a),before,'tap is inspection/axis selection, not a puzzle move');
 rings.dispatch('pointerdown',p);rings.dispatch('pointermove',{...p,clientX:p.clientX+8,buttons:1});assert.equal(tip.hidden,true);rings.dispatch('pointercancel',p);
 rings.dispatch('pointermove',p);assert.equal(tip.hidden,false);
 a.document.dispatch('pointermove',{target:a.element('cube')});assert.equal(tip.hidden,true);
 rings.dispatch('pointermove',p);c.PUZZLE_API.move({face:a.document.querySelector('.notation-key').dataset.face,dir:1});assert.equal(tip.hidden,true,'native animation clears the reference immediately');
 rings.dispatch('pointermove',p);assert.equal(tip.hidden,true,'no stale reference while a piece is moving');settle(a);
 assert(B.nodes().some(n=>B.inspectNode(n.stickerId)!==references.get(n.stickerId)),'a completed move updates actual piece location/orientation references');
 c.ConstrainedSolverUI={visualState:()=>({active:true})};rings.dispatch('pointermove',p);assert.equal(tip.hidden,true,'constrained selections own their own node UI');
});
test('shape reference gives the exact named mechanism slot and orientation and stays hidden in mirror mode',()=>{
 const a=createPage('ghost'),c=a.context,B=c.PUZZLE_SOLVER_BRIDGE,model=c.ShapeEngine.create('ghost');
 const chosen=model.pieces.find(p=>p.kind==='corner'),id=String(model.stickerState.find(s=>s.piece===chosen.id).id);
 assert.match(B.inspectNode(id),new RegExp('^'+chosen.name+' → '+c.ShapeRenderer.slotName(chosen.pos)));
 const move={face:model.configs.find(config=>model.movingPieces({face:config.id,dir:1}).includes(chosen.id)).id,dir:1};model.applyMove(move);c.PUZZLE_API.move(move);settle(a);
 const moved=model.pieces.find(p=>p.id===chosen.id),text=B.inspectNode(id);assert(text.startsWith(moved.name+' → '+c.ShapeRenderer.slotName(moved.pos)));assert.match(text,/frame R→.*U→.*F→/);
 a.click('mirrorMode');assert.equal(B.inspectNode(id),'');const node=B.nodes().find(n=>n.stickerId===id);a.element('rings').dispatch('pointermove',{clientX:node.x,clientY:node.y});assert.equal(a.element('pieceReferenceTooltip').hidden,true);
});
test('Skewb Puzzleball reference distinguishes repeated colors by exact roof identity and destination',()=>{
 const a=createPage('ultimate'),c=a.context,B=c.PUZZLE_SOLVER_BRIDGE,model=c.SkewbEngine.create('ultimate');
 const piece=model.pieces.find(p=>p.kind!=='corner'),sticker=model.stickerState.find(s=>s.piece===piece.id),move={face:model.configs.find(cfg=>model.movingPieces({face:cfg.id,dir:1}).includes(piece.id)).id,dir:1};
 assert(B.inspectNode(sticker.id).includes(piece.name+' → '+piece.name));model.applyMove(move);c.PUZZLE_API.move(move);settle(a);
 const at=model.pieces.find(p=>p.id===piece.id),slot=model.polyhedron.pieces.find(p=>p.home.every((x,i)=>Math.abs(x-at.pos[i])<1e-7));
 assert(B.inspectNode(sticker.id).includes(piece.name+' → '+slot.name));assert.match(B.inspectNode(sticker.id),/sticker faces .*→/);
});
