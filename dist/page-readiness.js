/* Keep the dark shell stable until its styles and document are ready. */
(function(){
 'use strict';
 const root=document.documentElement;
 root.classList.add('page-pending');
 let revealed=false;
 function delayed(message){
  if(revealed)return;
  const label=document.getElementById('page-load-message'),retry=document.getElementById('page-load-retry');
  if(label)label.textContent=message;
  if(retry){retry.hidden=false;retry.onclick=()=>location.reload();}
 }
 const timer=setTimeout(()=>delayed('This page is taking longer to load. You can wait or try again.'),15000);
 function ready(){
  // Stylesheet failures must produce a usable retry screen, not raw game text.
  const styles=[...document.querySelectorAll('link[rel="stylesheet"]')];
  if(styles.some(link=>!link.sheet)){delayed('The page styling could not load. Please try again.');return;}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   revealed=true;clearTimeout(timer);root.classList.remove('page-pending');
  }));
 }
 document.addEventListener('DOMContentLoaded',ready,{once:true});
 window.addEventListener('pageshow',event=>{if(event.persisted)ready();});
})();
