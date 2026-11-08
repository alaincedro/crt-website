(function(){
  // The site works straight from a folder (no server), so links are built relative
  // to the folder that holds this script. u('/contact#inquiry') -> .../contact/index.html#inquiry
  const ROOT = (document.currentScript && document.currentScript.src)
    ? new URL('.', document.currentScript.src).href : new URL('/', location.href).href;
  const u = p=>{
    if(!p || p[0] !== '/') return p;
    const m = p.match(/^([^?#]*)(.*)$/); let path = m[1];
    if(path === '/' || path.endsWith('/')) path += 'index.html';
    else if(!/\.[a-z0-9]+$/i.test(path.split('/').pop())) path += '/index.html';
    return new URL(path.slice(1) + m[2], ROOT).href;
  };
  // '.../business/index.html' -> '/business' (used to match menu entries)
  const pageKey = href=>{
    const h = new URL(href, location.href).href.split(/[?#]/)[0];
    if(!h.startsWith(ROOT)) return null;
    return '/' + h.slice(ROOT.length).replace(/(^|\/)index\.html$/, '').replace(/\/$/, '');
  };
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav-links');
  if(toggle && nav){
    toggle.addEventListener('click', function(){
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.textContent = isOpen ? 'Close' : 'Menu';
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.textContent='Menu';
    }));
  }
  const params = new URLSearchParams(window.location.search);

  // Swap prices in visible text, e.g. {"1,000,000":"1,200,000"}. One pass, so a new
  // price is never swapped twice. Skips scripts, styles and form fields.
  function crtReplaceNumbers(root, map){
    const keys = Object.keys(map);
    if(!root || !keys.length) return;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[^\\d,])(' + keys.map(esc).join('|') + ')(?![\\d,])', 'g');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && n.parentElement.closest('script,style,textarea,input')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => { const t = n.nodeValue; if(re.test(t)){ re.lastIndex = 0; n.nodeValue = t.replace(re, (m, a, b) => a + map[b]); } re.lastIndex = 0; });
  }

  // ---------------------------------------------------------------
  // Analytics: paste your IDs here to switch tracking on.
  //   GA_ID         e.g. 'G-XXXXXXXXXX'   (Google Analytics 4)
  //   META_PIXEL_ID e.g. '123456789012345' (Meta / Facebook Pixel)
  // While they are empty, no tracking code loads at all.
  // ---------------------------------------------------------------
  const GA_ID = '';
  const META_PIXEL_ID = '';
  // Tracking only loads after the visitor accepts the cookie notice (Rwanda data
  // protection law, Law No. 058/2021). With both IDs empty, no notice is shown.
  const CONSENT_KEY = 'crt_consent';
  const getConsent = ()=>{ try{ return localStorage.getItem(CONSENT_KEY); }catch(e){ return null; } };
  const setConsent = v=>{ try{ localStorage.setItem(CONSENT_KEY, v); }catch(e){} };
  function loadTracking(){
    if(GA_ID){
      const s=document.createElement('script'); s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID; document.head.appendChild(s);
      window.dataLayer=window.dataLayer||[]; window.gtag=function(){dataLayer.push(arguments);}; gtag('js', new Date()); gtag('config', GA_ID, {anonymize_ip:true});
    }
    if(META_PIXEL_ID){
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', META_PIXEL_ID); fbq('track','PageView');
    }
  }
  if(GA_ID || META_PIXEL_ID){
    const choice = getConsent();
    if(choice === 'yes') loadTracking();
    else if(choice !== 'no'){
      const bar = document.createElement('div');
      bar.className = 'consent'; bar.setAttribute('role','region'); bar.setAttribute('aria-label','Cookie notice');
      bar.innerHTML = '<p>We use cookies to see which pages and ads work. <a href="/privacy#analytics">Privacy</a></p>'+
        '<div class="consent-actions"><button type="button" class="btn small ghost" data-c="no">Decline</button><button type="button" class="btn small" data-c="yes">Accept</button></div>';
      bar.addEventListener('click', e=>{
        const b = e.target.closest('[data-c]'); if(!b) return;
        setConsent(b.dataset.c); bar.remove();
        if(b.dataset.c === 'yes') loadTracking();
      });
      document.body.appendChild(bar);
    }
  }
  const trackLead = (label)=>{
    if(typeof window.gtag==='function') gtag('event','generate_lead',{form_location:location.pathname,label:label});
    if(typeof window.fbq==='function') fbq('track','Lead',{content_name:label});
  };

  // Where did this visitor come from? Remember the ad / campaign for the session.
  const SOURCE_KEY = 'crt_source';
  (function(){
    const utm = ['utm_source','utm_medium','utm_campaign'].map(k=>params.get(k)).filter(Boolean);
    let src = utm.length ? utm.join(' / ') : (params.get('fbclid') ? 'facebook / instagram ad' : (params.get('gclid') ? 'google ad' : ''));
    try{
      if(src) sessionStorage.setItem(SOURCE_KEY, src);
      else if(!sessionStorage.getItem(SOURCE_KEY)){
        const ref = document.referrer && new URL(document.referrer).hostname;
        sessionStorage.setItem(SOURCE_KEY, ref && ref !== location.hostname ? ref : 'direct');
      }
    }catch(e){}
  })();
  const getSource = ()=>{ try{ return sessionStorage.getItem(SOURCE_KEY) || 'direct'; }catch(e){ return 'unknown'; } };

  document.querySelectorAll('[data-booking-form]').forEach(form=>{
    const formService = form.dataset.service || params.get('service') || 'Creative project';
    const formOffer = form.dataset.offer || params.get('offer') || '';
    const serviceField = form.querySelector('[name="service"]');
    const offerField = form.querySelector('[name="offer"]');
    if(serviceField) serviceField.value = params.get('service') || formService;
    if(offerField) offerField.value = params.get('offer') || formOffer;
    if(params.get('date')) { const dateField=form.querySelector('[name="date"]'); if(dateField) dateField.value=params.get('date'); }
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const set = (n,v)=>{ const f=form.querySelector('[name="'+n+'"]'); if(f) f.value=v; };
      set('page', location.pathname);
      set('source', getSource());
      const data = new FormData(form);
      const service = data.get('service') || formService;
      const offer = data.get('offer') || formOffer;

      // 1) Send it to the admin dashboard (Supabase), if connected.
      const CFG = window.CRT_CONFIG || {};
      if(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !data.get('bot-field')){
        const cut = (v,n)=> (v||'').toString().slice(0,n) || null;
        try{
          fetch(CFG.SUPABASE_URL.replace(/\/$/,'') + '/rest/v1/leads', {
            method:'POST', keepalive:true,
            headers:{'apikey':CFG.SUPABASE_ANON_KEY,'Authorization':'Bearer '+CFG.SUPABASE_ANON_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
            body: JSON.stringify({
              name: cut(data.get('name'),120) || 'Unknown', contact: cut(data.get('contact'),160) || 'Unknown',
              service: cut(service,120), offer: cut(offer,120), event_date: cut(data.get('date'),120),
              details: cut(data.get('details'),2000), page: cut(location.pathname,200), source: cut(getSource(),200)
            })
          }).catch(()=>{});
        }catch(err){}
      }
      // 2) Count it as a lead (only if analytics IDs are set above).
      trackLead(offer || service);

      // 3) Open WhatsApp with everything filled in.
      const lines = [
        'Hi CRT Media Agency, I would like to enquire about a project.',
        'Service: ' + service,
        offer ? 'Offer/package: ' + offer : '',
        data.get('name') ? 'Name: ' + data.get('name') : '',
        data.get('contact') ? 'Email or phone: ' + data.get('contact') : '',
        data.get('date') ? 'Preferred date/timeline: ' + data.get('date') : '',
        data.get('details') ? 'Project details: ' + data.get('details') : '',
      ].filter(Boolean);
      const msg = encodeURIComponent(lines.join('\n'));
      setTimeout(()=>{ window.location.href = 'https://wa.me/250796356035?text=' + msg; }, 150);
    });
  });
  document.querySelectorAll('[data-prefill-service]').forEach(link=>{
    const target = new URL(link.href, window.location.href);
    target.searchParams.set('service', link.dataset.prefillService);
    if(link.dataset.prefillOffer) target.searchParams.set('offer', link.dataset.prefillOffer);
    link.href = target.toString();
  });
  // Bottom action bar on every page: "Ask a question" (WhatsApp) + the page's main action.
  // Replaces the old floating WA circle and phone-only enquiry button.
  (function(){
    const oldMain = document.querySelector('.mobile-booking a');
    const oldWa = document.querySelector('.whatsapp-float');
    const hasForm = !!document.getElementById('inquiry');
    const bar = document.createElement('div');
    bar.className = 'action-bar' + (document.querySelector('.hero-paths') ? ' is-hidden' : '');
    const ask = document.createElement('a');
    ask.className = 'action-ask';
    ask.href = oldWa ? oldWa.href : 'https://wa.me/250796356035';
    ask.target = '_blank'; ask.rel = 'noopener';
    ask.dataset.track = 'bar_whatsapp';
    ask.innerHTML = '<span class="action-dot"></span><span class="lbl-long">Ask a question</span><span class="lbl-short">Ask</span>';
    const main = document.createElement('a');
    main.className = 'btn action-main';
    main.href = hasForm ? '#inquiry' : u('/contact#inquiry');
    main.dataset.track = 'bar_main';
    main.textContent = oldMain ? oldMain.textContent.trim() : 'Get a quote';
    // "Book a call" (filled with BOOKING_URL below; stays hidden if there is no link)
    const CAL_ICON = '<svg class="cal-ico" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const call = document.createElement('a');
    call.className = 'action-call';
    call.href = u('/contact'); call.hidden = true;
    call.setAttribute('data-booking-link','');
    call.dataset.track = 'bar_book_call';
    call.innerHTML = CAL_ICON + '<span class="lbl-long">Book a free call</span><span class="lbl-short">Call</span>';
    bar.append(ask, call, main);
    document.body.appendChild(bar);
    // Header: "Book a call" beside "Get a quote"
    const navCta = document.querySelector('.nav-links .nav-cta');
    if(navCta){
      const actions = document.createElement('div');
      actions.className = 'nav-actions';
      const navCall = document.createElement('a');
      navCall.className = 'nav-call';
      navCall.href = u('/contact'); navCall.hidden = true;
      navCall.setAttribute('data-booking-link','');
      navCall.dataset.track = 'nav_book_call';
      navCall.innerHTML = CAL_ICON + '<span>Book a call</span>';
      navCta.parentNode.insertBefore(actions, navCta);
      actions.append(navCall, navCta);
    }
    document.querySelectorAll('.mobile-booking,.whatsapp-float').forEach(el=>el.remove());
    document.body.classList.add('has-action-bar');
    // Get out of the way when the form, the footer or the home hero tiles are on screen.
    const targets = [document.getElementById('inquiry'), document.querySelector('footer'), document.querySelector('.hero-paths')].filter(Boolean);
    if('IntersectionObserver' in window && targets.length){
      const seen = new Set();
      const io = new IntersectionObserver(entries=>{
        entries.forEach(e=>e.isIntersecting ? seen.add(e.target) : seen.delete(e.target));
        bar.classList.toggle('is-hidden', seen.size > 0);
      }, {threshold: 0.15});
      targets.forEach(t=>io.observe(t));
    }
  })();

  // ---------------------------------------------------------------
  // "Book a call": paste your Cal.com / Calendly / Google Calendar
  // booking-page link here. While it is empty, every "Book a call"
  // button stays hidden, so nothing broken ever shows.
  // ---------------------------------------------------------------
  const BOOKING_URL = 'https://cal.com/crt-media-agency-djafrq/20-minutes-meeting-with-crt';
  document.querySelectorAll('[data-booking-link]').forEach(el=>{
    if(!BOOKING_URL) return;
    el.href = BOOKING_URL;
    el.target = '_blank'; el.rel = 'noopener';
    (el.closest('[data-booking]') || el).hidden = false;
  });

  // ---------------------------------------------------------------
  // Menu panels (desktop): every menu item opens a panel with photos
  // and quick links; the page is blurred behind it.
  // To change a panel, edit MENU below. Each item:
  //   [name, link, image, small line under the name, [[label, link], ...]]
  // ---------------------------------------------------------------
  const S = '/assets/md/';
  const MENU = {
    '/work': { cols: 3, items: [
      ['Sandra & Mathias','/work-wedding-sandra-mathias','','Wedding · civil, dote, church & reception',[['Read the case study','/work-wedding-sandra-mathias']]],
      ['Client Acquisition & AI workshop','/work-client-acquisition-ai-workshop','','Event · 6 Figure Club × goflex',[['Read the case study','/work-client-acquisition-ai-workshop']]],
      ['Zora Lounge','/work-zora-lounge','','Graphic design · weekly event posters',[['Read the case study','/work-zora-lounge']]],
      ['Mirindi & Fred','/work-wedding-mirindi-fred','','Wedding · civil, church & reception',[['Read the case study','/work-wedding-mirindi-fred']]],
      ['Eloge & Alice','/work-eloge-alice','','Proposal & civil wedding',[['Read the case study','/work-eloge-alice']]],
      ['King’s Memo','/work-kings-memo','','Branding · logo design',[['Read the case study','/work-kings-memo']]],
    ], side: [['All case studies','/work'],['Weddings','/work#weddings'],['Events','/work#events'],['Branding & social','/work#branding'],['Book a call','#call']] },
    '/weddings': { cols: 4, items: [
      ['Basic','/weddings#packages','/assets/work/reception-sandra-mathias-800.webp','From 1,000,000 RWF',[['Check my date','/contact?service=Wedding%20photography%20%26%20film&offer=Basic#inquiry']]],
      ['Standard','/weddings#packages','/assets/work/wedding-sandra-mathias-800.webp','From 1,500,000 RWF',[['Check my date','/contact?service=Wedding%20photography%20%26%20film&offer=Standard#inquiry']]],
      ['Premium','/weddings#packages','/assets/work/proposal-eloge-alice-800.webp','From 2,000,000 RWF',[['Check my date','/contact?service=Wedding%20photography%20%26%20film&offer=Premium#inquiry']]],
      ['VIP','/weddings#packages','/assets/work/decor-lounge-800.webp','Custom quote',[['Get a custom quote','/contact?service=Wedding%20photography%20%26%20film&offer=VIP#inquiry']]],
    ], side: [['Weddings overview','/weddings'],['Packages and prices','/weddings#packages'],['Book early, save 10%','/offer-wedding-early-booking'],['Livestream add-on','/offer-wedding-livestream']] },
    '/events': { cols: 2, items: [
      ['Event coverage','/events','/assets/md/workshop.webp','Photo and video, from 350,000 RWF',[['Learn','/events'],['Check my date','/events#inquiry']]],
      ['Event + social bundle','/offer-event-social-bundle','/assets/work/church-celebration-800.webp','Content ready in 72 hours',[['See offer','/offer-event-social-bundle']]],
    ], side: [['Events overview','/events'],['Check my date','/events#inquiry'],['Event case studies','/work#events'],['Book a call','#call']] },
    '/business': { cols: 3, items: [
      ['Commercial photo & video','/commercial-photography-video','/assets/work/table-styling-800.webp','From 400,000 RWF',[['Learn','/commercial-photography-video'],['Book','/commercial-photography-video#inquiry']]],
      ['Branding & design','/branding-graphic-design','/assets/work/kings-memo-logo-800.webp','From 300,000 RWF',[['Learn','/branding-graphic-design'],['Book','/branding-graphic-design#inquiry']]],
      ['Social media & content','/social-media-content','/assets/work/zora-lounge-poster-800.webp','From 450,000 RWF / month',[['Learn','/social-media-content'],['Book','/social-media-content#inquiry']]],
      ['Web & digital','/web-digital','/assets/work/crt-website-800.webp','From 600,000 RWF',[['Learn','/web-digital'],['Book','/web-digital#inquiry']]],
      ['Business offers','/business#offers','/assets/work/floral-centerpiece-800.webp','Fixed starting prices',[['See offers','/business#offers']]],
      ['10% off your first project','/offer-first-project','/assets/work/decor-reception-lounge-800.webp','New clients',[['See offer','/offer-first-project']]],
    ], side: [['Business overview','/business'],['Get a quote','/business#inquiry'],['Book a call','#call']] },
    '/deals': { cols: 3, items: [
      ['Brand starter kit','/offer-brand-starter-kit','/assets/work/kings-memo-logo-800.webp','Kit from 300,000 RWF',[['See offer','/offer-brand-starter-kit']]],
      ['Event + social bundle','/offer-event-social-bundle','/assets/work/church-celebration-800.webp','Bundle from 350,000 RWF',[['See offer','/offer-event-social-bundle']]],
      ['Book early, save 10%','/offer-wedding-early-booking','/assets/work/reception-sandra-mathias-800.webp','Weddings from 900,000 RWF',[['See offer','/offer-wedding-early-booking']]],
    ], side: [['All deals','/deals'],['Business deals','/deals#business'],['Event deals','/deals#events'],['Wedding deals','/deals#weddings'],['10% off your first project','/offer-first-project']] },
    '/about': { cols: 3, items: [
      ['About CRT','/about','/assets/md/alain-cedrick-camera.webp','Founded in Kigali in 2025',[['Our story','/about']]],
      ['Alain Cedrick','/about','/assets/md/alain-cedrick.webp','CEO & Creative Director',[['Meet the team','/about']]],
      ['Thierry “Ziggy” Nteziryayo','/about','/assets/md/thierry-ziggy-nteziryayo.webp','Director of Photography',[['Meet the team','/about']]],
    ], side: [['Contact','/contact'],['Book a call','#call'],['hello@crt.rw','mailto:hello@crt.rw'],['+250 796 356 035','tel:+250796356035']] },
  };
  (function(){
    const header = document.querySelector('.site-header');
    if(!header || !window.matchMedia('(hover: hover) and (min-width: 761px)').matches) return;
    const esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const fix = h=> h==='#call' ? (BOOKING_URL || u('/contact')) : u(h);
    const ext = h=> h==='#call' && BOOKING_URL ? ' target="_blank" rel="noopener"' : '';
    const panel = document.createElement('div');
    panel.className = 'menu-panel';
    const scrim = document.createElement('div');
    scrim.className = 'menu-scrim';
    document.body.append(scrim, panel);
    const render = cfg=>{
      panel.innerHTML = `<div class="menu-panel-grid cols-${cfg.cols}">` + cfg.items.slice(0, cfg.cols * 2).map(([n,h,img,meta,links])=>
        `<div class="menu-item">`+
        `<div class="menu-text"><a class="menu-name" href="${fix(h)}">${esc(n)}</a>`+
        (meta ? `<span class="menu-meta">${esc(meta)}</span>` : '')+
        `<span class="menu-links">${links.map(([l,u])=>`<a href="${fix(u)}"${ext(u)}>${esc(l)}</a>`).join('')}</span></div></div>`).join('') +
        `</div><div class="menu-panel-side">${cfg.side.map(([l,u])=>`<a href="${fix(u)}"${ext(u)}>${esc(l)}</a>`).join('')}</div>`;
    };
    let t, current = null;
    const place = ()=>{ panel.style.top = header.getBoundingClientRect().bottom + 'px'; };
    const open = link=>{
      clearTimeout(t); place();
      if(current !== link){
        render(MENU[pageKey(link.href)]);
        if(window.__CRT_PRICE_MAP) crtReplaceNumbers(panel, window.__CRT_PRICE_MAP);
        if(current) current.classList.remove('is-open');
        current = link; link.classList.add('is-open');
      }
      document.body.classList.add('menu-open');
    };
    const close = ()=>{ t = setTimeout(()=>{ document.body.classList.remove('menu-open'); if(current){ current.classList.remove('is-open'); current = null; } }, 150); };
    document.querySelectorAll('.nav-links a').forEach(link=>{
      if(MENU[pageKey(link.href)]){
        link.addEventListener('mouseenter', ()=>open(link));
        link.addEventListener('focus', ()=>open(link));
        link.addEventListener('mouseleave', close);
      } else {
        link.addEventListener('mouseenter', close);
      }
    });
    panel.addEventListener('mouseenter', ()=>clearTimeout(t));
    panel.addEventListener('mouseleave', close);
    panel.addEventListener('focusout', e=>{ if(!panel.contains(e.relatedTarget) && !(e.relatedTarget && e.relatedTarget.closest('.nav-links'))) close(); });
    scrim.addEventListener('mouseenter', close);
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') close(); });
    // Keyboard: close the panel once focus leaves both the menu and the panel.
    header.addEventListener('focusout', e=>{ const to = e.relatedTarget; if(!to || (!header.contains(to) && !panel.contains(to))) close(); });
    window.addEventListener('scroll', ()=>{ if(document.body.classList.contains('menu-open')) place(); }, {passive:true});
  })();

  // ---------------------------------------------------------------
  // Live prices + wedding package contents, edited in /admin.
  // The pages keep today's prices as a fallback; when the dashboard
  // has different values, every matching price on the page is swapped.
  // ---------------------------------------------------------------
  (function(){
    const CFG = window.CRT_CONFIG || {};
    if(!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
    // Prices exactly as written in the pages today. Don't edit these here; edit them in /admin.
    const BASE = {basic:1000000, standard:1500000, premium:2000000, livestream:200000, event_bundle:350000,
                  content_session:400000, brand_kit:300000, monthly:450000, website:600000};
    const fmt = n => Number(n).toLocaleString('en-US');
    const url = CFG.SUPABASE_URL.replace(/\/$/,'') + '/rest/v1/site_content?select=key,value';
    fetch(url, {headers:{'apikey':CFG.SUPABASE_ANON_KEY,'Authorization':'Bearer '+CFG.SUPABASE_ANON_KEY}})
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const c = {}; (rows||[]).forEach(r => { c[r.key] = r.value; });
        if(c.prices){
          const map = {};
          for(const k in BASE){
            const v = Number(c.prices[k]);
            if(v > 0 && v !== BASE[k]) map[fmt(BASE[k])] = fmt(v);
          }
          ['basic','standard','premium'].forEach(k => {          // early booking = 10% off
            const v = Number(c.prices[k]);
            if(v > 0 && v !== BASE[k]) map[fmt(Math.round(BASE[k]*0.9))] = fmt(Math.round(v*0.9/1000)*1000);
          });
          if(Object.keys(map).length){ window.__CRT_PRICE_MAP = map; crtReplaceNumbers(document.body, map); }
        }
        if(Array.isArray(c.testimonials) && c.testimonials.length){
          const sec = document.querySelector('[data-testimonials]'), list = sec && sec.querySelector('[data-testimonials-list]');
          if(list){
            list.innerHTML = '';
            c.testimonials.slice(0, 6).forEach(t => {
              if(!t || !t.quote || !t.name) return;
              const fig = document.createElement('figure'); fig.className = 't-card';
              const q = document.createElement('blockquote'); q.textContent = '“' + t.quote + '”';
              const cap = document.createElement('figcaption'); const b = document.createElement('strong'); b.textContent = t.name; cap.appendChild(b);
              if(t.role){ const r = document.createElement('span'); r.textContent = t.role; cap.appendChild(r); }
              fig.append(q, cap); list.appendChild(fig);
            });
            sec.hidden = !list.children.length;
          }
        }
        if(c.packages){
          document.querySelectorAll('ul.package-list[data-package]').forEach(ul => {
            const items = c.packages[ul.dataset.package];
            if(!Array.isArray(items) || !items.length) return;
            const short = !!ul.querySelector('li.more');
            const shown = short ? items.slice(0,3) : items;
            ul.innerHTML = '';
            shown.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
            if(short && items.length > 3){ const li = document.createElement('li'); li.className = 'more'; li.textContent = 'and ' + (items.length - 3) + ' more'; ul.appendChild(li); }
          });
        }
      }).catch(()=>{});
  })();

  // ---------------------------------------------------------------
  // Case study media (film + photos), uploaded in /admin → Case studies.
  // Visitors only see sections that have content. Add ?preview=1 to the
  // page address to see the empty slots as placeholders.
  // ---------------------------------------------------------------
  (function(){
    const page = document.querySelector('[data-case]');
    if(!page) return;
    const slug = page.dataset.case;
    const preview = params.has('preview');
    const SLOTS = ['The full room during a session','Speakers on stage','Attendees in conversation between sessions','Both brands’ logos on stage','Q&A with the audience','Speakers and organisers group photo'];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const safeUrl = u => { try{ const x = new URL(u, location.href); return (x.protocol === 'https:' || x.origin === location.origin) ? x.href : ''; }catch(e){ return ''; } };
    function filmHTML(v){
      const url = safeUrl(v.url); if(!url) return '';
      const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
      if(yt) return `<iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0" title="Highlight film" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if(vm) return `<iframe src="https://player.vimeo.com/video/${vm[1]}" title="Highlight film" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      if(v.type === 'file' || /\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video src="${esc(url)}" controls preload="metadata" playsinline></video>`;
      return `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Watch the highlight film ↗</a>`;
    }
    function render(entry){
      entry = entry || {};
      const filmSec = document.querySelector('[data-case-film]'), filmSlot = filmSec && filmSec.querySelector('[data-film-slot]');
      if(filmSlot){
        const html = entry.video && entry.video.url ? filmHTML(entry.video) : '';
        if(html){ filmSlot.innerHTML = html; filmSec.hidden = false; }
        else if(preview){ filmSlot.innerHTML = '<div class="ph-box film-ph"><span>Highlight film placeholder</span><small>Add a YouTube or Vimeo link, or upload the video, in /admin → Case studies</small></div>'; filmSec.hidden = false; }
      }
      const galSec = document.querySelector('[data-case-gallery]'), gal = galSec && galSec.querySelector('[data-gallery-slot]');
      if(gal){
        const photos = (entry.photos || []).filter(p => p && safeUrl(p.url));
        let html = photos.map(p => `<figure class="cs-tile"><img src="${esc(safeUrl(p.url))}" alt="${esc(p.caption || '')}" loading="lazy"></figure>`).join('');
        if(preview) for(let i = photos.length; i < SLOTS.length; i++) html += `<figure class="cs-tile ph-tile"><div class="ph-box"><span>Photo placeholder</span><small>${esc(SLOTS[i])}</small></div></figure>`;
        if(html){ gal.innerHTML = html; galSec.hidden = false; }
      }
    }
    const CFG = window.CRT_CONFIG || {};
    if(!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY){ render(null); return; }
    fetch(CFG.SUPABASE_URL.replace(/\/$/,'') + '/rest/v1/site_content?select=value&key=eq.case_studies',
          {headers:{'apikey':CFG.SUPABASE_ANON_KEY,'Authorization':'Bearer '+CFG.SUPABASE_ANON_KEY}})
      .then(r => r.ok ? r.json() : [])
      .then(rows => render(rows && rows[0] && rows[0].value ? rows[0].value[slug] : null))
      .catch(() => render(null));
  })();

  // Click tracking (only active once GA_ID / META_PIXEL_ID are set above).
  document.querySelectorAll('[data-track]').forEach(el=>el.addEventListener('click',()=>{
    const eventName = el.dataset.track;
    if(typeof window.gtag === 'function') window.gtag('event', eventName);
    if(typeof window.fbq === 'function'){
      if(/book_call/.test(eventName)) fbq('track','Schedule');
      else if(/whatsapp/.test(eventName)) fbq('track','Contact');
    }
  }));
})();

// Footer: keep the copyright year current
document.querySelectorAll('[data-year]').forEach(el=>{ el.textContent = new Date().getFullYear(); });
