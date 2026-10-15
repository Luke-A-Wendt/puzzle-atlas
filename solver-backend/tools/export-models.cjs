#!/usr/bin/env node
'use strict';
// Read-only Atlas export. No website file is ever written by this script.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const backend=path.resolve(__dirname,'..');
const atlas=path.resolve(process.argv[2]||path.join(backend,'../puzzle-atlas/dist'));
const out=path.join(backend,'data'),vendor=path.join(backend,'vendor/atlas-engines');
const names={axis:'Axis Cube',masterpyraminx:'Master Pyraminx',kilominx:'Kilominx',ghost:'Ghost Cube',cube2:'Cube 2×2',cube3:'Cube 3×3',cube4:'Cube 4×4',cube5:'Cube 5×5×5',cube6:'Cube 6×6×6',cube7:'Cube 7×7×7',cube8:'Cube 8×8×8',cube9:'Cube 9×9×9',cube10:'Cube 10×10×10',mirror:'Mirror Cube',homer:'Homer',pyraminx:'Pyraminx',tetraminx:'Tetraminx',megaminx:'Megaminx',jing:'Jing Pyraminx',skewb:'Skewb',masterskewb:'Master Skewb',ultimate:'Skewb Puzzleball',diamond:'Skewb Diamond',fto:'Face-turning Octahedron',crystal:'Pyraminx Crystal',dino:'Dino Cube',rainbow:'Rainbow Cube',rhombic:'Rhombic Dodecahedron Cube',flatdiamond:'Flat Diamond Cube',cornerocta:'Corner-turning Octahedron',trajber:'Trajber’s Octahedron',jewel:'Christoph’s Jewel',pyramorphix:'Pyramorphix',mastermorphix:'MasterMorphix',helicopter:'Helicopter Cube',diamondstyle:'Diamond Puzzler',diamondcube:'Diamond Cuboctahedron'};
const engines={axis:['shape-engine','ShapeEngine'],masterpyraminx:['masterpyraminx-engine','MasterPyraminxEngine'],kilominx:['kilominx-engine','KilominxEngine'],ghost:['ghost-engine','GhostEngine'],jing:['skewb-engine','SkewbEngine'],skewb:['skewb-engine','SkewbEngine'],masterskewb:['skewb-engine','SkewbEngine'],ultimate:['skewb-engine','SkewbEngine'],diamond:['skewb-engine','SkewbEngine'],fto:['fto-engine','FTOEngine'],crystal:['crystal-engine','CrystalEngine'],dino:['dino-engine','DinoEngine'],rainbow:['dino-engine','DinoEngine'],rhombic:['shape-engine','ShapeEngine'],flatdiamond:['shape-engine','ShapeEngine'],cornerocta:['shape-engine','ShapeEngine'],trajber:['shape-engine','ShapeEngine'],jewel:['shape-engine','ShapeEngine'],pyramorphix:['shape-engine','ShapeEngine'],mastermorphix:['shape-engine','ShapeEngine'],helicopter:['helicopter-engine','HelicopterEngine'],diamondstyle:['shape-engine','ShapeEngine'],diamondcube:['shape-engine','ShapeEngine']};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const clean=x=>JSON.parse(JSON.stringify(x));
const vecKey=v=>v.map(x=>Math.round(x*1e7)||0).join(',');
const poseKey=s=>vecKey(s.center||s.p)+'/'+vecKey(s.normal||s.n);
const shapeKey=s=>vecKey(s.pos)+'/'+poseKey(s);
const identity=n=>Array.from({length:n},(_,i)=>i);
const compose=(a,b)=>b.map(v=>a[v]);
function inverse(p){const q=[];p.forEach((v,i)=>q[v]=i);return q;}
function checkPerm(p){if(p.some(x=>!Number.isInteger(x)||x<0||x>=p.length)||new Set(p).size!==p.length)throw Error('Not a permutation');}
function order(p){let q=identity(p.length);for(let n=1;n<=60;n++){q=compose(p,q);if(q.every((x,i)=>x===i))return n;}throw Error('Unexpected move order');}
function instantiate(id,code,rootName,kind,source){const ctx={CUBE_SIZE:Number(id.slice(4))};vm.createContext(ctx);vm.runInContext(code,ctx,{filename:source.file});const engine=ctx[rootName],model=kind==='model'?engine.create(id):null;return{id,kind,engine,model,source};}
function loadSnapshot(id){const spec=JSON.parse(fs.readFileSync(path.join(out,id+'.json'),'utf8'));const s=spec.adapter.source;const code=fs.readFileSync(path.join(backend,s.snapshot),'utf8');if(sha(code)!==s.sha256)throw Error('Snapshot checksum mismatch');return instantiate(id,code,s.rootName,s.kind,s);}
function source(id){
 let file,code,rootName,kind;
 if(engines[id]){[file,rootName]=engines[id];file+='\.js';file=file.replace('\\.','.');code=fs.readFileSync(path.join(atlas,'games',file),'utf8');kind='model';}
 else if(/^cube(?:[5-9]|10)$/.test(id)){file='nxn-engine.js';code=fs.readFileSync(path.join(atlas,'games',file),'utf8');rootName='CubeEngine';kind='cube';}
 else{file=id+'.html';const html=fs.readFileSync(path.join(atlas,'games',file),'utf8');const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);code=scripts.find(s=>/root\.(CubeEngine|TetraEngine|MegaEngine)\s*=/.test(s));if(!code)throw Error('No inline engine '+id);rootName=code.match(/root\.(CubeEngine|TetraEngine|MegaEngine)\s*=/)[1];kind=rootName==='CubeEngine'?'cube':'fixed';}
 const saved=id+'-engine.js';fs.writeFileSync(path.join(vendor,saved),code);
 return instantiate(id,code,rootName,kind,{file:'games/'+file,sha256:sha(code),snapshot:'vendor/atlas-engines/'+saved,rootName,kind});
}
function fixedAdapter(a){
 const E=a.engine,M=a.model,initial=clean(M?M.stickerState:E.makeSolved());
 const slots=clean(M?M.slots:E.slots||E.makeSolved());
 const byPose=new Map(slots.map((s,i)=>[poseKey(s),i]));
 const byId=new Map(slots.map((s,i)=>[s.id,i]));
 const idPosition=new Map(initial.map((s,i)=>[s.id,i]));
 const locate=s=>a.kind==='cube'?byPose.get(poseKey(s)):s.normal?byPose.get(poseKey(s)):byId.get(s.slot);
 const configs=M?M.configs:E.configs;
 const axisIds=Array.isArray(configs)?configs.map(c=>c.id||c.face):Object.keys(configs);
 const reset=()=>M?M.reset():clean(initial);
 let state=reset();
 const apply=move=>{if(M){M.applyMove(move);state=M.stickerState;}else state=E.applyMove(state,move);return state;};
 const getState=()=>M?M.stickerState:state;
 function mapping(){const p=[];for(const s of getState()){const dst=locate(s);if(dst===undefined)throw Error(a.id+' sticker has no fixed slot '+JSON.stringify(s));p[idPosition.get(s.id)]=dst;}checkPerm(p);return p;}
 function resetAll(){state=reset();}
 const base=axisIds.map(face=>{resetAll();apply({face,dir:1,turns:1});const perm=mapping();return {face,perm,order:order(perm)};});
 resetAll();
 return {degree:slots.length,nodeIds:slots.map(s=>String(s.id)),nodes:slots.map((s,index)=>({index,id:String(s.id),engineSlotId:s.id,piece:s.piece??s.pieceId??(s.p?vecKey(s.p):null),face:s.face??s.homeFace??null,color:s.color??initial[index]?.color??null,center:s.center||s.p,normal:s.normal||s.n})),base,reset:resetAll,apply,mapping,getState,locate,initialOccupied:identity(slots.length),representation:'fixed-sticker-slots'};
}
function shapeAdapter(a){
 // Shape-changing surfaces do not have one node per fixed solved slot. Build
 // finite reachable pose addresses for a single marker, never whole states.
 const M=a.model,V=a.engine.vector,configs=M.configs,initial=clean(M.stickerState),nodes=[],lookup=new Map();
 const insert=s=>{const k=shapeKey(s);if(!lookup.has(k)){lookup.set(k,nodes.length);nodes.push({pos:s.pos.slice(),center:s.center.slice(),normal:s.normal.slice()});}return lookup.get(k);};
 initial.forEach(insert);
 function next(s,c){const affected=c.tip?s.pos[c.axis]*c.sign===2:s.pos[c.axis]*c.sign>0;return affected?{pos:V.transform(c.matrix,s.pos),center:V.transform(c.matrix,s.center),normal:V.transform(c.matrix,s.normal)}:s;}
 for(let n=0;n<nodes.length;n++){if(nodes.length>5000)throw Error('Pose domain too large');for(const c of configs)insert(next(nodes[n],c));}
 const base=configs.map(c=>{const perm=nodes.map(s=>lookup.get(shapeKey(next(s,c))));checkPerm(perm);return{face:c.id,perm,order:order(perm)};});
 const initialOccupied=initial.map(s=>lookup.get(shapeKey(s))),idPosition=new Map(initial.map((s,i)=>[s.id,i]));
 const mapping=()=>{const p=[];for(const s of M.stickerState)p[idPosition.get(s.id)]=lookup.get(shapeKey(s));if(p.some(x=>x===undefined))throw Error('Missing shape pose');return p;};
 const nodeIds=nodes.map(s=>'pose:'+shapeKey(s));
 return {degree:nodes.length,nodeIds,nodes:nodes.map((s,i)=>({...s,index:i,id:nodeIds[i],solvedStickerId:initial.find(x=>shapeKey(x)===shapeKey(s))?.id??null})),base,reset:()=>M.reset(),apply:m=>M.applyMove(m),mapping,getState:()=>M.stickerState,locate:s=>lookup.get(shapeKey(s)),initialOccupied,representation:'expanded-sticker-pose-domain'};
}
function movesFor(adapter){const moves=[];for(const {face,perm,order:n}of adapter.base){for(let power=1;power<n;power++){const signed=power<=n/2?power:power-n,dir=Math.sign(signed),turns=Math.abs(signed),name=face+(turns===1?'':turns)+(dir<0?"'":'');let p=identity(perm.length);for(let j=0;j<power;j++)p=compose(perm,p);moves.push({name,perm:p,engineMove:{face,dir,turns},inverse:null,order:order(p),cost:1,axis:face,power});}}
 for(const m of moves){const inv=inverse(m.perm);m.inverse=moves.findIndex(v=>v.axis===m.axis&&v.perm.every((x,i)=>x===inv[i]));if(m.inverse<0)throw Error('Missing inverse');}return moves;}
