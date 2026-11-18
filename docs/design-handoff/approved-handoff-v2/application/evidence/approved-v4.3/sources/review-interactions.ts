/* Scene interactions only. No service calls or simulated product mutations. Generated JS is a browser-compatible copy of this TypeScript source. */
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const go=route=>location.href=route+'--'+document.body.dataset.mode+'--'+(innerWidth<=700&&route!=='chat'?'mobile':'desktop')+'.html';
let trigger=null,menu=null;
function closeMenu(){if(!menu)return;menu.remove();menu=null;if(trigger){trigger.setAttribute('aria-expanded','false');trigger.parentElement.classList.remove('menu-open');trigger.focus()}trigger=null}
function openMenu(b){closeMenu();trigger=b;b.setAttribute('aria-expanded','true');b.parentElement.classList.add('menu-open');menu=document.createElement('div');menu.className='row-popover';menu.id='row-actions-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',b.getAttribute('aria-label'));b.setAttribute('aria-controls',menu.id);const h=document.createElement('h2');h.textContent=b.getAttribute('aria-label').replace(/^Actions for /,'').replace(/ actions$/,'');const close=document.createElement('button');close.className='btn';close.setAttribute('role','menuitem');close.textContent='Close menu';close.onclick=closeMenu;menu.append(h,close);document.body.append(menu);const r=b.getBoundingClientRect();menu.style.left=Math.min(Math.max(16,r.right-menu.offsetWidth),innerWidth-menu.offsetWidth-16)+'px';menu.style.top=Math.min(r.bottom+8,innerHeight-menu.offsetHeight-16)+'px';close.focus()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu){e.preventDefault();closeMenu()}if(menu&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();menu.querySelector('button').focus()}});
document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target)&&!trigger.contains(e.target))closeMenu()});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const l=(b.getAttribute('aria-label')||b.textContent).trim();
 if(b.classList.contains('row-action')){if(trigger===b)closeMenu();else openMenu(b);return}
 if(l==='Toggle navigation'){if(innerWidth>700)document.body.classList.toggle('nav-collapsed');else $('#nav-sheet').showModal()}
 if(l==='Close navigation')$('#nav-sheet').close();
 if(l==='Route actions')$('#route-menu').showModal();
 if(l==='Instant / Thinking')$('#mode-menu').showModal();
 if(l==='Close')b.closest('dialog')?.close();
 if(b.closest('.nav-links')){if(l==='Explore')go('explore');if(l==='All pages')go('library');if(l==='Journal')go('chat')}
 if(l.startsWith('Ask Journl ·')){if($('.agent')){$('.agent').hidden=false;$('.workspace').classList.add('chat-open');$('.assistant-float')?.remove();$('.surface').classList.remove('has-assistant')}else go('chat')}
 if(l==='Collapse Ask Journl'){$('.agent').hidden=true;$('.workspace').classList.remove('chat-open');document.body.classList.remove('expanded');$('.surface').classList.add('has-assistant');const wrap=document.createElement('div');wrap.className='assistant-float';wrap.innerHTML='<button class="btn pill" aria-label="Ask Journl · New reply">Ask Journl <span class="dot"></span></button>';$('.surface').append(wrap)}
 if(l==='Resize / expand agent'){$('.agent').style.width='';document.body.classList.toggle('expanded')}
 if(l==='Remove source')$('.source-chip').hidden=true;
 if(l==='Attach note source')$('.source-chip').hidden=false;
 if(l==='Instant'||l==='Thinking'){const c=$('.composer .mode');if(c)c.textContent=l+' ⌄';b.closest('dialog')?.close()}
 if(l==='Copy'){try{await navigator.clipboard.writeText(b.closest('.assistant').innerText)}catch{}b.textContent='Copied'}
 if(l==='Retry'){const turn=b.closest('.assistant');turn.style.opacity='.6';setTimeout(()=>turn.style.opacity='1',200)}
 if(l==='Send message'){const t=$('.composer textarea');if(t.value.trim()){const el=document.createElement('div');el.className='user';el.textContent=t.value.trim();$('.conversation').append(el);t.value='';el.scrollIntoView({block:'nearest'})}}
 if(b.closest('.library-toolbar .tabs')){b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));$$('.page-row').forEach(r=>r.hidden=l==='Folders'&&r.textContent.includes('Things worth keeping'))}
 if(['Unlinked notes ⌄','Newest first ⌄'].includes(l))$('#filter-menu')?.showModal();
 if(b.closest('#filter-menu')&&b.classList.contains('menu-option')){const items=[...b.parentNode.querySelectorAll('.menu-option')],group=items.indexOf(b)<2?items.slice(0,2):items.slice(2);group.forEach(x=>{x.classList.toggle('selected',x===b);x.textContent=x.textContent.replace('✓ ','')});b.textContent='✓ '+b.textContent}
});
$('[aria-label="Find a page"]')?.addEventListener('input',e=>$$('.page-row').forEach(r=>r.hidden=!r.querySelector('.page-name').textContent.toLowerCase().includes(e.target.value.toLowerCase())));
$$('.resize').forEach(handle=>{handle.tabIndex=0;handle.setAttribute('aria-orientation','vertical');const panel=handle.closest('.agent,.nav'),agent=panel.classList.contains('agent');function set(w){panel.style.width=Math.max(agent?360:180,Math.min(agent?704:320,w))+'px'}handle.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();set(panel.offsetWidth+(e.key==='ArrowRight'?16:-16)*(agent?-1:1))}});handle.addEventListener('pointerdown',e=>{handle.setPointerCapture(e.pointerId);const start=e.clientX,w=panel.offsetWidth;const move=ev=>set(w+(ev.clientX-start)*(agent?-1:1));handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',()=>handle.removeEventListener('pointermove',move),{once:true})})});
})();
