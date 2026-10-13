/* A manual stopwatch. Puzzle moves and solver playback never control it. */
(() => {
 'use strict';
 if(!document.querySelector || window.PuzzlePlayTimer)return;
 const footer=document.querySelector('.cube-bottom');
 if(!footer)return;
 const make=(tag,id,className,text)=>{const el=document.createElement(tag);if(id)el.id=id;if(className)el.className=className;if(text)el.textContent=text;return el;};
 const timer=make('div','playTimer','play-timer');timer.setAttribute('role','group');timer.setAttribute('aria-label','Manual solve timer');
 const face=make('div','','play-timer-face'),readout=make('span','playTimerReadout','play-timer-readout','0:00.0');
 readout.setAttribute('role','timer');readout.setAttribute('aria-live','off');readout.setAttribute('aria-label','Elapsed time');
 face.append(readout,make('span','','play-timer-label','Your time'));
 const controls=make('div','','play-timer-controls'),toggle=make('button','playTimerToggle','small outline','Start'),reset=make('button','playTimerReset','small outline','Reset');
 toggle.type=reset.type='button';toggle.setAttribute('aria-pressed','false');toggle.setAttribute('aria-label','Start timer');reset.setAttribute('aria-label','Reset timer');
 controls.append(toggle,reset);timer.append(face,controls);footer.classList.add('has-play-timer');footer.appendChild(timer);
 // Keep the legacy elements in the DOM because some puzzle controllers update
 // their labels after mirror-mode changes. The timer stylesheet hides them.
 for(const old of footer.querySelectorAll('.legend, .shape-key')){old.hidden=true;old.setAttribute('aria-hidden','true');}
 let running=false,accumulated=0,startedAt=0,frameId=0;
 const elapsed=()=>accumulated+(running?Math.max(0,performance.now()-startedAt):0);
 function render(){const ticks=Math.floor(elapsed()/100),seconds=Math.floor(ticks/10),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);readout.textContent=(hours?hours+':'+String(minutes%60).padStart(2,'0'):minutes)+':'+String(seconds%60).padStart(2,'0')+'.'+ticks%10;toggle.textContent=running?'Stop':'Start';toggle.setAttribute('aria-pressed',String(running));toggle.setAttribute('aria-label',running?'Stop timer':accumulated?'Resume timer':'Start timer');reset.disabled=!running&&accumulated===0;timer.classList.toggle('is-running',running);}
 function tick(){frameId=0;render();if(running)frameId=requestAnimationFrame(tick);}
 toggle.addEventListener('click',()=>{if(running){accumulated=elapsed();running=false;if(frameId)cancelAnimationFrame(frameId);frameId=0;}else{startedAt=performance.now();running=true;frameId=requestAnimationFrame(tick);}render();});
 reset.addEventListener('click',()=>{running=false;accumulated=0;startedAt=0;if(frameId)cancelAnimationFrame(frameId);frameId=0;render();});
 window.PuzzlePlayTimer=Object.freeze({snapshot:()=>Object.freeze({running,elapsedMs:elapsed()})});render();
})();
