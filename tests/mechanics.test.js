import test from 'node:test';
import assert from 'node:assert/strict';
import '../engine.js';import '../mechanics.js';
const M=globalThis.SpinOutMechanics,E=globalThis.SpinOutEngine;
const qs=(state,n)=>Array.from({length:n},(_,i)=>state>>i&1?0:3);
const near=(a,b)=>assert(Math.abs(a-b)<.003,`${a} != ${b}`);

test('shared geometry: equal circular radii, pitch, first disk straight edge and rail locations',()=>{
  near(M.D,Math.SQRT2*M.R);near(M.A,M.R/Math.sqrt(2));
  const regular=M.outline(),first=M.outline(true);
  assert(regular.some(p=>p.y>-M.A+.1&&p.y<0));assert.equal(first[0].y,-M.A);assert.equal(first[1].y,-M.A);
  assert(M.diskPath(true).includes('L '));assert(M.diskPath(false).includes('A '));
  const r=M.railPaths(7);assert(r.top.includes(String(M.WINDOW+M.A)));assert(r.bottom.includes(String(M.WINDOW-M.D-M.A)));
});
for(let n=3;n<=8;n++)test(`${n} disks: all canonical states, real gate travel + neighbor collision reproduce reference graph`,()=>{
  for(let state=0;state<1<<n;state++){
    const q=qs(state,n);assert.equal(M.contact(q,0),null);
    const first=q.findIndex(v=>v===0),limit=first<0?M.exit(n):(first+1)*M.D;
    const moved=M.slide(q,0,M.exit(n));near(moved.travel,limit);
    if(first>=0){assert.equal(moved.hit.kind,'bottom');assert.equal(moved.hit.disk,first);assert(moved.hit.point.x>=0);}
    for(let i=0;i<n;i++){
      const move=M.slide(q,0,i*M.D),reached=Math.abs(move.travel-i*M.D)<.003;
      const rot=reached?M.rotation(q,i*M.D,i,q[i]===0?-1:1):{ok:false};
      assert.equal(reached&&rot.ok,E.canTurn(state,i),`state ${state}, disk ${i+1}`);
    }
  }
});
test('window position is physical: arbitrary intermediate positions block turning; continuous dragging stops on contact',()=>{
  const q=[0,0,0];
  const closed=M.slide(q,0,-M.D);assert(closed.blocked);assert.equal(closed.hit.kind,'end');assert.equal(closed.hit.part,'carrier');near(closed.travel,0);
  for(const t of [M.D*.25,M.D*.5,M.D*.75])assert.equal(M.rotation(q,t,0,-1).ok,false);
  const moved=M.slide(q,0,9*M.D);near(moved.travel,M.D);assert(moved.hit);
  near(M.slide(q,moved.travel,0).travel,0);
  assert.equal(M.rotation(q,0,0,1).ok,true);
  q[0]=1;const next=M.rotation(q,M.D,1,-1);assert.equal(next.ok,false,'first straight edge blocks the next disk');
  assert.equal(next.hit.kind,'disk');
});
test('no binary guard: outside disks can make extra quarter turns; their collisions still count',()=>{
  const q=[3,3,3];const t=4*M.D;assert.equal(M.contact(q,t),null);
  const a=M.rotation(q,t,0,-1);assert.equal(a.ok,true);q[0]=a.next;assert.equal(q[0],2);
  assert.equal(M.canonical(q),false);
  const move=M.slide(q,t,0);assert(move.blocked);assert(move.travel>0);
});
test('reference demonstration executes real slide/rotation checks and reaches fully extracted goal, with reversible actions',()=>{
  for(let n=3;n<=8;n++){
    const q=Array(n).fill(0),plan=M.referencePlan(q,0);assert(plan);
    assert.equal(plan.filter(s=>s.type==='turn').length,[5,10,21,42,85,170][n-3]);
    let t=0;const trail=[];
    for(const step of plan){trail.push({q:[...q],t});
      if(step.type==='slide'){const m=M.slide(q,t,step.travel);near(m.travel,step.travel);assert(!m.blocked);t=m.travel;}
      else{const r=M.rotation(q,t,step.i,step.dir);assert(r.ok);q[step.i]=r.next;}
    }
    near(t,M.exit(n));assert.equal(M.contact(q,t),null);
    for(let i=plan.length-1;i>=0;i--){const step=plan[i],old=trail[i];
      if(step.type==='slide'){const m=M.slide(q,t,old.t);near(m.travel,old.t);t=m.travel;}
      else{const r=M.rotation(q,t,step.i,-step.dir);assert(r.ok);q[step.i]=r.next;}
      assert.deepEqual(q,old.q);near(t,old.t);
    }
  }
});

