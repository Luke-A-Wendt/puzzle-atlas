'use strict';
// Compatibility entry: face grouping is now carried by intersecting transport
// rings, not by independent panels or an isolated control dial.
const fs=require('node:fs'),path=require('node:path'),suite=require('./connected-ring-maps.test.cjs');
let checked=0;for(const [file,types]of suite.sets){const full=path.join(__dirname,'../dist/games',file+'.js');if(!fs.existsSync(full))continue;const E=require(full);for(const type of types)checked+=suite.verifyModel(E,type);}
console.log(checked+' independently checked connected-map animation incidences.');
