export type Scene = {key:string; title:string; route:string; state:string; width:number; height:number; theme:string; group:string}

const pairs = (key:string,title:string,route:string,state:string,width:number,height:number,group:string):Scene[] =>
  ['light','dark'].map(theme=>({key:key+'-'+theme,title,route,state,width,height,theme,group}));

export const scenes:Scene[]=[
  ...pairs('garden-1440','Small balcony garden','Project','Both panels open',1440,1000,'Workspace'),
  ...pairs('garden-1920','Small balcony garden','Project','Both panels open',1920,1080,'Workspace'),
  ...pairs('agent-closed','Agent closed','Project','Navigation open, floating Ask Journl',1440,1000,'Panel states'),
  ...pairs('nav-compact','Navigation compact','Project','Agent open, icon rail',1440,1000,'Panel states'),
  ...pairs('all-pages','All pages','All pages','All pages tab, empty name search',1440,1000,'Routes'),
  ...pairs('journal','Friday journal','Journal','Entries tab, Nov 20 selected',1440,1000,'Routes'),
  ...pairs('tree-states','Navigation and citations','Project','First, middle, last and nested rows, selected + hover, keyboard focus, source and composer focus',1440,1000,'Interaction plates'),
  ...pairs('table-states','Index row and overflow','All pages','Hovered first row, open overflow on third row',1440,1000,'Interaction plates'),
  ...pairs('composer-error','Composer recovery','Project','Send disabled after failure, draft preserved, Retry visible',1440,1000,'Interaction plates'),
  ...pairs('composer-loading','Composer loading','Project','Response pending, send disabled',1440,1000,'Interaction plates'),
  ...pairs('formatting-states','Editor formatting','Project','Text selected, formatting toolbar and block menu open',1440,1000,'Interaction plates'),
  ...pairs('composer-streaming','Streaming response','Project','Partial response visible, Stop available',1440,1000,'Interaction plates'),
  ...pairs('mobile-nav','Navigation sheet','Project','Navigation sheet open',390,844,'Tablet and phone'),
  ...pairs('mobile-agent','Agent sheet','Project','Agent sheet open',390,844,'Tablet and phone'),
  ...pairs('tablet','Tablet workspace','Project','Compact navigation, agent closed',834,1112,'Tablet and phone'),
];

const paths:Record<string,string>={
 compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
 format:'<path d="M4 18 9 6l5 12M6 14h6m3 4h6m-3-3v6"/>',
 bold:'<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zm0 7h7a3.5 3.5 0 0 1 0 7H7z"/>',
 italic:'<path d="M11 5h7M6 19h7m2-14-6 14"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
 stop:'<rect x="7" y="7" width="10" height="10" rx="1"/>',
 panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
 right:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
 search:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 journal:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h4"/>',
 page:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
 pages:'<rect x="7" y="5" width="12" height="15" rx="2"/><path d="M4 17V6a3 3 0 0 1 3-3h9m-6 7h6m-6 4h6"/>',
 folder:'<path d="M3 6h7l2 2h9v11H3z"/>',
 pin:'<path d="m9 3 9 9-4 1-3 4-4-4 4-3zM8 16l-4 4"/>',
 spark:'<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 down:'<path d="m6 9 6 6 6-6"/>',chevron:'<path d="m9 6 6 6-6 6"/>',left:'<path d="m15 6-6 6 6 6"/>',
 history:'<path d="M4 11a8 8 0 1 1 2 6m-2-10v5h5m3-5v5l3 2"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/>',
 leaf:'<path d="M20 4c0 12-4 15-10 15a6 6 0 0 1-6-6C4 7 8 4 20 4ZM4 20 14 10"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/>',
 link:'<path d="m10 14 4-4m-6 7-1 1a4 4 0 0 1-5-5l4-4a4 4 0 0 1 5 0m2 6a4 4 0 0 0 5 0l4-4a4 4 0 0 0-5-5l-1 1"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H4v12"/>',
 refresh:'<path d="M20 9a8 8 0 1 0 0 6m0-11v5h-5"/>', arrow:'<path d="M12 19V5m-6 6 6-6 6 6"/>',
 x:'<path d="m6 6 12 12M18 6 6 18"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
};
const icon=(name:string)=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
const control=(name:string,label:string,extra='')=>`<button type="button" class="icon-btn ${extra}" aria-label="${label}">${icon(name)}</button>`;
const pill=(name:string,label:string,extra='')=>`<button type="button" class="pill ${extra}">${icon(name)}${label}</button>`;
const row=(name:string,title:string,classes='',tail='')=>`<button type="button" class="navrow ${classes}" aria-label="${title}">${icon(name)}<span class="truncate">${title}</span>${tail ? '<span class="trail">'+tail+'</span>' : ''}</button>`;

