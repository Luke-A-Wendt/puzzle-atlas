'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),E=require('../dist/games/skewb-engine.js');
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/skewb-guides.js'),'utf8'),c);const guides=c.window.SKEWB_GUIDES;
const key=p=>p.map(x=>Math.round(x*1e6)).join(','),parse=s=>s.replaceAll('′',"'").trim().split(/\s+/).filter(Boolean),inverse=s=>parse(s).reverse().map(t=>t.endsWith("'")?t.slice(0,-1):t+"'").join(' '),run=(m,s)=>parse(s).forEach(t=>m.applyMove(t[0],t.includes("'")?-1:1)),codes=step=>Array.from(step.body.matchAll(/<code>([^<]+)<\/code>/g),m=>m[1]);
function host(type){const m=E.create(type),byPos=Object.fromEntries(m.pieces.map(p=>[key(p.home),p.name])),current=p=>byPos[key(p.pos)],piece=n=>m.pieces.find(p=>p.name===n),exact=p=>p.stickers.every(s=>m.stickerState[s.id].slot===s.id);return{m,current,piece,exact};}
function effects(type,algs){return algs.map(word=>{const{m,current,exact}=host(type);run(m,word);return{word,mapping:Object.fromEntries(m.pieces.map(p=>[p.name,current(p)])),changed:m.pieces.filter(p=>!exact(p)).map(p=>p.name)};});}
function frame(h){const{m,current,piece}=h,l=current(piece('L'));if(l!=='L')run(m,{R:"B b'",D:"R r'",B:"D d'"}[l]);const r=current(piece('R'));if(r!=='R')run(m,{D:"L' l",B:"L l'"}[r]);for(const name of ['L','R','D','B'])assert.equal(current(piece(name)),name);}
function cyclePieces(h,names,recipes){const{m,current,piece}=h;let iterations=0;for(;;){const wrong=names.map(piece).filter(p=>current(p)!==p.name);if(!wrong.length)return;assert(wrong.length>=3);assert(++iterations<20);const a=wrong[0],chosen=[current(a),a.name],third=wrong.find(p=>!chosen.includes(current(p))),list=[...chosen,current(third)];let row=recipes.find(r=>list.every((s,i)=>r.mapping[s]===list[(i+1)%3])),twice=false;if(!row){row=recipes.find(r=>list.every((s,i)=>r.mapping[s]===list[(i+2)%3]));twice=true;}assert(row);run(m,row.word);if(twice)run(m,row.word);}}
function scramble(h,type,seed){const r=E.seededRandom(type+'-manual-guide-'+seed);for(let i=0;i<40;i++)h.m.applyMove(h.m.configs[Math.floor(r()*h.m.configs.length)].id,r()<.5?-1:1);}
test('Skewb Puzzleball complete six-stage tables solve 100 all-eight-axis scrambles',()=>{
 const g=guides.ultimate,swaps=effects('ultimate',codes(g.steps[2])),twists=effects('ultimate',codes(g.steps[3])),cycles=effects('ultimate',codes(g.steps[4])),flips=effects('ultimate',codes(g.steps[5]));
 assert.equal(swaps.length,3);assert.equal(twists.length,6);assert.equal(cycles.length,20);assert.equal(flips.length,15);
 for(let seed=0;seed<100;seed++){
  const h=host('ultimate'),{m,current,piece,exact}=h;scramble(h,'ultimate',seed);frame(h);
  for(const name of ['L','R','D','B']){let n=0;while(!exact(piece(name))){assert(++n<=2);m.applyMove(name);}}
  const free=['RDB','LDB','LRB','LRD'],wrong=free.map(piece).filter(p=>current(p)!==p.name);if(wrong.length){assert.equal(wrong.length,4);const r=swaps.find(r=>wrong.every(p=>r.mapping[current(p)]===p.name));assert(r);run(m,r.word);}
  let n=0;for(;;){const bad=free.filter(name=>!exact(piece(name)));if(!bad.length)break;assert(bad.length>=2);assert(++n<8);const[a,b]=bad,r=twists.find(r=>r.changed.includes(a)&&r.changed.includes(b));assert(r);run(m,r.word);if(!exact(piece(a)))run(m,r.word);assert(exact(piece(a)));}
  const roofs=['LR','LD','LB','RD','RB','DB'];cyclePieces(h,roofs,cycles);n=0;
  for(;;){const bad=roofs.filter(name=>!exact(piece(name)));if(!bad.length)break;assert.equal(bad.length%2,0);assert(++n<=3);const[a,b]=bad,r=flips.find(r=>r.changed.includes(a)&&r.changed.includes(b));assert(r);run(m,r.word);assert(exact(piece(a))&&exact(piece(b)));}
  assert(m.isSolved(),'Puzzleball solve '+seed);assert(m.pieces.every(exact));
 }
});
test('Skewb Diamond complete insertion/flip/center method solves 100 all-eight-axis scrambles',()=>{
 const g=guides.diamond,insert=codes(g.steps[1]),flip=effects('diamond',codes(g.steps[2])),centers=effects('diamond',codes(g.steps[3])),rows=[['LR','DB',insert[0],insert[1]],['RB','LD',insert[2],insert[3]],['LB','RD',insert[4],insert[5]]];
 for(let seed=0;seed<100;seed++){
  const h=host('diamond'),{m,current,piece,exact}=h;scramble(h,'diamond',seed);frame(h);const done=[];
  for(const[target,setup,A,B]of rows){const p=piece(target);if(!exact(p)){const where=current(p),trapped=rows.find(row=>row[0]===where);if(trapped)run(m,trapped[2]);let n=0;while(current(p)!==setup){assert(++n<=2);m.applyMove('D');}run(m,A);if(!exact(p)){run(m,inverse(A));run(m,B);}assert(exact(p));assert(done.every(n=>exact(piece(n))));}done.push(target);}
  const lower=['LD','RD','DB'];let n=0;while(!lower.every(name=>current(piece(name))===name)){assert(++n<=2);m.applyMove('D');}
  const bad=lower.filter(name=>!exact(piece(name)));if(bad.length){assert.equal(bad.length,2);const r=flip.find(r=>bad.every(name=>r.changed.includes(name)));assert(r);run(m,r.word);}
  assert([...done,...lower].every(name=>exact(piece(name))));cyclePieces(h,['RDB','LDB','LRB','LRD'],centers);assert(m.isSolved(),'Diamond solve '+seed);
 }
});
