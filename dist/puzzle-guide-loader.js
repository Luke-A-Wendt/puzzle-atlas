/* Load only this puzzle's local guide when the player opens it. Hidden guides
 * never consume startup bandwidth, parsing time or DOM construction work. */
(function(root){
 'use strict';
 const families={
  'cube-guides.js':['cube2','cube3','cube4','mirror'],
  'large-cube-guides.js':['cube5','cube6','cube7','cube8','cube9','cube10'],
  'poly-guides.js':['pyraminx','megaminx'],
  'skewb-guides.js':['ultimate','diamond'],
  'tetraminx-guide.js':['tetraminx'],
  'fto-guides.js':['fto'],
  'shape-guides.js':['axis','rhombic','flatdiamond','cornerocta','trajber','jewel','mastermorphix','pyramorphix'],
  'dino-guides.js':['dino','rainbow'],
  'homer-guide.js':['homer'],
  'skewb-expansion-guides.js':['skewb','jing','masterskewb'],
  'edge-crystal-guides.js':['helicopter','crystal'],
  'diamond-guides.js':['diamondstyle','diamondcube'],
  'addition-guides.js':['masterpyraminx','kilominx','ghost']
 };
 const dependencies={
  'large-cube-guides.js':['cube-guides.js'],
  'diamond-guides.js':['cube-guides.js'],
  'addition-guides.js':['master-guide-data.js','edge-crystal-guides.js','shape-guides.js']
 };
 // Read only our known exports; enumerating Window can invoke storage or
 // cross-origin accessors in privacy-restricted browsers.
 const namespaces=['CUBE_GUIDES','LARGE_CUBE_GUIDES','POLY_GUIDES','SKEWB_GUIDES','TETRAMINX_GUIDES','FTO_GUIDES','SHAPE_GUIDES','DINO_GUIDES','HOMER_GUIDES','SKEWB_EXPANSION_GUIDES','EDGE_CRYSTAL_GUIDES','DIAMOND_GUIDES','ADDITION_GUIDES'];
 const pending=new Map();
 function sources(key){
  const family=Object.keys(families).find(file=>families[file].includes(key));
  if(!family)throw Error('No solution guide is registered for this puzzle.');
  const ordered=[];function add(file){for(const dependency of dependencies[file]||[])add(dependency);if(!ordered.includes(file))ordered.push(file);}
  add(family);add('solver-guide.js');if(key!=='homer'){add('human-difficulty.js');add('difficulty-guide.js');}return ordered;
 }
 function script(file,release){
  const url=new URL(file,document.baseURI);if(release)url.searchParams.set('v',release);
  const id=url.href;if(pending.has(id))return pending.get(id);
  const promise=Promise.all((dependencies[file]||[]).map(name=>script(name,release))).then(()=>new Promise((resolve,reject)=>{
   const node=document.createElement('script');node.src=id;node.async=true;
   node.onload=()=>resolve();node.onerror=()=>{node.remove();reject(Error('The solution guide could not load.'));};
   document.head.appendChild(node);
  }));
  pending.set(id,promise);promise.catch(()=>{if(pending.get(id)===promise)pending.delete(id);});return promise;
 }
 async function load(key,release){
  const ordered=sources(key);await Promise.all(ordered.map(file=>script(file,release)));
  const guide=namespaces.map(name=>root[name]?.[key]).find(Boolean);
  if(!guide||!root.SOLVER_GUIDE)throw Error('The solution guide could not initialize.');
  return guide;
 }
 root.PuzzleGuideLoader=Object.freeze({load,sources});
})(window);