function navigation(s:Scene,compact:boolean,sheet:boolean){
 const plate=s.key.startsWith('tree-states');
 const logo=compact?'mark':'lockup';
 return `<aside class="nav panel glass">${sheet?'<div class="sheet-grip"></div>':''}<div class="brand row"><img src="../references/${logo}-${s.theme}.svg" alt="Journl" width="${compact?26:102}">${sheet?'<div class="spacer"></div>'+control('x','Close navigation'):compact?'':'<div class="spacer"></div>'+control('panel','Compact navigation')}</div>
 ${compact?`<div class="nav-scroll">${[['panel','Expand navigation'],['search','Search'],['plus','New page'],['journal','Journal'],['pages','All pages'],['compass','Explore'],['folder','Projects']].map(([glyph,label])=>`<button class="navrow ${label==='Projects'?'selected':''}" aria-label="${label}">${icon(glyph)}</button>`).join('')}</div><div class="nav-footer"><button class="navrow" aria-label="Maya Lee, account and plan settings"><span class="avatar">ML</span></button></div>`:
 `<div class="nav-scroll">${row('search','Search',plate?'hovered':'','<kbd>⌘ K</kbd>')}${row('plus','New page','mint')}
 <div class="label">Workspace</div>
 ${row('journal','Journal',s.route==='Journal'?'selected':'')}${row('pages','All pages',s.route==='All pages'?'selected':'')}
 ${row('compass','Explore',plate?'hovered':'')}
 <div class="label row">Folders<span class="spacer"></span>${control('plus','New folder')}</div>
 ${row('folder','Projects','',icon('down'))}
 ${row('page','Small balcony garden','nested '+(s.route==='Project'?'selected ':'')+(plate?'hovered':''))}
 ${plate?`<div class="nested-actions row">${control('plus','Add child page')}${control('more','Page actions')}</div>`:''}
 ${row('page','Kitchen shelf build','nested '+(plate?'hovered focused':''))}
 ${row('folder','Recipes','',icon('chevron'))}
 ${row('folder','References','',icon('chevron'))}
 ${row('folder','Random notes',plate?'hovered':'',icon('chevron'))}
 </div><div class="nav-footer"><div class="navrow row"><span class="avatar">ML</span><span class="account-name"><strong>Maya Lee</strong><small>Personal account</small></span></div>${row('settings','Plan &amp; settings')}</div>`}
 ${sheet||compact?'':'<span class="grip" aria-hidden="true">⠿</span>'}</aside>`;
}

function project(s:Scene){
 const formatting=s.key.startsWith('formatting-states');
 const toolbar=formatting?`<div class="format-tools row" role="toolbar" aria-label="Text formatting">${control('bold','Bold','focused hovered')}${control('italic','Italic')}${control('link','Add link')}<span class="format-divider"></span>${control('list','List')}${control('more','Block actions')}</div>`:'';
 const blockMenu=formatting?`<div class="block-tools">${control('more','Block actions','hovered')}<div class="menu block-menu" aria-label="Block actions"><button class="hovered">${icon('format')} Turn into</button><button>${icon('copy')} Duplicate</button><button>${icon('x')} Delete</button></div></div>`:'';

 return `<article class="document"><span class="doc-mark mint">${icon('leaf')}</span><div class="doc-meta">Projects <span aria-hidden="true">/</span> Garden planning</div>
 <h1>Small balcony garden</h1><p class="lede">A working plan for a narrow east-facing balcony, with room for herbs, salad greens, and a chair by the rail.</p>
 <div class="properties"><span class="badge mint">${icon('clock')} In progress</span><span class="badge">Spring planting</span><span class="badge peach">${icon('sun')} Morning sun</span></div>
 <section class="doc-section"><h2>What fits</h2>${toolbar}<div class="editor-block ${formatting?'with-block-menu':''}"><p>The balcony gets ${formatting?'<mark class="text-selection">direct sun from about 8 to 11 a.m.</mark>':'direct sun from about 8 to 11 a.m.'} Keep the walkway clear and use two rail planters plus one floor pot near the warm wall.</p>${blockMenu}</div></section>
 <section class="doc-section"><h2>This week</h2><ul class="tasks"><li><span class="check done">${icon('check')}</span>Measure rail depth and check bracket clearance</li><li><span class="check"></span>Pick up two shallow rail planters and saucers</li><li><span class="check"></span>Start parsley and cut-and-come-again lettuce</li></ul></section>
 <section class="doc-section"><h2>Planting map</h2><div class="beds"><div class="bed"><strong>Rail planter A</strong><small>Parsley · chives</small></div><div class="bed"><strong>Rail planter B</strong><small>Loose-leaf lettuce</small></div><div class="bed"><strong>Floor pot</strong><small>Basil · warm wall</small></div></div></section>
 <section class="doc-section"><h2>Related pages</h2><div class="related">${pill('link','Useful growing notes')}${pill('link','Lemon &amp; herb lentils')}</div></section></article>`;
}

