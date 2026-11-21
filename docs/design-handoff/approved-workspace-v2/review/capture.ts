import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { scenes, render } from './scenes.ts';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.JOURNL_PLAYWRIGHT || 'playwright');
const here = fileURLToPath(new URL('.',import.meta.url));
const local = (file:string)=> resolve(here,file);
const sceneFile = local('.capture.html');
const fileUrl = (path:string)=>pathToFileURL(path).href;

const tests = [
 ['Panel heading over glass','.agent-title','color','text'],
 ['Navigation default','.navrow[aria-label="Journal"]','color','text'],
 ['Navigation hover over glass','.navrow[aria-label="Explore"]','color','text'],
 ['Navigation selected + hover','.nested.selected','color','text'],
 ['Keyboard outline against glass','.nested.focused','outlineColor','outline'],
 ['Citation hover over conversation surface','.source.focused','color','text'],
 ['Composer focus against surrounding glass','.composer.focused','outlineColor','outline'],
 ['Document title','.document h1','color','text'],
 ['Document supporting text','.lede','color','text'],
 ['Composer boundary against input surface','.composer','borderTopColor','inside'],
 ['Hovered row label','.table-grid.hovered strong','color','text'],
 ['Menu text','.menu button:nth-child(2)','color','text'],
 ['Error message','.alert span','color','text'],
 ['Model selector text','.model','color','text'],
 ['Selected editor text','.text-selection','color','text'],
 ['Formatting toolbar focus','.format-tools .focused','outlineColor','outline'],
 ['Block menu hover text','.block-menu .hovered','color','text'],
 ['Stop label','.stop-action','color','text'],
 ['Stop focus against composer','.stop-action','outlineColor','outline'],
 ['Disabled send icon','.composer button:disabled','color','disabled'],
] as const;
const measurements = new Map<string,Record<string,number>>();
const boxes=new Map<string,string>();
const browser = await chromium.launch({headless:true,executablePath:process.env.JOURNL_CHROMIUM,args:['--no-sandbox']});
const page=await browser.newPage({deviceScaleFactor:1});
const groups=[...new Set(scenes.map(s=>s.group))];
const id=(g:string)=>g.toLowerCase().replaceAll(' ','-');

