'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist'),read=f=>fs.readFileSync(path.join(dist,f),'utf8');
function load(){
 const context={window:{},document:{addEventListener(){}},console};vm.createContext(context);
 for(const file of [...read('play.html').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(x=>x!=='play.js'))vm.runInContext(read(file),context,{filename:file});
 const guides=Object.assign({},...Object.entries(context.window).filter(([k])=>k.endsWith('_GUIDES')).map(([,v])=>v));return {render:context.window.SOLVER_GUIDE.render,guides};
}
test('All 34 guides retain specialized steps and receive complete, uniquely numbered bibliography links',()=>{
 const {render,guides}=load();assert.equal(Object.keys(guides).length,34);
 for(const [key,guide]of Object.entries(guides)){
  const result=render({key,name:guide.title,guide});assert(guide.steps.length>2,key+' specialized solution');
  assert(result.chapterHTML.indexOf('Using the Constrained Solver')<result.chapterHTML.indexOf('General approach &amp; algorithm'));
  assert(result.chapterHTML.includes('dashed white circle'));assert(result.chapterHTML.includes('Schreier generator'));assert(result.chapterHTML.includes('rightmost transformation first'));
  const ids=[...result.referenceHTML.matchAll(/id="(guide-reference-\d+)"/g)].map(m=>m[1]);assert.equal(ids.length,result.referenceCount,key);assert.equal(new Set(ids).size,ids.length);
  const citations=[...(result.chapterHTML+result.puzzleHTML).matchAll(/href="#(guide-reference-\d+)"/g)].map(m=>m[1]);
  assert(citations.length>=4,key);for(const id of citations)assert(ids.includes(id),key+' missing '+id);
  for(const source of guide.sources)assert(result.referenceHTML.includes(source.url.replaceAll('&','&amp;')),key+' lost original link '+source.url);
  const equations=(result.chapterHTML.match(/<math /g)||[]).length;assert(equations>=7,key+' equations');
  assert.equal((result.chapterHTML.match(/<\/math>/g)||[]).length,equations,key+' equation closure');
  assert(!/Gold outlines|green outlines|recorded.*guaranteed recovery/.test(result.chapterHTML),key);
 }
});
test('Research notes keep scope and exactness qualifications',()=>{
 const {render,guides}=load(),out=key=>render({key,name:key,guide:guides[key]});
 assert(out('cube3').puzzleHTML.includes('classic fixed-center 3×3'));
 assert(out('cube7').puzzleHTML.includes('growing-size family'));
 assert(out('diamond').puzzleHTML.includes('disassembly and reassembly'));
 assert(out('helicopter').puzzleHTML.includes('does not solve the state-dependent jumbling'));
 assert(out('jing').puzzleHTML.includes('additional movable centers'));
 assert(out('homer').puzzleHTML.includes('eight-corner 2×2'));
 assert(out('cube2').chapterHTML.includes('legal state can remain unresolved'));
 const unsafe=render({key:'cube2',name:'<img src=x>',guide:guides.cube2});assert(!unsafe.puzzleHTML.includes('<img'));assert(unsafe.puzzleHTML.includes('&lt;img src=x&gt;'));
});
test('Specialized solution leads, supporting chapters collapse below, and no stale recovery claims remain',()=>{
 const html=read('play.html');assert(html.indexOf('id="guide-intro"')<html.indexOf('id="guide-steps"'));assert(html.indexOf('id="guide-steps"')<html.indexOf('id="solver-guide"'));assert(html.includes('<details class="solver-method-details">'));const {render,guides}=load();const chapter=render({key:'cube2',name:'Cube 2×2',guide:guides.cube2}).chapterHTML;assert(!/<details[^>]*\sopen(?:\s|>)/.test(chapter));assert(chapter.includes('lasso'));assert(chapter.includes('Bright dots have a stored, verified move sequence'));assert(chapter.includes('Moderately dim dots marked'));assert(chapter.includes('remain selectable but need a further check'));assert(chapter.includes('Strongly dim dots are proved unavailable'));assert(chapter.includes('Go</strong> plays the stored verified sequence'));assert(chapter.includes('Check &amp; solve'));assert(chapter.includes('success is not guaranteed'));for(const label of ['Select held','Go','Stop'])assert(chapter.includes('<strong>'+label+'</strong>'),label+' is documented');assert(!chapter.includes('Exit after step'));assert(chapter.includes('manual timer'));assert(html.indexOf('solver-guide.js')<html.indexOf('src="play.js"'));
 assert(html.includes('guide-bibliography'));assert(!html.includes('guide-session-note'));
 assert(!read('skewb-expansion-guides.js').includes('automatic Solve button retraces recorded moves'));
 assert(!read('edge-crystal-guides.js').includes('recorded <strong>Auto solve</strong> sequence provide guaranteed recovery'));
});
test('Technical specification has navigable chapters, escaped pseudocode and closed nested disclosures',()=>{
 const {render,guides}=load(),chapter=render({key:'cube2',name:'Cube 2×2',guide:guides.cube2}).chapterHTML;
 const ids=[...chapter.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'duplicate disclosure ID');
 const links=[...chapter.matchAll(/class="solver-tech-jump" href="#([^"]+)"/g)].map(m=>m[1]);
 assert.equal(links.length,9);for(const id of links)assert(ids.includes(id),'missing technical chapter '+id);
 assert.equal((chapter.match(/<details\b/g)||[]).length,(chapter.match(/<\/details>/g)||[]).length);
 assert(!/<details[^>]*\sopen(?:\s|>)/.test(chapter));
 const blocks=[...chapter.matchAll(/<pre\b[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)].map(m=>m[1]);
 assert(blocks.length>=20,'all algorithms include pseudocode');
 for(const block of blocks){assert(block.trim());assert(!/[<>]/.test(block),'unescaped pseudocode markup');}
 assert(!chapter.includes('undefined'));assert(!chapter.includes('[object Object]'));
 for(const key of ['THEN(p,q)','INVERSE_WORD','Schreier','unknown','ordered-pair','homeBySticker','modelSignature'])assert(chapter.includes(key),'missing reproducibility term '+key);
 const scripts=[...read('play.html').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 for(const file of ['solver-tech-group.js','solver-tech-manual.js','solver-technical.js'])assert(scripts.indexOf(file)<scripts.indexOf('solver-guide.js'));
});