const entries=[
 ['Small balcony garden','Projects','mint'],
 ['Lemon &amp; herb lentils','Recipes','peach'],
 ['Useful growing notes','References',''],
 ['Kitchen shelf build','Projects','mint'],
 ['Weekend market list','Random notes',''],
 ['Pantry shortcuts','Recipes','peach'],
 ['Seed packet notes','References',''],
];

function pages(s:Scene){
 const plate=s.key.startsWith('table-states');
 return `<article class="document list-document"><span class="doc-mark badge">${icon('pages')}</span><h1>All pages</h1><p class="lede">Find pages by name or browse their folders.</p>
 <div class="index-tools">${pill('search','Search by name','name-search')}<span class="spacer"></span>${pill('plus','New page','primary')}</div>
 <div class="tabs"><button class="tab active" aria-current="page">All pages</button><button class="tab">Folders</button></div>
 <div class="table" role="table" aria-label="Pages"><div class="table-grid table-head" role="row"><span role="columnheader">Name</span><span role="columnheader">Folder</span><span role="columnheader" aria-label="Actions"></span></div>
 ${entries.map(([name,folder,tone],i)=>`<div role="row" class="table-grid ${plate&&i===0?'hovered':''}"><div role="cell" class="row">${icon('page')}<strong class="truncate">${name}</strong></div><div role="cell"><span class="badge ${tone}">${folder}</span></div><div role="cell">${control('more','Actions for '+name,plate&&i===2?'focused':'')}${plate&&i===2?`<div class="menu"><button>${icon('page')} Rename</button><button class="hovered">${icon('folder')} Move to folder</button><button>${icon('copy')} Duplicate</button><button>${icon('x')} Delete</button></div>`:''}</div></div>`).join('')}</div></article>`;
}

function journal(){
 return `<article class="document"><span class="doc-mark peach">${icon('journal')}</span><div class="doc-meta">Friday, November 20, 2026</div><h1>Friday, November 20</h1><p class="lede">Daily entries</p>
 <div class="index-tools">${pill('plus','New entry','primary')}</div>
 <section class="doc-section"><div class="journal-entry"><div class="tiny muted">8:35 AM</div><h2>Morning light on the balcony</h2><p>Direct sun reached the rail by eight. The wall stayed warm after the light moved, so that’s where the basil pot can go.</p><div class="related" style="margin-top:9px">${pill('link','Small balcony garden')}</div></div>
 <div class="journal-entry"><div class="tiny muted">12:10 PM</div><h2>Lunch from the pantry</h2><p>Made lemon lentils with the last parsley. Save a little cooking water next time so the dressing coats the lentils.</p><div class="related" style="margin-top:9px">${pill('link','Lemon &amp; herb lentils')}</div></div></section></article>`;
}

function center(s:Scene,closed:boolean){
 const page=s.route==='Project', daily=s.route==='Journal';
 const identity=page?'<span class="desktop-only muted">Projects</span><span class="desktop-only muted">/</span><strong class="truncate">Small balcony garden</strong>':`<strong>${s.route}</strong>`;
 const journalActions=daily?`<div class="row"><button class="pill selected">Entries</button><button class="pill">Timeline</button></div><div class="row">${control('left','Previous date')}${pill('journal','Nov 20')}${control('chevron','Next date')}${control('history','Entry history')}</div>`:'';
 return `<main class="center panel"><header class="bar"><button class="icon-btn mobile-only" aria-label="Open navigation">${icon('menu')}</button><div class="identity row">${identity}</div>${journalActions}<div class="actions row">${page?'<span class="row muted tiny desktop-only">'+icon('check')+' Saved</span>':''}${page?pill('format','Format','format-entry '+(s.key.startsWith('formatting-states')?'selected':'')):''}${control('search',page?'Find in page':'Search workspace')}${control('more',page?'Page actions':'More actions')}</div></header>
 <div class="doc-scroll">${page?project(s):daily?journal():pages(s)}</div>${closed?`<button class="launcher">${icon('spark')} Ask Journl</button>`:''}</main>`;
}

