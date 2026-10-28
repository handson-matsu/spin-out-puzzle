import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers/offline-dom.js';
const M=globalThis.SpinOutMechanics;
const near=(a,b)=>assert(Math.abs(a-b)<.002,`${a} != ${b}`);
const visual=ui=>M.WINDOW-Number(ui.get('slide').attributes.transform.match(/translate\(([^ ]+)/)[1]);
const slot=ui=>Number(ui.get('handle').attributes['aria-valuenow']);
function dragTo(ui,target,{release=true,cancel=false}={}){
  const current=visual(ui),view=ui.get('mechanism').attributes.viewBox.split(' ').map(Number),box=ui.get('mechanism').getBoundingClientRect();
  const units=Math.max(view[2]/box.width,280/box.height),x=(current-target)/units;
  ui.get('handle').fire('pointerdown',{pointerId:5,clientX:0});
  ui.get('mechanism').fire('pointermove',{pointerId:5,clientX:x});
  if(release)ui.get('mechanism').fire(cancel?'pointercancel':'pointerup',{pointerId:5,clientX:x});
}
function checkFrame(ui){
  const v=visual(ui),box=ui.get('mechanism').attributes.viewBox.split(' ').map(Number);
  near(box[0],Math.min(-18,M.WINDOW-v-132));near(box[2],Math.max(M.width(ui.get('discs').children.length)+64,M.width(ui.get('discs').children.length)+32-box[0]));
}
async function beforeFinalSlide(){
  const ui=await load();ui.get('count').value='3';ui.get('count').fire('change');
  const plan=M.shortestPlan([0,0,0],0).route;
  for(const step of plan.slice(0,-1)){
    if(step.type==='turn'){ui.disk(step.i).fire('click');ui.advance(400);}
    else while(Math.abs(slot(ui)*M.D-step.travel)>.002){ui.get(step.travel>slot(ui)*M.D?'slideOut':'slideIn').fire('click');ui.advance(700);}
  }
  while(slot(ui)<5){ui.get('slideOut').fire('click');ui.advance(700);}
  assert.equal(slot(ui),5);assert.equal(ui.get('clearBanner').hidden,true);return ui;
}

test('drag always snaps to nearest reachable integer, including cancellation and return-to-origin',async()=>{
  for(const [fraction,expected] of [[.2,0],[.49,0],[.51,1],[.9,1]]){
    const ui=await load();dragTo(ui,fraction*M.D);assert.equal(slot(ui),expected);
    // The preview does not jump to the destination when released.
    near(visual(ui),fraction*M.D);ui.advance(224);near(visual(ui),expected*M.D);
    assert.equal(ui.get('moves').textContent,'0');
    if(expected===0)assert.equal(ui.get('undo').disabled,true);
    else{ui.get('undo').fire('click');ui.advance(300);assert.equal(slot(ui),0);near(visual(ui),0);}
  }
  const ui=await load();dragTo(ui,.7*M.D,{cancel:true});ui.advance(224);assert.equal(slot(ui),1);
});

test('arrow/keyboard controls move exactly one station and cannot cross the gate',async()=>{
  const ui=await load();ui.get('slideOut').fire('click');assert.equal(slot(ui),1);near(visual(ui),0);ui.advance(320);near(visual(ui),M.D);
  ui.get('slideOut').fire('click');ui.advance(320);assert.equal(slot(ui),1);assert.match(ui.get('message').textContent,/ストッパー/);
  ui.get('slideIn').fire('click');ui.advance(320);assert.equal(slot(ui),0);
  ui.get('handle').fire('keydown',{key:'ArrowLeft'});ui.advance(320);assert.equal(slot(ui),1);
  ui.get('handle').fire('keydown',{key:'ArrowRight'});ui.advance(320);assert.equal(slot(ui),0);
  dragTo(ui,10*M.D);ui.advance(224);assert.equal(slot(ui),1);near(visual(ui),M.D);
});

for(const mode of ['button','drag'])test(`last ${mode} slide animates tray and camera together; clear appears only at the endpoint`,async()=>{
  const ui=await beforeFinalSlide();
  if(mode==='button')ui.get('slideOut').fire('click');else dragTo(ui,5.65*M.D);
  let previous=visual(ui),frames=0;assert.equal(slot(ui),6);assert.equal(ui.get('clearBanner').hidden,true);
  for(let k=0;k<42;k++){
    ui.advance(16);const current=visual(ui);assert(current>=previous-.0001);assert(current-previous<M.D*.25);
    checkFrame(ui);if(current<M.exit(3)-.0001)assert.equal(ui.get('clearBanner').hidden,true);
    previous=current;frames++;
  }
  assert(frames>5);near(visual(ui),M.exit(3));assert.equal(ui.get('clearBanner').hidden,false);
  assert.equal(ui.get('clearScene').attributes.visibility,'visible');assert(M.width(3)-visual(ui)<0);
  const q=ui.get('discs').children.map(d=>{const degrees=Number(d.querySelector('.rotor').style.transform.match(/rotate\(([^d]+)/)[1]);return (Math.round(degrees/90)%4+4)%4;});
  assert(M.isCleared(q,slot(ui)*M.D));assert.equal(M.shortestPlan(q,slot(ui)*M.D).count,0);
  assert.deepEqual(M.shortestPlan(q,slot(ui)*M.D).route,[]);
  // The whole empty case and the complete carrier remain inside the visible frame.
  const view=ui.get('mechanism').attributes.viewBox.split(' ').map(Number);assert(view[0]+view[2]>M.width(3));assert(view[0]<M.WINDOW-visual(ui)-126);
  ui.get('clearClose').fire('click');assert.equal(ui.get('clearBanner').hidden,true);
  ui.get('undo').fire('click');ui.advance(320);assert.equal(slot(ui),5);assert.equal(ui.get('clearBanner').hidden,true);
  ui.get('slideOut').fire('click');ui.advance(700);assert.equal(ui.get('clearBanner').hidden,false);
  ui.get('clearRestart').fire('click');assert.equal(slot(ui),0);assert.equal(ui.get('moves').textContent,'0');assert.equal(ui.get('clearBanner').hidden,true);
});

test('reset cancels pending frames; compact controls retain a 44px hit area at every viewport',async()=>{
  const ui=await load();ui.get('slideOut').fire('click');ui.advance(48);assert(visual(ui)>0);
  ui.get('reset').fire('click');ui.advance(1200);near(visual(ui),0);assert.equal(slot(ui),0);assert.equal(ui.get('clearBanner').hidden,true);
  for(const width of [680,800,1080]){
    const view=await load({width});
    for(let step=0;step<8;step++){
      const left=parseFloat(view.get('handleControls').style.left),top=parseFloat(view.get('handleControls').style.top);
      assert(left>=0&&left+94<=width);assert(top>=0&&top+44<=340);
      view.get('slideOut').fire('click');view.advance(400);
    }
  }
});

test('reduced motion reaches the same integer and clear state without frame animation',async()=>{
  const ui=await load({reducedMotion:true});ui.get('slideOut').fire('click');near(visual(ui),M.D);assert.equal(slot(ui),1);assert.equal(ui.get('undo').disabled,false);
});
