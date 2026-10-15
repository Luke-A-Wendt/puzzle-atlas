/* Puzzle Atlas original fixed-slot FTO method.
 * Setup paths and all 1,375 move-builder cases are derived from and checked
 * against the exact game geometry. Base commutators follow Jaap's FTO method.
 */
(function(){
'use strict';
const data=__FTO_GUIDE_DATA__;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=s=>s.split(/\s+/).filter(Boolean);
const inverse=s=>parse(s).reverse().map(t=>t.endsWith('′')?t.slice(0,-1):t+'′').join(' ');
const canonical=(slots,pair)=>pair?slots.slice().sort().join(','):[slots.join(','),[slots[1],slots[2],slots[0]].join(','),[slots[2],slots[0],slots[1]].join(',')].sort()[0];
function sequence(method,slots){
 const d=data[method];if(!d||slots.length!==(d.pair?2:3)||new Set(slots).size!==slots.length||slots.some(s=>!d.slots.includes(s)))return null;
 const setup=d.paths[canonical(slots,d.pair)];if(setup===undefined)return null;
 return{setup:inverse(setup),cycle:d.core,restore:setup};
}
function result(method,slots){
 const seq=sequence(method,slots);if(!seq)return'<p>Choose '+(data[method].pair?'two':'three')+' different slots.</p>';
 const effect=data[method].pair?'Flip the vertices at '+slots.join(' and '):'Move the pieces at '+slots.join(' → ')+' → '+slots[0];
 return'<p><strong>'+escape(effect)+'.</strong></p>'+(seq.setup?'<p>1. Set up: <code>'+escape(seq.setup)+'</code></p>':'<p>1. No setup needed.</p>')+'<p>2. '+(method.startsWith('center')?'Cycle (all five repetitions are written out)':'Do')+': <code>'+escape(seq.cycle)+'</code></p>'+(seq.restore?'<p>3. Restore: <code>'+escape(seq.restore)+'</code></p>':'<p>3. No restore moves needed.</p>');
}
const options=(slots,selected)=>slots.map(s=>'<option value="'+s+'"'+(s===selected?' selected':'')+'>'+s+'</option>').join('');
function builder(id,method,legend){
 const d=data[method],labels=d.pair?['First vertex','Second vertex']:['From slot','To slot','Then to slot'];
 return'<fieldset class="fto-move-builder" id="fto-'+id+'-builder" data-fto-method="'+method+'"><legend>'+legend+'</legend>'+(id==='center'?'<label>Center group<select data-fto-orbit><option value="centerABCD">A · B · C · D faces</option><option value="centerEFGH">E · F · G · H faces</option></select></label>':'')+'<div class="fto-builder-fields">'+labels.map((label,i)=>'<label>'+label+'<select data-fto-slot="'+i+'">'+options(d.slots,d.base[i])+'</select></label>').join('')+'</div><div class="fto-builder-result" aria-live="polite">'+result(method,d.base)+'</div></fieldset>';
}
window.FTO_GUIDES={fto:{
 title:'Solve the Face-turning Octahedron',
 intro:'Solve the two-color edges, place and orient the four-color vertices, then finish the small centers. The move builders cover every case in this game’s fixed frame: choose the slots you need, and follow the displayed moves.',
 notation:[
  'A face letter <strong>A–H</strong> means one 120° clockwise turn, viewed directly from outside that face. A prime <strong>′</strong> means counterclockwise. Select the named axis below either panel and use <strong>Turn left</strong> or <strong>Turn right</strong>; each arrow’s tooltip names its notation move. Left/right describes ring-map motion and is not the notation convention.',
  '<strong>Am, Bm, Cm and Dm</strong> turn only the middle slice parallel to the named face. The center stage uses <strong>Bm</strong>, clockwise as seen from face B, and <strong>Bm′</strong>, its inverse. A center-slice move does not include the outer face.',
  'Dragging the 3D view changes only your viewpoint. The face letters, slot labels and move directions stay fixed. You never need to rename the faces to use this guide.',
  'Run all three parts of a builder—<strong>Set up → Do/Cycle → Restore</strong>—before judging its effect. Pieces may leave solved positions temporarily. The restore moves are part of the algorithm.'
 ],
 steps:[
  {title:'1 · Read the pieces and fixed color frame',body:
   '<p>Turn on <strong>Piece labels</strong>. Each label identifies a piece’s solved slot and its current slot. For example, <strong>BH → DE</strong> means the BH edge is currently in DE; its next destination should be BH. A single label means the piece is in its own slot.</p><p>The letters in a slot name are the faces meeting there. An edge has two letters, such as AH. A vertex has four, such as ABGH. Each face’s three small centers have numbered slots, such as A1, A2 and A3. Rotate the 3D view to find hidden labels.</p><table><thead><tr><th>Face</th><th>Solved color</th><th>Opposite face</th></tr></thead><tbody><tr><td>A</td><td>Pearl</td><td>E · Gold</td></tr><tr><td>B</td><td>Blue</td><td>F · Emerald</td></tr><tr><td>C</td><td>Coral</td><td>G · Orange</td></tr><tr><td>D</td><td>Violet</td><td>H · Aqua</td></tr></tbody></table><p>Use this fixed color frame throughout. There are twelve two-sticker edges, six four-sticker vertices, and twenty-four one-sticker centers. The next steps preserve each earlier stage when the complete displayed sequence is finished.</p>'},
  {title:'2 · Put the twelve edges in their slots',body:
   '<p>Ignore the vertices and centers. The two-color edges do not have a separate flip to solve: putting an edge in the correct fixed slot also gives it the correct orientation.</p><ol><li>Find a misplaced edge. Put its <strong>current slot</strong> in <strong>From slot</strong>, and its <strong>home slot</strong> in <strong>To slot</strong>.</li><li>Look at the edge currently occupying that To slot. Put <em>its</em> home slot in <strong>Then to slot</strong>.</li><li>If that gives the same slot as From, you found an exchanged pair. For the third slot, choose any other misplaced edge’s current slot.</li><li>Perform the complete displayed sequence. Check the labels and repeat.</li></ol><p>The builder cycles exactly those three edge positions; every other edge stays solved. At least one more edge reaches home each time. You cannot finish a legal state with only two exchanged edges; if that seems to happen, recheck the labels and any incomplete sequence.</p>'+builder('edge','edge','Three-edge cycle')+'<p>Example: the default choice moves BH → DE → CE → BH. It affects vertices and centers, which are still unsolved at this stage.</p>'},
  {title:'3 · Place the six vertices',body:
   '<p>Now use the four-letter vertex labels. Ignore the direction of their stickers for the moment: the goal is to put each vertex in its own slot.</p><p>Use the same choice rule as for the edges: <strong>current slot → that piece’s home → the home of the piece currently in that destination</strong>. For an exchanged pair, choose another misplaced vertex for the third slot.</p>'+builder('vertex','vertex','Three-vertex cycle')+'<p>Repeat until all six vertices have single-slot labels. Each complete sequence preserves every edge and all unselected vertices. Some of the three moved vertices may still need the half-turn orientation correction in the next step.</p>'},
  {title:'4 · Orient the vertices in pairs',body:
   '<p>With each vertex in its own slot, compare its four stickers with the fixed face colors in step 1. A vertex is either correct or flipped by a half-turn about its point; it is never fixed by turning only a tip, because this puzzle has no tip controls.</p><p>Select any two incorrectly oriented vertices. The builder flips both in place, preserving all edges and every other vertex. Repeat with another pair until all six vertices match the frame. A legal position always has an even number of flipped vertices.</p>'+builder('flip','flip','Flip a pair of vertices')+'<p>If only one vertex appears wrong, inspect the opposite side before moving on. Recheck that all six vertices are in the correct slots.</p>'},
  {title:'5 · Finish the centers by color',body:
   '<p>Only the small, single-color centers remain. The centers on <strong>A, B, C and D</strong> form one group; those on <strong>E, F, G and H</strong> form the other. Work on either group first. A center never transfers between these groups.</p><p><strong>Solve colors, not center numbers.</strong> The three centers of a color are interchangeable. For example, A1 in slot A3 is already correct. Ignore its label’s arrow when both names start with the same face letter.</p><ol><li>Choose an incorrect center and enter its current slot as <strong>From</strong>.</li><li>Choose an incorrect slot on the face where that color belongs; enter it as <strong>To</strong>.</li><li>Inspect the center currently in To. Choose an incorrect third slot on the face where <em>that</em> color belongs. This is <strong>Then to</strong>.</li><li>If the only such slot is From, those two centers form an exchanged pair. Choose any other incorrect slot in the same group as the third slot. If exactly two incorrect centers remain, use an <em>already correct</em> third center on the same face as From.</li><li>Run the entire sequence, including its restore moves. Recheck colors and repeat, then solve the other group.</li></ol>'+builder('center','centerABCD','Three-center cycle')+'<p>Each sequence moves only the selected three centers. All edges, vertices and other centers return exactly to their previous state. The center cycle is longer than the earlier moves: its repeated middle-slice commutator is printed in full so you can enter it from left to right.</p><p>When each of the eight triangular faces has one color, the puzzle is solved. Remaining arrows between same-color center labels are harmless.</p>'},
  {title:'6 · Practice a smaller step',body:
   '<p>For a short exercise, start solved and apply one sequence from a builder. Then select the opposite cycle direction by exchanging the To and Then to choices, and run that sequence to return those selected pieces to their original slots. Later-stage pieces may still be scrambled. For a vertex-flip pair, repeat the same sequence to undo its effect on the vertices; the centers will still be a later task.</p><p>The game’s Undo button can correct an entry mistake. The automated Solve button uses the Constrained Solver on the current arrangement, with protected-node highlights between stages. This manual method also works without move history.</p><p>These builders were generated for this exact model and checked over every available selection. They favor a small number of reusable ideas over the shortest possible solution.</p>'}
 ],
 sources:[{label:'Jaap Scherphuis · FTO structure and base commutators',url:'https://www.jaapsch.net/puzzles/octaface.htm'}]
}};
function updateBuilder(box,changeOrbit){
 const orbit=box.querySelector('[data-fto-orbit]');
 if(orbit&&changeOrbit){box.dataset.ftoMethod=orbit.value;const d=data[orbit.value];box.querySelectorAll('[data-fto-slot]').forEach((select,i)=>{select.innerHTML=options(d.slots,d.base[i]);});}
 const method=box.dataset.ftoMethod,slots=Array.from(box.querySelectorAll('[data-fto-slot]'),s=>s.value);
 box.querySelector('.fto-builder-result').innerHTML=result(method,slots);
}
document.addEventListener('change',event=>{const target=event.target;if(!target||!target.closest)return;const box=target.closest('.fto-move-builder');if(box)updateBuilder(box,target.hasAttribute('data-fto-orbit'));});
// A small read-only surface lets verification exercise the same emitted recipes.
window.FTO_GUIDE_BUILDERS=Object.freeze({sequence,methods:Object.keys(data),slots:method=>data[method]?data[method].slots.slice():[]});
})();
