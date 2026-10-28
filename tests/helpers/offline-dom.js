import '../../engine.js';
import '../../mechanics.js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
class Element {
  constructor(tag='div') {
    this.tag=tag;this.children=[];this.listeners={};this.dataset={};this.attributes={};this.classes=new Set();
    this.disabled=false;this.value='';this.hidden=false;this.checked=true;this.style={setProperty(name,value){this[name]=value;}};
    this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle:(x,...args)=>{if(args.length?Boolean(args[0]):!this.classes.has(x))this.classes.add(x);else this.classes.delete(x);}};
  }
  set textContent(v){this.text=String(v);this.children=[];}get textContent(){return this.text||'';}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='class'){this.classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(x=>this.classes.add(x));}}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;this.text='';}
  querySelector(s){const key=s.startsWith('.')?'class':'tag',value=s.slice(key==='class'?1:0);for(const c of this.children){if(key==='class'?c.classes.has(value):c.tag===value)return c;const hit=c.querySelector(s);if(hit)return hit;}return null;}
  addEventListener(name,fn){(this.listeners[name]||=[]).push(fn);}
  fire(name,event={}){if(name==='click'&&this.disabled)return;for(const fn of this.listeners[name]||[])fn({preventDefault(){},...event});}
  getBoundingClientRect(){return this.box||{width:800,height:340};}
  setPointerCapture(id){this.pointer=id;}hasPointerCapture(id){return this.pointer===id;}releasePointerCapture(){this.pointer=null;}
}
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function serialize(e){
  const attrs={...e.attributes};if(e.classes.size)attrs.class=[...e.classes].join(' ');
  const styles=Object.entries(e.style).filter(([,v])=>typeof v!=='function').map(([k,v])=>`${k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${v}`).join(';');if(styles)attrs.style=styles;
  return `<${e.tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${escape(v)}"`).join(' ')}>${escape(e.textContent)}${e.children.map(serialize).join('')}</${e.tag}>`;
}
export async function load({width=800,height=340,reducedMotion=false,accessFetch}={}){
  const html=await readFile(new URL('index.html',root),'utf8');
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const markup=html.slice(html.indexOf('<svg id="mechanism"'),html.indexOf('</svg>')+6),stack=[];
  for(const token of markup.match(/<[^>]+>|[^<]+/g)){
    if(token.startsWith('</')){stack.pop();continue;}
    if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)[1],e=new Element(tag);
      for(const m of token.matchAll(/([\w:-]+)="([^"]*)"/g))e.setAttribute(m[1],m[2]);
      if(e.attributes.id)elements.set(e.attributes.id,e);if(stack.length)stack.at(-1).append(e);
      if(!token.endsWith('/>'))stack.push(e);
    }else if(stack.length&&token.trim())stack.at(-1).textContent=token.trim();
  }
  elements.get('mechanism').box={width,height};
  elements.get('speed').value='450';const timers=new Map();let sequence=0,now=0;
  const document={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),addEventListener(){},hidden:false};
  const accessRequests=[];
  const context=vm.createContext({Math,document,fetch(...args){accessRequests.push(args);return accessFetch?accessFetch(...args):Promise.resolve({type:'opaque'});},performance:{now:()=>now},matchMedia:()=>({matches:reducedMotion}),requestAnimationFrame(fn){const id=++sequence;timers.set(id,{fn:()=>fn(now),at:now+16});return id;},cancelAnimationFrame(id){timers.delete(id);},setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);}});
  // Physics is independently tested exhaustively; share its unmodified host instance
  // here to avoid Node VM's global-lookup overhead in UI tests.
  context.window=context;
  context.SpinOutEngine=globalThis.SpinOutEngine;context.SpinOutMechanics=globalThis.SpinOutMechanics;
  for(const file of ['app.js','access-counter.js'])vm.runInContext(await readFile(new URL(file,root),'utf8'),context,{filename:file});
  const get=id=>elements.get(id);
  const advance=duration=>{const end=now+duration;let budget=5000;
    while(timers.size){const[id,timer]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(timer.at>end)break;assert(--budget>0);now=timer.at;timers.delete(id);timer.fn();}now=end;};
  advance(0);
  return {get,advance,accessRequests,disk:i=>get('discs').children.find(b=>b.dataset.index===i),context,scene:()=>serialize(get('mechanism'))};
}
