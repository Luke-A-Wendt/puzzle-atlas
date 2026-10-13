'use strict';
const assert=require('node:assert/strict');
const {E,model,pieces,byName,byPos,keyPos,parse,format,inv,run,canonical,methods}=require('../guide-research/build-fto-guide-data.cjs');
function algorithm(name,slots){const method=methods[name],path=parse(method.paths[canonical(slots,method.pair)]);assert(path);return[...inv(path),...parse(method.core),...path]}
function stickerExact(piece){return model.stickerState.filter(s=>s.piece===piece.id).every(s=>s.id===s.slot)}
let caseCount=0;
for(const [name,method] of Object.entries(methods))for(const key of Object.keys(method.paths)){
 const slots=key.split(','),expected={};
 if(!method.pair)slots.forEach((s,i)=>expected[s]=slots[(i+1)%3]);
 model.reset();run(algorithm(name,slots));
 for(const p of model.pieces){
  const dest=byPos[keyPos(p.pos)].name;
  if(p.kind===method.kind){assert.equal(dest,expected[p.name]||p.name,name+' '+key+' position '+p.name);if(!slots.includes(p.name))assert(stickerExact(p),name+' '+key+' preserves '+p.name);else if(method.pair)assert(!stickerExact(p),name+' '+key+' flips '+p.name);}
  if((name!=='edge'&&p.kind==='edge')||(method.kind==='center'&&p.kind==='vertex'))assert(stickerExact(p),name+' '+key+' prior stage preserved '+p.name);
 }
 caseCount++;
}
console.log('Verified every move builder:',caseCount,'cases, exact piece movement and prior-stage preservation.');
function stateNames(kind){return Object.fromEntries(model.pieces.filter(p=>p.kind===kind).map(p=>[byPos[keyPos(p.pos)].name,p.name]))}
function place(kind,method){for(let round=0;round<40;round++){
 const at=stateNames(kind),wrong=Object.keys(at).filter(s=>at[s]!==s);if(!wrong.length)return;
 const src=wrong[0],dst=at[src];let third=at[dst];if(third===src)third=wrong.find(s=>s!==src&&s!==dst);assert(third,kind+' cannot end in a two-cycle');run(algorithm(method,[src,dst,third]));
}throw Error(kind+' not solved');}
function solveCenters(method){const slots=methods[method].slots;for(let round=0;round<80;round++){
 const at=stateNames('center'),wrong=slots.filter(s=>at[s][0]!==s[0]);if(!wrong.length)return;
 const src=wrong[0],dst=wrong.find(s=>s[0]===at[src][0]);assert(dst);
 let third=wrong.find(s=>s!==src&&s!==dst&&s[0]===at[dst][0]);
 if(!third)third=wrong.find(s=>s!==src&&s!==dst);
 if(!third)third=slots.find(s=>s!==src&&s!==dst&&s[0]===src[0]);
 assert(third);run(algorithm(method,[src,dst,third]));
}throw Error('Centers failed');}
for(let seed=0;seed<200;seed++){
 model.reset();run(E.scramble('fto-guide-'+seed,36));
 if(seed%2===0)for(let j=0;j<6;j++)model.applyMove(E.middleConfigs[(seed+j)%4].id,j%2?-1:1);
 place('edge','edge');place('vertex','vertex');
 const flipped=model.pieces.filter(p=>p.kind==='vertex'&&!stickerExact(p));assert.equal(flipped.length%2,0);
 for(let i=0;i<flipped.length;i+=2)run(algorithm('flip',[flipped[i].name,flipped[i+1].name]));
 solveCenters('centerABCD');solveCenters('centerEFGH');
 assert(model.isSolved(),'Entire method solves scramble '+seed);
}
console.log('Verified complete guide method on 200 independent scrambles, including middle-slice moves.');
// Exercise the emitted browser guide, not merely the data-generation utility.
const vm=require('node:vm'),fs=require('node:fs');
const listeners={},context={window:{},document:{addEventListener:(event,fn)=>listeners[event]=fn}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/fto-guides.js'),'utf8'),context);
const api=context.window.FTO_GUIDE_BUILDERS;
assert.equal(context.window.FTO_GUIDES.fto.steps.length,6);assert.equal(typeof listeners.change,'function');
for(const [name,method]of Object.entries(methods))for(const key of Object.keys(method.paths)){
 const slots=key.split(','),seq=api.sequence(name,slots);assert(seq);
 model.reset();run(parse([seq.setup,seq.cycle,seq.restore].join(' ')));
 for(const p of model.pieces.filter(p=>p.kind===method.kind))assert.equal(byPos[keyPos(p.pos)].name,method.pair?p.name:(slots.includes(p.name)?slots[(slots.indexOf(p.name)+1)%3]:p.name));
}
assert.equal(api.sequence('edge',['AH','AH','AF']),null);
assert.equal(api.sequence('centerABCD',['A1','B1','E1']),null);
console.log('Verified all 1,375 recipes from the literal shipped guide script; duplicate and cross-group choices are rejected.');
// The actual delegated change handler updates both recipes and center groups.
function fakeBox(method){
 const m=methods[method];let activeMethod=method;
 const selects=m.base.map(value=>({value,_html:'',set innerHTML(html){this._html=html;const selected=/<option value="([^"]+)" selected>/.exec(html);this.value=selected?selected[1]:'';},get innerHTML(){return this._html;}}));
 const output={innerHTML:''},orbit={value:method};
 const box={dataset:{ftoMethod:method},querySelectorAll:()=>selects,querySelector:s=>s==='[data-fto-orbit]'?(method.startsWith('center')?orbit:null):output};
 return{box,selects,output,orbit,target:{closest:()=>box,hasAttribute:()=>false}};
}
const edgeBox=fakeBox('edge');edgeBox.selects.forEach((s,i)=>s.value=['AH','BH','CH'][i]);listeners.change({target:edgeBox.target});assert(edgeBox.output.innerHTML.includes('AH → BH → CH → AH'));
edgeBox.selects[1].value='AH';listeners.change({target:edgeBox.target});assert(edgeBox.output.innerHTML.includes('three different slots'));
const centerBox=fakeBox('centerABCD');centerBox.orbit.value='centerEFGH';centerBox.target.hasAttribute=()=>true;listeners.change({target:centerBox.target});assert.equal(centerBox.box.dataset.ftoMethod,'centerEFGH');assert(centerBox.selects.every(s=>/[EFGH]/.test(s.value)));assert(centerBox.output.innerHTML.includes('Bm E Bm′ E′'));
console.log('Verified delegated builder selections, duplicate feedback, and switching between center groups.');
