/* Compatibility entry point for the shared connected rotation-ring atlas. */
(function(root){'use strict';const R=root.ConnectedRings||(typeof require==='function'?require('./connected-rings.js'):null);root.FaceGroupedRings=R;if(typeof module!=='undefined'&&module.exports)module.exports=R;})(typeof globalThis!=='undefined'?globalThis:this);
