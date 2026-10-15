'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist'),read=file=>fs.readFileSync(path.join(dist,file),'utf8').replace(/[?&]v=[a-f0-9]{20}(?=[\"'#&])/g,'');
const groups={
 tetrahedral:['tetraminx','pyraminx','jing','masterpyraminx'],
 cubical:['cube2','cube3','cube4','cube5','cube6','cube7','cube8','cube9','cube10','mirror','axis','ghost','pyramorphix','diamondstyle','diamondcube','rhombic','flatdiamond','cornerocta','trajber','jewel','mastermorphix'],
 octahedral:['skewb','masterskewb','ultimate','diamond','fto','dino','rainbow'],
 dodecahedral:['helicopter','kilominx','megaminx','crystal']
};
function controls(id){return new Set(JSON.parse(read('games/constrained-solver-models/'+id+'.json')).moves.map(move=>move.axis));}
function handbook(){const context={window:{SOLVER_TECHNICAL:{render:()=>''}}};vm.runInNewContext(read('solver-guide.js'),context);return context.window.SOLVER_GUIDE.renderCommon();}
test('Catalog families retain mechanism-based classification across all 36 visible puzzles',()=>{
 const cards=[...read('index.html').matchAll(/<a class="puzzle-card" data-family="([^"]+)" href="play\.html\?p=([^&"]+)/g)];
 assert.equal(cards.length,36);
 for(const [family,ids]of Object.entries(groups))for(const id of ids){
  assert(cards.some(card=>card[1]===family&&card[2]===id),id+' belongs in '+family);
  assert(controls(id).size>0,id+' has an actual model');
 }
 assert.match(read('play.js'),/homer:\{name:'Homer',family:'Cubical \(6 axes\)/,'hidden picture puzzle keeps its cube mechanism family');
});
test('Documented layer counts match the actual cube move models without changing their axis family',()=>{
 const {chapterHTML}=handbook();
 for(let n=2;n<=10;n++)assert.equal(controls('cube'+n).size,3*n,n+' cube single-layer controls');
 assert.equal(controls('pyraminx').size,8,'four directions with independent tips');
 assert.equal(controls('masterpyraminx').size,12,'four directions with multiple depths');
 assert.equal(controls('cornerocta').size,12,'six directions with independent tips');
 assert.equal(controls('fto').size,12,'eight poles plus central-slice controls');
 for(const term of ['turning directions from the center','half-axes or turning poles','3N single-layer controls','3(N−1) internal cutting planes','9 for 3×3×3, 12 for 4×4×4, and 30 for 10×10×10','different arrangements','not the same symmetry family','One layer turn can move several separate cycles','neither the axis count nor the drawn-ring count measures difficulty'])assert(chapterHTML.includes(term),'missing count distinction '+term);
 assert.doesNotMatch(read('index.html'),/\d+ rings ·/,'card counts are move controls, not all rendered rings');
 assert.doesNotMatch(read('play.js'),/\d+ rings\./,'page descriptions make the same distinction');
});
test('Classification explanation is linked from the atlas and cites the stated convention',()=>{
 const {chapterHTML,referenceHTML}=handbook();
 assert(read('index.html').includes('solver-handbook.html#help-axis-families'));
 assert(chapterHTML.includes('id="help-axis-families"'));
 assert(referenceHTML.includes('https://www.jaapsch.net/puzzles/ideas.htm'));
 assert(referenceHTML.includes('Ideas for further puzzles'));
 assert(!/Show actions|View axis|Reset view/.test(chapterHTML),'handbook no longer describes removed controls');
});
