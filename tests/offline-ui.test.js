import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers/offline-dom.js';

test('offline UI: immediate startup, rotation, rail contact marker, hints, Undo',async()=>{
  const {get,advance,disk}=await load();
  assert.equal(get('moves').textContent,'0');assert.equal(get('minimum'),undefined);assert.equal(get('discs').children.length,7);
  disk(6).fire('click');assert.equal(get('moves').textContent,'0');assert.match(get('message').textContent,/レール/);
  assert(get('contact').children.length>0);assert(get('rail-top').classes.has('collision'));
  get('hint').fire('click');assert.equal(get('moves').textContent,'0');assert(get('discs').children.some(d=>d.classes.has('hinted')));
  disk(0).fire('click');assert.equal(get('moves').textContent,'1');assert.equal(get('remaining'),undefined);
  assert.equal(disk(0).querySelector('.rotor').style.transform,'rotate(-90deg)');
  disk(0).fire('click');assert.equal(get('moves').textContent,'1');
  advance(340);get('undo').fire('click');assert.equal(get('moves').textContent,'0');advance(340);
  assert.equal(disk(0).querySelector('.rotor').style.transform,'rotate(0deg)');
});
test('offline UI: drag stops at real lower gate; Undo restores slide and rotation independently',async()=>{
  const {get,advance,disk}=await load();
  get('slideIn').fire('click');assert.match(get('message').textContent,/台の奥端/);assert(get('rail-end').classes.has('collision'));
  get('handle').fire('pointerdown',{pointerId:1,clientX:200});
  get('mechanism').fire('pointermove',{pointerId:1,clientX:-600});
  assert.match(get('message').textContent,/ストッパー/);assert(get('rail-bottom').classes.has('collision'));
  get('mechanism').fire('pointerup',{pointerId:1});
  assert.equal(get('moves').textContent,'0');assert.equal(get('position').textContent,'回転窓に円盤2');
  const moved=get('slide').attributes.transform;get('undo').fire('click');advance(340);assert.notEqual(get('slide').attributes.transform,moved);
  disk(0).fire('click');advance(340);get('slideOut').fire('click');advance(340);
  get('undo').fire('click');advance(340);assert.equal(get('moves').textContent,'1');
  get('undo').fire('click');advance(340);assert.equal(get('moves').textContent,'0');
});
test('offline UI: autoplay 3–8 disks includes sliding and clears only after full extraction; Undo after clear',async()=>{
  for(let n=3;n<=8;n++){
    const {get,advance}=await load();get('count').value=String(n);get('count').fire('change');advance(0);
    const minimum=globalThis.SpinOutMechanics.shortestPlan(Array(n).fill(0),0).count;get('auto').fire('click');advance((minimum*2+5)*450);
    assert.equal(get('moves').textContent,String(minimum));assert.equal(get('remaining'),undefined);assert.equal(get('clearBanner').hidden,false);
    assert(get('slide').classes.has('escaped'));assert.match(get('message').textContent,/クリア/);
    assert.equal(get('auto').disabled,true);
    get('undo').fire('click');advance(340);assert(!get('slide').classes.has('escaped'));assert.equal(get('moves').textContent,String(minimum),'last action is extraction, not a rotation');
    assert.equal(get('auto').disabled,false);
  }
});
test('offline UI: alternate directions are not forced to binary; demonstration can recover, stop and reset',async()=>{
  const {get,advance,disk}=await load();
  get('rotateRight').fire('click');advance(340);assert.equal(get('moves').textContent,'1');
  get('studyMode').fire('click');assert.equal(get('study').hidden,false);assert.match(get('binary').textContent,/左/);
  get('hint').fire('click');assert.match(get('message').textContent,/最少ルート/);assert.equal(get('moves').textContent,'1');
  get('auto').fire('click');advance(340);get('auto').fire('click');advance(2000);assert.equal(get('moves').textContent,'2');
  get('auto').fire('click');get('reset').fire('click');advance(2000);assert.equal(get('moves').textContent,'0');
  get('speed').value='900';get('speed').fire('input');assert.equal(get('speedValue').textContent,'0.90 秒 / 操作');
  get('playMode').fire('click');assert.equal(get('study').hidden,true);
});
