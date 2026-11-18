// Browser source. scene.js is the byte-identical executable build of this JavaScript-compatible TypeScript.
(()=>{
const params=new URLSearchParams(location.search),id=params.get('state')||'all-pages',mode=params.get('theme')||'light';
const s=window.JOURNL_STATES.find(x=>x.stateId===id);if(!s){document.body.textContent='Unknown review state';return}
const mobile=innerWidth<=700;document.body.dataset.mode=mode;document.body.dataset.state=id;document.body.dataset.family=s.family;
const E=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I=(name)=>{const paths={menu:'M4 6h16M4 12h16M4 18h16',more:'M4 12h.01M12 12h.01M20 12h.01',close:'M6 6l12 12M18 6L6 18',expand:'M4 9V4h5M4 4l6 6M20 15v5h-5M20 20l-6-6',search:'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',page:'M6 3h12v18H6zM9 8h6M9 12h6',chat:'M4 4h16v13H9l-5 4z',add:'M12 5v14M5 12h14',check:'M5 12l4 4L19 6'};return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.page}"/></svg>`};
const button=(label,kind='',icon='')=>`<button type="button" class="btn ${kind}" aria-label="${E(label)}">${icon?I(icon):''}${E(label)}</button>`;
const iconButton=(label,icon)=>`<button type="button" class="btn icon-btn" aria-label="${E(label)}">${I(icon)}</button>`;
let template='library';if(s.family==='explore')template='explore';if(s.family==='chat'&&id!=='chat-closed'&&id!=='chat-unread')template='chat';
let key=`${template}--${mode}--${mobile&&template!=='chat'?'mobile':'desktop'}`;
if(s.family==='marketing'){
 document.body.className='landing';document.body.innerHTML=window.JOURNL_TEMPLATES[`landing--${mode}--${mobile?'mobile':'desktop'}`];
 const frame=document.querySelector('.product-frame');frame.innerHTML=`<img class="canonical-hero" src="../screenshots/library/all-pages--${mode}--${mobile?'mobile':'desktop'}.png" width="${mobile?390:1440}" height="${mobile?844:1000}" alt="Journl Library dashboard with the complete ${mobile?'mobile':'desktop'} application shell">`;
 document.querySelector('.composition-caption').innerHTML='<span>A project. A recipe. A reference. One place to return to.</span><span>Actual redesigned Library capture · synthetic example notes</span>';
 if(id==='marketing-focus')document.querySelector('.marketing-nav a').classList.add('focus-demo');
 document.title='Journl · A home for useful knowledge';window.sceneReady=true;return;
}
if(s.family==='auth'){
 document.body.className='public-scene';let body=s.body.replace(/<h1[^>]*>[\s\S]*?<\/h1>/,'');
 body=body.replace(/<div class="row">Continue with (Google|GitHub)<\/div>/g,(_,v)=>button('Continue with '+v));
 if(!body.trim())body='<p>Your session could not continue.</p>'+button('Return to sign in');
 document.body.innerHTML=`<main class="auth-layout"><section class="auth-intro"><a class="brand" href="/">Journl</a><div><p class="eyebrow">YOUR KNOWLEDGE, TOGETHER</p><h1>A home for<br>what matters.</h1><p>Projects, notes, recipes, references.<br>Keep the pieces close.</p></div><small>Access is currently by invitation.</small></section><section class="auth-panel"><div class="auth-card"><h1>${E(s.title)}</h1><div class="state-content">${body}</div></div></section></main>`;
 document.title='Journl · '+s.title;enhance();window.sceneReady=true;return;
}
document.body.innerHTML=window.JOURNL_TEMPLATES[key];
const top=document.querySelector('.top .location');const familyLabels={journal:'Journal',editor:'Library',library:'Library',explore:'Explore',references:'Library',recovery:'Journal',chat:'Journal',account:'Account',billing:'Account & plan',shared:'Journal'};
top.innerHTML=`${familyLabels[s.family]||'Journl'} <span>${s.family==='library'?'All pages':s.family==='editor'||s.family==='references'?'Space before plans':s.family==='account'?'Settings':s.family==='billing'?'Subscription':s.family==='explore'?'Your connections':'Entries'}</span>`;
document.querySelectorAll('.nav-links .btn').forEach(e=>{const active=(s.family==='explore'&&e.textContent.includes('Explore'))||(['library','editor','references'].includes(s.family)&&e.textContent.includes('All pages'))||(!['explore','library','editor','references'].includes(s.family)&&e.textContent.includes('Journal'));e.classList.toggle('chosen',active);if(active)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')});
const scroll=document.querySelector('.content-scroll');let body=s.body;
const major=['all-pages','all-pages-search','all-pages-no-results','library-folders','explore-evidence','chat-populated','chat-expanded','chat-context','chat-welcome','chat-closed','chat-unread','page-populated','page-blank','journal-populated','journal-empty','journal-timeline','dated-entry','graph-view','thread-detail','folder-detail','fixture-page-comparison'];
if(!major.includes(id)){document.body.classList.add('secondary-scene')}
const stripHeading=(h)=>h.replace(/^\s*<p class="eyebrow">[\s\S]*?<\/p>/,'').replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/,'');
if(['all-pages','all-pages-search','all-pages-no-results','library-folders'].includes(id)){
 // The hero and the review use this same complete approved application scene template.
 scroll.innerHTML=window.JOURNL_TEMPLATES[`library--${mode}--${mobile?'mobile':'desktop'}`].match(/<div class="content-scroll">([\s\S]*?)<\/div><div class="assistant-float">/)[1];
 const replacements=[['Space before plans','A small balcony garden'],['Things worth keeping','Lemon & herb lentils'],['On paying attention','Make room for focus'],['Reflections','Projects'],['Reading','References']];for(const [a,b] of replacements)scroll.innerHTML=scroll.innerHTML.replaceAll(a,b);
 const rows=scroll.querySelectorAll('.page-row');if(rows[1]){rows[1].querySelector('.folder-meta').textContent='Recipes';rows[1].querySelector('small').textContent='Recipes'}
 if(id==='all-pages-search'){scroll.querySelector('input').value='garden';rows.forEach((r,i)=>{if(i)r.remove()});scroll.querySelector('.count').textContent='1 page · Search matches page names'}
 if(id==='all-pages-no-results'){scroll.querySelector('input').value='unmatched';scroll.querySelector('.page-table').innerHTML='<div class="empty"><h2>No matching pages</h2><p>Try another name or clear your search.</p>'+button('Clear search')+'</div>';scroll.querySelector('.count').remove()}
 if(id==='library-folders'){scroll.querySelector('h1').textContent='Folders';scroll.querySelector('.tabs').innerHTML=button('All pages')+button('Folders','selected');scroll.querySelector('.page-heading>.btn').textContent='+ New folder';scroll.querySelector('input').setAttribute('placeholder','Find a folder by name');scroll.querySelector('.page-table').innerHTML='<div class="table-label"><span>FOLDER</span><span>CONTENTS</span><span>ACTIONS</span></div>'+['Projects','Recipes','References'].map((v,i)=>`<article class="page-row"><div class="page-cell">${I('page')}<div>${button(v,'page-name')}<small class="mobile">1 page</small></div></div><span class="folder-meta">1 page</span><button class="btn icon-btn row-action" aria-label="${v} actions" aria-haspopup="menu" aria-expanded="false">${I('more')}</button></article>`).join('');scroll.querySelector('.count').textContent='3 folders'}
 const side=document.querySelector('.workspace>.nav');
 const folders=side.querySelectorAll('.folder');if(folders[0]){folders[0].querySelector('.folder-name').textContent='Projects';folders[0].querySelector('.row-action').setAttribute('aria-label','Projects actions')}
 if(folders[1]){folders[1].querySelector('.folder-name').textContent='References';folders[1].querySelector('.row-action').setAttribute('aria-label','References actions')}
 const leaves=side.querySelectorAll('.leaf');if(leaves[0])leaves[0].querySelector('span').textContent='A small balcony garden';if(leaves[1]){leaves[1].innerHTML='<button class="btn icon-btn" aria-label="Expand Recipes">›</button><button class="btn folder-name" aria-label="Recipes">Recipes</button><button class="btn icon-btn row-action" aria-label="Recipes actions" aria-haspopup="menu" aria-expanded="false">'+I('more')+'</button>';leaves[1].className='folder'}

}else if(id==='explore-evidence'){
 // Keep the approved evidence view unchanged in its complete shell.
}else if(s.family==='chat'&&id!=='chat-closed'&&id!=='chat-unread'){
 const agent=document.querySelector('.agent'),conversation=agent.querySelector('.conversation');
 let fragment=new DOMParser().parseFromString('<div>'+body+'</div>','text/html');
 if(fragment.querySelector('.chat-scroll'))body=fragment.querySelector('.chat-scroll').innerHTML;
 else{fragment.querySelectorAll('.composer,.agent-head,.shared-tabs,.resize').forEach(e=>e.remove());body=fragment.body.firstElementChild.innerHTML}
 body=body.replaceAll('class="chat-turn user"','class="user"').replaceAll('class="chat-turn assistant"','class="assistant"').replaceAll('class="user-bubble"','class="user"').replaceAll('class="assistant-turn"','class="assistant"');
 conversation.innerHTML=body||'<div class="empty"><h2>What’s on your mind?</h2><p>Ask about a note, or start a new thought.</p></div>';
 if(id==='chat-populated'||id==='chat-expanded'){conversation.innerHTML='<div class="user">What seems to help me find more room to think in this entry?</div><div class="assistant"><p>You describe three small changes: taking the long way, leaving your headphones off, and noticing ordinary details.</p><p>The useful shift seems to be making room before trying to solve anything.</p>'+button('A slower start','citation')+'<div class="turn-actions">'+button('Copy')+button('Retry')+'</div></div>'}
 const composer=agent.querySelector('.composer');composer.querySelector('textarea').value='Help me turn this into one question I can return to tomorrow.';
 if(/streaming|thinking$|tool-running/.test(id)){const b=composer.querySelector('.send');b.innerHTML=I('close');b.setAttribute('aria-label','Stop response')}
 if(/quota-free|quota-pro|offline/.test(id)){composer.querySelector('.send').disabled=true}
 if(id==='chat-welcome')conversation.innerHTML='<div class="empty"><h2>What would you like to explore?</h2><p>Bring a note into the conversation, or start with a question.</p>'+button('Attach a note')+'</div>';
 document.body.classList.remove('secondary-scene');if(id==='chat-expanded')document.body.classList.add('expanded');
}else{
 if(id==='chat-closed'||id==='chat-unread')body='<p class="eyebrow">MONDAY, NOVEMBER 16, 2026</p><h1>A slower start</h1><p>I took the long way to the park this morning. Without headphones, I noticed the bakery opening and the light moving through the trees.</p><p>I keep coming back to the same thought: <mark>make space before making a plan</mark>. A quieter beginning gives the rest of the day a little more room.</p>';
 const hasTitle=/<h1[ >]/.test(body);const title=hasTitle?'':`<h1>${E(s.title)}</h1>`;
 const documentState=major.includes(id)||/selection-|readonly|kept-view/.test(id);
 const context=['editor','references','recovery'].includes(s.family)&&!documentState?'<div class="context-excerpt"><small>SPACE BEFORE PLANS</small><p>Make space before making a plan.</p></div>':'';
 scroll.innerHTML=`<article class="document v5-document ${documentState?'':'state-document'}">${context}${title}<div class="state-content" data-state-region="${E(id)}">${body}</div></article>`;
 if(id==='journal-populated'||id==='dated-entry'){scroll.querySelector('h1').textContent=id==='dated-entry'?'Morning without headphones':'A slower start';scroll.insertAdjacentHTML('afterbegin','<div class="journal-view">'+button('Entries','selected')+button('Timeline')+button('Today')+'</div>')}
 if(id==='journal-timeline'){scroll.innerHTML='<div class="page-heading"><h1>Your days, in context</h1></div><div class="journal-view">'+button('Entries')+button('Timeline','selected')+button('Today')+'</div>'+['Monday, November 16','Sunday, November 15','Saturday, November 14'].map((d,i)=>`<section class="timeline-entry"><small>${d}, 2026</small><h2>${i===1?'A little room for today':i===0?'A slower start':'Morning without headphones'}</h2><p>${i===1?'Start writing…':'A walk without headphones made the morning feel less crowded.'}</p>${button('Open entry')}</section>`).join('')}
 if(id==='journal-empty')scroll.querySelector('h1').textContent='A little room for today';
 if(id==='navigation-compact')document.body.classList.add('nav-collapsed');
 if(id==='transparency-reduced')document.body.classList.add('opaque-mode');
}
// New copied nodes get fresh review identities, independently from immutable originals.
document.querySelectorAll('[data-od-comment-id]').forEach(e=>e.setAttribute('data-od-comment-id',crypto.randomUUID()));
function enhance(){
 document.querySelectorAll('button').forEach(b=>{b.type='button';if(!b.getAttribute('aria-label')&&b.textContent.trim())b.setAttribute('aria-label',b.textContent.trim())});
 document.querySelectorAll('input,textarea,select').forEach(e=>{if(!e.getAttribute('aria-label')){const label=e.closest('label');if(label)e.setAttribute('aria-label',label.querySelector('span')?.textContent||label.textContent.trim()||'Value')}});
 document.querySelectorAll('svg:not(.graph):not([role="img"])').forEach(e=>{if(e.closest('.graph'))return;e.classList.add('icon')});
 document.querySelectorAll('.notice.error').forEach(e=>e.setAttribute('role','alert'));
 document.querySelectorAll('.settings-tabs button').forEach(b=>{const text=b.textContent.trim();const active=(text==='Profile'&&!/security|password|linked|sessions|appearance/.test(id))||(text==='Security'&&/security|password|linked|sessions/.test(id))||(text==='Appearance'&&/appearance/.test(id));b.classList.toggle('selected',active);b.setAttribute('aria-selected',String(active))});
 document.querySelectorAll('img[src^="data:image/svg+xml;base64,"]').forEach(img=>{const value=atob(img.getAttribute('src').split(',')[1]).replaceAll('serif','Inter, sans-serif').replaceAll('#EAF3F5','#e9effb').replaceAll('#16786E','#21304a').replaceAll('#CDEAE5','#c4cbff').replaceAll('#173446','#21304a');img.src='data:image/svg+xml;base64,'+btoa(value)});

 document.querySelectorAll('input[type="checkbox"]').forEach(input=>{let label=input.closest('label');if(!label){const parent=input.parentElement;label=document.createElement('label');label.className='checkbox-row';if(parent.matches('.row,p')){while(parent.firstChild)label.append(parent.firstChild);parent.append(label)}else{input.replaceWith(label);label.append(input)}}label.classList.add('checkbox-row');if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',label.textContent.trim()||'Select item')});
 document.querySelectorAll('.btn.primary').forEach(b=>{if(/^(Remove avatar|Remove copy|Delete|Sign out|Revoke)/.test(b.textContent.trim())){b.classList.remove('primary');b.classList.add('danger')}});
 if(mobile)document.querySelectorAll('svg.graph').forEach(g=>{g.setAttribute('viewBox','0 0 320 480');g.innerHTML='<g fill="none" stroke="currentColor"><path d="M160 210L72 92M160 210L248 92M160 210L72 370M160 210L248 370"/></g><g><circle cx="72" cy="92" r="20"/><circle cx="248" cy="92" r="20"/><circle cx="160" cy="210" r="28"/><circle cx="72" cy="370" r="20"/><circle cx="248" cy="370" r="20"/></g><g text-anchor="middle"><text x="72" y="32"><tspan x="72">A slower</tspan><tspan x="72" dy="22">start</tspan></text><text x="248" y="12"><tspan x="248">Morning</tspan><tspan x="248" dy="22">without</tspan><tspan x="248" dy="22">headphones</tspan></text><text x="160" y="260"><tspan x="160">Space before</tspan><tspan x="160" dy="22">plans</tspan></text><text x="72" y="420"><tspan x="72">Leaving</tspan><tspan x="72" dy="22">room</tspan></text><text x="248" y="420"><tspan x="248">On paying</tspan><tspan x="248" dy="22">attention</tspan></text></g>'});

}
enhance();
const nav=document.querySelector('.workspace>.nav');nav?.style.setProperty('--nav-width','216px');
function toggleAgent(){const agent=document.querySelector('.agent');if(agent){agent.hidden=!agent.hidden;document.querySelector('.workspace').classList.toggle('chat-open',!agent.hidden);document.body.classList.toggle('agent-hidden',agent.hidden);return}const aside=document.createElement('aside');aside.className='agent';aside.innerHTML='<header class="agent-head"><div><h2>Ask Journl</h2><small>Current note</small></div>'+iconButton('Expand agent','expand')+iconButton('Close agent','close')+'</header><div class="conversation"><p>What would you like to explore?</p></div><div class="composer"><label for="review-message">Message Ask Journl</label><textarea id="review-message" aria-label="Message Ask Journl"></textarea><div class="composer-controls">'+button('Attach source')+button('Instant')+button('Send','primary')+'</div></div>';document.querySelector('.stage').append(aside);document.querySelector('.workspace').classList.add('chat-open');}
let returnFocus=null;
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const label=b.getAttribute('aria-label')||b.textContent.trim();
 if(/Toggle navigation/.test(label)){if(mobile){const d=document.querySelector('#nav-sheet');d.showModal()}else document.body.classList.toggle('nav-collapsed')}
 if(/Close navigation/.test(label))document.querySelector('#nav-sheet').close();
 if(/Ask Journl|Open agent/.test(label)&&b.closest('.assistant-float'))toggleAgent();
 if(/Expand agent|Expand Ask Journl|Expand assistant|Resize \/ expand agent/.test(label))document.body.classList.toggle('expanded');
 if(/Collapse agent|Close agent|Collapse Ask Journl|Close assistant/.test(label)){const a=document.querySelector('.agent');if(a){a.hidden=true;document.body.classList.add('agent-hidden');document.querySelector('.workspace').classList.remove('chat-open')}}
 if(b.classList.contains('row-action')||/Account menu/.test(label)){
  document.querySelector('.row-popover')?.remove();returnFocus=b;b.setAttribute('aria-expanded','true');b.closest('.folder,.leaf,.page-row')?.classList.add('menu-open');
  const isFolder=!!b.closest('.folder')||id==='library-folders';const labels=/Account menu/.test(label)?['Account settings','Subscription','Sign out']:isFolder?['New page','New folder','Move up','Move down','Move to…','Delete folder']:['Move up','Move down','Move to…','Delete page'];const menu=document.createElement('div');menu.className='row-popover';menu.setAttribute('role','menu');menu.innerHTML=labels.map(x=>`<button type="button" role="menuitem" class="btn ${x.startsWith('Delete')?'danger':''}">${E(x)}</button>`).join('');document.body.append(menu);const r=b.getBoundingClientRect();menu.style.left=Math.max(16,Math.min(innerWidth-menu.offsetWidth-16,r.right-menu.offsetWidth))+'px';menu.style.top=Math.min(innerHeight-menu.offsetHeight-16,r.bottom+8)+'px';menu.querySelector('button').focus();
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('.row-popover')?.remove();if(returnFocus){returnFocus.setAttribute('aria-expanded','false');returnFocus.closest('.menu-open')?.classList.remove('menu-open');returnFocus.focus();returnFocus=null}}if(e.target.matches('.resize')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const a=e.target.closest('.agent');if(a){const w=Math.max(400,Math.min(704,a.getBoundingClientRect().width+(e.key==='ArrowRight'?16:-16)));a.style.width=w+'px'}else nav.style.setProperty('--nav-width',Math.max(192,Math.min(280,nav.getBoundingClientRect().width+(e.key==='ArrowRight'?16:-16)))+'px')}});
document.querySelectorAll('.resize').forEach(r=>{r.tabIndex=0;r.setAttribute('aria-orientation','vertical');r.addEventListener('pointerdown',e=>{r.setPointerCapture(e.pointerId);const start=e.clientX,agent=r.closest('.agent'),el=agent||nav,w=el.getBoundingClientRect().width;const move=ev=>{const value=Math.max(agent?400:192,Math.min(agent?704:280,w+(agent?-1:1)*(ev.clientX-start)));if(agent)el.style.width=value+'px';else el.style.setProperty('--nav-width',value+'px')};r.addEventListener('pointermove',move);r.addEventListener('pointerup',()=>r.removeEventListener('pointermove',move),{once:true})});});
document.title='Journl · '+s.title;
window.sceneReady=true;
})();
