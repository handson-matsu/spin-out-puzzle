import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { recordVisit } from '../access.js';
const root = new URL('../', import.meta.url);
const published = new URL('https://handson-matsu.github.io/spin-out-puzzle/');

test('GitHub Pages: every local HTML, CSS and module resource resolves within the project path', async () => {
  const queue = ['index.html'], checked = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (checked.has(path)) continue;
    checked.add(path);
    const local = new URL(path, root);
    assert((await stat(local)).isFile(), path);
    const content = await readFile(local, 'utf8');
    const refs = path.endsWith('.html') ? [...content.matchAll(/(?:src|href)="([^"]+)"/g)].map(x => x[1])
      : path.endsWith('.js') ? [...content.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(x => x[1])
      : path.endsWith('.css') ? [...content.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map(x => x[1]) : [];
    for (const ref of refs) {
      if (/^(https?:|data:|#)/.test(ref)) continue;
      const resolved = new URL(ref, new URL(path, published));
      assert(resolved.href.startsWith(published.href), `${path}: ${ref}`);
      const resource = resolved.pathname.slice(published.pathname.length);
      if (resource && !resource.endsWith('/')) queue.push(resource);
    }
  }
  for (const file of ['index.html', 'style.css', 'app.js', 'engine.js', 'mechanics.js', 'access-counter.js']) assert(checked.has(file), file);
  assert((await stat(new URL('.nojekyll', root))).isFile());
});

test('unused legacy access configuration remains disconnected', async () => {
  const source = await readFile(new URL('config.js', root), 'utf8');
  const context = { window: {} }; vm.runInNewContext(source, context);
  assert.equal(context.window.SPIN_OUT_CONFIG.access.enabled, false);
  assert.equal(context.window.SPIN_OUT_CONFIG.access.record, null);
  let touched = false;
  await recordVisit(context.window.SPIN_OUT_CONFIG.access, {getItem(){touched=true;throw Error('blocked');}});
  assert.equal(touched,false);
  await recordVisit({enabled:true,record:async()=>{}},{getItem(){throw Error('blocked');}});
});

// file:// blocks module-script fetches in standard browsers. Keep the entry classic.
test('double-click entry uses classic scripts with independent GAS logging after game startup', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 4);
  assert(scripts[0][1].includes('./engine.js'));
  assert(scripts[1][1].includes('./mechanics.js'));
  assert(scripts[2][1].includes('./app.js'));
  assert(scripts[3][1].includes('./access-counter.js'));
  assert(!html.includes('src="config.js"'));
  assert(!html.includes('src="./config.js"'));
  for (const [, attrs] of scripts) assert(!/type=["']module|async/.test(attrs));
  for (const name of ['engine.js', 'mechanics.js', 'app.js']) {
    const source = await readFile(new URL(name, root), 'utf8');
    assert(!/^\s*(?:import|export)\b/m.test(source), name);
    assert(!/\b(?:fetch|XMLHttpRequest|recordVisit)\s*\(/.test(source), name);
    new vm.Script(source, { filename: name });
  }
  new vm.Script(await readFile(new URL('access-counter.js', root), 'utf8'));
});

test('visible numeric clutter is removed and arrow buttons sit inside the tray canvas',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8'),css=await readFile(new URL('style.css',root),'utf8');
  assert(!html.includes('id="minimum"'));assert(!html.includes('id="remaining"'));
  const canvas=html.slice(html.indexOf('id="canvas"'),html.indexOf('<p id="position"'));
  assert(canvas.includes('id="handleControls"'));assert(canvas.includes('id="slideOut"'));assert(canvas.includes('id="slideIn"'));
  assert.match(css,/\.handle-controls button\{[^}]*width:44px;[^}]*height:44px/);
  assert(html.includes('id="clearBanner"'));assert(html.includes('id="clearRestart"'));
});
