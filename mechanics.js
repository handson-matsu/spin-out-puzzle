// Shared drawing/collision geometry. Coordinates are normalized, not measured millimetres.
(() => {
'use strict';
const R=40, A=R/Math.sqrt(2), D=2*A, WINDOW=3*D, EPS=1e-6, N=24;
const cache=new Map(),solutions=new Map();
const point=(r,a)=>({x:r*Math.cos(a),y:r*Math.sin(a)});
function arc(cx,cy,start,end,count=N) {
  return Array.from({length:count+1},(_,i)=>{const p=point(R,(start+(end-start)*i/count)*Math.PI/180);return {x:cx+p.x,y:cy+p.y};});
}
function outline(first=false) {
  return [
    ...(first ? [{x:-A,y:-A},{x:A,y:-A}] : arc(0,-D,135,45)),
    ...arc(D,0,225,135).slice(1),
    ...arc(0,0,45,135).slice(1),
    ...arc(-D,0,45,-45).slice(1)
  ];
}
const shapes=[outline(true),outline(false)];
const width=n=>WINDOW+(n-1)*D+R+12;
const exit=n=>(n+3)*D;
const center=(i,travel)=>WINDOW+i*D-travel;
function transformed(i,travel,q,angle=q*90) {
  const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=center(i,travel);
  return shapes[i===0?0:1].map(p=>({x:x+p.x*c-p.y*s,y:p.x*s+p.y*c}));
}
function rails(n) {
  const w=width(n),s=WINDOW-D;
  return {
    top:[{x:0,y:-85},{x:w,y:-85},{x:w,y:-A},...arc(WINDOW,0,315,225),{x:0,y:-A}],
    bottom:[{x:0,y:A},...arc(s,0,135,90,N/2),{x:w,y:R},{x:w,y:85},{x:0,y:85}],
    end:[{x:w,y:-85},{x:w+12,y:-85},{x:w+12,y:85},{x:w,y:85}]
  };
}
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function inside(p,poly) {
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[j],b=poly[i];
    if(Math.abs(cross(a,b,p))<EPS && p.x>=Math.min(a.x,b.x)-EPS && p.x<=Math.max(a.x,b.x)+EPS && p.y>=Math.min(a.y,b.y)-EPS && p.y<=Math.max(a.y,b.y)+EPS)return false;
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  } return yes;
}
function bounds(poly) {return {l:Math.min(...poly.map(p=>p.x)),r:Math.max(...poly.map(p=>p.x)),t:Math.min(...poly.map(p=>p.y)),b:Math.max(...poly.map(p=>p.y))};}
function overlap(a,b) {
  const aa=bounds(a),bb=bounds(b);
  if(aa.r<=bb.l+EPS||aa.l>=bb.r-EPS||aa.b<=bb.t+EPS||aa.t>=bb.b-EPS)return null;
  for(const p of a)if(inside(p,b))return p;
  for(const p of b)if(inside(p,a))return p;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++) {
    const p=a[i],q=a[(i+1)%a.length],u=b[j],v=b[(j+1)%b.length];
    if(Math.max(p.x,q.x)<Math.min(u.x,v.x)||Math.max(u.x,v.x)<Math.min(p.x,q.x)||Math.max(p.y,q.y)<Math.min(u.y,v.y)||Math.max(u.y,v.y)<Math.min(p.y,q.y))continue;
    if(cross(p,q,u)*cross(p,q,v)<-EPS && cross(u,v,p)*cross(u,v,q)<-EPS) {
      const t=cross(u,v,p)/(cross(u,v,p)-cross(u,v,q));return {x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)};
    }
  } return null;
}
function inDisk(p,i,travel,q,angle=q*90) {
  const a=-angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=p.x-center(i,travel);
  const x=dx*c-p.y*s,y=dx*s+p.y*c;
  if(x*x+y*y>=R*R-EPS)return false;
  if(i===0 ? y < -A+EPS : x*x+(y+D)*(y+D)<R*R+EPS)return false;
  return (x-D)*(x-D)+y*y>R*R+EPS && (x+D)*(x+D)+y*y>R*R+EPS;
}
function railHit(p,n) {
  const w=width(n),stop=WINDOW-D;
  if(p.x>=w-EPS && p.x<w+12 && Math.abs(p.y)<85)return 'end';
  if(p.x<0||p.x>w)return null;
  const dx=p.x-WINDOW;
  const top=Math.abs(dx)<A ? -Math.sqrt(R*R-dx*dx) : -A;
  if(p.y<top-EPS)return 'top';
  const d=p.x-stop;
  const bottom=d < -A ? A : d<0 ? Math.sqrt(R*R-d*d) : R;
  if(p.y>bottom+EPS)return 'bottom';
  return null;
}
function contact(qs,travel,only=-1,angle) {
  const indices=only<0?qs.map((_,i)=>i):[only];
  for(const i of indices) {
    const shape=transformed(i,travel,qs[i],i===only?angle:undefined);
    for(const p of shape) {const part=railHit(p,qs.length);if(part)return {kind:part,disk:i,point:p};}
    if(only>=0)for(const j of [i-1,i+1])if(j>=0&&j<qs.length) {
      for(const p of shape)if(inDisk(p,j,travel,qs[j]))return {kind:'disk',disk:i,other:j,point:p};
      for(const p of transformed(j,travel,qs[j]))if(inDisk(p,i,travel,qs[i],angle))return {kind:'disk',disk:i,other:j,point:p};
    }
  }
  return null;
}
const diskPath=first=>`M ${-A} ${-A} ${first ? `L ${A} ${-A}` : `A ${R} ${R} 0 0 0 ${A} ${-A}`} A ${R} ${R} 0 0 0 ${A} ${A} A ${R} ${R} 0 0 1 ${-A} ${A} A ${R} ${R} 0 0 0 ${-A} ${-A} Z`;
function railPaths(n) {
  const w=width(n),s=WINDOW-D;
  return {top:`M 0 -85 H ${w} V ${-A} H ${WINDOW+A} A ${R} ${R} 0 0 0 ${WINDOW-A} ${-A} H 0 Z`,
    bottom:`M 0 ${A} H ${s-A} A ${R} ${R} 0 0 0 ${s} ${R} H ${w} V 85 H 0 Z`,
    end:`M ${w} -85 H ${w+12} V 85 H ${w} Z`};
}
function rotation(qs,travel,i,dir) {
  if(!Number.isInteger(i)||i<0||i>=qs.length||![1,-1].includes(dir))throw Error('Invalid rotation');
  const key=[qs.length,i,qs[i-1],qs[i],qs[i+1],Math.round(travel*100000),dir].join(':');
  if(cache.has(key))return cache.get(key);
  let result={ok:true,next:(qs[i]+dir+4)%4};
  // Check the actual drawn polygon at each degree, including both endpoints.
  for(let step=0;step<=90;step++) {
    const hit=contact(qs,travel,i,qs[i]*90+dir*step);
    if(hit){result={ok:false,hit,angle:qs[i]*90+dir*Math.max(0,step-1)};break;}
  }
  if(cache.size>12000)cache.clear();cache.set(key,result);return result;
}
function slide(qs,from,to) {
  const target=Math.max(0,Math.min(exit(qs.length),to));
  const count=Math.max(1,Math.ceil(Math.abs(target-from)/2));let last=from;
  for(let k=1;k<=count;k++) {
    const next=from+(target-from)*k/count,hit=contact(qs,next);
    if(hit) {
      let good=last,bad=next;
      for(let z=0;z<18;z++){const m=(good+bad)/2;if(contact(qs,m))bad=m;else good=m;}
      return {travel:good,hit:contact(qs,bad)||hit,blocked:true};
    }
    last=next;
  }
  return {travel:target,hit:to<0?{kind:'end',part:'carrier',disk:qs.length-1,point:{x:width(qs.length),y:0}}:null,blocked:to<0};
}
// Resting slide positions are integer multiples of D. The sweep is still
// continuous: never snap through a rail or a neighboring blocked interval.
function snap(qs,from,desired=from) {
  const limit=qs.length+3,target=Math.max(0,Math.min(exit(qs.length),desired));
  const slots=Array.from({length:limit+1},(_,k)=>k).sort((a,b)=>Math.abs(a*D-target)-Math.abs(b*D-target)||b-a);
  for(const slot of slots){const result=slide(qs,from,slot*D);if(!result.blocked)return {travel:slot*D,slot};}
  return null;
}
function isCleared(qs,travel) {
  return travel>=exit(qs.length)-.002 && width(qs.length)-travel<0 && qs.every((_,i)=>center(i,travel)+R<0);
}
const path=poly=>'M '+poly.map(p=>`${p.x.toFixed(5)},${p.y.toFixed(5)}`).join(' L ')+' Z';
const canonical=qs=>qs.every(q=>q===0||q===3);
const binary=qs=>qs.reduce((s,q,i)=>s|((q===0?1:0)<<i),0);
// Reference plan is verified mechanically at every slide and turn. It is not a
// claim about shortest paths when arbitrary out-of-case rotations are admitted.
function referencePlan(qs,travel) {
  if(!canonical(qs))return null;
  const copy=[...qs],plan=[];let p=travel;
  for(const i of globalThis.SpinOutEngine.solve(binary(qs),qs.length)) {
    const destination=i*D,move=slide(copy,p,destination);
    if(Math.abs(move.travel-destination)>.002)return null;
    if(Math.abs(p-destination)>.002)plan.push({type:'slide',travel:destination});
    p=destination;
    const dir=copy[i]===0?-1:1,result=rotation(copy,p,i,dir);
    if(!result.ok)return null;
    copy[i]=result.next;plan.push({type:'turn',i,dir});
  }
  const last=slide(copy,p,exit(copy.length));
  if(Math.abs(last.travel-exit(copy.length))>.002)return null;
  plan.push({type:'slide',travel:exit(copy.length)});return plan;
}
// 0-1 BFS: a quarter-turn costs one, a traversable slide edge costs zero.
// The search graph uses pitch-spaced slide stations. Drag previews are continuous; released positions snap to stations.
function* planSearch(qs,travel,maxNodes=20000) {
  if(isCleared(qs,travel))return {route:[],count:0,expanded:0,scope:'pitch-stations'};
  const memoKey=qs.join('')+':'+travel.toFixed(5)+':'+maxNodes;
  if(solutions.has(memoKey)){const saved=solutions.get(memoKey);return {...saved,route:[...saved.route]};}
  const n=qs.length,stride=n+4,codeOf=q=>q.reduce((s,v,i)=>s+v*4**i,0);
  const code=codeOf(qs),dist=new Map(),parent=new Map(),done=new Set(),deque=new Map();let head=0,tail=0,expanded=0;
  const put=(key,d,previous,step,zero)=>{
    if(d>=(dist.get(key)??Infinity))return;
    dist.set(key,d);parent.set(key,{previous,step});
    if(zero)deque.set(--head,key);else deque.set(tail++,key);
  };
  for(let slot=0;slot<=n+3;slot++) {
    const target=slot*D,m=slide(qs,travel,target);
    if(!m.blocked)put(code*stride+slot,0,null,Math.abs(target-travel)>.002?{type:'slide',travel:target}:null,false);
  }
  while(head<tail) {
    const key=deque.get(head);deque.delete(head++);if(done.has(key))continue;done.add(key);
    const count=dist.get(key),slot=key%stride,code=Math.floor(key/stride);
    if(slot===n+3) {
      const route=[];let cursor=key;
      while(cursor!==null){const p=parent.get(cursor);if(p.step)route.push(p.step);cursor=p.previous;}
      route.reverse();const compact=[];
      for(const step of route){if(step.type==='slide'&&compact.at(-1)?.type==='slide')compact[compact.length-1]=step;else compact.push(step);}
      const result={route:compact,count,expanded,scope:'pitch-stations'};
      if(solutions.size>256)solutions.clear();solutions.set(memoKey,result);return {...result,route:[...compact]};
    }
    if(++expanded>maxNodes)return null;
    if(expanded%64===0)yield expanded;
    const q=Array.from({length:n},(_,i)=>Math.floor(code/4**i)%4),p=slot*D;
    for(const next of [slot-1,slot+1])if(next>=0&&next<=n+3){
      const m=slide(q,p,next*D);if(!m.blocked)put(code*stride+next,count,key,{type:'slide',travel:next*D},true);
    }
    for(let i=0;i<n;i++)for(const dir of [-1,1]){
      const r=rotation(q,p,i,dir);
      if(r.ok)put((code+(r.next-q[i])*4**i)*stride+slot,count+1,key,{type:'turn',i,dir},false);
    }
  }
  return null;
}
function shortestPlan(qs,travel,maxNodes=20000) {
  const search=planSearch(qs,travel,maxNodes);let item;
  do{item=search.next();}while(!item.done);return item.value;
}
globalThis.SpinOutMechanics=Object.freeze({R,A,D,WINDOW,EPS,width,exit,center,outline,transformed,rails,path,diskPath,railPaths,overlap,inDisk,railHit,contact,rotation,slide,snap,isCleared,canonical,binary,referencePlan,shortestPlan,planSearch});
})();
