/* Human ratings and the existing local solver benchmark are guide-only detail.
 * Nothing is fetched until the player opens a solution guide. */
(function(root){
 'use strict';
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let benchmark=null,pending=null;
 const label=value=>({easy:'Easy',medium:'Medium',hard:'Hard','very-hard':'Very Hard'}[String(value).toLowerCase()]||String(value));
 function render(key,mirror){
  const rating=root.HUMAN_DIFFICULTY?.puzzles?.[key];
  if(!rating||key==='homer')return '';
  const human=label(rating.difficulty),sample=benchmark?.puzzles?.[key];
  let html=mirror?'<p><strong>Very Hard in mirror mode.</strong> With colors hidden, identify pieces and their orientations from their shapes, then apply the same legal moves. This adds visual recognition and bookkeeping to the colored puzzle’s method. The colored version is rated '+esc(human)+'.</p>':'<p><strong>'+esc(human)+' in color.</strong> '+esc(rating.rationale)+'</p>';
  if(mirror)html+='<p>'+esc(rating.rationale)+'</p>';
  html+='<p class="solver-guide-note">An editorial estimate for learning a human solution: recognition, number of stages and reusable rules, setup complexity, and the chance of losing progress matter more than the length of an automated solution. Prior experience with a related puzzle can make it much easier.</p>';
  if(sample&&Number.isFinite(sample.averageMoves)){
   const count=sample.samples?.length||benchmark.methodology?.samplesPerPuzzle||3;
   html+='<p><strong>Auto Solve benchmark:</strong> '+esc(sample.averageMoves.toFixed(1))+' legal moves on average ('+esc(sample.minMoves)+'–'+esc(sample.maxMoves)+' across '+esc(count)+' scrambles). Each trial used this puzzle’s normal Randomize generator from solved, discarded the move journal, and verified the computed solution. One returned legal move counts as one step, including a half turn when it is a single legal move. These are stored measurements, not a new calculation on your device. They measure this solver’s route length, not human difficulty or a proven shortest distance; time-bounded optimization can produce different counts on another run. Mirror mode uses the same move model.</p>';
  }
  const sources=(rating.sources||[]).filter(source=>/^https:\/\//.test(source.url));
  if(sources.length)html+='<p class="solver-guide-note">Rating background: '+sources.map(source=>'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title)+'</a>').join(' · ')+'.</p>';
  return html;
 }
 function loadEstimate(release){
  if(benchmark)return Promise.resolve(benchmark);
  if(pending)return pending;
  const url=new URL('atlas-difficulty.json',document.baseURI);if(release)url.searchParams.set('v',release);
  pending=fetch(url.href).then(response=>{if(!response.ok)throw Error('The local benchmark could not load.');return response.json();}).then(data=>{benchmark=data;return data;}).finally(()=>{pending=null;});
  return pending;
 }
 root.PuzzleDifficultyGuide=Object.freeze({render,loadEstimate});
})(window);
