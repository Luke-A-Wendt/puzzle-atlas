(() => {
'use strict';
const puzzles={
 masterpyraminx:{name:'Master Pyraminx',family:'Tetrahedral (4 axes)',subtitle:'Four layers. Centers, wings, and midges around four vertices.'},
 kilominx:{name:'Kilominx',family:'Dodecahedral (12 axes)',subtitle:'Twenty corners. Twelve pentagonal faces.'},
 ghost:{name:'Ghost Cube',family:'Cubical (6 axes)',subtitle:'An angular cube with a hidden alignment. Solve in color or mirror mode.'},
 jing:{name:'Jing Pyraminx',family:'Tetrahedral (4 axes)',subtitle:'Four vertices, six edges, and four movable face centers.'},
 skewb:{name:'Skewb',family:'Octahedral (8 axes)',subtitle:'Half-cube turns around the corners.'},
 masterskewb:{name:'Master Skewb',family:'Octahedral (8 axes)',subtitle:'Fifty pieces. Eight corner turns. Straight cuts.'},
 helicopter:{name:'Helicopter Cube',family:'Rhombic Dodecahedral (12 axes)',subtitle:'Twelve edge axes. Reunite the triangles on each face.'},
 crystal:{name:'Pyraminx Crystal',family:'Dodecahedral (12 axes)',subtitle:'Deep cuts through twelve colorful faces.'},
 homer:{name:'Homer',family:'Cubical (6 axes) · Secret puzzle',subtitle:'Eight pieces. One familiar face. Restore Homer’s head.'},
 tetraminx:{name:'Tetraminx',family:'Tetrahedral (4 axes)',subtitle:'Four main layers. The tipless tetrahedral puzzle.'},
 pyraminx:{name:'Pyraminx',family:'Tetrahedral (4 axes)',subtitle:'Four main layers. Four independent tips.'},
 cube2:{name:'Cube 2×2',family:'Cubical (6 axes)',subtitle:'Eight corners. Six linked rings.'},
 cube3:{name:'Cube 3×3',family:'Cubical (6 axes)',subtitle:'The classic, from a new perspective.'},
 cube4:{name:'Cube 4×4',family:'Cubical (6 axes)',subtitle:'Outer faces. Inner slices. Endless possibilities.'},
 cube5:{name:'Cube 5×5×5',family:'Cubical (6 axes)',subtitle:'5 layers. 15 rings. Every slice connected.'},
 cube6:{name:'Cube 6×6×6',family:'Cubical (6 axes)',subtitle:'6 layers. 18 rings. Every slice connected.'},
 cube8:{name:'Cube 8×8×8',family:'Cubical (6 axes)',subtitle:'8 layers. 24 slice controls. Three pairs of wings on every edge.'},
 diamondstyle:{name:'Diamond Puzzler',family:'Cubical (6 axes)',subtitle:'Three colored bands on a shaved cube mechanism.'},
 diamondcube:{name:'Diamond Cuboctahedron',family:'Cubical (6 axes)',subtitle:'Six square faces and eight triangular faces. Fourteen colors to restore.'},
 cube7:{name:'Cube 7×7×7',family:'Cubical (6 axes)',subtitle:'7 layers. 21 rings. Every slice connected.'},
 mirror:{name:'Mirror Cube',family:'Cubical (6 axes)',subtitle:'Unequal blocks. Start in color or try advanced mirror mode.'},
 pyramorphix:{name:'Pyramorphix',family:'Cubical (6 axes)',subtitle:'Four colors. Eight pieces. A tetrahedron that changes shape.'},
 rhombic:{name:'Rhombic Dodecahedron Cube',family:'Cubical (6 axes)',subtitle:'Twelve diamond faces around a familiar cube mechanism.'},
 flatdiamond:{name:'Flat Diamond Cube',family:'Cubical (6 axes)',subtitle:'Two flat hexagons and twelve sloping faces to bring home.'},
 cornerocta:{name:'Corner-turning Octahedron',family:'Cubical (6 axes)',subtitle:'Six turning vertices, with independently rotating tips.'},
 trajber:{name:'Trajber’s Octahedron',family:'Cubical (6 axes)',subtitle:'Deeper vertex turns add a center to every triangular face.'},
 jewel:{name:'Christoph’s Jewel',family:'Cubical (6 axes)',subtitle:'Eighteen pieces. Six turning vertices. No tips.'},
 mastermorphix:{name:'MasterMorphix',family:'Cubical (6 axes)',subtitle:'Four colors. A 3×3 mechanism. A tetrahedron that changes shape.'},
 ultimate:{name:'Skewb Puzzleball',family:'Octahedral (8 axes)',subtitle:'Deep diagonal turns. Fourteen moving pieces.'},
 diamond:{name:'Skewb Diamond',family:'Octahedral (8 axes)',subtitle:'Eight faces. Fourteen pieces. A different kind of turn.'},
 fto:{name:'Face-turning Octahedron',family:'Octahedral (8 axes)',subtitle:'Eight faces. Forty-two pieces. Three layers per axis.'},
 dino:{name:'Dino Cube',family:'Octahedral (8 axes)',subtitle:'Twelve edges. Three pieces turn around each corner.'},
 rainbow:{name:'Rainbow Cube',family:'Octahedral (8 axes)',subtitle:'Six square faces. Eight triangles. Fourteen colors.'},
 megaminx:{name:'Megaminx',family:'Dodecahedral (12 axes)',subtitle:'Twelve faces. One beautiful challenge.'}
};
const params=new URLSearchParams(location.search);
const key=Object.hasOwn(puzzles,params.get('p'))?params.get('p'):'cube3';
const advanced=params.get('mirror')==='1'&&['mirror','flatdiamond','pyramorphix','mastermorphix','homer','ghost'].includes(key);
const puzzle=puzzles[key], guide={...window.CUBE_GUIDES,...window.POLY_GUIDES,...window.SKEWB_GUIDES,...window.TETRAMINX_GUIDES,...window.LARGE_CUBE_GUIDES,...window.FTO_GUIDES,...window.SHAPE_GUIDES,...window.DINO_GUIDES,...window.HOMER_GUIDES,...window.SKEWB_EXPANSION_GUIDES,...window.EDGE_CRYSTAL_GUIDES,...window.DIAMOND_GUIDES,...window.ADDITION_GUIDES}[key];
const $=id=>document.getElementById(id), frame=$('puzzle-frame'), layout=$('play-layout');
const safeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.title=puzzle.name+' — Puzzle Atlas';
$('puzzle-title').textContent=puzzle.name;
frame.title='Interactive '+puzzle.name+' game';
frame.src='games/'+key+'.html'+(advanced?'?mirror=1':'');
function syncGuideButton(){frame.contentWindow?.postMessage({type:'guide-panel-state',open:!layout.classList.contains('guide-hidden')},location.origin==='null'?'*':location.origin);}
window.addEventListener('message',event=>{
 if(event.source!==frame.contentWindow||event.origin!==location.origin)return;
 if(event.data?.type==='toggle-guide')setTab(layout.classList.contains('guide-hidden'));
 if(event.data?.type==='ring-panel-state')syncGuideButton();
});
if(guide){
 const solverGuide=window.SOLVER_GUIDE?.render({key,name:puzzle.name,guide});
 if(solverGuide){
  $('solver-guide').innerHTML=solverGuide.chapterHTML;$('solver-puzzle-method').innerHTML=solverGuide.puzzleHTML;
  const algorithm=$('solver-guide').querySelector('.solver-guide-algorithm');
  if(algorithm)$('guide-scroll').insertBefore(algorithm,$('guide-sources').closest('details'));
 }
 $('guide-intro').innerHTML='<h3>'+safeHTML(puzzle.name)+'</h3><p class="guide-method-title">'+safeHTML(guide.title)+'</p><p>'+safeHTML(guide.intro)+'</p>';
 $('guide-notation').innerHTML='<ul>'+guide.notation.map(n=>'<li>'+n+'</li>').join('')+'</ul>';
 $('guide-steps').innerHTML=guide.steps.map((step,i)=>'<details class="guide-step" id="step-'+i+'"'+(i===0?' open':'')+'><summary><span class="step-number">'+String(i+1).padStart(2,'0')+'</span><span>'+safeHTML(step.title.replace(/^\d+\s*·\s*/,''))+'</span></summary><div class="step-body">'+step.body+'</div></details>').join('');
 $('guide-jump').innerHTML=guide.steps.map((step,i)=>'<option value="'+i+'">'+(i+1)+'. '+safeHTML(step.title.replace(/^\d+\s*·\s*/,''))+'</option>').join('');
 $('guide-sources').innerHTML=solverGuide?.referenceHTML||guide.sources.map(source=>'<li><a href="'+safeHTML(source.url)+'" target="_blank" rel="noopener noreferrer">'+safeHTML(source.label)+'</a></li>').join('');
} else {$('guide-intro').textContent='The solution guide could not load. Reload this page to try again.';}
$('guide-scroll').addEventListener('click',event=>{const link=event.target.closest?.('.guide-cite');if(!link)return;const target=document.querySelector(link.getAttribute('href'));if(!target)return;event.preventDefault();const references=target.closest('details');if(references)references.open=true;target.scrollIntoView({behavior:'smooth',block:'nearest'});});
$('guide-scroll').addEventListener('click',event=>{const link=event.target.closest?.('.solver-tech-jump');if(!link)return;const target=document.getElementById(link.getAttribute('href').slice(1));if(!target)return;event.preventDefault();for(let node=target;node&&node!==$('guide-scroll');node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});const summary=target.querySelector('summary');if(summary)summary.focus({preventScroll:true});});
$('guide-jump').addEventListener('change',e=>{const step=$('step-'+e.target.value);step.open=true;step.scrollIntoView({behavior:'smooth',block:'start'});});
$('expand-steps').addEventListener('click',()=>{const steps=[...document.querySelectorAll('.guide-step')];const expand=steps.some(step=>!step.open);steps.forEach(step=>step.open=expand);$('expand-steps').textContent=expand?'Collapse all':'Expand all';});
$('guide-toggle').addEventListener('click',()=>setTab(layout.classList.contains('guide-hidden')));
function setTab(showGuide){layout.classList.toggle('guide-hidden',!showGuide);layout.classList.toggle('mobile-guide',showGuide);$('guide-toggle').setAttribute('aria-expanded',String(showGuide));syncGuideButton();}
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();setTab(true);$('guide-scroll').focus();});
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==location.origin)return;if(event.data?.type==='puzzle-height'&&Number.isFinite(event.data.height))$('game-area').style.setProperty('--game-height',Math.min(2200,Math.max(750,event.data.height))+'px');});
})();
