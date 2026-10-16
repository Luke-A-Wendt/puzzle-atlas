'use strict';
// Build the atlas from small, checked-in editorial and measured datasets.
// Visitors receive static cards and local previews; no solver runs on this page.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'dist/index.html');
let html = fs.readFileSync(target, 'utf8');
const data = require('./atlas-card-data.json');
const human = require('../dist/human-difficulty.js');
const metrics = require('../dist/atlas-metrics.json');
const families = {tetrahedral:'Tetrahedral',cubical:'Cubical',octahedral:'Octahedral',dodecahedral:'Dodecahedral',shapeshifter:'ShapeShifter'};
const mirrors = {mirror:'mirror-silver',axis:'axis-mirror',ghost:'ghost-mirror',pyramorphix:'pyramorphix-mirror',mastermorphix:'mastermorphix-mirror',flatdiamond:'flatdiamond-mirror'};
const dateArg = process.argv.find(arg => arg.startsWith('--date='));
const date = dateArg ? dateArg.slice(7) : /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(html)?.[1];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Use --date=YYYY-MM-DD');
const dateLabel = new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if (data.length!==36 || new Set(data.map(c=>c.id)).size!==36 || data.some(c=>c.id==='homer')) throw new Error('Expected 36 distinct public puzzles');
const colored = data.map(c=>{
 const d=human.puzzles[c.id],m=metrics.puzzles[c.id];
 if(!d||!m||!families[c.mechanismFamily])throw new Error('Missing catalog data: '+c.id);
 if(m.shapeShifter!==Boolean(mirrors[c.id]))throw new Error('Missing mirror preview: '+c.id);
 return {...c,d,m,mode:'color',family:m.shapeShifter?'shapeshifter':c.mechanismFamily};
}).sort((a,b)=>a.d.rank-b.d.rank);
const cards=[...colored,...colored.filter(c=>c.m.shapeShifter).map(c=>({...c,mode:'mirror',preview:mirrors[c.id],name:'Mirror '+c.name.replace(/^Mirror\s+/, '')}))];
const metric=(value,label,hint)=>`<div title="${escape(hint)}"><dt>${label}</dt><dd>${value}</dd></div>`;
const markup=cards.map((c,index)=>{
 const {id,name,mode,family,preview,m,d}=c,mirror=mode==='mirror';
 for(const ext of ['webp','png'])if(!fs.existsSync(path.join(root,'dist/assets',preview+'.'+ext)))throw new Error('Missing preview '+preview+'.'+ext);
 const rating=mirror?'Very Hard':({easy:'Easy',medium:'Medium',hard:'Hard'}[d.difficulty.toLowerCase()]);
 return `<a class="puzzle-card" data-puzzle="${id}" data-family="${family}" data-mode="${mode}" data-difficulty="${rating}" href="play.html?p=${id}${mirror?'&mirror=1':''}" aria-label="Play ${escape(name)}${mirror?' in mirror mode':''}">
<div class="card-image"><picture><source srcset="assets/${preview}.webp" type="image/webp"><img src="assets/${preview}.png" alt="Solved ${mirror?'silver':'colored'} ${escape(name)}" width="640" height="480" loading="eager" decoding="async" fetchpriority="${index<4?'high':'low'}"></picture></div>
<div class="card-body"><p class="descriptor"><span>${families[family]}</span><span class="difficulty">${rating}</span></p>
<h2>${escape(name)}</h2>
<div class="card-bottom"><dl class="card-metrics" aria-label="Solved ring-map metrics">${metric(mirror?1:m.colors,'Colors','Visible tile colors.')}${metric(m.rings,'Rings','Distinct drawn paths in the solved ring map; not rotation axes.')}${metric(m.nodes,'Nodes','Physical tiles represented in the ring map.')}</dl>
</div></div></a>`;
}).join('\n');
html=html.replace(/<div id="collection"[\s\S]*?(?=<p id="filter-status")/,`<div id="collection" class="card-grid" aria-label="36 puzzles ordered by human difficulty, followed by six mirror versions">\n${markup}\n</div>`);
html=html.replace(/<p id="filter-status"[^>]*>[\s\S]*?<\/p>/,'<p id="filter-status" class="sr-only" role="status" aria-live="polite">Showing 36 puzzles in 42 versions, ordered by human difficulty.</p>');
html=html.replace(/<span class="catalog-note">[\s\S]*?<\/span>/,'');
html=html.replace(/<details id="catalog-key"[\s\S]*?<\/details>/,'');
const help=`<details id="how-to-play" class="how-to"><summary>How to play <span>A quick start</span></summary><div class="quick-start">
<p><strong>Look around</strong>Drag the 3D puzzle to orbit. <span class="help-pointer">Scroll the mouse wheel to zoom.</span><span class="help-touch">Pinch with two fingers to zoom.</span> The view changes; the puzzle does not.</p>
<p><strong>Select an axis</strong><span class="help-pointer">Click</span><span class="help-touch">Tap</span> a ring, axis label, or axis button. Repeated <span class="help-pointer">clicks</span><span class="help-touch">taps</span> on a 3D tile cycle its axes, then clear the selection.</p>
<p><strong>Turn the puzzle</strong>Drag along a ring, or use ↶ Rotate / Rotate ↷ below the 3D view. The arrows mean counterclockwise / clockwise looking inward from the selected axis.</p>
<p><strong>Connect the views</strong><span class="help-pointer">Hover over a 3D tile to outline its ring-map node.</span><span class="help-touch">In Constrained Solver, tap either a 3D tile or its ring-map node to make the same selection.</span> <span class="help-pointer">Click</span><span class="help-touch">Tap</span> empty ring-map space to deselect the axis.</p>
<p><strong>Scramble or solve</strong>Randomize scrambles the current state. Auto Solve works through it in stages. Stop once to finish the stage; twice to finish just the current move.</p>
<p><strong>Try a constrained swap</strong>Use Hold to protect node colors. Choose a tile for Swap ① and Swap ②, then Go. Clear releases holds; Suggest chooses holds for you.</p>
<p><strong>Replay your moves</strong>The player steps backward or forward through moves or whole sequences. Stop ends playback after the current move.</p>
<p><strong>Find help</strong>Show guide opens this puzzle’s solution. The <a href="solver-handbook.html">solving handbook</a> explains every control, solver, and algorithm.</p>
</div></details>`;
html=html.replace(/<details id="how-to-play"[\s\S]*?<\/details>/,help);
html=html.replace(/(<a class="nav-link" href=")[^"]+("[^>]*>How to play)/,'$1#how-to-play$2');
html=html.replace(/<time datetime="\d{4}-\d{2}-\d{2}">[^<]*<\/time>/,`<time datetime="${date}">${dateLabel}</time>`);
fs.writeFileSync(target,html);
console.log(`Built ${colored.length} puzzles and ${cards.length-colored.length} mirror variants; human difficulty; release ${date}.`);
