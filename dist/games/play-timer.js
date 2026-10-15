/* Shared control feedback. Legacy filename retained for portable asset compatibility. */
/* Feedback tracks semantic settings, never busy/disabled states or action
 * captions. Explicit callers use the same gate as observed changes; a reset to
 * the existing value cannot force another accent. No polling loop. */
(function(root){
 'use strict';
 const doc=root.document;if(!doc?.querySelectorAll||root.PuzzleFeedback)return;
 const get=id=>{try{return doc.getElementById?.(id)||null;}catch(_){return null;}};
 const selector='button,input[type="range"],input[type="checkbox"],input[type="radio"],select',states=new WeakMap(),timers=new WeakMap(),deferred=new WeakSet(),seenMirror=new WeakSet();
 const attr=(node,name)=>node.getAttribute?.(name)??node.attributes?.[name]??null;
 const pressed=new Set(['mirrorMode','viewHighlightToggle','pieceLabels','ringLabelToggle','ringFocus','advanced','constrainedSolverToggle','ringModeDefault','csHold','csSwap','csShowGoal']);
 const control=node=>node?.nodeType===3?node.parentElement?.closest?.(selector):node?.closest?.(selector);
 const visible=node=>{if(!node)return false;for(let p=node;p&&p!==doc;p=p.parentElement){if(p.hidden||p.getAttribute?.('aria-hidden')==='true')return false;}return !root.getComputedStyle||root.getComputedStyle(node).display!=='none';};
 function semantic(node){
  if(!node)return null;
  if(node.id==='speed'||node.id==='playbackSpeed')return String(node.value);
  if(node.id==='viewLabelMode')return attr(node,'data-mode');
  if(pressed.has(node.id))return attr(node,'aria-pressed');
  if(node.id==='notationInverse')return String(!!node.checked);
  if(node.id==='ringPanelToggle'||node.id==='ringPanelHide')return String(!doc.body.classList.contains('rings-collapsed')&&!doc.body.classList.contains('rings-unavailable'));
  if(node.id==='guidePanelToggle'||node.id==='viewActionsToggle')return attr(node,'aria-expanded');
  return null;
 }
 function accent(node){
  if(!visible(node)||timers.has(node))return false;
  node.classList.add('puzzle-feedback');
  const finish=()=>{node.classList.remove('puzzle-feedback');timers.delete(node);};
  if(root.setTimeout)timers.set(node,root.setTimeout(finish,520));else finish();
  return true;
 }
 function check(node){
  if(!node)return false;const next=semantic(node);if(next===null)return false;
  const previous=states.get(node);states.set(node,next);
  return previous!==undefined&&previous!==next?accent(node):false;
 }
 function mirrorCallout(){
  const node=get('mirrorMode');
  if(node&&root.PUZZLE_API?.puzzle!=='homer'&&visible(node)&&!seenMirror.has(node)){seenMirror.add(node);accent(node);}
 }
 function pulse(value){
  const node=typeof value==='string'?get(value):value;if(!node||semantic(node)===null)return false;
  const changed=check(node);
  // Some engine callbacks announce a setting just before updating its DOM.
  // Recheck once after that task; never accent an unchanged setting.
  if(!deferred.has(node)){deferred.add(node);Promise.resolve().then(()=>{deferred.delete(node);check(node);});}
  return changed;
 }
 function refresh(){for(const node of doc.querySelectorAll(selector))check(node);}
 root.PuzzleFeedback=Object.freeze({pulse,refresh});
 for(const node of doc.querySelectorAll(selector)){const value=semantic(node);if(value!==null)states.set(node,value);}
 if(root.MutationObserver&&doc.body)new root.MutationObserver(records=>{
  const changed=new Set();
  for(const record of records){const node=control(record.target);if(node)changed.add(node);if(record.type==='childList')for(const child of record.addedNodes||[]){if(child.matches?.(selector))changed.add(child);for(const item of child.querySelectorAll?.(selector)||[])changed.add(item);}}
  for(const node of changed)check(node);
  // Range.value is a property. Its accompanying caption and reset callbacks
  // provide the event boundary; equal assignments and busy captions stay quiet.
  for(const id of ['speed','mirrorMode','ringPanelToggle','ringPanelHide'])check(get(id));
  mirrorCallout();
 }).observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','aria-expanded','data-mode','hidden','value','checked']});
 for(const event of ['click','input','change'])doc.addEventListener?.(event,e=>{const node=control(e.target);if(node)pulse(node);if(root.setTimeout)root.setTimeout(()=>{if(node)check(node);check(get('speed'));},0);},true);
 if(root.setTimeout)root.setTimeout(mirrorCallout,180);
})(window);
