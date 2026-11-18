const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const R=path.resolve(__dirname,'..'), baseline=process.env.JOURNL_BASELINE||path.resolve(R,'../full-review-v5');
const r=createRequire(require.resolve('@playwright/test',{paths:['/home/rmolinamir/projects/journl/apps/web']})),r2=createRequire(r.resolve('playwright'));
const {PNG}=require(path.dirname(r2.resolve('playwright-core'))+'/lib/utilsBundle.js');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const current=read(R+'/specs/renders.json'),old=read(baseline+'/specs/renders.json'), byImage=new Map(old.map(x=>[x.image,x]));
const errors=[],records=[];let done=0;
const textProof=fs.existsSync(R+'/specs/brand-text-style-checks.json')?read(R+'/specs/brand-text-style-checks.json').records:[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
for(const n of current){
 const o=byImage.get(n.image), issues=[];
 if(!o||!n.image){errors.push({image:n.image,error:'Unexpected or failed render'});continue}
 if(!same(n.dimensions,o.dimensions))issues.push('Raster dimensions changed');
 for(const k of ['nav','panel','agent','composer','conversation','pill','overlay','overlayScroller','trigger','header','selectedNav','fullHeight','marketingRegions'])if(!same(n.checks[k],o.checks[k]))issues.push('Non-brand geometry or identity changed: '+k);
 const controls=c=>c.controls.map(x=>({label:x.label,rect:x.rect,disabled:x.disabled,inViewport:x.inViewport,inOverlay:x.inOverlay}));
 if(!same(controls(n.checks),controls(o.checks)))issues.push('Non-brand control geometry or identity changed');
 if(n.checks.oldBrandCount!==0||n.checks.brandError||n.checks.brandHosts.some(x=>x.approved!=='shifted-right-v7'))issues.push('Legacy or failed branding');
 if(n.checks.images.some(i=>!i.complete||!i.width||!i.height))issues.push('Missing image');
 const bytes=fs.readFileSync(R+'/'+n.image);
 if(hash(bytes)!==n.sha256)issues.push('Image hash mismatch');
 const masks=n.checks.brandRegions.filter(x=>x.visible).map(x=>({...x.rect,padding:32,kind:'existing brand slot'}));
 for(const im of n.checks.images){if(im.src.includes('all-pages--'))masks.push({...im.rect,padding:32,kind:'embedded canonical dashboard'});else if(im.src.includes('/brand/'))masks.push({...im.rect,padding:32,kind:'approved brand artwork'});}
 let outsidePixels=0,outsideBounds=null,edgeRoundingPixels=0,textRasterPixels=0;
 const proof=textProof.find(x=>x.image===n.image&&x.stylesAndGeometryIdentical);
 const textRects=proof?proof.integrated.flatMap(x=>x.rects):[];
 if(o.sha256!==n.sha256&&same(n.dimensions,o.dimensions)){
  const a=PNG.sync.read(fs.readFileSync(baseline+'/'+o.image)),b=PNG.sync.read(bytes),width=a.width;
  for(let y=0;y<a.height;y++){
   if(a.data.subarray(y*width*4,(y+1)*width*4).equals(b.data.subarray(y*width*4,(y+1)*width*4)))continue;
   const spans=masks.filter(m=>y>=m.y-m.padding&&y<=m.bottom+m.padding).map(m=>[m.x-m.padding,m.right+m.padding]);
   for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(a.data[i]===b.data[i]&&a.data[i+1]===b.data[i+1]&&a.data[i+2]===b.data[i+2]&&a.data[i+3]===b.data[i+3])continue;
    if(spans.some(([l,r])=>x>=l&&x<=r))continue;
    const delta=Math.max(Math.abs(a.data[i]-b.data[i]),Math.abs(a.data[i+1]-b.data[i+1]),Math.abs(a.data[i+2]-b.data[i+2]),Math.abs(a.data[i+3]-b.data[i+3]));
    if(textRects.some(r=>x>=r.x-1&&x<=r.right+1&&y>=r.y-1&&y<=r.bottom+1)){textRasterPixels++;continue}
    if(delta<=6){edgeRoundingPixels++;continue}
    outsidePixels++;
    if(!outsideBounds)outsideBounds={left:x,top:y,right:x,bottom:y};else{outsideBounds.left=Math.min(outsideBounds.left,x);outsideBounds.right=Math.max(outsideBounds.right,x);outsideBounds.bottom=y}
   }
  }
 }
 if(edgeRoundingPixels>Math.max(100,Math.ceil(n.dimensions.width*n.dimensions.height*.0002)))issues.push('Raster rounding exceeds max(100 pixels,0.02% of image pixels)');
 if(outsidePixels)issues.push('Pixels changed outside brand/dependent hero regions');
 const result={image:n.image,identicalRaster:o.sha256===n.sha256,brandHosts:n.checks.brandHosts.length,visibleBrands:n.checks.brandRegions.filter(x=>x.visible).length,masks,outsidePixels,outsideBounds,edgeRoundingPixels,textRasterPixels,textStyleProof:proof?'Identical text, font/color/style and glyph layout rectangles':null,issues};records.push(result);
 if(issues.length)errors.push(result);
 if(++done%200===0)console.log('Brand verification',done+'/'+current.length);
}
const missing=old.filter(o=>!current.some(n=>n.image===o.image)).map(x=>x.image);if(missing.length)errors.push({missing});
const evidence=[];for(const f of (function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)])})(baseline+'/evidence')){const rel=path.relative(baseline,f),unchanged=hash(fs.readFileSync(f))===hash(fs.readFileSync(R+'/'+rel));evidence.push({path:rel,unchanged});if(!unchanged)errors.push({historicalEvidenceChanged:rel})}
const approved=path.resolve(R,'../logo-review-v7/assets/logos/after');
const assets=fs.readdirSync(approved).map(f=>({file:'assets/brand/'+f,sha256:hash(fs.readFileSync(R+'/assets/brand/'+f)),exact:hash(fs.readFileSync(R+'/assets/brand/'+f))===hash(fs.readFileSync(approved+'/'+f))}));
if(assets.some(x=>!x.exact))errors.push({unapprovedLogoAsset:true});
const result={status:errors.length?'FAILED':'PASS',scope:'All canonical proposed renders; original evidence and archived revisions excluded from logo replacement',method:'Compare original image inventory, dimensions, non-brand region/control geometry and identity; pixel comparison outside existing brand slots and dependent canonical dashboard imagery, with32px allowance for composited blur. Differences up to6/255 per channel outside verified text, limited to max(100 pixels,0.02% of image pixels), are recorded as raster rounding. Larger text-only raster differences are allowed only inside unchanged text rectangles after separate exact text/font/color/style/layout checks; these are rendering differences, not a claim of byte-identical non-brand pixels. Every brand host uses exact approved Shifted right SVG. Unchanged rasters are expected when branding is hidden or outside the captured region.',canonicalImages:current.length,originalImages:old.length,identicalRasters:records.filter(r=>r.identicalRaster).length,rasterRoundingImages:records.filter(r=>r.edgeRoundingPixels).length,textRasterDifferenceImages:records.filter(r=>r.textRasterPixels).length,changedRasters:records.filter(r=>!r.identicalRaster).length,missing,originalEvidenceFiles:evidence.length,evidenceUnchanged:evidence.every(x=>x.unchanged),assets,errors,records};
fs.writeFileSync(R+'/specs/brand-integration.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,records:undefined,assets:undefined,errors:errors.slice(0,10)}));
if(errors.length)process.exitCode=1;
