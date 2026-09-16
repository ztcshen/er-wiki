import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {serve} from './serve.mjs';
const {chromium}=await import(process.env.ER_WIKI_PLAYWRIGHT_MODULE||'playwright');
const server=await serve();
const browser=await chromium.launch({headless:true,...(process.env.ER_WIKI_CHROMIUM_EXECUTABLE?{executablePath:process.env.ER_WIKI_CHROMIUM_EXECUTABLE}:{})});
const output=await fs.mkdtemp(new URL('../work/landing-',import.meta.url));
const base=`http://127.0.0.1:${server.address().port}/er-wiki/`;
try {
 for(const width of [1440,390])for(const lang of ['en','zh']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(base+(lang==='en'?'':'zh.html'));
  assert.equal(await page.locator('h1').count(),1);
  assert((await page.locator('h1').innerText()).includes(lang==='en'?'Readable ER':'保持可读'));
  await page.locator('.hero-visual img').evaluate(img=>img.decode());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(requests.every(url=>url.startsWith(base)),'No external asset requests');
  assert.equal(await page.locator('script').count(),0);
  await page.screenshot({path:`${output}/${lang}-${width}.png`,fullPage:true});
  await page.locator('.hero .primary').click();
  await page.locator('[data-demo-ready="true"]').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-node-kind="table"]').count(),13);
  assert.deepEqual(errors,[]);await page.close();
 }
 // A real browser capture of the introduction, suitable for social previews.
 const social=await browser.newPage({viewport:{width:1200,height:630}});
 await social.goto(base+'social.html');await social.locator('.hero-visual img').evaluate(img=>img.decode());
 await social.screenshot({path:`${output}/social-preview.png`});
 console.log(JSON.stringify({output,checks:'EN/ZH, 1440/390px, headings, no overflow, local assets, no JS, CTA to real 13-table demo'}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
