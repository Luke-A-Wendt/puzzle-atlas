/* Local, reversible move journal. Each entry is a committed legal turn.
 * The cursor points between turns; replay never adds a second copy of a turn.
 * Solver chunks share an explicit sequence so transport follows solve stages,
 * not the worker's implementation-sized playback batches. */
(function(root){
'use strict';
let api=null,entries=[],raw=[],cursor=0,serial=0,group=null,openGroup=null,replay=null,launching=false,marked=null,engineSequence=false;
const buttons={};
const el=id=>root.document.getElementById(id);
const clone=m=>({...m});
const countTurn=source=>source==='manual'||source==='algorithm'?1:0;
function newGroup(name){return {id:++serial,name:String(name||'Moves').slice(0,120),labelled:false,seed:null,rawLabel:null,seedElement:null};}
function element(tag,cls,text){const n=root.document.createElement(tag);n.className=cls;n.textContent=text||'';return n;}
function appendGroup(name,seed){el('log').appendChild(element('div','log-label',name));if(seed)el('log').appendChild(element('div','journal-seed','Randomize seed: '+seed));}
function rawLabel(entry){return entry.name+(entry.seed?'\nRandomize seed: '+entry.seed:'');}
function currentMark(){marked?.classList.remove('current');marked=cursor>0?entries[cursor-1]?.element:null;marked?.classList.add('current');}
function appendEntry(entry,index){
 const node=element('span','move'+(index>=cursor?' future':''));node.setAttribute('title',entry.name+(index>=cursor?' · not currently applied':''));
 node.append(element('span','move-index',String(index+1)),root.document.createTextNode(api?.moveLabel?.(entry.move)||entry.move.face));
 entry.element=node;el('log').appendChild(node);
}
function rebuild(){
 const log=el('log');log.replaceChildren();let prior=null;
 for(let i=0;i<entries.length;i++){const e=entries[i];if(e.labelled&&prior!==e.group){appendGroup(e.name,e.seed);prior=e.group;}appendEntry(e,i);}
 currentMark();
}
function truncate(){
 if(cursor===entries.length)return;
 // A new turn from the middle of a recorded sequence creates a branch. Keep
 // the committed prefix as its own named sequence and discard only the future.
 if(cursor>0&&entries[cursor-1].group===entries[cursor].group){const id=entries[cursor-1].group,name=entries[cursor-1].name.replace(/ · split$/,'')+' · split';for(let i=0;i<cursor;i++)if(entries[i].group===id){entries[i].name=name;entries[i].labelled=true;}}
 entries.length=cursor;raw.length=0;let prior=null;
 for(const e of entries){if(e.labelled&&prior!==e.group){raw.push({label:rawLabel(e)});prior=e.group;}raw.push({move:clone(e.move),source:e.source});}
 rebuild();
}
function label(name){
 if(replay)return raw;
 el('journalActivity').textContent='';truncate();group=openGroup||newGroup(name);
 if(!group.labelled){if(!entries.length)el('log').replaceChildren();group.rawLabel={label:group.name};raw.push(group.rawLabel);appendGroup(group.name,group.seed);group.labelled=true;}
 return raw;
}
function setSeed(seed){
 if(replay||!group||!group.labelled)return false;
 group.seed=String(seed);if(group.rawLabel)group.rawLabel.label=rawLabel(group);
 if(group.seedElement)group.seedElement.textContent='Randomize seed: '+group.seed;
 else{group.seedElement=element('div','journal-seed','Randomize seed: '+group.seed);el('log').appendChild(group.seedElement);}
 return true;
}
function record(move,source){
 if(source==='journal-undo'||source==='journal-redo'){
  if(!replay)throw Error('Journal replay lost its cursor');
  const index=replay.direction<0?cursor-1:cursor;const entry=entries[index];
  if(!entry)throw Error('Journal cursor is outside its legal replay range');
  cursor+=replay.direction;replay.completed++;
  entry.element?.classList.toggle('future',replay.direction<0);
  entry.element?.setAttribute('title',entry.name+(replay.direction<0?' · not currently applied':''));currentMark();root.PuzzleSolvedProgress?.update?.();return raw;
 }
 el('journalActivity').textContent='';truncate();
 const g=source==='manual'?newGroup('Move '+(api?.moveLabel?.(move)||move.face)):(openGroup||group||newGroup('Moves'));
 const e={move:clone(move),source,group:g.id,name:g.name,labelled:g.labelled,seed:g.seed,element:null};
 entries.push(e);cursor=entries.length;raw.push({move:clone(move),source});
 if(entries.length===1&&!g.labelled)el('log').replaceChildren();
 // The previous mark is the only one that can be current during normal append.
 appendEntry(e,entries.length-1);currentMark();el('log').scrollTop=el('log').scrollHeight;
 if(source==='manual')group=null;
 root.PuzzleSolvedProgress?.update?.();
 return raw;
}
function engineBusy(){if(root.PUZZLE_SOLVER_BRIDGE?.isBusy)return root.PUZZLE_SOLVER_BRIDGE.isBusy();if(!api)return false;const s=api.snapshot();return !!s.animating||!!(s.mode&&s.mode!=='idle');}
function solverBusy(){const ui=root.ConstrainedSolverUI;if(ui?.journalBusy)return ui.journalBusy();if(ui?.autoStopActive?.())return true;const s=ui?.state?.();return !!s&&(!!s.auto||['loading','solving','executing','auto-gap'].includes(s.phase));}
function idle(){return !!api&&!engineBusy()&&!solverBusy()&&!replay;}
function replayTurnDelta(){if(!replay)return 0;const index=replay.direction<0?cursor-1:cursor;return replay.direction*countTurn(entries[index]?.source);}
function startChunk(){
 if(!replay||launching)return false;const job=replay,remaining=Math.abs(job.target-cursor);if(!remaining)return true;
 const length=Math.min(300,remaining),moves=[];
 for(let i=0;i<length;i++){const entry=entries[job.direction<0?cursor-1-i:cursor+i];moves.push(job.direction<0?api.invertMove(entry.move):clone(entry.move));}
 launching=true;job.pending=true;
 let accepted=false;
 try{accepted=api.runMoves(moves,{journalReplay:job.direction<0?'undo':'redo',label:job.name});}
 finally{launching=false;}
 if(!accepted){replay=null;root.PuzzleSolvedProgress?.endSequence?.();el('journalActivity').textContent='Playback unavailable from this position.';sync();return false;}return true;
}
function navigate(direction,sequence){
 if(!idle())return false;direction=direction<0?-1:1;
 if(direction<0?cursor===0:cursor===entries.length)return false;
 const first=entries[direction<0?cursor-1:cursor];let target=cursor+direction;
 if(sequence){while(direction<0?target>0:target<entries.length){const e=entries[direction<0?target-1:target];if(e.group!==first.group)break;target+=direction;}}
 openGroup=null;group=null;
 replay={direction,target,total:Math.abs(target-cursor),completed:0,name:first.name,pending:false};
 if(sequence)root.PuzzleSolvedProgress?.beginSequence?.();
 const accepted=startChunk();sync();return accepted;
}
function stopReplay(){
 if(!replay)return false;const job=replay;replay=null;launching=false;openGroup=null;group=null;
 root.PuzzleSolvedProgress?.endSequence?.();
 el('journalActivity').textContent='Stopped '+(job.direction<0?'undoing ':'redoing ')+job.name+' · '+job.completed+' / '+job.total;
 return true;
}
function sync(){
 if(!api)return;
 // All engine-owned sequences (including randomize and guide algorithms) are
 // one display transaction. Explicit solver groups survive chunk boundaries.
 const snapshot=api.snapshot(), sequenceActive=!!snapshot.mode&&snapshot.mode!=='idle';
 if(sequenceActive&&!engineSequence){engineSequence=true;root.PuzzleSolvedProgress?.beginSequence?.();}
 else if(engineSequence&&!sequenceActive&&!snapshot.animating){engineSequence=false;if(!openGroup&&!replay)root.PuzzleSolvedProgress?.endSequence?.();}
 if(replay&&!launching&&!engineBusy()){
  if(cursor===replay.target){const finished=replay;replay=null;root.PuzzleSolvedProgress?.endSequence?.();el('journalActivity').textContent=(finished.direction<0?'Undid ':'Redid ')+finished.name;api.restorePlaybackDefaults?.({preserveSettings:true});root.PuzzleAxisDisplay?.clear?.();}
  else if(replay.pending){
   // updateUI runs inside finishMove. Wait until its frame has returned before
   // starting the next chunk, otherwise its queue advance overwrites our first turn.
   const job=replay;job.pending=false;root.requestAnimationFrame(()=>{if(replay===job&&!engineBusy())startChunk();});
  }
 }
 const blocked=!idle();
 if(buttons.undoSequence)buttons.undoSequence.title=cursor?'Undo sequence · '+entries[cursor-1].name:'Undo sequence';
 if(buttons.redoSequence)buttons.redoSequence.title=cursor<entries.length?'Redo sequence · '+entries[cursor].name:'Redo sequence';
 for(const id of ['undo','undoSequence'])if(buttons[id])buttons[id].disabled=blocked||cursor===0;
 for(const id of ['redo','redoSequence'])if(buttons[id])buttons[id].disabled=blocked||cursor===entries.length;
 if(replay){el('journalActivity').textContent=(replay.direction<0?'Undoing ':'Redoing ')+replay.name+' · '+replay.completed+' / '+replay.total;el('message').textContent=el('journalActivity').textContent;}
}
function attach(value){
 if(api)return;api=value;
 for(const id of ['undo','undoSequence','redo','redoSequence'])buttons[id]=el(id);
 // The existing Undo handler is retained in each application and calls navigate.
 buttons.undoSequence.addEventListener('click',()=>navigate(-1,true));buttons.redo.addEventListener('click',()=>navigate(1,false));buttons.redoSequence.addEventListener('click',()=>navigate(1,true));sync();root.PuzzleSolvedProgress?.update?.();
}
function reset(){entries=[];raw=[];cursor=0;group=null;openGroup=null;replay=null;launching=false;marked=null;engineSequence=false;el('journalActivity').textContent='';Promise.resolve().then(()=>root.PuzzleSolvedProgress?.endSequence?.());}
function beginSequence(name){if(replay)return false;root.PuzzleSolvedProgress?.beginSequence?.();openGroup=newGroup(name);group=openGroup;return true;}
function endSequence(){root.PuzzleSolvedProgress?.endSequence?.();openGroup=null;if(!engineBusy())group=null;sync();}
root.PuzzleJournal=Object.freeze({attach,label,setSeed,record,reset,sync,navigate,stopReplay,beginSequence,endSequence,replayTurnDelta,isReplaying:()=>!!replay,state:()=>({cursor,total:entries.length,replaying:!!replay,sequence:replay?.name||null,entries:entries.map(e=>({move:clone(e.move),source:e.source,sequence:e.group,name:e.name,seed:e.seed}))})});
})(window);
