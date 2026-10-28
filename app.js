// Plain scripts: supports double-click/file:// with no network requests.
(() => {
'use strict';
const M=globalThis.SpinOutMechanics,E=globalThis.SpinOutEngine,$=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
let n=7,qs=Array(n).fill(0),angles=Array(n).fill(0),travel=0,selected=0,records=[],busy=false,playing=false,timer,unlockTimer,motionFrame,drag=null,sound=false,audio,plan=[],hinted=null,hit=null;
const disks=[],rotors=[];
let visualTravel=0,won=false,bannerDismissed=false,motionGeneration=0;
const svg=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
const snapshot=()=>({qs:[...qs],angles:[...angles],travel});
const turns=()=>records.filter(r=>r.type==='turn').length;
function tone(clear=false) {
  if(!sound)return;
  try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();
    (clear?[523,659,784]:[330]).forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.12;o.frequency.value=f;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.1,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.16);});
  }catch{}
}
function stop(){playing=false;clearTimeout(timer);plan=[];$('auto').textContent='▶ 手本を再生';}
function clearFeedback(){hit=null;hinted=null;}
function build(){
  $('discs').replaceChildren();disks.length=rotors.length=0;
  const paths=M.railPaths(n);
  for(const part of ['top','bottom','end'])$('rail-'+part).setAttribute('d',paths[part]);
  $('case-base').setAttribute('width',M.width(n)+12);
  $('carrier').setAttribute('width',(n-1)*M.D+M.R+138);
  for(let i=0;i<n;i++){
    const group=svg('g',{class:'disk',role:'button',tabindex:'0','data-index':i});group.dataset.index=i;
    const rotor=svg('g',{class:'rotor'});
    rotor.append(svg('path',{d:M.diskPath(i===0),class:'disk-shape',fill:'url(#brass)'}));
    if(i===0)rotor.append(svg('path',{d:`M ${-M.A} ${-M.A} H ${M.A}`,class:'flat-edge'}));
    // Arrow up is the patent's reference; convex sector points down initially.
    rotor.append(svg('path',{d:'M 0 -18 L -4 -9 H 4 Z',class:'direction-arrow'}));
    group.append(rotor,svg('circle',{r:7,class:'axle'}),svg('path',{d:'M -3 2 L 3 -2',class:'screw'}),svg('text',{y:3,'text-anchor':'middle',class:'hub-number'},String(i+1)));
    group.addEventListener('click',()=>{if(drag||busy||playing)return;selected=i;const dir=qs[i]===0?-1:qs[i]===3?1:-1;act(i,dir);});
    group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!playing&&!busy){selected=i;act(i,qs[i]===0?-1:qs[i]===3?1:-1);}}});
    disks.push(group);rotors.push(rotor);$('discs').append(group);
  }
}
function camera(){
  const left=Math.min(-18,M.WINDOW-visualTravel-132);
  return {left,width:Math.max(M.width(n)+64,M.width(n)+32-left)};
}
function renderScene(){
  const view=camera();
  $('mechanism').setAttribute('viewBox',`${view.left} -130 ${view.width} 280`);
  $('canvas').style.minWidth=`${Math.max(680,M.width(n)+64)}px`;
  $('slide').setAttribute('transform',`translate(${M.WINDOW-visualTravel} 0)`);
  // One numeric animation drives tray, labels and camera; no competing CSS transition.
  $('slide').style.transform=`translate(${M.WINDOW-visualTravel}px, 0px)`;
  $('labels').replaceChildren();
  qs.forEach((q,i)=>$('labels').append(svg('text',{x:M.center(i,visualTravel),y:132,'text-anchor':'middle',class:'disk-label'},String(i+1))));
  $('contact').replaceChildren();
  if(hit){const p=hit.point;$('contact').append(svg('circle',{cx:p.x,cy:p.y,r:8,class:'contact-ring'}),svg('path',{d:`M ${p.x-4} ${p.y-4} l 8 8 m 0 -8 l -8 8`,class:'contact-cross'}));}
  $('guide').replaceChildren();
  if(hinted){const x=M.center(hinted.i,visualTravel);$('guide').append(svg('path',{d:`M ${x} -64 H ${M.WINDOW}`,class:'hint-line'}),svg('circle',{cx:hinted.targetX??M.WINDOW,cy:0,r:M.R+4,class:'hint-window'}));}
  const box=$('mechanism').getBoundingClientRect(),scale=Math.min(box.width/view.width,box.height/280);
  const marginX=(box.width-view.width*scale)/2,marginY=(box.height-280*scale)/2;
  const handleX=marginX+(M.WINDOW-visualTravel-91-view.left)*scale;
  $('handleControls').style.left=`${Math.max(8,Math.min(box.width-104,handleX-48))}px`;
  $('handleControls').style.top=`${Math.max(6,marginY+40*scale-52)}px`;
  $('clearScene').setAttribute('visibility',won?'visible':'hidden');
  $('caseEmpty').setAttribute('x',M.width(n)/2);
  const at=qs.findIndex((_,i)=>Math.abs(M.center(i,visualTravel)-M.WINDOW)<.1);
  $('position').textContent=won?'スライドがケースから抜けました':drag?'離すと近くの目盛に止まります':Math.abs(travel-visualTravel)>.002?'スライドを移動中…':at>=0?`回転窓に円盤${at+1}`:'円盤の中心を回転窓へ';
}
function render(){
  $('moves').textContent=turns();
  $('level').textContent=`${String(n).padStart(2,'0')} DISCS`;
  $('binary').textContent=M.canonical(qs)?qs.map(q=>q===0?'1':'0').join(' '):qs.map(q=>['下','左','上','右'][q]).join(' ');
  renderScene();
  $('handle').setAttribute('aria-disabled',String(busy||playing||won));
  $('handle').setAttribute('aria-valuemin','0');$('handle').setAttribute('aria-valuemax',String(n+3));$('handle').setAttribute('aria-valuenow',String(Math.round(travel/M.D)));$('handle').setAttribute('aria-valuetext',`${Math.round(travel/M.D)}目盛`);
  const clear=won;
  $('slide').classList.toggle('escaped',clear);
  $('mechanism').classList.toggle('cleared',clear);
  $('clearBanner').hidden=!clear||bannerDismissed;
  $('clearResult').textContent=`${turns()}手でスライドが完全に抜けました。`;
  $('selected').textContent=`選択：円盤${selected+1}`;
  disks.forEach((b,i)=>{
    b.setAttribute('transform',`translate(${i*M.D} 0)`);
    b.setAttribute('aria-disabled',String(busy||playing||clear));
    b.setAttribute('aria-label',`円盤${i+1}、凸部は${['下','左','上','右'][qs[i]]}。クリックで90度回す`);
    b.classList.toggle('selected',i===selected);b.classList.toggle('hinted',hinted?.i===i);
    b.classList.toggle('collision',hit&&(hit.disk===i||hit.other===i));
    rotors[i].style.transform=`rotate(${angles[i]}deg)`;
  });
  for(const part of ['top','bottom','end'])$('rail-'+part).classList.toggle('collision',hit?.kind===part);
  $('undo').disabled=!records.length||busy||!!drag;
  $('hint').disabled=clear||busy||playing||!!drag;
  $('auto').disabled=clear;
  for(const id of ['slideIn','slideOut','rotateLeft','rotateRight'])$(id).disabled=clear||busy||playing||!!drag;
  $('history').replaceChildren();
  const first=document.createElement('li');first.textContent='初期：全て凸部が下・スライドは奥';
  const items=records.map((r,k)=>{const li=document.createElement('li');li.textContent=`${k+1}. ${r.type==='turn'?`円盤${r.i+1} ${r.dir<0?'反時計':'時計'}回り90°`:`台を${r.after.travel>r.before.travel?'左':'右'}へ`} ／ ${r.after.qs.map(q=>['下','左','上','右'][q]).join(' ')} ／ 引出し ${(r.after.travel/M.D).toFixed(2)}目盛`;return li;}).reverse();
  $('history').append(...items,first);
}
function reportContact(h,operation){
  hit=h;
  const names={top:'上レール',bottom:'下レールのストッパー',end:'ケースの奥の壁',disk:`隣の円盤${(h.other??0)+1}`};
  $('message').textContent=`${operation}：${h.part==='carrier'?'台の奥端':`円盤${h.disk+1}`}が${names[h.kind]}に接触。×印と赤い輪郭が接触部です。`;
  render();
}
function lock(){busy=true;clearTimeout(unlockTimer);unlockTimer=setTimeout(()=>{busy=false;render();},340);}
function act(i,dir){
  if(busy||drag||won)return false;
  selected=i;clearFeedback();const result=M.rotation(qs,travel,i,dir);
  if(!result.ok){reportContact(result.hit,'回転を止めました');return false;}
  const before=snapshot();qs[i]=result.next;angles[i]+=dir*90;
  records.push({type:'turn',i,dir,before,after:snapshot()});tone();lock();render();
  $('message').textContent=`円盤${i+1}を90°回しました。持ち手をドラッグして、次の円盤を窓へ。`;
  return true;
}
function cancelMotion(){
  motionGeneration++;if(motionFrame!==undefined)cancelAnimationFrame(motionFrame);motionFrame=undefined;
}
function finishSlide(){
  visualTravel=travel;busy=false;
  if(M.isCleared(qs,travel)){
    won=true;bannerDismissed=false;stop();tone(true);
    $('message').textContent=`クリア！ ${turns()}手でスライドが完全に抜けました。`;
  }
  render();
}
function animateSlide(duration=260){
  cancelMotion();const generation=motionGeneration,from=visualTravel,to=travel;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(Math.abs(to-from)<.00001||reduced){finishSlide();return;}
  busy=true;render();const start=performance.now();
  function frame(now){
    if(generation!==motionGeneration)return;
    const progress=Math.min(1,Math.max(0,(now-start)/duration));
    visualTravel=from+(to-from)*(1-(1-progress)**3);
    renderScene();
    if(progress<1)motionFrame=requestAnimationFrame(frame);else{motionFrame=undefined;finishSlide();}
  }
  motionFrame=requestAnimationFrame(frame);
}
function commitSlide(target,before,hitAfter=null,duration=260){
  travel=target;clearFeedback();hit=hitAfter;
  if(Math.abs(travel-before.travel)>.002)records.push({type:'slide',before,after:snapshot()});
  if(hitAfter)reportContact(hitAfter,'スライドを止めました');
  else $('message').textContent='円盤を回すときは、丸い窓へ中心を合わせてタップ。';
  animateSlide(duration);
}
function move(to){
  if(busy||drag||won)return false;
  const before=snapshot(),destination=Math.round(to/M.D)*M.D,sweep=M.slide(qs,travel,destination);
  const snapped=M.snap(qs,sweep.travel);
  if(!snapped)return false;
  const distance=Math.abs(snapped.travel-visualTravel)/M.D;
  commitSlide(snapped.travel,before,sweep.hit,Math.min(620,240+distance*50));
  return !sweep.blocked&&Math.abs(travel-destination)<.002;
}
function reset(){
  stop();cancelMotion();clearTimeout(unlockTimer);busy=false;drag=null;
  qs=Array(n).fill(0);angles=Array(n).fill(0);travel=visualTravel=0;won=false;bannerDismissed=false;
  records=[];selected=0;clearFeedback();$('count').value=String(n);
  $('mechanism').classList.remove('dragging');build();render();
  $('message').textContent='持ち手をドラッグ。離すと近くの目盛に止まります。矢印なら1目盛ずつ。';
}
function restore(s){qs=[...s.qs];angles=[...s.angles];travel=s.travel;won=false;bannerDismissed=false;}
function guidance(){
  const found=M.shortestPlan(qs,travel);
  if(found)return {...found,retrace:false};
  const route=M.referencePlan(qs,travel);
  return route?{route,retrace:false,fallback:true}:null;
}
$('hint').addEventListener('click',()=>{
  const g=guidance();if(!g){$('message').textContent='この姿勢からの手本は用意できません。Undoで直前へ戻せます。';return;}
  const step=g.route[0];if(!step){$('message').textContent='クリア済みです。残り回転数は0回です。';return;}hinted={i:step.type==='turn'?step.i:Math.max(0,Math.min(n-1,Math.round(step.travel/M.D))),targetX:step.type==='turn'?M.center(step.i,travel):M.WINDOW};render();
  $('message').textContent=(g.fallback?'探索上限のため、正規手本の次の操作：':`目盛位置での最少ルート（残り${g.count}回転）：`)+(step.type==='turn'?`円盤${step.i+1}を${step.dir<0?'反時計':'時計'}回りに90°。`:`持ち手を${step.travel>travel?'左':'右'}へ、${step.travel>=M.exit(n)-.002?'最後まで引き抜く':`円盤${hinted.i+1}が丸い窓に合う位置まで`}`);
});
function tick(){
  if(!playing)return;
  if(busy){timer=setTimeout(tick,80);return;}
  const step=plan.shift();if(!step){stop();render();return;}
  const ok=step.type==='turn'?act(step.i,step.dir):move(step.travel);
  if(!ok){stop();render();return;}
  if(playing)timer=setTimeout(tick,Number($('speed').value));
}
$('auto').addEventListener('click',()=>{if(drag)return;if(playing){stop();render();return;}const g=guidance();if(!g){$('message').textContent='手本を作れません。Undoで戻してお試しください。';return;}plan=g.route;playing=true;$('auto').textContent='■ 手本を停止';render();tick();});
$('undo').addEventListener('click',()=>{if(busy||drag)return;stop();const r=records.pop();if(!r)return;restore(r.before);clearFeedback();if(r.type==='slide')animateSlide(280);else{visualTravel=travel;lock();render();}$('message').textContent='直前の回転またはスライドを戻しました。';});
$('reset').addEventListener('click',reset);
$('clearRestart').addEventListener('click',reset);
$('clearClose').addEventListener('click',()=>{bannerDismissed=true;render();});
$('count').addEventListener('change',()=>{n=Number($('count').value);reset();});
$('rotateLeft').addEventListener('click',()=>act(selected,-1));$('rotateRight').addEventListener('click',()=>act(selected,1));
$('slideOut').addEventListener('click',()=>move(travel+M.D));$('slideIn').addEventListener('click',()=>move(travel-M.D));
$('speed').addEventListener('input',()=>$('speedValue').textContent=`${(Number($('speed').value)/1000).toFixed(2)} 秒 / 操作`);
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=`効果音 ${sound?'ON':'OFF'}`;$('sound').setAttribute('aria-pressed',String(sound));if(sound)tone();});
function mode(study){$('study').hidden=!study;for(const[id,active]of[['studyMode',study],['playMode',!study]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-pressed',String(active));}}
$('playMode').addEventListener('click',()=>mode(false));$('studyMode').addEventListener('click',()=>mode(true));
for(let c=3;c<=8;c++){const row=document.createElement('tr');row.innerHTML=`<td>${c}枚</td><td>${E.solve(E.initial(c),c).length}回</td>`;$('lengths').append(row);}
function pointerDown(e){
  if(busy||playing||won)return;
  e.preventDefault();clearFeedback();drag={id:e.pointerId,lastX:e.clientX,before:snapshot()};
  $('mechanism').setPointerCapture(e.pointerId);$('mechanism').classList.add('dragging');render();
}
$('handle').addEventListener('pointerdown',pointerDown);$('carrier').addEventListener('pointerdown',pointerDown);
$('mechanism').addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;e.preventDefault();
  const box=$('mechanism').getBoundingClientRect(),view=camera(),unitsPerPixel=Math.max(view.width/box.width,280/box.height);
  const target=visualTravel-(e.clientX-drag.lastX)*unitsPerPixel;drag.lastX=e.clientX;
  const result=M.slide(qs,visualTravel,target);visualTravel=result.travel;hit=result.hit;
  if(hit)reportContact(hit,'スライドを止めました');else renderScene();
});
function pointerEnd(e){
  if(!drag||e.pointerId!==drag.id)return;
  const before=drag.before;drag=null;$('mechanism').classList.remove('dragging');
  if($('mechanism').hasPointerCapture(e.pointerId))$('mechanism').releasePointerCapture(e.pointerId);
  const snapped=M.snap(qs,visualTravel),target=snapped?.travel??before.travel;
  commitSlide(target,before,hit,200);
}
$('mechanism').addEventListener('pointerup',pointerEnd);$('mechanism').addEventListener('pointercancel',pointerEnd);
$('handle').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();if(!playing)move(travel+(e.key==='ArrowLeft'?M.D:-M.D));}});
if(typeof globalThis.addEventListener==='function')globalThis.addEventListener('resize',renderScene);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();render();}});
reset();
})();
