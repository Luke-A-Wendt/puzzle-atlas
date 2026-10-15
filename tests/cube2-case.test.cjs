'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Element}=require('./solver-dom.cjs');
const D=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/cube2-case-data.json'),'utf8'));
// Independent array arithmetic; do not use the production compose/factor helpers.
const I=Array.from({length:24},(_,i)=>i);
const then=(a,b)=>a.map(q=>b[q]);
const inv=a=>{const r=[];a.forEach((q,i)=>r[q]=i);return r;};
const evaluate=word=>word.reduce((p,j)=>then(p,D.moves[j].perm),I);
function factor(g,start=0){
 let r=g.slice(),word=[],selected=[];
 for(const level of D.levels.slice(start)){
  const t=level.entries.find(x=>x.image===r[level.base]);if(!t)return null;
  selected.push(t);word.push(...t.word.slice().reverse().map(j=>D.moves[j].inverse));
  r=then(r,inv(t.perm));
  assert(D.base.slice(0,level.index+1).every(b=>r[b]===b));
 }
 return {residual:r,word,selected};
}
test('worked-example data exactly match the reproducible verified builder',()=>{
 assert.deepEqual(D,require('../scripts/build-cube2-case.cjs').build());
 const browser={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/cube2-case-data.js'),'utf8'),browser);
 assert.deepEqual(JSON.parse(JSON.stringify(browser.window.Cube2CaseData)),D,'inline local data and downloadable JSON are identical');
});
test('all primitive matrices implement the documented geometry, powers and column-vector convention',()=>{
 const normals={U:[0,1,0],D:[0,-1,0],L:[-1,0,0],R:[1,0,0],F:[0,0,1],B:[0,0,-1]};
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const rotate=(v,n)=>cross(n,v).map((x,i)=>-x+n[i]*dot(n,v));
 for(const [face,n]of Object.entries(normals)){
  const p=D.nodes.map(node=>{
   if(dot(node.center,n)!==1)return node.index;
   const center=rotate(node.center,n),normal=rotate(node.normal,n);
   return D.nodes.find(q=>q.center.every((v,i)=>v===center[i])&&q.normal.every((v,i)=>v===normal[i])).index;
  });
  for(const [suffix,power]of [['',1],['2',2],["'",3]]){
   const move=D.moves.find(m=>m.name===face+suffix),expected=Array.from({length:power}).reduce(a=>then(a,p),I);
   assert.deepEqual(move.perm,expected,move.name+' matches −π/2 outward-normal rotation powers');
   assert.deepEqual(then(move.perm,D.moves[move.inverse].perm),I);
   assert.deepEqual(Array.from({length:move.order}).reduce(a=>then(a,move.perm),I),I);
   const matrix=I.map(r=>I.map(c=>Number(move.perm[c]===r))),x=I.map(i=>100+i);
   const y=matrix.map(row=>row.reduce((s,a,j)=>s+a*x[j],0));
   for(let source=0;source<24;source++)assert.equal(y[move.perm[source]],x[source]);
  }
 }
});
test('every transporter fixes its prefix and the complete finite chain has the claimed order',()=>{
 assert.deepEqual(D.base,I);assert.equal(new Set(D.nodes.slice(0,8).map(n=>n.piece)).size,8,'base starts with one sticker on each physical corner');
 let count=0,checks=0,order=1n;
 for(const level of D.levels){
  const entries=new Map(level.entries.map(t=>[t.image,t]));assert.equal(entries.size,level.entries.length);
  order*=BigInt(entries.size);
  for(const t of entries.values()){
   assert.deepEqual(evaluate(t.word),t.perm);assert.equal(t.perm[level.base],t.image);
   assert(level.held.every(q=>t.perm[q]===q));if(t.word.length)count++;
  }
  const generators=D.levels.slice(level.index).flatMap(l=>l.entries.filter(t=>t.word.length));
  for(const t of entries.values())for(const g of generators){
   const u=entries.get(g.perm[t.image]);assert(u,'listed orbit is closed under all generators');
   const residue=then(then(t.perm,g.perm),inv(u.perm));
   const result=factor(residue,level.index+1);assert(result);assert.deepEqual(result.residual,I);checks++;
  }
 }
 assert.equal(count,98);assert.equal(count,D.certificate.transporterWords);assert.equal(checks,5922);assert.equal(checks,D.certificate.schreierChecks);
 assert.equal(order,40320n*3n**7n);assert.equal(order.toString(),D.order);assert.equal(order/24n,BigInt(D.orientationQuotientOrder));
 for(const m of D.moves)assert.deepEqual(factor(m.perm).residual,I);
});
test('worked solution is exact; reverse scramble is shorter; the forty-token raw bound is attained',()=>{
 const ex=D.example,result=factor(ex.permutation);
 assert.deepEqual(evaluate(ex.scramble),ex.permutation);assert.deepEqual(result.word,ex.solution);assert.deepEqual(evaluate([...ex.scramble,...ex.solution]),I);
 assert.equal(ex.solution.length,27);assert.equal(ex.scramble.length,8);
 const undo=ex.scramble.slice().reverse().map(j=>D.moves[j].inverse);
 assert(undo.length<ex.solution.length);assert.deepEqual(evaluate([...ex.scramble,...undo]),I);
 for(const stage of ex.stages){
  assert.deepEqual(evaluate(stage.transporter),inv(stage.correctionPerm));assert.deepEqual(evaluate(stage.correction),stage.correctionPerm);
  assert.deepEqual(then(stage.before,stage.correctionPerm),stage.after);
 }
 const longest=D.levels.map(l=>l.entries.reduce((a,t)=>t.word.length>a.word.length?t:a));
 const construction=longest.slice().reverse().flatMap(t=>t.word),worst=factor(evaluate(construction));
 assert.equal(longest.reduce((s,t)=>s+t.word.length,0),40);assert.equal(D.certificate.rawSolveLengthBound,40);
 assert.equal(worst.word.length,40,'there exists a configuration whose unshortened representative concatenation reaches the stated bound');
 assert.deepEqual(evaluate([...construction,...worst.word]),I);
 for(let a=0;a<24;a++)for(let b=a+1;b<24;b++){const p=I.slice();[p[a],p[b]]=[p[b],p[a]];assert.equal(factor(p),null,'isolated sticker transposition is not legal');}
});
function caseHost(data=D){
 const document=new Element('document'),host=new Element('section','cube2-worked-example');
 document.appendChild(host);document.getElementById=id=>document.querySelector('#'+id);
 const context={document,window:{Cube2CaseData:data}};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/cube2-case.js'),'utf8'),context);
 return {host,element:id=>document.getElementById(id)};
}
function inspectMatrix(output,p){
 const table=output.querySelector('.case-matrix'),rows=table.querySelectorAll('tbody tr');assert.equal(rows.length,24);
 for(let r=0;r<24;r++){
  const cells=rows[r].querySelectorAll('td');assert.equal(cells.length,24);
  for(let c=0;c<24;c++)assert.equal(cells[c].textContent,String(Number(p[c]===r)),'matrix row '+r+' column '+c);
 }
}
test('the explorer renders all primitive matrices and every level can select its available representatives',()=>{
 const page=caseHost(),move=page.element('case-move'),level=page.element('case-level'),image=page.element('case-image');
 assert.equal(page.host.querySelectorAll('details').length,14,'seven sections plus seven worked-stage matrices');
 for(let i=0;i<D.moves.length;i++){move.value=String(i);move.dispatch('change');inspectMatrix(page.element('case-move-output'),D.moves[i].perm);}
 for(let i=0;i<D.levels.length;i++){
  level.value=String(i);level.dispatch('change');assert.equal(image.value,'0','changing levels clears a stale representative index');
  assert.equal(image.children.length,D.levels[i].entries.length);
  for(const j of [...new Set([0,D.levels[i].entries.length-1])]){image.value=String(j);image.dispatch('change');inspectMatrix(page.element('case-transporter-output'),D.levels[i].entries[j].perm);}
 }
 const text=page.host.textContent;assert(!text.includes('undefined'));assert(text.includes('40-move constructive upper bound'));
 for(const a of page.host.querySelectorAll('.case-links a')){
  const href=a.getAttribute('href');assert(fs.existsSync(path.join(__dirname,'../dist',href)),href+' resolves to an included static file');
 }
});
test('missing teaching data shows a readable recovery message instead of a script exception',()=>{
 const missing=caseHost(null);assert(missing.host.textContent.includes('Reload this page'));
});
