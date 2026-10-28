import test from 'node:test';
import assert from 'node:assert/strict';
import '../engine.js';
const { initial, canTurn, turn, solve } = globalThis.SpinOutEngine;
import { recordVisit } from '../access.js';
// Independent oracle: reflected Gray-code sequence, without using the move predicate.
function graySequence(n) { let a = [0]; for (let k = 0; k < n; k++) a = a.concat([...a].reverse().map(s => s + 2 ** k)); return a; }
for (let n = 3; n <= 8; n++) {
  test(`${n} disks: exhaustive rules, shortest BFS, hints, undo`, () => {
    const gray = graySequence(n), index = new Map(gray.map((s, i) => [s, i]));
    assert.equal(solve(initial(n), n).length, [5,10,21,42,85,170][n - 3]);
    for (let s = 0; s <= initial(n); s++) {
      const p = index.get(s), expected = [gray[p - 1], gray[p + 1]].filter(x => x !== undefined).sort((a,b)=>a-b);
      const actual = [];
      for (let i = 0; i < n; i++) {
        const t = turn(s, i, n);
        assert.equal(canTurn(s, i), i === 0 || ((s >> (i-1) & 1) === 1 && Array.from({length:i-1},(_,j)=>s>>j&1).every(x=>x===0)));
        if (t !== s) { actual.push(t); assert.equal(turn(t,i,n),s); }
      }
      assert.deepEqual(actual.sort((a,b)=>a-b), expected);
      const path = solve(s,n); assert.equal(path.length,p);
      let current = s; const stack = [];
      for (const i of path) { stack.push(current); assert(canTurn(current,i)); current = turn(current,i,n); }
      assert.equal(current,0);
      for (const i of path.toReversed ? path.toReversed() : [...path].reverse()) { current = turn(current,i,n); assert.equal(current,stack.pop()); }
      assert.equal(current,s);
    }
    assert.equal(turn(initial(n),-1,n),initial(n)); assert.equal(turn(initial(n),n,n),initial(n));
  });
}
test('standard seven-disc known recursive solution, 85 quarter-turns', () => {
  function recursive(n) { if(n===0)return []; if(n===1)return [0]; return [...recursive(n-2),n-1,...recursive(n-2).reverse(),...recursive(n-1)]; }
  assert.deepEqual(solve(127,7),recursive(7));
  assert.equal(solve(127,7)[0],0);
});
test('access: opt-in, duplicate protection and failure isolation', async () => {
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}; let calls=0;
  await recordVisit({enabled:false,record:()=>calls++},storage); assert.equal(calls,0);
  const config={enabled:true,record:async()=>{calls++;throw Error('offline');}};
  await recordVisit(config,storage); await recordVisit(config,storage); assert.equal(calls,1);
  await recordVisit(config,{getItem(){throw Error('storage blocked');}}); assert.equal(calls,1);
});
