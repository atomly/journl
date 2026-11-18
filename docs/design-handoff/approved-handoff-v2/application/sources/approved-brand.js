/* Exact approved Shifted right assets. Artwork only; retain each existing brand slot. */
(() => {
  const rect = e => {
    const r = e.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
  };
  window.originalBrandRegions = [];
  async function apply() {
    await document.fonts.ready;
    const mode = matchMedia('(forced-colors: active)').matches ? 'mono-ink' : document.body.dataset.mode === 'dark' ? 'dark' : 'light';
    for (const e of document.querySelectorAll('.brand:not([data-approved-brand])')) {
      const r = rect(e), css = getComputedStyle(e);
      const visible = r.width > 0 && r.height > 0;
      const record = {rect:r,visible,parent:e.parentElement.className,original:e.textContent};
      window.originalBrandRegions.push(record);
      e.dataset.approvedBrand = 'shifted-right-v7';
      e.setAttribute('aria-label','Journl');
      if (visible) {
        e.style.width = r.width+'px';
        e.style.height = r.height+'px';
        e.style.flexShrink = '0';
      } else {
        e.style.minHeight = parseFloat(css.fontSize)*1.6+'px';
      }
      e.style.justifyContent = 'flex-start';
      const img = document.createElement('img');
      img.src = '../assets/brand/lockup-'+mode+'.svg';
      img.alt = 'Journl';
      img.className = 'approved-logo-lockup';
      const marketing = !!e.closest('.marketing-nav,.marketing-footer');
      const height = marketing ? 32 : 40;
      const padding = parseFloat(css.paddingLeft)+parseFloat(css.paddingRight);
      const maxWidth = visible ? Math.max(1,r.width-padding) : 160;
      img.style.cssText = 'display:block;object-fit:contain;object-position:left center;flex-shrink:0;width:auto;height:'+(marketing?height:Math.min(height,maxWidth/3.6666875))+'px;max-width:'+(marketing?'none':'100%')+';';
      e.replaceChildren(img);
    }
    await Promise.all([...document.querySelectorAll('.approved-logo-lockup')].map(i=>i.decode()));
    window.brandReady = true;
  }
  window.brandReady = false;
  apply().catch(e=>{window.brandError=String(e);throw e});
  new MutationObserver(()=>{
    if(document.querySelector('.brand:not([data-approved-brand])')) apply();
  }).observe(document.body,{childList:true,subtree:true});
})();