try {
 await mkdir(local('screens'),{recursive:true});
 for(const scene of scenes){
  await writeFile(sceneFile,render(scene));
  await page.setViewportSize({width:scene.width,height:scene.height});
  await page.goto(fileUrl(sceneFile));
  await page.evaluate(async ()=>{await document.fonts.ready; await Promise.all([...document.images].map(image=>image.decode()));});
  if(scene.key.startsWith('composer-loading')||scene.key.startsWith('composer-streaming')||scene.key.startsWith('mobile-agent')){
   await page.locator('.thread').evaluate(node=>node.scrollTop=node.scrollHeight);
  }
  const geometry = await page.evaluate(()=>{
    function box(selector:string){
     const node=document.querySelector(selector);
     if(!node||getComputedStyle(node).display==='none')return null;
     const {x,y,width,height}=node.getBoundingClientRect();
     return {x,y,width,height};
    }
    return {nav:box('.nav'),center:box('.center'),agent:box('.agent'),
     docScroll:document.querySelector('.doc-scroll')?.scrollTop??0,
     threadScroll:document.querySelector('.thread')?.scrollTop??0,
     overflow:[...document.querySelectorAll('.doc-scroll,.thread,.nav-scroll,.bar,.table')].filter(node=>node.clientWidth>0&&node.scrollWidth>node.clientWidth+2).map(node=>node.className)};
  });
  if(geometry.overflow.length)throw Error(scene.key+' horizontal overflow: '+geometry.overflow.join(', '));
  if(scene.width>=1440&&geometry.nav&&geometry.agent&&(geometry.nav.y!==geometry.agent.y||geometry.nav.height!==geometry.agent.height)){
   throw Error(scene.key+' sidebar heights diverge');
  }
  boxes.set(scene.key,[
   ...Object.entries({Nav:geometry.nav,Center:geometry.center,Agent:geometry.agent}).flatMap(([name,box])=>box?[name+' '+box.width+' × '+box.height+' at '+box.x+', '+box.y]:[]),
   'Scroll top '+geometry.docScroll+' px document'+(geometry.agent?', '+geometry.threadScroll+' px thread':'')
  ].join(' · '));
  await page.screenshot({path:local('screens/'+scene.key+'.png'),animations:'disabled'});
  if(scene.width!==1440||!['tree-states','table-states','composer-error','formatting-states','composer-streaming'].some(key=>scene.key.startsWith(key)))continue;
  const probes=await page.evaluate((checks)=>{
   return checks.flatMap(([label,selector,property,mode])=>{
    const e=document.querySelector(selector);
    if(!e)return [];
    const r=e.getBoundingClientRect();
    const rgb=getComputedStyle(e)[property].match(/[\d.]+/g)?.slice(0,3).map(Number);
    let x=r.x+r.width/2,y=r.y+r.height/2,w=5,h=5;
    if(mode==='outline'){y=r.y-5;w=Math.min(80,r.width-16);h=1;}
    if(mode==='inside'){y=r.y+3;h=1;}
    if(mode==='text'){w=Math.min(50,r.width-12);h=9;}
    return [{label,rgb,x:Math.round(x-w/2),y:Math.round(y-h/2),w:Math.round(w),h}];
   });
  },tests);
  await page.addStyleTag({content:'*{-webkit-text-fill-color:transparent!important}.icon{visibility:hidden!important}'});
  const background=(await page.screenshot()).toString('base64');
  const ratios=await page.evaluate(async({background,probes})=>{
    const image=new Image();
    image.src='data:image/png;base64,'+background;
    await image.decode();
    const canvas=document.createElement('canvas');
    canvas.width=image.width; canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;
    ctx.drawImage(image,0,0);
    const luminance=(color:number[])=>color.reduce((sum,c,i)=>{
      const v=c/255;
      return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    },0);
    return probes.map(({label,rgb,x,y,w,h})=>{
      const pixels=ctx.getImageData(x,y,w,h).data;
      let minimum=Infinity;
      const fg=luminance(rgb!);
      for(let i=0;i<pixels.length;i+=4){
        const bg=luminance([pixels[i],pixels[i+1],pixels[i+2]]);
        minimum=Math.min(minimum,(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05));
      }
      return [label,minimum] as const;
    });
   },{background,probes});
  for(const [label,ratio] of ratios){
   const row=measurements.get(label)||{};
   row[scene.theme]=Math.min(row[scene.theme]??Infinity,ratio);
   measurements.set(label,row);
  }
 }
 const spec=await readFile(local('spec.html'),'utf8');
 const gallery=groups.map(group=>`<section id="${id(group)}"><h2>${group}</h2><div class="gallery ${group==='Tablet and phone'?'handheld':''}">${scenes.filter(s=>s.group===group).map(s=>`
 <figure class="${s.width===390?'phone':''}"><a href="review/screens/${s.key}.png"><img src="review/screens/${s.key}.png" alt="${s.title}, ${s.theme} theme, ${s.state}" width="${s.width}" height="${s.height}"></a><figcaption><strong>${s.title}</strong> · ${s.theme} · ${s.width} × ${s.height}<small>${s.route} · ${s.state}</small><small>${boxes.get(s.key)}</small></figcaption></figure>`).join('')}</div></section>`).join('');
 const result=(value:number|undefined)=>value===undefined?'—':value.toFixed(2)+':1';
 const contrast=`<section id="contrast"><h2>Rendered contrast</h2><p class="spec">These spot checks use Chromium’s composited background pixels at 1440 × 1000, including glass and hover fills. The capture removes glyphs for sampling and compares centered background samples with the declared foreground. Each value is the lowest ratio within its sampled patch. Outline samples use the adjacent rendered surface. The disabled send icon has no minimum. These checks cover the listed pairs only.</p><div class="table"><table><thead><tr><th>Sample</th><th>Light</th><th>Dark</th><th>Target</th></tr></thead><tbody>${[...measurements].map(([label,v])=>`<tr><td>${label}</td><td>${result(v.light)}</td><td>${result(v.dark)}</td><td>${label.includes('Disabled')?'Exempt':/outline|focus against|boundary/i.test(label)?'3:1':'4.5:1'}</td></tr>`).join('')}</tbody></table></div></section>`;
 const index=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Journl · Workspace review</title><link rel="stylesheet" href="review/index.css"></head>
 <body><header class="mast"><img src="references/lockup-light.svg" width="118" height="32" alt="Journl"><span>Design iteration 02</span><strong>NOT APPROVED</strong></header><main><h1>Workspace review</h1>
 <p class="intro">A place to organize, revisit, and work with what you know. Start with the garden project at 1440 × 1000 and compare the same workspace across layouts, themes, and states.</p>
 <p class="spec">Select a screenshot to open its original PNG. All views use the same synthetic workspace fixture. Theme pairs share layout, content, and state. Coordinates and sizes below use CSS pixels at a 1× capture scale. These static plates show where existing controls fit. <a href="review-v1/index.html">Open archived iteration 01</a>.</p>
 <nav aria-label="Review sections">${[...groups.map(g=>[id(g),g]),['behavior','Behavior'],['contrast','Contrast'],['gate','Validation gate']].map(([key,label])=>`<a href="#${key}">${label}</a>`).join('')}</nav>
 ${gallery}${spec}${contrast}<p class="spec">Review environment: headless desktop Chromium with fixed viewports. The phone and tablet images represent viewport layouts. Physical-device behavior and production functionality remain for implementation validation. The original Gather logos are used as supplied.</p></main></body></html>`;
 await writeFile(local('../index.html'),index);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(fileUrl(local('../index.html')));
 const audit=await page.evaluate(async()=>{
  const images=await Promise.all([...document.images].map(async image=>{
   await image.decode();
   return {src:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight,declaredWidth:image.width};
  }));
  const links=[...document.querySelectorAll<HTMLAnchorElement>('a')];
  const broken=links.filter(link=>link.hash&&!document.getElementById(link.hash.slice(1))).map(link=>link.href);
  const unlinked=images.filter(image=>image.src?.endsWith('.png')&&!links.some(link=>link.getAttribute('href')===image.src));
  return {images,broken,unlinked};
 });
 if(audit.broken.length||audit.unlinked.length||audit.images.length!==scenes.length+1)throw Error('Index audit failed');
 for(const scene of scenes){
  const img=audit.images.find((item:{src:string})=>item.src==='review/screens/'+scene.key+'.png');
  if(!img||img.width!==scene.width||img.height!==scene.height)throw Error('PNG dimensions: '+scene.key);
 }
 await page.locator('a[href="review-v1/index.html"]').click();
 if(await page.locator('figure img').count()!==26)throw Error('Archive index link failed');
 console.log('Decoded every PNG and verified all index image links and section anchors.');
 console.log(Object.fromEntries(measurements));
} finally {
 await browser.close();
 const { unlink }=await import('node:fs/promises');
 await unlink(sceneFile).catch(()=>{});
}
