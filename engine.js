// Classic script: also runs directly from file:// without module fetches.
(() => {
'use strict';
// Disk 1 is the rightmost disk (least significant bit). 1 = vertical.
const initial = n => (1 << n) - 1;
function canTurn(state, i) {
  return i === 0 || (state & ((1 << i) - 1)) === (1 << (i - 1));
}
function turn(state, i, n) {
  if (!Number.isInteger(i) || i < 0 || i >= n || !canTurn(state, i)) return state;
  return state ^ (1 << i);
}
function solve(state, n) {
  const queue = [0], distance = new Int16Array(1 << n).fill(-1);
  distance[0] = 0;
  for (let k = 0; k < queue.length; k++) {
    const s = queue[k];
    for (let i = 0; i < n; i++) if (canTurn(s, i)) {
      const t = s ^ (1 << i);
      if (distance[t] < 0) { distance[t] = distance[s] + 1; queue.push(t); }
    }
  }
  const path = [];
  while (state) {
    const i = Array.from({ length: n }, (_, i) => i).find(i => canTurn(state, i) && distance[state ^ (1 << i)] === distance[state] - 1);
    path.push(i); state ^= 1 << i;
  }
  return path;
}
const bits = (state, n) => state.toString(2).padStart(n, '0');

globalThis.SpinOutEngine = Object.freeze({ initial, canTurn, turn, solve, bits });
})();
