/* The shared reference has one home; game guides keep their specific recipes. */
(() => {
'use strict';
const chapters=document.getElementById('handbook-chapters');
const output=window.SOLVER_GUIDE.renderCommon();
chapters.innerHTML=output.chapterHTML;
document.getElementById('handbook-bibliography').innerHTML=output.referenceHTML;
const panel=chapters.querySelector('.solver-panel-guide'),usage=chapters.querySelector('.solver-guide-usage');
if(panel&&usage)usage.parentNode.insertBefore(panel,usage);
function reveal(id){
 const target=document.getElementById(id);if(!target)return;
 for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
 target.scrollIntoView({behavior:'smooth',block:'start'});
 const heading=target.querySelector('summary');if(heading)heading.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a[href^="#"]');if(!link)return;
 const id=link.getAttribute('href').slice(1);if(!document.getElementById(id))return;
 event.preventDefault();history.replaceState(null,'','#'+encodeURIComponent(id));reveal(id);
});
window.addEventListener('hashchange',()=>reveal(decodeURIComponent(location.hash.slice(1))));
if(location.hash)requestAnimationFrame(()=>reveal(decodeURIComponent(location.hash.slice(1))));
})();
