'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist');
const read=name=>fs.readFileSync(path.join(dist,name),'utf8');
function handbook(initialHash){
 const calls={scroll:[],focus:[],history:[]},windowListeners={},documentListeners={};
 const body={tagName:'BODY',parentElement:null};
 const outer={tagName:'DETAILS',open:false,parentElement:body};
 const summary={focus:options=>calls.focus.push(options)};
 const how={tagName:'DETAILS',id:'how-to-play',open:false,parentElement:outer,querySelector:selector=>selector==='summary'?summary:null,scrollIntoView:options=>calls.scroll.push(options)};
 const deep={tagName:'DETAILS',id:'help-held',open:false,parentElement:how,querySelector:selector=>selector==='summary'?summary:null,scrollIntoView:options=>calls.scroll.push(options)};
 const usage={parentNode:{insertBefore:(node,before)=>{assert.equal(node,how);assert.equal(before,usage);}}};
 const nodes={'how-to-play':how,'help-held':deep,'handbook-chapters':{innerHTML:'',querySelector:s=>s==='.solver-panel-guide'?how:s==='.solver-guide-usage'?usage:null},'handbook-bibliography':{innerHTML:''}};
 const location={hash:initialHash},context={document:{getElementById:id=>nodes[id],addEventListener:(type,fn)=>{documentListeners[type]=fn;}},location,history:{replaceState:(...args)=>{calls.history.push(args);location.hash=args[2];}},requestAnimationFrame:fn=>fn(),window:{SOLVER_GUIDE:{renderCommon:()=>({chapterHTML:'<details id="how-to-play"></details>',referenceHTML:'local references'})},addEventListener:(type,fn)=>{windowListeners[type]=fn;}}};
 vm.runInNewContext(read('solver-handbook.js'),context);
 return {nodes,calls,location,documentListeners,windowListeners};
}
test('Direct illustrated-help arrival opens the collapsed chapter and its ancestors',()=>{
 const h=handbook('#how-to-play'),how=h.nodes['how-to-play'];
 assert.equal(how.open,true);assert.equal(how.parentElement.open,true);
 assert.equal(h.calls.scroll.length,1);assert.equal(h.calls.focus.length,1);assert.equal(h.calls.history.length,0);
 assert.equal(h.nodes['handbook-chapters'].innerHTML,'<details id="how-to-play"></details>');
});
test('Nested help links and later hash navigation reveal all required disclosures',()=>{
 const h=handbook('');let prevented=false;
 h.documentListeners.click({target:{closest:()=>({getAttribute:()=> '#help-held'})},preventDefault(){prevented=true;}});
 assert(prevented);assert.equal(h.nodes['help-held'].open,true);assert.equal(h.nodes['how-to-play'].open,true);assert.equal(h.calls.history[0][2],'#help-held');
 h.nodes['how-to-play'].open=false;h.location.hash='#how-to-play';h.windowListeners.hashchange();assert.equal(h.nodes['how-to-play'].open,true);
});
test('Every standalone puzzle opens locally packaged illustrated help without leaving its game',()=>{
 const models=JSON.parse(read('games/constrained-solver-models/manifest.json')).models;
 assert.equal(models.length,37);
 for(const {id}of models){
  const html=read('games/'+id+'.html'),help=/<details class="journal-help">([\s\S]*?)<\/details>/.exec(html)?.[1];assert(help,id);
  const link=/<a href="([^"]+#how-to-play)" target="_blank" rel="noopener" aria-label="[^"]+new tab[^"]*"/.exec(help);assert(link,id+' preserves game state in both standalone and framed use');
  for(const base of ['https://atlas.test/games/','https://atlas.test/puzzle-atlas/games/','http://localhost:8000/dist/games/']){
   const source=new URL(id+'.html',base),target=new URL(link[1].replaceAll('&amp;','&'),source);
   assert.equal(target.origin,source.origin,id+' same origin');assert.equal(target.pathname,new URL('../solver-handbook.html',source).pathname,id+' correct nested path');
   assert.equal(target.hash,'#how-to-play');
  }
  assert(!/manual timer|solved percentage/.test(help),id+' current controls');assert(help.includes('Both panels share the selected axis'),id+' shared selector instructions');assert(help.includes('↶ Rotate is positive (counterclockwise)')&&help.includes('M follows L, E follows D, and S follows F'),id+' signed 3D directions');assert(!/Show actions|View axis|Reset view/.test(help),id+' obsolete actions and camera buttons');for(const [button,arrow,label]of [['ccw','↶','Turn left'],['cw','↷','Turn right']])assert(new RegExp('<button id="'+button+'"[^>]*><span class="direction">'+arrow+'</span>'+label+'</button>').test(html),id+' native '+button+' arrow and label');assert(help.includes('Stop now'),id+' both automatic stop levels');
 }
});
