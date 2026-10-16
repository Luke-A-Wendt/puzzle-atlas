/* Same-origin iframe handshake: show the first fully styled, painted frame. */
(function(root){
 'use strict';
 function create(options){
  const {frame,cover,message,retry,area,puzzle}=options;
  let loaded=false,initialized=false,done=false,attempt=0,timer=0,paintToken=0;
  function failed(text){if(done)return;message.textContent=text;retry.hidden=false;}
  function paintReady(){
   if(done||!loaded||!initialized)return;
   const token=++paintToken;
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(done||token!==paintToken||!loaded||!initialized)return;
    let doc;
    try{doc=frame.contentDocument;}catch(_){failed('The puzzle could not be opened. Please try again.');return;}
    if(!doc||[...doc.querySelectorAll('link[rel="stylesheet"]')].some(link=>!link.sheet)){
     failed('The puzzle styling could not load. Please try again.');return;
    }
    const canvas=doc.getElementById('cube');
    if(!canvas||!canvas.width||!canvas.height){failed('The puzzle view could not start. Please try again.');return;}
    done=true;clearTimeout(timer);frame.classList.add('puzzle-frame-ready');cover.hidden=true;area.setAttribute('aria-busy','false');
    // The game can report readiness without starting any optional guide work.
    options.onReady?.();
   }));
  }
  function start(url,adopt=false){
   attempt++;paintToken++;done=false;loaded=false;initialized=false;
   frame.classList.remove('puzzle-frame-ready');cover.hidden=false;retry.hidden=true;area.setAttribute('aria-busy','true');
   message.textContent='Loading '+options.name+'…';clearTimeout(timer);
   timer=setTimeout(()=>failed('This puzzle is taking longer to start. You can wait or try again.'),15000);
   // The tiny HTML bootstrap may already be loading this exact game. Do not
   // restart its request, and recover a load/ready event emitted before us.
   const expected=new URL(url,location.href).href;
   if(adopt&&new URL(frame.src||'about:blank',location.href).href===expected){
    try{
     if(frame.contentWindow.location.href===expected&&frame.contentDocument?.readyState==='complete'){
      loaded=true;initialized=frame.contentWindow.PUZZLE_API?.puzzle===puzzle;
      if(initialized)paintReady();else failed('The puzzle could not finish loading. Please try again.');
     }
    }catch(_){failed('The puzzle could not be opened. Please try again.');}
   }else frame.src=url;
  }
  frame.addEventListener('load',()=>{
   // Ignore the iframe's initial about:blank load.
   try{if(!frame.contentDocument||frame.contentWindow.location.href==='about:blank')return;}catch(_){failed('The puzzle could not be opened. Please try again.');return;}
   loaded=true;
   // Also accept an already initialized document (e.g. a back/forward restore).
   initialized=initialized||frame.contentWindow.PUZZLE_API?.puzzle===puzzle;
   if(!initialized){failed('The puzzle could not finish loading. Please try again.');return;}
   paintReady();
  });
  frame.addEventListener('error',()=>failed('The puzzle could not load. Please try again.'));
  root.addEventListener('message',event=>{
   if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.type!=='puzzle-ready'||event.data.puzzle!==puzzle)return;
   initialized=true;paintReady();
  });
  retry.addEventListener('click',()=>{
   const url=new URL(options.url,location.href);url.searchParams.set('retry',String(attempt));start(url.href);
  });
  root.addEventListener('pageshow',event=>{if(event.persisted&&!done)paintReady();});
  start(options.url,true);
  return {isReady:()=>done};
 }
 root.PuzzleFrameReadiness=Object.freeze({create});
})(window);