function agent(s:Scene,sheet:boolean){
 const plate=s.key.startsWith('tree-states'), err=s.key.startsWith('composer-error'), loading=s.key.startsWith('composer-loading'), streaming=s.key.startsWith('composer-streaming'), page=s.route==='Project';
 const opening=page?'What should I plant this week?':s.route==='Journal'?'What did I learn about the balcony today?':'Where did I save the notes about morning light?';
 const answer=page?`<p>Start with <strong>parsley and loose-leaf lettuce</strong>. Both fit the rail planters and suit the three hours of morning sun you recorded.</p><p>Put the basil in the floor pot by the warm wall. Your growing notes say to wait until nights stay above <span class="nowrap">13 °C.</span></p>`:s.route==='Journal'?`<p>You recorded that the rail got direct sun by eight, and the wall stayed warm after the light moved. You picked the warm wall for the basil pot.</p>`:`<p><strong>Small balcony garden</strong> is in Projects. Its “What fits” section records direct sun from about 8 to 11 a.m. <strong>Useful growing notes</strong> is filed under References.</p>`;
 const follow=page?'Which planter should I set up first?':'What’s the next step for the garden?';
 return `<aside class="agent panel glass">${sheet?'<div class="sheet-grip"></div>':''}<header class="agent-head row"><span class="agent-title row">${icon('spark')} Ask Journl</span><span class="spacer"></span>${control(sheet?'x':'right','Close agent')}</header>
 <div class="thread"><div class="user-msg message">${opening}</div><div><div class="assistant-msg message">${answer}<div class="sources row">${pill('link',s.route==='Journal'?'Nov 20 journal':'Small balcony garden','source '+(plate?'hovered focused':''))}${pill('link','Useful growing notes','source')}</div></div><div class="msg-actions row">${control('copy','Copy response')}${control('refresh','Regenerate response')}</div></div>
 <div class="user-msg message">${follow}</div>
 <div><div class="assistant-msg message"><p>Set up <strong>Rail planter A</strong> first. Test the brackets before you fill it, then plant parsley and chives together.</p><div class="sources row">${pill('link','Small balcony garden','source')}</div></div><div class="msg-actions row">${control('copy','Copy response')}${control('refresh','Regenerate response')}</div></div>
 ${streaming?`<div class="user-msg message">Can you make a short shopping list?</div><div class="assistant-msg message"><p>Start with two shallow rail planters, matching saucers, and parsley and loose-leaf lettuce seeds.</p><p class="stream-status row">${icon('clock')} Generating…</p></div>`:''}
 ${loading?'<div class="user-msg message">Can you summarize the plan?</div><div class="assistant-msg message row" role="status">'+icon('clock')+' Preparing a response…</div>':''}</div>
 <footer class="composer-area">${err?`<div class="alert row" role="alert">${icon('alert')}<span>Message didn’t send. Your draft is saved.</span><button>Retry</button></div>`:''}
 <div class="composer ${plate?'focused':''}"><div class="draft ${loading||streaming?'muted':''}">${streaming?'Response in progress…':loading?'Waiting for response…':'Can you make a short shopping list?'}${plate?'<span aria-hidden="true">│</span>':''}</div>
 <div class="row composer-controls"><button class="pill model" aria-label="Mode or model: Instant">Instant ${icon('down')}</button>${control('plus','Select sources','source-add')}<span class="context-chip row">${icon('page')}<span class="truncate">${page?'Current page':'Workspace'}</span>${control('x','Remove source','source-remove')}</span><span class="spacer"></span>${streaming?pill('stop','Stop','stop-action focused'):`<button class="primary" aria-label="Send message" ${err||loading?'disabled':''}>${icon('arrow')}</button>`}</div></div></footer>${sheet?'':'<span class="grip" aria-hidden="true">⠿</span>'}</aside>`;
}

export function render(s:Scene){
 const navSheet=s.key.startsWith('mobile-nav'), agentSheet=s.key.startsWith('mobile-agent');
 const compact=s.key.startsWith('nav-compact')||s.key.startsWith('tablet');
 const closed=s.key.startsWith('agent-closed')||s.key.startsWith('tablet')||navSheet;
 return `<!doctype html><html lang="en" class="${s.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOT APPROVED · ${s.title}</title><link rel="stylesheet" href="workspace.css"></head><body><div class="workspace ${closed?'noagent':''} ${compact?'compact':''} ${navSheet?'navsheet':''} ${agentSheet?'agentsheet':''}">${navigation(s,compact,navSheet)}${center(s,closed||agentSheet)}${closed?'':agent(s,agentSheet)}${navSheet||agentSheet?'<div class="scrim"></div>':''}</div><div class="review-status">NOT APPROVED</div></body></html>`;
}