function validate(a,adapter,moves){let singleMoveChecks=0,sequenceSteps=0;
 for(const move of moves){adapter.reset();adapter.apply(move.engineMove);const actual=adapter.mapping(),want=adapter.initialOccupied.map(i=>move.perm[i]);if(actual.some((x,i)=>x!==want[i]))throw Error(a.id+' single move mismatch '+move.name);singleMoveChecks++;}
 // Compare on nontrivial states, independently stepping the engine and the
 // exported integer permutations. This catches solved-state-only adapters.
 for(let seed=1;seed<=4;seed++){adapter.reset();let expected=adapter.initialOccupied.slice(),rng=seed;for(let t=0;t<40;t++){rng=(Math.imul(rng,1664525)+1013904223)>>>0;const move=moves[rng%moves.length];adapter.apply(move.engineMove);expected=expected.map(x=>move.perm[x]);const actual=adapter.mapping();if(actual.some((x,i)=>x!==expected[i]))throw Error(a.id+' composition mismatch at '+t);sequenceSteps++;}}
 adapter.reset();return{singleMoveChecks,sequenceSteps,bijectiveMoveChecks:moves.length,inverseChecks:moves.length,moveOrders:[...new Set(moves.map(m=>m.order))]};}
function exportOne(id){const a=source(id);let adapter;const shape=engines[id]?.[0]==='shape-engine'||id==='ghost';
 if(['axis','flatdiamond','pyramorphix','mastermorphix','ghost'].includes(id))adapter=shapeAdapter(a);else adapter=fixedAdapter(a);
 const moves=movesFor(adapter),validation=validate(a,adapter,moves),notes=[];
 if(shape&&adapter.representation==='expanded-sticker-pose-domain')notes.push('Ring map is dynamic. Nodes are finite pose addresses, not just solved-face slots; only initialOccupied/current occupied addresses contain stickers. A frontend adapter must resolve each current ring dot by its pos, center, and normal. Never treat stickerState.slot as a destination here.');
 if(id==='ghost')notes.push('Ghost uses abstract oriented piece attachments: pos and center are the mechanical piece position; normal is a canonical attachment direction, not a measured surface normal. Each of the 61 physical colored patches has one attachment. Center attachments have a transverse component, so all visible center rotations remain observable. Empty addresses are not selectable. The 3D polyhedral geometry and automatic alignment phase are separate from this exact 168-address permutation action.');
 if(id==='helicopter')notes.push('Only the cube-shape, non-jumbling 180-degree subgroup is exported. Jumbling changes legal cuts and is explicitly unsupported. A state reached using fractional alignment stops must be rejected even if a request only asks for half turns.');
 if(['mirror','homer'].includes(id))notes.push('The permutation domain is the underlying cube sticker frame. In-place orientation of single-face center stickers is not represented. Mirror mode has no ring map in the current UI.');
 notes.push('Protection means each selected node returns to the same slot at the sequence endpoint, not remaining stationary during intermediate moves. Color equality is weaker than labeled-node equality.');
 const expanded=adapter.representation==='expanded-sticker-pose-domain';
 const result={schemaVersion:1,id,name:names[id],supported:true,fixedPermutation:true,degree:adapter.degree,nodeIds:adapter.nodeIds,nodes:adapter.nodes,moves,initialOccupied:adapter.initialOccupied,stickerCount:adapter.initialOccupied.length,requiresOccupiedState:expanded,adapter:{representation:adapter.representation,directRingSlots:!expanded,requiresOccupiedState:expanded,source:a.source,sourceToDestination:true,keyPrecision:1e-7,moveCost:'One nonidentity axis rotation, including allowed half/double turns, costs one.',supportedMode:id==='helicopter'?'normal-half-turn-only':'engine-fixed-moves',notes},validation};
 fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(result)+'\n');return{id,name:result.name,degree:result.degree,stickerCount:result.stickerCount,moves:moves.length,representation:adapter.representation,bytes:fs.statSync(path.join(out,id+'.json')).size,validation,notes};}
function main(){
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(vendor,{recursive:true});
 // Optional IDs after the site path replace only those models and preserve
 // existing snapshots, so adding one puzzle does not invalidate others.
 const selected=process.argv.slice(3),ids=selected.length?selected:Object.keys(names);
 for(const id of ids)if(!Object.hasOwn(names,id))throw Error('Unknown puzzle '+id);
 const file=path.join(out,'manifest.json'),prior=selected.length&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).models:[],byId=new Map(prior.map(m=>[m.id,m]));
 for(const id of ids){try{const model=exportOne(id);byId.set(id,model);process.stdout.write(id+': '+model.degree+' nodes, '+model.moves+' moves\n');}catch(e){process.stderr.write(id+': '+e.stack+'\n');throw e;}}
 const models=Object.keys(names).filter(id=>byId.has(id)).map(id=>byId.get(id));
 const manifest={schemaVersion:1,sourceRoot:atlas,models,totalBytes:models.reduce((s,m)=>s+m.bytes,0)};fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
}
if(require.main===module)main();
module.exports={source,loadSnapshot,fixedAdapter,shapeAdapter,movesFor,validate,exportOne,names};
