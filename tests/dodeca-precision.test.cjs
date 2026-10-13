'use strict';
// These engines generate geometry on each device. Small platform differences in
// transcendental functions must not change sticker identities or legal actions.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {solveFull}=require('../solver-backend/src/full-solve.cjs');
const {mapSnapshot}=require('../solver-backend/src/atlas-adapter.cjs');
const root=path.resolve(__dirname,'../dist'),plain=x=>JSON.parse(JSON.stringify(x));
const buffer=new ArrayBuffer(8),view=new DataView(buffer);
function bumpUlps(value,count){
 if(!Number.isFinite(value)||value===0)return value;
 view.setFloat64(0,value);
 view.setBigUint64(0,view.getBigUint64(0)+BigInt(count*(value<0?-1:1)));
 return view.getFloat64(0);
}
function numericalModes(){
 const modes=[{name:'native',math:()=>Object.create(Math)}];
 // Keep the default suite small; the full independent-function sweep is
 // available with DODECA_PRECISION_FULL=1 (30 variants per engine).
 const full=process.env.DODECA_PRECISION_FULL==='1';
 const groups=full?[['sin'],['cos'],['sin','cos'],['sqrt'],['hypot'],['atan2'],['sin','cos','sqrt','hypot','atan2']]:[['sin','cos'],['hypot'],['sin','cos','sqrt','hypot','atan2']];
 for(const functions of groups){
  const counts=full?[-4,-1,1,4]:functions.length===2?[-1,1]:[-4,4];
  for(const ulps of counts)modes.push({name:functions.join('+')+' '+ulps+' ulps',math:()=>{
   const altered=Object.create(Math);
   for(const fn of functions)altered[fn]=(...args)=>bumpUlps(Math[fn](...args),ulps);
   return altered;
  }});
 }
 modes.push({name:'naive hypot',math:()=>Object.assign(Object.create(Math),{hypot:(...values)=>Math.sqrt(values.reduce((sum,x)=>sum+x*x,0))})});
 return modes;
}
for(const id of ['crystal','kilominx'])test(id+' keeps canonical identities and legal solver actions across bounded floating-point variations',()=>{
 const model=JSON.parse(fs.readFileSync(path.join(root,'games/constrained-solver-models',id+'.json'),'utf8'));
 const cache=JSON.parse(fs.readFileSync(path.join(root,'games/constrained-solver-caches',id+'.json'),'utf8'));
 const source=model.adapter.source,code=fs.readFileSync(path.join(root,source.file),'utf8');
 for(const mode of numericalModes()){
  const label=id+' / '+mode.name,context={Math:mode.math()};vm.createContext(context);vm.runInContext(code,context,{filename:source.file});
  const engine=context[source.rootName].create(id);
  const mapping=()=>mapSnapshot(model,plain(engine.stickerState)).stickerToNode;
  const home=mapping(),expected={...home};
  assert.deepEqual({...home},model.homeBySticker,label+' home addresses changed');
  let seed=8183;
  for(let step=0;step<40;step++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const move=model.moves[seed%model.moves.length];engine.applyMove(move.engineMove);
   for(const sticker of Object.keys(expected))expected[sticker]=move.perm[expected[sticker]];
   assert.deepEqual({...mapping()},expected,label+' legal permutation differs at move '+step);
  }
  const result=solveFull(model,{currentBySticker:mapping(),homeBySticker:model.homeBySticker},{cache});
  assert.equal(result.status,'solved',label+': '+result.reason);
  assert.equal(result.verified,true,label+' unverified solution');
 }
});
