/* Docking is a mechanical setup phase: colors stay still until cuts align. */
(function(root){
 'use strict';
 const shared=root.ShapeRings;
 root.ShapeRings=Object.freeze({...shared,create(model){
  const map=shared.create(model);
  if(model.type!=='ghost')return map;
  const render=map.render;
  return {...map,render(ctx,options={}){
   const animation=options.animation?{...options.animation,progress:model.animationPlan(options.animation).turn}:null;
   return render(ctx,{...options,animation});
  }};
 }});
})(typeof globalThis!=='undefined'?globalThis:this);
