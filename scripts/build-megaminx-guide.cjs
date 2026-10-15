'use strict';
// Generate setup conjugates on two/three piece slots, never full puzzle states.
// Running this refreshes only the marked data block in poly-guides.js.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'dist/games/megaminx.html'),'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('root.MegaEngine'));
const context={};vm.createContext(context);vm.runInContext(script,context);const E=context.MegaEngine,solved=E.makeSolved(),groups={};
for(const s of E.slots){const name=s.pieceFaces.slice().sort().join('');(groups[name]??=[]).push(s.id);}
const parse=s=>s.trim().split(/\s+/).filter(Boolean),move=t=>({face:t[0],dir:/['′]/.test(t)?-1:1,turns:t.includes('2')?2:1}),run=s=>parse(s).reduce((x,t)=>E.applyMove(x,move(t)),solved);
const slot=s=>E.slots[s.slot].pieceFaces.slice().sort().join(''),key=(a,mode)=>mode==='pair'?a.slice().sort().join(','):mode==='ordered'?a.join(','):[a.join(','),[a[1],a[2],a[0]].join(','),[a[2],a[0],a[1]].join(',')].sort()[0];
const edge="H L H' L H L'2 H'",specs={edge:{size:2,mode:'cycle',core:edge},flip:{size:2,mode:'pair',core:"H L G L' G' H' "+edge},corner:{size:3,mode:'cycle',core:"H C H' L H C' H' L H C H' L'2 H C' H'"},twist:{size:3,mode:'ordered',core:"H C' H' G' C' G L G' C G H C H' L'"}};
const moves=E.faces.flatMap(f=>[f.id,f.id+"'"]),perms=Object.fromEntries(moves.map(t=>{const s=run(t);return[t,Object.fromEntries(Object.entries(groups).map(([k,a])=>[k,slot(s[a[0]])]))];})),data={};
for(const [method,spec]of Object.entries(specs)){
 const s=run(spec.core),slots=Object.keys(groups).filter(k=>k.length===spec.size).sort(),changed=slots.filter(k=>groups[k].some(id=>s[id].slot!==id));let base;
 if(spec.mode==='cycle'){assert.equal(changed.length,3);base=[changed[0],slot(s[groups[changed[0]][0]])];base.push(slot(s[groups[base[1]][0]]));}
 else {assert.equal(changed.length,2);base=changed;if(spec.mode==='ordered'){const v=E.vector,sign=k=>{const id=groups[k][0],home=E.slots[id],target=E.slots[s[id].slot],axis=v.unit(home.pieceFaces.map(f=>E.configs[f].normal).reduce(v.add,[0,0,0]));return v.dot(axis,v.cross(home.normal,target.normal));};base.sort((a,b)=>sign(a)-sign(b));assert(sign(base[0])<-.1&&sign(base[1])>.1);}}
 const paths={[key(base,spec.mode)]:''},queue=[base];
 for(let q=0;q<queue.length;q++){const old=queue[q],word=paths[key(old,spec.mode)];for(const t of moves){const next=old.map(k=>perms[t][k]),k=key(next,spec.mode);if(paths[k]!==undefined)continue;paths[k]=word?word+' '+t:t;queue.push(next);}}
 const n=slots.length,expected=spec.mode==='cycle'?n*(n-1)*(n-2)/3:spec.mode==='pair'?n*(n-1)/2:n*(n-1);assert.equal(queue.length,expected);
 data[method]={mode:spec.mode,slots,core:spec.core,base,paths};console.log(method,queue.length,'setups; maximum',Math.max(...Object.values(paths).map(x=>parse(x).length)),'moves');
}
const target=path.join(root,'dist/poly-guides.js'),markerA='/* BEGIN EXACT MEGAMINX GUIDE DATA */',markerB='/* END EXACT MEGAMINX GUIDE DATA */';let text=fs.readFileSync(target,'utf8');const block=markerA+'\nwindow.MEGAMINX_GUIDE_DATA='+JSON.stringify(data)+';\n'+markerB;
if(text.includes(markerA))text=text.slice(0,text.indexOf(markerA))+block+text.slice(text.indexOf(markerB)+markerB.length);else text+='\n'+block+'\n';fs.writeFileSync(target,text);console.log('Generated',Buffer.byteLength(block),'bytes.');
