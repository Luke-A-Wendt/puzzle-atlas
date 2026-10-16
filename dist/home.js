'use strict';
const buttons=[...document.querySelectorAll('[data-filter]')];
const cards=[...document.querySelectorAll('[data-family]')];
const allowed=new Set(buttons.map(b=>b.dataset.filter));
function filterFamily(family){
 if(!allowed.has(family))family='all';
 buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===family)));
 const puzzles=new Set();let versions=0;
 cards.forEach(card=>{
  card.hidden=family!=='all'&&card.dataset.family!==family;
  if(!card.hidden){puzzles.add(card.dataset.puzzle);versions++;}
 });
 document.getElementById('filter-status').textContent=`Showing ${puzzles.size} puzzles${versions>puzzles.size?' in '+versions+' versions':''}, ordered by human difficulty.`;
}
buttons.forEach(button=>button.addEventListener('click',()=>filterFamily(button.dataset.filter)));

// These are pre-rendered local images: no game engines run on the atlas. Start
// every small preview eagerly so scrolling never has to initialize a puzzle.
// If a preferred WebP fails, remove its <source> and retry the original PNG
// once. A failed fallback remains an explicit preview message, never a blank
// card or an endless retry loop.
for(const img of document.querySelectorAll('.card-image img')){
 const wrapper=img.closest('.card-image');
 let fallback=false;
 function ready(){wrapper.classList.remove('preview-missing');}
 function failed(){
  if(!fallback){
   fallback=true;
   for(const source of img.parentElement.querySelectorAll('source'))source.remove();
   const url=new URL(img.getAttribute('src'),location.href);url.searchParams.set('preview-retry','1');img.src=url.href;
   return;
  }
  wrapper.classList.add('preview-missing');
 }
 img.addEventListener('load',ready);img.addEventListener('error',failed);
 // A cached failure can finish before this bottom-of-page script attaches.
 if(img.complete){if(img.naturalWidth)ready();else failed();}
}