test('4-direction 0-1 search produces reversible physically checked plans; does not force 85 rotations',()=>{
  for(let n=3;n<=8;n++){
    const q=Array(n).fill(0),found=M.shortestPlan(q,0);assert(found);
    assert.equal(found.count,[5,10,21,42,54,55][n-3]);
    let t=0,count=0;const trail=[];
    for(const step of found.route){trail.push({q:[...q],t});
      if(step.type==='slide'){const m=M.slide(q,t,step.travel);assert(!m.blocked);near(m.travel,step.travel);t=m.travel;}
      else{const r=M.rotation(q,t,step.i,step.dir);assert(r.ok);q[step.i]=r.next;count++;}
    }
    near(t,M.exit(n));assert.equal(count,found.count);
    for(let k=found.route.length-1;k>=0;k--){const step=found.route[k],old=trail[k];
      if(step.type==='slide'){const m=M.slide(q,t,old.t);assert(!m.blocked);t=m.travel;}
      else{const r=M.rotation(q,t,step.i,-step.dir);assert(r.ok);q[step.i]=r.next;}
      near(t,old.t);assert.deepEqual(q,old.q);
    }
  }
});

test('independent Dijkstra search agrees with 0-1 BFS on small full mechanical graphs',()=>{
  for(let n=3;n<=4;n++){
    const stride=n+4,dist=new Map([[0,0]]),pending=[[0,0]],done=new Set();let answer;
    function relax(key,cost){if(cost<(dist.get(key)??Infinity)){dist.set(key,cost);pending.push([key,cost]);}}
    while(pending.length){
      pending.sort((a,b)=>b[1]-a[1]);const [key,cost]=pending.pop();if(done.has(key))continue;done.add(key);
      const slot=key%stride,code=Math.floor(key/stride),q=Array.from({length:n},(_,i)=>Math.floor(code/4**i)%4);
      if(slot===n+3){answer=cost;break;}
      for(const next of [slot-1,slot+1])if(next>=0&&next<=n+3&&!M.slide(q,slot*M.D,next*M.D).blocked)relax(code*stride+next,cost);
      for(let i=0;i<n;i++)for(const dir of [-1,1]){const r=M.rotation(q,slot*M.D,i,dir);if(r.ok)relax((code+(r.next-q[i])*4**i)*stride+slot,cost+1);}
    }
    assert.equal(answer,M.shortestPlan(Array(n).fill(0),0).count);
  }
});

test('independent dense radial boundary sampling finds no penetration along the seven-disc shortcut',()=>{
  const n=7,q=Array(n).fill(0),found=M.shortestPlan(q,0);let travel=0;
  function radial(first,theta){
    let radius=M.R;
    for(const [cx,cy] of [[M.D,0],[-M.D,0],...(first?[]:[[0,-M.D]])]){
      const projection=cx*Math.cos(theta)+cy*Math.sin(theta),disc=projection**2-(cx*cx+cy*cy-M.R*M.R);
      if(projection>0&&disc>=0)radius=Math.min(radius,projection-Math.sqrt(disc));
    }
    if(first&&Math.sin(theta)<0)radius=Math.min(radius,-M.A/Math.sin(theta));
    return radius;
  }
  for(const step of found.route){
    if(step.type==='slide'){travel=step.travel;continue;}
    const i=step.i;
    for(let deg=0;deg<=90;deg+=3)for(let polar=0;polar<360;polar+=2){
      const theta=polar*Math.PI/180,r=radial(i===0,theta),a=theta+(q[i]*90+deg*step.dir)*Math.PI/180;
      const p={x:M.center(i,travel)+r*Math.cos(a),y:r*Math.sin(a)};
      assert.equal(M.railHit(p,n),null,`disk ${i+1}, angle ${deg}, boundary ${polar}`);
      for(const j of [i-1,i+1])if(j>=0&&j<n)assert(!M.inDisk(p,j,travel,q[j]),`neighbor collision disk ${i+1}, angle ${deg}`);
    }
    q[i]=(q[i]+step.dir+4)%4;
  }
});

test('integer snap across all reference states chooses the closest reachable station without tunneling',()=>{
  for(let n=3;n<=8;n++)for(let state=0;state<1<<n;state++){
    const q=qs(state,n),first=q.findIndex(v=>v===0),limit=first<0?n+3:first+1;
    for(const fraction of [.37,.62,Math.max(0,limit-.49),Math.max(0,limit-.51)]){
      const preview=M.slide(q,0,Math.min(fraction,limit)*M.D).travel,result=M.snap(q,preview);assert(result);
      assert.equal(result.slot,Math.round(preview/M.D));near(result.travel,result.slot*M.D);
      assert(!M.slide(q,preview,result.travel).blocked);assert(!M.slide(q,0,result.travel).blocked);
    }
  }
});

test('cleared carrier has a zero-rotation empty plan, not the initial seven-disc count of 54',()=>{
  const initial=M.shortestPlan(Array(7).fill(0),0);assert.equal(initial.count,54);
  const q=Array(7).fill(0);let travel=0;
  for(const step of initial.route){if(step.type==='slide')travel=step.travel;else q[step.i]=(q[step.i]+step.dir+4)%4;}
  assert(M.isCleared(q,travel));assert(!M.isCleared(q,travel-M.D));
  const done=M.shortestPlan(q,travel);assert.equal(done.count,0);assert.deepEqual(done.route,[]);
});
