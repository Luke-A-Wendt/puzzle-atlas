'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist'),read=f=>fs.readFileSync(path.join(dist,f.split(/[?#]/)[0]),'utf8').replace(/[?&]v=[a-f0-9]{20}(?=[\"'#&])/g,'');
function load(common=false){
 const context={window:{},document:{addEventListener(){}},console};vm.createContext(context);
 vm.runInContext(read('puzzle-guide-loader.js'),context,{filename:'puzzle-guide-loader.js'});
 const keys=JSON.parse(read('games/constrained-solver-models/manifest.json')).models.map(m=>m.id),files=[...new Set(keys.flatMap(key=>context.window.PuzzleGuideLoader.sources(key)))];
 if(common)files.unshift('solver-tech-group.js','solver-tech-manual.js','solver-technical.js');
 for(const file of files)vm.runInContext(read(file),context,{filename:file});
 const guides=Object.assign({},...Object.entries(context.window).filter(([k])=>k.endsWith('_GUIDES')).map(([,v])=>v));return {...context.window.SOLVER_GUIDE,guides};
}
function bibliography(out){
 const ids=[...out.referenceHTML.matchAll(/id="(guide-reference-\d+)"/g)].map(m=>m[1]);assert.equal(ids.length,out.referenceCount);assert.equal(new Set(ids).size,ids.length);
 for(const id of [...((out.chapterHTML||'')+(out.puzzleHTML||'')).matchAll(/href="#(guide-reference-\d+)"/g)].map(m=>m[1]))assert(ids.includes(id),'missing '+id);
}
test('All 37 game guides retain specific axis-language recipes and puzzle-only references',()=>{
 const {render,guides}=load();assert.equal(Object.keys(guides).length,37);
 for(const [key,guide]of Object.entries(guides)){
  const out=render({key,name:guide.title,guide});assert(guide.steps.length>2,key+' specialized solution');
  assert(guide.notation.length>0,key+' notation');assert(!/Show tile labels|Hide tile labels|Enable <strong>Tile labels|Turn on <strong>Tile labels/.test(JSON.stringify(guide)),key+' obsolete tile-label control');assert(!/Notation moves|Inverse.*checkbox|notation controls/.test(JSON.stringify(guide)),key+' obsolete move controls');assert(guide.steps.some(step=>step.body.includes('<code>')),key+' actual move sequences');
  assert.equal(out.chapterHTML,'',key+' must not repeat the shared algorithms');
  assert(!out.referenceHTML.includes('Computation with permutation groups'),key+' general group bibliography belongs in handbook');
  assert(!out.referenceHTML.includes('An algorithm for solving the factorization problem'),key+' general factorization reference belongs in handbook');
  assert(out.puzzleHTML.includes('A method for'),key+' specialized method scope');bibliography(out);
  for(const source of guide.sources)assert(out.referenceHTML.includes(source.url.replaceAll('&','&amp;')),key+' lost original source '+source.url);
 }
});
test('Puzzle research distinguishes exact mechanics, family background and shortest-solution claims',()=>{
 const {render,guides}=load(),out=key=>render({key,name:key,guide:guides[key]});
 assert(out('cube3').puzzleHTML.includes('classic fixed-center 3×3×3'));
 assert(out('cube7').puzzleHTML.includes('growing-size family'));
 assert(out('diamond').puzzleHTML.includes('disassembly and reassembly'));
 assert(out('helicopter').puzzleHTML.includes('does not solve the state-dependent jumbling'));
 assert(out('jing').puzzleHTML.includes('additional movable centers'));
 assert(out('homer').puzzleHTML.includes('eight-corner 2×2×2'));
 assert(out('megaminx').referenceHTML.includes('Introducing the permutations R package'));
 const unsafe=render({key:'cube2',name:'<img src=x>',guide:guides.cube2});assert(!unsafe.puzzleHTML.includes('<img'));assert(unsafe.puzzleHTML.includes('&lt;img src=x&gt;'));
});
test('Shared handbook preserves UI instructions, guarantees, equations and every technical chapter',()=>{
 const {renderCommon}=load(true),out=renderCommon(),chapter=out.chapterHTML;bibliography(out);
 for(const text of ['Using the Constrained Solver','General approach &amp; algorithm','Schreier generator','rightmost transformation first','legal state can remain unresolved','lasso','Bright dots have a stored, verified move sequence','Gray dots cannot be selected for a swap','Gray does not mean the swap is proved impossible','The Select tool can still toggle any node','Selecting endpoint 2 plays the stored verified sequence','A pair without a ready sequence cannot be selected','There are no question marks or speculative checks'])assert(chapter.includes(text),'missing '+text);
 for(const label of ['Hold','Select','Clear','Auto','Swap ①','Swap ②','Move ①','Move ②','Guide','Stop','Stop now','Some labels','All labels','No labels','Hide highlights','Hide labels / Show labels','↶ Rotate','Rotate ↷','Show goal'])assert(chapter.includes('<strong>'+label+'</strong>'),'missing UI control '+label);
 for(const text of ['temporarily exempt','original held locations remain held with their new colors','F = H ∖ {a,b}','rebinds persistent locations','Auto Solve’s secured-prefix invariant'])assert(chapter.includes(text),'missing endpoint hold contract '+text);
 for(const text of ['Show goal is hidden in mirror mode','· split','Randomize seed','Reduced-motion','independent','last completed legal turn'])assert(chapter.includes(text),'missing current control contract '+text);
 for(const text of ['flash together for each primitive turn','no separate axis-selector or rotation-button panel','a positive right-hand rotation','M uses L, E uses D, and S uses F','Both panels always share one selection','Each arrow’s tooltip names the corresponding notation move','disabled when no axis is selected','space rather than covering the puzzle','There is no tile-label control','only the occluded portions disappear','preserves your chosen labels and playback speed','switches directly to choosing endpoint 1','piece reference','hidden during solver operations and in Mirror mode','temporary disabled/enabled states','single-line button captions','manual move buttons are disabled','first click on the top','caption changes to','Manual mode keeps'])assert(chapter.includes(text),'missing revised presentation contract '+text);
 for(const text of ['How to play — illustrated controls','½× or ¾×','1½× or 2×','current primitive turn','actual canvas renderer','primed inverse','arbitrary swap need not bring the puzzle closer'])assert(chapter.includes(text),'missing current illustrated help contract '+text);
 for(const file of ['cube-guides.js','addition-guides.js'])assert(!read(file).includes('ring map is hidden'),'obsolete mirror guide: '+file);
 for(const text of ['Show no labels','Show some labels','Show all labels','Settings initialize only on a fresh puzzle-page load','1× speed','no 3D labels','3D highlights on','ring labels hidden','focused rings','including Homer','4× and 8×','Focus on rings','neither button changes the zoom or layout','Labels and playback speed are independent','zoom and pan are disabled','Each colored node represents an actual physical tile', 'without adding hollow markers', 'Only physical tiles', 'does not download solver tables','Stop</strong>, the <strong>journal player'])assert(chapter.includes(text),'missing persistent settings or navigation contract '+text);
 assert(chapter.includes('Selecting the second tile automatically checks'));assert(chapter.includes('then stays blank'));assert(chapter.includes('at least one verified partner'));assert(chapter.includes('No solution found. Try another pair.'));assert(!chapter.includes('<strong>Go</strong>'));assert(!chapter.includes('<strong>Suggest</strong>'));for(const text of ['bold solid white circle','outside dashed held circles','Follow the white rings to completion','strictly increases','same next checkpoint','Ordinary two-way exchanges cannot solve every legal configuration','Auto stays on','Keep the certificate intact','goal is reached'])assert(chapter.includes(text),'missing goal-guidance contract '+text);
 for(const text of ['two mutually exclusive modes','disables Clear','keeps the current holds','no repeated Auto click','local hints','manual hint makes no whole-puzzle progress guarantee','ON-AUTO-ON','ON-SELECT','ON-AUTO-OFF','NEW-GOAL(a,b)','GUIDED-FIRST-HINT'])assert(chapter.includes(text),'missing persistent hold policy '+text);
 assert(!/restores Some labels|selects All labels.*½×|Homer.*default off|Mirror mode restores the display|Rate selected/.test(chapter),'obsolete automatic display presets');
 assert(chapter.includes('The button names the next action, not the current mode'));assert(chapter.includes('secured nodes divided by total physical nodes'));assert(chapter.includes('Its secured count grows only after'));assert(!/manual timer|% solved|3D readout|00:00.00/.test(chapter));assert(!chapter.includes('More labels'));assert(!/Show actions|Hide actions|View axis|Reset view|inverse checkbox|notation buttons/.test(chapter));assert(!chapter.includes('Check &amp; solve'));assert(!chapter.includes('Select a node'));assert(chapter.includes('Select axis'));assert(!chapter.includes('They measure different things'));assert(!chapter.includes('Show tile labels'));assert(!chapter.includes('Some axis labels'));assert(!chapter.includes('Auto Solve suppresses 1/2'));assert(!chapter.includes('Suggest solve step'));assert(!chapter.includes('animation speed slider'));assert(!chapter.includes('at most one decimal'));assert(!chapter.includes('Exit after step'));assert(!/Gold outlines|green outlines|recorded.*guaranteed recovery/.test(chapter));
 const equations=(chapter.match(/<math /g)||[]).length;assert(equations>=7);assert.equal((chapter.match(/<\/math>/g)||[]).length,equations);
 const ids=[...chapter.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'duplicate disclosure ID');
 for(const id of ['tech-model','tech-chain','tech-search','tech-holds','tech-eligibility','tech-goal-hints','tech-full','tech-guided-checkpoints','tech-shorten','tech-runtime','tech-reproduce'])assert(ids.includes(id),'missing '+id);
 assert(!chapter.includes('solver-tech-nav'),'redundant purple chapter tiles removed');
 assert.equal((chapter.match(/<details\b/g)||[]).length,(chapter.match(/<\/details>/g)||[]).length);assert(!/<details[^>]*\sopen(?:\s|>)/.test(chapter));
 const blocks=[...chapter.matchAll(/<pre\b[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)].map(m=>m[1]);assert(blocks.length>=20);
 for(const block of blocks){assert(block.trim());assert(!/[<>]/.test(block),'unescaped pseudocode');}
 assert(!chapter.includes('undefined'));assert(!chapter.includes('[object Object]'));
 for(const key of ['THEN(p,q)','INVERSE_WORD','Schreier','unknown','ordered-pair','homeBySticker','modelSignature','EXPAND-SPARSE-CONJUGATES','BUILD-PAIR-INDEX and LOOKUP','exemptSwapEndpoints','FIRST-GOAL-HINT','SECOND-GOAL-HINT','AUTO-HOLDS-PLAN','verifyAutoHoldsPlan','verifyAutoHoldsStage','K_(i+1)','M - |K_0|','297,638','285,800','70,014'])assert(chapter.includes(key),'missing reproducibility term '+key);
 for(const title of ['Computation with permutation groups','A compact representation for permutation groups','An algorithm for solving the factorization problem','Finding optimal solutions','Algorithms for solving Rubik','Solving the Rubik’s Cube optimally is NP-complete'])assert(out.referenceHTML.includes(title),'missing general reference '+title);
});
test('Handbook is linked beside How to play; puzzle pages lead with their own solution',()=>{
 const home=read('index.html'),html=read('play.html'),book=read('solver-handbook.html');
 assert(home.includes('class="handbook-entry"'));assert(home.indexOf('class="handbook-entry"')>home.indexOf('id="how-to-play"'));assert(home.includes('href="solver-handbook.html"'));
 assert(html.indexOf('id="guide-intro"')<html.indexOf('id="guide-steps"'));assert(html.indexOf('id="guide-steps"')<html.indexOf('solver-method-details'));
 assert(html.includes('guide-handbook-link'));assert(html.includes('guide-bibliography'));assert(!html.includes('solver-tech-group.js'));assert(!html.includes('solver-technical.js'));
 assert(book.includes('id="cube2-worked-example"'));assert(book.includes('href="#cube2-worked-example"'));assert(book.includes('id="handbook-bibliography"'));
 const scripts=[...book.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 for(const file of ['solver-tech-group.js','solver-tech-manual.js','solver-technical.js'])assert(scripts.indexOf(file)<scripts.indexOf('solver-guide.js'));
 assert(scripts.indexOf('cube2-case-data.js')<scripts.indexOf('cube2-case.js'));
 assert(!read('skewb-expansion-guides.js').includes('automatic Solve button retraces recorded moves'));
 assert(!read('edge-crystal-guides.js').includes('recorded <strong>Auto solve</strong> sequence provide guaranteed recovery'));
});


test('Illustrated controls are packaged locally and every puzzle links to them',()=>{
 const chapter=load(true).renderCommon().chapterHTML;
 const figures=[...chapter.matchAll(/<img src="(assets\/help-[^"]+)"[^>]*alt="([^"]+)"/g)];assert.equal(figures.length,4);
 for(const match of figures){const bytes=fs.readFileSync(path.join(dist,match[1]));assert(bytes.subarray(1,4).equals(Buffer.from('PNG')));assert.equal(bytes.readUInt32BE(16),500);assert.equal(bytes.readUInt32BE(20),500);assert(match[2].length>60,'useful visual description');}
 for(const file of fs.readdirSync(path.join(dist,'games')).filter(f=>f.endsWith('.html'))){const html=read('games/'+file),help=/<details class="journal-help">([\s\S]*?)<\/details>/.exec(html);if(!help)continue;assert(help[1].includes('../solver-handbook.html#how-to-play'),file);assert(help[1].includes('id="cubeNote" hidden'),file+' preserves the engine compatibility element');assert(!help[1].includes('animation speed slider'));assert(!help[1].includes('complete current protected'));}
});
