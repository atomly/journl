// Contextual surface composition. Keeps the approved shell and 438-state ledger.
(()=>{
const p=new URLSearchParams(location.search),id=p.get('state')||'all-pages',theme=p.get('theme')||'light',s=window.JOURNL_STATES.find(x=>x.stateId===id);if(!s)return;
const mobile=innerWidth<=700,tablet=innerWidth>700&&innerWidth<=1100,E=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const B=(t,cls='')=>`<button type="button" class="btn ${cls}" aria-label="${E(t)}">${E(t)}</button>`;
const note=`<article class="document context-note"><p class="eyebrow">LIBRARY / REFLECTIONS</p><h1>Space before plans</h1><p>I took the long way to the park this morning. Without headphones, I noticed the bakery opening and the light moving through the trees.</p><p>I keep coming back to the same thought: <mark>make space before making a plan</mark>.</p><p>A quieter beginning gives the rest of the day a little more room. I want to keep this close when the week gets busy.</p><p><button class="reference-anchor" aria-label="Space before plans reference">Space before plans</button></p><div class="document-actions">${B('Explore this note','primary')}</div></article>`;
const approvedContent=(kind='library')=>{const d=new DOMParser().parseFromString(window.JOURNL_TEMPLATES[`${kind}--${theme}--${mobile?'mobile':'desktop'}`],'text/html');return d.querySelector('.content-scroll').innerHTML};
const sourceDoc=new DOMParser().parseFromString('<div id="payload">'+s.body+'</div>','text/html');let source=sourceDoc.querySelector('#payload');
const unwrap=()=>{const n=source.querySelector(':scope>.document,:scope>.content,:scope>.modal-surface,:scope>.auth-form');if(n)source.innerHTML=n.innerHTML;source.querySelectorAll(':scope>h1,:scope>.eyebrow,.modal-top,.context-excerpt').forEach(n=>n.remove())};unwrap();
source.querySelectorAll('.btn.primary,.menu button').forEach(b=>{if(/^(Delete|Remove copy|Unlink|Sign out|Revoke)/.test(b.textContent.trim())){b.classList.remove('primary');b.classList.add('danger')}});
source.querySelectorAll('input[type="checkbox"]').forEach(input=>{if(!input.closest('label')){const parent=input.parentElement,label=document.createElement('label');label.className='checkbox-row';while(parent.firstChild)label.append(parent.firstChild);parent.append(label);input.setAttribute('aria-label',label.textContent.trim()||'Select item')}});
source.querySelectorAll('.row').forEach(r=>{if(/^Continue with (Google|GitHub)$/.test(r.textContent.trim()))r.outerHTML=B(r.textContent.trim())});
let kind='route',anchor='selection';
if(s.family==='editor'&&(/^(block-types-|toolbar-more$|alignment$|colors-|slash-|block-context$|link-|code-languages$|table-row-|table-column-|table-cell-|selection-(block-type|colors|alignment|insert-link|more-actions)$|reference-slash)/.test(id)))kind='popover';
if(s.family==='editor'&&/selection-(block-type|colors|alignment|insert-link|more-actions)/.test(id)){const panel=source.querySelector('.anchored-panel');if(panel)source.innerHTML=panel.innerHTML}
if(s.family==='editor'&&['block-action-delete','table-state-delete-confirm'].includes(id))kind='modal';
if(s.family==='references'&&(/^(display-menu|preview-)/.test(id))){kind='popover';anchor='reference'}
if(s.family==='library'&&/^(root-add|folder-menu|page-menu)$/.test(id)){kind='popover';anchor=id==='root-add'?'library-add':id==='folder-menu'?'folder':'page'}
if(s.family==='library'&&/^(move-|delete-)/.test(id))kind='modal';
if(s.family==='journal'&&/^convert-/.test(id)&&id!=='convert-success')kind='modal';
if(s.family==='journal'&&/^(date-history|journal-modes)$/.test(id)){kind='popover';anchor='journal'}
if(s.family==='shared'&&/^search-/.test(id))kind='modal';
if(s.family==='shared'&&/^(modal-focus|dev-invites|dev-query)/.test(id))kind='modal';
if(s.family==='shared'&&/^(empty-menu|narrow-route-actions|journal-route-menu)$/.test(id)){kind='popover';anchor='journal'}
if(id==='navigation-mobile')kind='navigation-sheet';
if(s.family==='chat'&&/^(source-picker|source-overflow|reasoning-options)/.test(id)){kind='popover';anchor=id==='reasoning-options'?'mode':'source'}
if(s.family==='account'&&id==='user-menu'){kind='popover';anchor='account'}
if(s.family==='account'&&id==='avatar-choose'){kind='popover';anchor='avatar'}
if(s.family==='account'&&/^(reauth-|linked-unlink|sessions-revoke)/.test(id))kind='modal';
if(s.family==='billing'&&/^(subscription-modal|subscription-intercepted)$/.test(id))kind='modal';
if(s.family==='auth'&&/modal|intercepted/.test(id))kind='modal';
if(s.family==='recovery'&&!/^(persistent-notice|reconnect-retry)$/.test(id))kind='modal';
if(id==='toolbar'||['buttons','fields','resize-boundaries','conditional-actions','provider-configuration'].includes(id))kind='component-reference';
window.surfaceSemantics={kind,anchor,stateId:id,reason:kind==='component-reference'?'Supplemental component/conditional-action plate, not a replacement for contextual route coverage':'Contextual composition based on current source pointers and accepted state inventory',sourcePaths:s.sourcePaths};
// Fix standalone auth extraction: the old story is content, never a second form heading.
if(s.family==='auth'){
 const titles={'sign-in':'Welcome back','invite':'Enter your invitation','sign-up':'Create your account','forgot-full':'Reset your password','reset-full':'Choose a new password','verify-email':'Check your inbox','auth-error':'We could not complete sign-in','not-found':'This page is not here'};
 const inner=sourceDoc.querySelector('.auth-form');if(inner)source.innerHTML=inner.innerHTML;source.querySelectorAll('.auth-story,.wordmark,:scope>h1').forEach(n=>n.remove());
 const title=titles[id]||s.title.split(' · ')[0];const card=document.querySelector('.auth-card');if(card){card.querySelector('h1').textContent=title;card.querySelector('.state-content').innerHTML=source.innerHTML;card.querySelectorAll('.row').forEach(r=>{if(/^Continue with/.test(r.textContent.trim()))r.outerHTML=B(r.textContent.trim())})}
 s.reviewTitle=title;
}
if(s.family==='marketing'){window.contextReady=true;return}
const scroll=document.querySelector('.content-scroll');
const pageContext=['editor','references'].includes(s.family)||(s.family==='library'&&!/^(all-pages|library-folders|folder-|tree-|root-add|new-folder|drag-|move-|delete-)/.test(id))||id==='context-page';
function header(){const location=document.querySelector('.top .location');if(!location)return;if(id==='context-explore'){location.innerHTML='Explore <span>Your connections</span>';document.querySelectorAll('.workspace>.nav .nav-links .btn').forEach(e=>{e.classList.toggle('chosen',e.textContent.includes('Explore'));if(e.textContent.includes('Explore'))e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')});return}const h=pageContext?'Library <span>Reflections / Space before plans</span>':s.family==='library'&&/folder-/.test(id)?'Library <span>Reflections</span>':s.family==='recovery'?'Journal <span>A slower start · Draft recovery</span>':null;if(h)location.innerHTML=h;if(pageContext&&id==='page-blank')location.innerHTML='Library <span>Untitled page</span>';if(pageContext&&id==='fixture-page-comparison')location.innerHTML='Library <span>Browser folder / Browser note 01</span>';if(pageContext){document.querySelectorAll('.workspace>.nav .nav-links .chosen').forEach(e=>{e.classList.remove('chosen');e.removeAttribute('aria-current')});const leaf=document.querySelector('.workspace>.nav .leaf');if(leaf){leaf.classList.add('selected-leaf');leaf.setAttribute('aria-current','page')}}}
header();
if(kind==='route'||kind==='component-reference'){
 if(s.family==='account')document.querySelectorAll('.state-content .row').forEach(r=>{const text=r.textContent.trim();if(/ · (Unlink|Link)$/.test(text)){const action=text.endsWith('Unlink')?'Unlink':'Link';r.innerHTML='<span>'+E(text.replace(/ · (Unlink|Link)$/,''))+'</span>'+B(action);r.classList.add('account-action-row')}});
 if(pageContext&&scroll){const h=scroll.querySelector('h1');if(h&&/^selection-/.test(id)){h.textContent='Space before plans';scroll.querySelector('.eyebrow')?.remove()}}
 if(scroll&&s.family==='library'&&/^page-(loading|error|unsupported|read-only|title-editing)$/.test(id)){const h=scroll.querySelector('h1');if(h)h.textContent='Space before plans'}
 if(scroll&&s.family==='library'&&/^folder-(nested|empty|loading|error|page-)/.test(id)){const h=scroll.querySelector('h1');if(h)h.textContent='Reflections'}
 if(s.family==='references'&&/^backlinks-/.test(id)&&scroll){scroll.innerHTML=note;scroll.querySelector('.context-note').insertAdjacentHTML('beforeend','<section class="backlinks-context"><h2>Backlinks</h2>'+source.innerHTML+'</section>')}
 if(s.family==='library'&&/^(folder-rename-|new-folder-)/.test(id)&&scroll){const payload=source.innerHTML;scroll.innerHTML=approvedContent();const table=scroll.querySelector('.page-table');table.insertAdjacentHTML('beforebegin','<section class="inline-edit"><h2>'+E(s.title.split(' · ')[0])+'</h2>'+payload+'</section>');scroll.querySelector('h1').textContent='Reflections';}
 if(s.family==='shared'&&/^context-(page|journal|explore)$/.test(id)&&scroll)scroll.innerHTML=id==='context-explore'?approvedContent('explore'):note;
 if(kind==='component-reference')document.body.dataset.referencePlate='true';if(p.get('scroll')==='content-end')requestAnimationFrame(()=>document.querySelectorAll('.conversation,.content-scroll').forEach(e=>e.scrollTop=e.scrollHeight));window.contextReady=true;return;
}
document.body.classList.remove('secondary-scene');document.body.classList.add('contextual-scene');
// Re-establish a populated route beneath every overlay instead of a generic catalog page.
if(s.family==='auth'){
 document.body.innerHTML=window.JOURNL_TEMPLATES[`landing--${theme}--${mobile?'mobile':'desktop'}`];document.body.className='landing contextual-scene auth-overlay-context';const frame=document.querySelector('.product-frame');frame.innerHTML=`<img class="canonical-hero" src="../screenshots/library/all-pages--${theme}--${mobile?'mobile':'desktop'}.png" width="${mobile?390:1440}" height="${mobile?844:1000}" alt="Journl Library dashboard">`;
}else if(scroll){
 if(s.family==='library'||anchor==='account'||anchor==='avatar')scroll.innerHTML=approvedContent();
 else if(s.family==='explore')scroll.innerHTML=approvedContent('explore');
 else if(s.family==='chat'){const c=document.querySelector('.conversation');if(c)c.innerHTML='<div class="user">What could I leave a little more room for today?</div><div class="assistant"><p>Your note comes back to one idea: make space before making a plan.</p></div>'}
 else scroll.innerHTML=['journal','recovery','shared'].includes(s.family)?note.replace('LIBRARY / REFLECTIONS','MONDAY, NOVEMBER 16, 2026').replace('<h1>Space before plans</h1>','<h1>A slower start</h1>'):note;
}
header();
let trigger=null;
if(anchor==='folder'&&scroll){scroll.innerHTML=approvedContent();scroll.querySelector('h1').textContent='Folders';scroll.querySelector('.page-table').innerHTML='<div class="table-label"><span>FOLDER</span><span>CONTENTS</span><span>ACTIONS</span></div>'+['Reflections','Reading'].map((f,i)=>`<article class="page-row"><div class="page-cell"><div>${B(f,'page-name')}<small class="mobile">${i?1:2} pages</small></div></div><span class="folder-meta">${i?1:2} pages</span><button type="button" class="btn icon-btn row-action" aria-label="${f} actions" aria-haspopup="menu">⋯</button></article>`).join('');trigger=scroll.querySelector('.row-action')}
if(anchor==='page'){scroll.innerHTML=note;trigger=mobile?document.querySelector('.top button[aria-label="Route actions"]'):document.querySelector('.workspace>.nav .leaf .row-action')}
if(anchor==='library-add')trigger=document.querySelector('.nav-label button')||document.querySelector('.page-heading>.btn');
if(anchor==='reference')trigger=scroll?.querySelector('.reference-anchor');
if(anchor==='source')trigger=document.querySelector('.composer-controls .icon-btn')||document.querySelector('.composer-controls button');
if(anchor==='mode')trigger=document.querySelector('.composer .mode');
if(anchor==='account')trigger=document.querySelector('.nav-bottom button');
if(anchor==='avatar'&&scroll){scroll.innerHTML='<article class="document context-note"><h1>Your account</h1><h2>Profile</h2><button class="avatar-trigger" aria-label="Change avatar">SR</button><label class="field"><span>Name</span><input value="Sam Rivera"></label>'+B('Save profile','primary')+'</article>';trigger=scroll.querySelector('.avatar-trigger')}
if(anchor==='journal'){trigger=document.querySelector('.top .location');if(trigger){trigger.innerHTML='Journal '+B('Entries ▾','journal-trigger');trigger=trigger.querySelector('button')}}
if(anchor==='selection'&&scroll){
 const selection=s.body.includes('selection-work')?new DOMParser().parseFromString(s.body,'text/html').querySelector('.selection-work'):null;
 if(selection){selection.querySelector('h1').textContent='Space before plans';selection.querySelector('.eyebrow')?.remove();selection.querySelectorAll('.anchored-panel').forEach(e=>e.remove());scroll.innerHTML='<article class="document context-note">'+selection.innerHTML+'</article>'}
 else scroll.innerHTML=['journal','recovery','shared'].includes(s.family)?note.replace('LIBRARY / REFLECTIONS','MONDAY, NOVEMBER 16, 2026').replace('<h1>Space before plans</h1>','<h1>A slower start</h1>'):note;
 const table=source.querySelector('table');if(table){scroll.querySelector('.context-note').insertAdjacentHTML('beforeend',table.outerHTML);table.remove()}
 let toolbar=scroll.querySelector('.selection-toolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.className='selection-toolbar';toolbar.innerHTML=B('Text ▾','context-trigger')+B('Bold')+B('Link')+B('More actions');const mark=scroll.querySelector('mark');mark.parentElement.insertAdjacentElement('afterend',toolbar)}
 trigger=toolbar.querySelector(/link-/.test(id)?'[aria-label="Insert link"]':/selection-colors|colors-/.test(id)?'[aria-label="Text color"]':'[aria-label="Block type"]')||toolbar.querySelector('button');
}
if(!trigger){trigger=document.querySelector('.top button[aria-label*="Save"]')||document.querySelector('.top button')||document.querySelector('.public-actions a')}
if(trigger){trigger.classList.add('context-trigger-open');trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls','context-surface');trigger.closest('.page-row,.folder,.leaf')?.classList.add('menu-open')}
if(id==='journal-route-menu')source.innerHTML='<div class="menu">'+['Entries','Timeline','Browse dates / history','Today'].map(t=>B(t,t==='Entries'?'selected':'')).join('')+'</div>';
let payload=source.innerHTML;
// Keep contextual source labels without repeating a route title inside the overlay body.
const heading=(id==='folder-menu'?'Reflections':id==='page-menu'?'Space before plans':id==='selection-block-type'?'Turn into':id.startsWith('slash-')?'Insert a block':s.reviewTitle||s.title.split(' · ')[0]);
source.querySelectorAll('h1,h2,h3').forEach(h=>{if(h.textContent.trim()===heading)h.remove()});payload=source.innerHTML;
if(id==='folder-menu'&&scroll){scroll.querySelector('.tabs').innerHTML=B('All pages')+B('Folders','selected');scroll.querySelector('.page-heading>.btn').textContent='+ New folder';scroll.querySelector('.count').textContent='2 folders';scroll.querySelector('.search input').placeholder='Find a folder by name';document.querySelector('.top .location').innerHTML='Library <span>Folders</span>'}
const modal=kind==='modal'||kind==='navigation-sheet'||mobile;
let overlay=document.createElement(modal?'dialog':'section');overlay.id='context-surface';overlay.className='context-surface '+(modal?'context-modal':'context-popover')+(mobile&&kind!=='modal'?' context-sheet':'');overlay.setAttribute('aria-label',heading);overlay.setAttribute('aria-labelledby','context-title');overlay.setAttribute('data-state-region',id);if(!modal){overlay.setAttribute('role',source.querySelector('.menu')?'menu':'dialog')}
let footer='';const lastActions=source.querySelectorAll('.actions');if(kind==='modal'&&lastActions.length){const a=lastActions[lastActions.length-1];footer=a.outerHTML;a.remove();payload=source.innerHTML}
if(kind==='navigation-sheet'){payload=document.querySelector('#nav-sheet .nav')?.outerHTML||payload;overlay.classList.add('navigation-overlay')}
overlay.innerHTML=`<header class="context-head"><h2 id="context-title">${E(heading)}</h2><button class="btn icon-btn context-close" type="button" aria-label="Close ${E(heading)}">×</button></header><div class="context-scroll">${payload}</div>${footer?`<footer class="context-footer">${footer}</footer>`:''}`;
document.body.append(overlay);
if(modal){overlay.showModal()}else{
 const r=trigger?.getBoundingClientRect()||{left:innerWidth/2,top:240,bottom:280,right:innerWidth/2};
 const width=Math.min(['folder','page','library-add','account','journal','mode'].includes(anchor)?288:400,innerWidth-48);overlay.style.width=width+'px';overlay.style.left=Math.max(16,Math.min(innerWidth-width-16,r.left))+'px';const below=innerHeight-r.bottom-24,above=r.top-24;
 const h=Math.min(overlay.scrollHeight,560,Math.max(below,above));overlay.style.maxHeight=Math.max(160,h)+'px';overlay.style.top=(below>=Math.min(overlay.scrollHeight,360)||below>=above?r.bottom+8:Math.max(16,r.top-Math.min(h,overlay.scrollHeight)-8))+'px';
}
const close=()=>{if(modal)overlay.close();else overlay.remove();trigger?.setAttribute('aria-expanded','false');trigger?.focus()};overlay.querySelector('.context-close').addEventListener('click',close);overlay.addEventListener('cancel',e=>{e.preventDefault();close()});
overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const items=[...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href]')].filter(e=>e.getBoundingClientRect().height);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
overlay.querySelectorAll('button').forEach(b=>{b.type='button';if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',b.textContent.trim())});
const scrollVariant=p.get('scroll');if(scrollVariant){const cs=overlay.querySelector('.context-scroll');cs.scrollTop=scrollVariant.includes('end')?100000:Math.max(80,cs.clientHeight*.8)*Number(scrollVariant.split('-')[1]||1)}
window.contextSurface={kind,modal,triggerLabel:trigger?.getAttribute('aria-label')||trigger?.textContent.trim(),actions:[...overlay.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean)};
window.contextReady=true;
})();
