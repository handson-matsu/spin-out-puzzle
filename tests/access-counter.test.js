import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { load } from './helpers/offline-dom.js';
const source=await readFile(new URL('../access-counter.js',import.meta.url),'utf8');
// Snapshot of the common implementation, verified against three local teaching repos.
const endpoint='https://script.google.com/macros/s/AKfycbxssCIHsD-N97SHxNC_GN0ihYeC0qy-lb-EY0KmSs6Gnztaph1sITMerLVEnNWOGkYc/exec';
const options={method:'GET',mode:'no-cors',cache:'no-store',credentials:'omit',keepalive:true};
function fixture(fetch){
  const ctx=vm.createContext({fetch});ctx.window=ctx;
  Object.defineProperty(ctx,'sessionStorage',{get(){throw Error('file storage blocked');}});
  Object.defineProperty(ctx,'localStorage',{get(){throw Error('storage blocked');}});
  return ctx;
}

test('same common GAS endpoint, app identifier and GET options; once per document even if script runs twice',async()=>{
  const calls=[],ctx=fixture((...args)=>{calls.push(args);return Promise.resolve({type:'opaque',get json(){throw Error('must not read response');}});});
  vm.runInContext(source,ctx);vm.runInContext(source,ctx);await Promise.resolve();
  assert.equal(calls.length,1);assert.equal(calls[0][0],endpoint+'?app=spin-out-puzzle');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])),options);
  assert.equal(ctx.spinOutAccessRecorded,true);
});

test('reload/new tab means a new visit, matching the reference apps',()=>{
  const calls=[];const fetch=(...args)=>{calls.push(args);return Promise.resolve();};
  vm.runInContext(source,fixture(fetch));vm.runInContext(source,fixture(fetch));assert.equal(calls.length,2);
});

test('offline rejection, synchronous failure and missing fetch are isolated, with no retry',async()=>{
  for(const fetch of [()=>Promise.reject(Error('offline')),()=>{throw Error('network blocked');},undefined]){
    let calls=0;const ctx=fixture(fetch?(...args)=>{calls++;return fetch(...args);}:undefined);
    assert.doesNotThrow(()=>vm.runInContext(source,ctx));await Promise.resolve();
    vm.runInContext(source,ctx);await Promise.resolve();assert.equal(calls,fetch?1:0);
  }
});

test('unresolved request cannot hold game initialization; game events never log again',async()=>{
  const ui=await load({accessFetch:()=>new Promise(()=>{})});assert.equal(ui.accessRequests.length,1);
  assert.equal(ui.get('moves').textContent,'0');assert.equal(ui.get('discs').children.length,7);
  ui.disk(0).fire('click');ui.advance(340);assert.equal(ui.get('moves').textContent,'1');
  ui.get('undo').fire('click');ui.advance(340);ui.get('hint').fire('click');
  ui.get('studyMode').fire('click');ui.get('playMode').fire('click');ui.get('reset').fire('click');
  ui.get('count').value='3';ui.get('count').fire('change');
  ui.get('auto').fire('click');ui.advance(10000);assert.equal(ui.get('clearBanner').hidden,false);
  ui.get('clearRestart').fire('click');assert.equal(ui.get('moves').textContent,'0');assert.equal(ui.accessRequests.length,1);
});

test('game rotation, slides, hint, autoplay and clear still work when GAS throws or rejects',async()=>{
  for(const accessFetch of [()=>{throw Error('fetch blocked');},()=>Promise.reject(Error('offline'))]){
    const ui=await load({accessFetch});await Promise.resolve();assert.equal(ui.accessRequests.length,1);
    ui.disk(0).fire('click');ui.advance(340);assert.equal(ui.get('moves').textContent,'1');
    ui.get('undo').fire('click');ui.advance(340);ui.get('slideOut').fire('click');ui.advance(400);
    assert.equal(ui.get('handle').attributes['aria-valuenow'],'1');
    ui.get('reset').fire('click');ui.get('count').value='3';ui.get('count').fire('change');
    ui.get('hint').fire('click');assert.equal(ui.get('moves').textContent,'0');
    ui.get('auto').fire('click');ui.advance(10000);assert.equal(ui.get('clearBanner').hidden,false);assert.equal(ui.accessRequests.length,1);
  }
});
