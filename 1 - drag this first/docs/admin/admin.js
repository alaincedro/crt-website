/* CRT admin dashboard. Works with Supabase when crt-config.js is filled in; otherwise runs a demo with sample data. */
(function(){
  'use strict';
  const CFG = window.CRT_CONFIG || {};
  const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => (n == null || n === '' || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US');
  const STATUSES = [['new','New'],['replied','Replied'],['quoted','Quoted'],['booked','Booked'],['lost','Lost']];
  const STATUS_LABEL = Object.fromEntries(STATUSES);
  const PRICE_FIELDS = [
    ['basic','Basic wedding package','Packages page, home, weddings, menu'],
    ['standard','Standard wedding package','Packages page, home, weddings, menu'],
    ['premium','Premium wedding package','Packages page, home, weddings, menu'],
    ['livestream','Wedding livestream add-on','Livestream offer, weddings page'],
    ['event_bundle','Event + social bundle','Events page, offers, home'],
    ['content_session','Commercial content session','Commercial page, offers'],
    ['brand_kit','Brand starter kit','Branding page, offers, home'],
    ['monthly','Monthly content plan (per month)','Social media page, offers'],
    ['website','Website launch','Web page, offers'],
  ];
  const PACKAGES = ['Basic','Standard','Premium','VIP'];
  const SERVICES = ['Wedding photography & film','Event photography & video','Commercial photography & video','Branding & graphic design','Social media & content','Websites & digital tools','Creative project'];
  const SOURCES = ['WhatsApp','Phone call','Instagram','Facebook','Referral','Walk-in','Other'];

  let me = null, leads = [], team = [], content = {}, filter = 'all', query = '', openId = null, started = false;

  // ------------------------------------------------------------------ data layer
  const sb = LIVE ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const demo = (() => {
    const day = 864e5, now = Date.now();
    const iso = d => new Date(now - d*day).toISOString();
    return {
      me: {user_id:'demo-1', name:'Alain (demo)', role:'admin', email:'alain@crt.rw'},
      team: [{user_id:'demo-1',name:'Alain Cedrick',role:'admin'},{user_id:'demo-2',name:'Ziggy',role:'staff'}],
      leads: [
        {id:7,created_at:iso(0.1),name:'Aline M.',contact:'+250 788 123 456',service:'Wedding photography & film',offer:'Book early, save 10%',event_date:'14 Feb 2027',details:'Church + reception at Kigali Serena, about 250 guests.',page:'/offer-wedding-early-booking',source:'instagram / paid / wedding-oct',status:'new',value_rwf:null,notes:'',assigned_to:null},
        {id:6,created_at:iso(0.6),name:'Kivu Coffee Ltd',contact:'hello@kivucoffee.rw',service:'Commercial photography & video',offer:'Content session',event_date:'Next month',details:'New packaging launch, 12 products.',page:'/offer-commercial-content-session',source:'google',status:'replied',value_rwf:400000,notes:'Sent shot list questions on WhatsApp.',assigned_to:'demo-2'},
        {id:5,created_at:iso(2),name:'Jean-Paul K.',contact:'0788 555 222',service:'Event photography & video',offer:'Event + social bundle',event_date:'22 Nov',details:'Product launch at Norrsken, 3 hours.',page:'/events',source:'direct',status:'quoted',value_rwf:450000,notes:'Quote sent 27 Oct. Follow up Friday.',assigned_to:'demo-1'},
        {id:4,created_at:iso(4),name:'Grace & Eric',contact:'+250 722 000 111',service:'Wedding photography & film',offer:'Premium',event_date:'June 2027',details:'Gusaba + wedding, two days.',page:'/wedding-packages',source:'instagram',status:'booked',value_rwf:2000000,notes:'Deposit received.',assigned_to:'demo-2'},
        {id:3,created_at:iso(9),name:'Tech Hub Rwanda',contact:'events@techhub.rw',service:'Websites & digital tools',offer:'Website launch',event_date:'December',details:'5-page site with event registrations.',page:'/offer-website-launch',source:'facebook / instagram ad',status:'quoted',value_rwf:600000,notes:'',assigned_to:'demo-1'},
        {id:2,created_at:iso(15),name:'Nadia U.',contact:'+250 789 999 000',service:'Branding & graphic design',offer:'Brand starter kit',event_date:'ASAP',details:'New bakery.',page:'/offer-brand-starter-kit',source:'google',status:'lost',value_rwf:300000,notes:'Went with a cheaper freelancer.',assigned_to:null},
        {id:1,created_at:iso(21),name:'Patrick N.',contact:'0781 234 567',service:'Wedding photography & film',offer:'Standard',event_date:'March 2027',details:'',page:'/weddings',source:'linktr.ee',status:'booked',value_rwf:1500000,notes:'',assigned_to:'demo-1'},
      ],
      inbox(body){
        const now = Date.now(), h = 36e5;
        const msgs = [
          {messageId:'1', folderId:'9', from:'Aline M.', fromAddress:'aline.m@example.com', subject:'Wedding in February: are you available?', summary:'Hello, we are getting married on 14 Feb 2027 at Kigali Serena and would love photos and a film.', received:now-2*h, unread:true},
          {messageId:'2', folderId:'9', from:'Kivu Coffee Ltd', fromAddress:'hello@kivucoffee.example', subject:'Product shoot quote', summary:'Could you send a quote for photographing 12 products for our new packaging?', received:now-26*h, unread:false},
        ];
        if(body.action === 'read'){ const m = msgs.find(x => x.messageId === body.messageId) || msgs[0]; return {html:'<p>(Demo) ' + m.summary + '</p><p>Thanks,<br>' + m.from + '</p>'}; }
        return {messages: msgs};
      },
      content: {
        prices:{basic:1000000,standard:1500000,premium:2000000,livestream:200000,event_bundle:350000,content_session:400000,brand_kit:300000,monthly:450000,website:600000},
        packages:{
          Basic:['1 photographer','Up to 6 hours of coverage','300+ edited photos','Private online gallery','Planning call before the day'],
          Standard:['1 photographer + 1 videographer','Up to 8 hours of coverage','400+ edited photos','3–5 minute highlight film','Private online gallery','Livestream add-on available'],
          Premium:['2 photographers + 1 videographer','Full-day coverage (up to 12 hours)','600+ edited photos','5–8 minute highlight film + 1-minute teaser','Pre-wedding photo session','Drone shots where allowed'],
          VIP:['Everything in Premium','Multi-day coverage (e.g. gusaba + wedding)','Full-length ceremony film','Printed photo album','Crew and schedule planned around your day']
        }
      }
    };
  })();

  const api = {
    async session(){ if(!LIVE) return {user:{email:demo.me.email,id:demo.me.user_id}}; const {data} = await sb.auth.getSession(); return data.session; },
    // Email + password: works when the site is opened straight from a folder,
    // where emailed sign-in links have no web address to return to.
    async signIn(email, password){
      if(!LIVE) return {error:null};
      return sb.auth.signInWithPassword({email, password});
    },
    async signOut(){ if(LIVE) await sb.auth.signOut(); location.reload(); },
    async me(uid){
      if(!LIVE) return demo.me;
      const {data, error} = await sb.from('team').select('user_id,name,role').eq('user_id', uid).maybeSingle();
      if(error) throw error; return data;
    },
    async leads(){
      if(!LIVE) return demo.leads.slice();
      const {data, error} = await sb.from('leads').select('*').order('created_at',{ascending:false}).limit(2000);
      if(error) throw error; return data;
    },
    async addLead(row){
      if(!LIVE){ const l = Object.assign({id: Math.max(0, ...demo.leads.map(x => x.id)) + 1, created_at: new Date().toISOString()}, row); demo.leads.unshift(l); return Object.assign({}, l); }
      const {data, error} = await sb.from('leads').insert(row).select('*').single(); if(error) throw error; return data;
    },
    // Mailbox (Zoho Mail) through the "inbox" Edge Function. Demo mode shows sample mail.
    async inbox(body){
      if(!LIVE) return demo.inbox(body);
      const {data, error} = await sb.functions.invoke('inbox', {body});
      if(error){
        let msg = error.message;
        try{ const j = await error.context.json(); msg = j.error || msg; }catch(e){}
        throw new Error(msg);
      }
      return data;
    },
    async updateLead(id, patch){
      if(!LIVE){ Object.assign(demo.leads.find(l=>l.id===id), patch); return; }
      const {error} = await sb.from('leads').update(patch).eq('id', id); if(error) throw error;
    },
    async deleteLead(id){
      if(!LIVE){ demo.leads = demo.leads.filter(l=>l.id!==id); return; }
      const {error} = await sb.from('leads').delete().eq('id', id); if(error) throw error;
    },
    async team(){
      if(!LIVE) return demo.team.slice();
      const {data, error} = await sb.from('team').select('user_id,name,role').order('name'); if(error) throw error; return data;
    },
    async updateMember(uid, patch){
      if(!LIVE){ Object.assign(demo.team.find(m=>m.user_id===uid), patch); return; }
      const {error} = await sb.from('team').update(patch).eq('user_id', uid); if(error) throw error;
    },
    async removeMember(uid){
      if(!LIVE){ demo.team = demo.team.filter(m=>m.user_id!==uid); return; }
      const {error} = await sb.from('team').delete().eq('user_id', uid); if(error) throw error;
    },
    async content(){
      if(!LIVE) return JSON.parse(JSON.stringify(demo.content));
      const {data, error} = await sb.from('site_content').select('key,value'); if(error) throw error;
      const c = {}; (data||[]).forEach(r => c[r.key] = r.value); return c;
    },
    async saveContent(key, value){
      if(!LIVE){ demo.content[key] = value; return; }
      const {error} = await sb.from('site_content').upsert({key, value, updated_by: me.user_id}); if(error) throw error;
    },
    // Upload a file to the public "media" bucket and return its public address.
    async upload(file, path){
      if(!LIVE) return URL.createObjectURL(file);           // demo: local preview only, nothing is stored
      const {error} = await sb.storage.from('media').upload(path, file, {upsert:true, contentType:file.type, cacheControl:'31536000'});
      if(error) throw error;
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },
    async removeFile(url){
      if(!LIVE || !url) return;
      const m = String(url).match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
      if(m) await sb.storage.from('media').remove([decodeURIComponent(m[1])]);   // best effort
    }
  };

  // ------------------------------------------------------------------ case studies
  const CASES = [
    {slug:'work-client-acquisition-ai-workshop', title:'Client Acquisition and AI for Scale Workshop'},
    {slug:'work-wedding-sandra-mathias', title:'Sandra & Mathias (wedding)'},
    {slug:'work-wedding-mirindi-fred', title:'Mirindi & Fred (wedding)'},
    {slug:'work-eloge-alice', title:'Eloge & Alice (proposal & civil wedding)'},
    {slug:'work-zora-lounge', title:'Zora Lounge (posters)'},
    {slug:'work-kings-memo', title:'King’s Memo (logo)'},
  ];
  const SLOT_HINTS = ['The full room during a session','Speakers on stage','Attendees in conversation between sessions','Both brands’ logos on stage','Q&A with the audience','Speakers and organisers group photo','Details: badges, notes, coffee break','Behind the scenes: the crew at work','A candid moment worth remembering'];
  const MAX_PHOTOS = 9, MAX_VIDEO_MB = 50;
  let caseSlug = CASES[0].slug, busy = false;
  const caseEntry = () => { content.case_studies = content.case_studies || {}; return content.case_studies[caseSlug] = content.case_studies[caseSlug] || {video:null, photos:[]}; };

  // Shrink photos to max 2000 px, JPEG ~82%, so the site stays fast.
  async function shrink(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    try{
      const img = await createImageBitmap(file);
      const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
      return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {type:'image/jpeg'}) : file;
    }catch(e){ return file; }
  }
  async function saveCases(msg){
    try{ await api.saveContent('case_studies', content.case_studies || {}); toast(msg || 'Saved. Live on the site.'); }catch(e){ fail(e); }
  }
  function renderCases(){
    const ro = !isAdmin(), entry = caseEntry();
    $('#cases-readonly').hidden = !ro;
    $('#case-select').innerHTML = CASES.map(c => `<option value="${esc(c.slug)}"${c.slug === caseSlug ? ' selected' : ''}>${esc(c.title)}</option>`).join('');
    $('#case-preview').href = '../' + caseSlug + '/index.html?preview=1';
    const v = entry.video;
    $('#film-url').value = v && v.type === 'link' ? v.url : '';
    $('#film-url').disabled = ro;
    $$('[data-action="save-film-url"],[data-action="remove-film"],.upload-btn').forEach(el => el.hidden = ro);
    $('#film-preview').innerHTML = v && v.url
      ? `<p class="small"><strong>${v.type === 'file' ? 'Uploaded video' : 'Linked film'}:</strong> <a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.type === 'file' ? 'open the file' : v.url)}</a></p>` +
        (v.type === 'file' ? `<video src="${esc(v.url)}" controls preload="metadata"></video>` : '')
      : '<p class="muted small">No film yet. The film section stays hidden on the site until you add one.</p>';
    const photos = entry.photos || [];
    let html = '';
    for(let i = 0; i < MAX_PHOTOS; i++){
      const p = photos[i];
      if(p) html += `<div class="slot filled" data-i="${i}"><img src="${esc(p.url)}" alt="">
        <input type="text" class="slot-caption" data-i="${i}" value="${esc(p.caption || '')}" placeholder="Describe this photo" ${ro ? 'disabled' : ''} aria-label="Caption for photo ${i + 1}">
        ${ro ? '' : `<div class="slot-actions"><label class="link">Replace<input type="file" accept="image/*" data-photo="${i}" hidden></label><button class="link danger" data-action="remove-photo" data-i="${i}">Remove</button></div>`}</div>`;
      else if(i === photos.length) html += `<label class="slot empty${ro ? ' ro' : ''}"><span class="slot-plus">${ro ? '' : '+'}</span><strong>${ro ? 'Empty slot' : 'Add photo'}</strong><small>${esc(SLOT_HINTS[i] || '')}</small>${ro ? '' : `<input type="file" accept="image/*" multiple data-photo="${i}" hidden>`}</label>`;
      else html += `<div class="slot empty ghost"><strong>Photo ${i + 1}</strong><small>${esc(SLOT_HINTS[i] || '')}</small></div>`;
    }
    $('#photo-slots').innerHTML = html;
  }
  async function addPhotos(files, startIndex){
    if(busy) return; busy = true;
    const entry = caseEntry(); entry.photos = entry.photos || [];
    try{
      let i = startIndex;
      for(const raw of files){
        if(i >= MAX_PHOTOS){ toast('Maximum ' + MAX_PHOTOS + ' photos'); break; }
        toast('Uploading photo ' + (i + 1) + '…');
        const file = await shrink(raw);
        const url = await api.upload(file, `case-studies/${caseSlug}/photo-${Date.now()}-${i}.jpg`);
        const old = entry.photos[i];
        entry.photos[i] = {url, caption: old ? old.caption : (SLOT_HINTS[i] || '')};
        if(old && old.url !== url) api.removeFile(old.url).catch(()=>{});
        i++;
      }
      entry.photos = entry.photos.filter(Boolean);
      renderCases(); await saveCases('Photos saved. Live on the site.');
    }catch(e){ fail(e); renderCases(); }
    busy = false;
  }
  async function uploadFilm(file){
    if(file.size > MAX_VIDEO_MB * 1024 * 1024){ toast('That video is over ' + MAX_VIDEO_MB + ' MB. Upload it to YouTube and paste the link instead.'); return; }
    if(busy) return; busy = true;
    try{
      toast('Uploading video… keep this page open');
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
      const url = await api.upload(file, `case-studies/${caseSlug}/film-${Date.now()}.${ext}`);
      const entry = caseEntry(), old = entry.video;
      entry.video = {type:'file', url};
      if(old && old.type === 'file') api.removeFile(old.url).catch(()=>{});
      renderCases(); await saveCases('Video saved. Live on the site.');
    }catch(e){ fail(e); }
    busy = false;
  }

  // ------------------------------------------------------------------ helpers
  function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2600); }
  function fail(e){ console.error(e); toast('Something went wrong: ' + (e && e.message ? e.message : 'please try again')); }
  function show(id){ ['view-login','view-noaccess','view-app'].forEach(v => $('#'+v).hidden = v !== id); }
  function when(iso){
    const d = new Date(iso), diff = (Date.now() - d) / 1000;
    if(diff < 3600) return Math.max(1, Math.round(diff/60)) + ' min ago';
    if(diff < 86400) return Math.round(diff/3600) + ' h ago';
    if(diff < 7*86400) return Math.round(diff/86400) + ' d ago';
    return d.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
  }
  function waNumber(contact){
    if(!contact || contact.includes('@')) return null;
    let d = contact.replace(/\D/g,'');
    if(d.startsWith('0')) d = '250' + d.slice(1);
    else if(d.length === 9 && d.startsWith('7')) d = '250' + d;
    return d.length >= 10 ? d : null;
  }
  const memberName = uid => (team.find(m => m.user_id === uid) || {}).name || '';
  const isAdmin = () => me && me.role === 'admin';

  // ------------------------------------------------------------------ leads
  function renderLeads(){
    const counts = Object.fromEntries(STATUSES.map(([k]) => [k, 0]));
    leads.forEach(l => counts[l.status] = (counts[l.status]||0) + 1);

    // KPIs
    const weekAgo = Date.now() - 7*864e5, month = new Date(); month.setDate(1); month.setHours(0,0,0,0);
    const newWeek = leads.filter(l => new Date(l.created_at) > weekAgo).length;
    const open = leads.filter(l => ['new','replied','quoted'].includes(l.status));
    const pipeline = leads.filter(l => l.status === 'quoted').reduce((s,l) => s + (Number(l.value_rwf)||0), 0);
    const bookedMonth = leads.filter(l => l.status === 'booked' && new Date(l.updated_at || l.created_at) >= month);
    const bookedValue = bookedMonth.reduce((s,l) => s + (Number(l.value_rwf)||0), 0);
    const closed = counts.booked + counts.lost;
    const win = closed ? Math.round(counts.booked / closed * 100) + '%' : '—';
    $('#kpis').innerHTML = [
      ['Waiting for reply', counts.new, counts.new ? 'Reply within 1 hour' : 'All caught up'],
      ['New this week', newWeek, 'Enquiries in 7 days'],
      ['Open leads', open.length, 'New, replied or quoted'],
      ['Quoted value', fmt(pipeline), 'RWF waiting on a decision'],
      ['Booked this month', bookedMonth.length, fmt(bookedValue) + ' RWF · win rate ' + win],
    ].map(([a,b,c]) => `<div class="kpi"><span>${esc(a)}</span><strong>${esc(b)}</strong><small>${esc(c)}</small></div>`).join('');

    // Insights
    const top = (key) => {
      const m = {}; leads.forEach(l => { const k = (l[key] || 'unknown').toString(); m[k] = (m[k]||0) + 1; });
      const rows = Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,6), max = rows.length ? rows[0][1] : 1;
      return rows.length ? rows.map(([k,v]) => `<div class="bar"><span class="bar-label"><i style="width:${Math.round(v/max*100)}%"></i><b>${esc(k)}</b></span><span class="bar-count">${v}</span></div>`).join('') : '<p class="muted small">No data yet.</p>';
    };
    $('#by-source').innerHTML = top('source');
    $('#by-service').innerHTML = top('service');

    // Pills
    $('#status-pills').innerHTML = [['all','All', leads.length], ...STATUSES.map(([k,l]) => [k,l,counts[k]])]
      .map(([k,l,n]) => `<button class="pill${filter===k?' is-active':''}" data-filter="${k}" role="tab" aria-selected="${filter===k}">${l}<em>${n}</em></button>`).join('');

    // Rows
    const q = query.trim().toLowerCase();
    const rows = leads.filter(l => (filter === 'all' || l.status === filter) &&
      (!q || [l.name,l.contact,l.service,l.offer,l.source,l.details].join(' ').toLowerCase().includes(q)));
    $('#leads-table tbody').innerHTML = rows.map(l => `
      <tr data-id="${l.id}" class="${l.status==='new'?'is-new-row':''}">
        <td data-label="Received">${esc(when(l.created_at))}</td>
        <td><div class="lead-name">${esc(l.name)}</div><div class="lead-sub">${esc(l.contact)}</div></td>
        <td data-label="Service">${esc(l.offer || l.service || '—')}${l.offer && l.service ? `<div class="lead-sub">${esc(l.service)}</div>` : ''}</td>
        <td data-label="Date wanted">${esc(l.event_date || '—')}</td>
        <td data-label="Source">${esc(l.source || '—')}</td>
        <td class="num" data-label="Value">${fmt(l.value_rwf)}</td>
        <td><span class="badge s-${esc(l.status)}">${esc(STATUS_LABEL[l.status] || l.status)}</span></td>
      </tr>`).join('');
    $('#leads-empty').hidden = rows.length > 0;
    $('#leads-sub').textContent = `${leads.length} enquiries from the website${LIVE ? '' : ' (demo)'}.`;
  }

  function openDrawer(id){
    const l = leads.find(x => x.id === id); if(!l) return;
    openId = id;
    $('#d-new').hidden = true; $('#d-facts').hidden = false; $('#d-quick').hidden = false;
    $('#d-name').textContent = l.name;
    const wa = waNumber(l.contact), first = (l.name || '').split(' ')[0];
    const about = l.offer ? `our “${l.offer}” offer` : (l.service ? l.service.toLowerCase() : 'your project');
    const msg = encodeURIComponent(`Hi ${first}, thank you for contacting CRT Media Agency about ${about}. `);
    $('#d-quick').innerHTML =
      (wa ? `<a class="btn small" href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener" data-action="wa-reply">Reply on WhatsApp</a><a class="btn secondary small" href="tel:+${wa}">Call</a>` : '') +
      (l.contact && l.contact.includes('@') ? `<a class="btn small" href="mailto:${esc(l.contact)}?subject=${encodeURIComponent('Your enquiry with CRT Media Agency')}" data-action="wa-reply">Reply by email</a>` : '');
    const facts = [['Contact', l.contact], ['Service', l.service], ['Offer / package', l.offer], ['Date wanted', l.event_date],
      ['Message', l.details], ['Source', l.source], ['Page', l.page], ['Received', new Date(l.created_at).toLocaleString('en-GB')]];
    $('#d-facts').innerHTML = facts.filter(f => f[1]).map(([k,v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    $('#d-status').innerHTML = STATUSES.map(([k,lab]) => `<option value="${k}"${l.status===k?' selected':''}>${lab}</option>`).join('');
    $('#d-value').value = l.value_rwf ?? '';
    $('#d-assigned').innerHTML = '<option value="">Nobody yet</option>' + team.map(m => `<option value="${esc(m.user_id)}"${l.assigned_to===m.user_id?' selected':''}>${esc(m.name || 'Team member')}</option>`).join('');
    $('#d-notes').value = l.notes || '';
    $('#d-delete').hidden = !isAdmin();
    $('#drawer').classList.add('is-open'); $('#drawer').setAttribute('aria-hidden','false'); $('#drawer-scrim').hidden = false;
    setTimeout(() => $('#d-status').focus(), 50);
  }
  // A lead that came in outside the website form (WhatsApp, phone, walk-in).
  function openNewLead(){
    openId = 'new';
    $('#d-name').textContent = 'Add a lead';
    $('#d-new').hidden = false; $('#d-facts').hidden = true; $('#d-quick').hidden = true; $('#d-delete').hidden = true;
    ['n-name','n-contact','n-offer','n-date','n-details','d-value','d-notes'].forEach(id => $('#'+id).value = '');
    $('#n-service').innerHTML = SERVICES.map(s => `<option>${esc(s)}</option>`).join('');
    $('#n-source').innerHTML = SOURCES.map(s => `<option>${esc(s)}</option>`).join('');
    $('#d-status').innerHTML = STATUSES.map(([k,lab]) => `<option value="${k}"${k==='new'?' selected':''}>${lab}</option>`).join('');
    $('#d-assigned').innerHTML = '<option value="">Nobody yet</option>' + team.map(m => `<option value="${esc(m.user_id)}"${me && m.user_id===me.user_id?' selected':''}>${esc(m.name || 'Team member')}</option>`).join('');
    $('#drawer').classList.add('is-open'); $('#drawer').setAttribute('aria-hidden','false'); $('#drawer-scrim').hidden = false;
    setTimeout(() => $('#n-name').focus(), 50);
  }
  async function addLead(){
    const name = $('#n-name').value.trim(), contact = $('#n-contact').value.trim();
    if(!name || !contact){ toast('Add a name and a way to contact them'); (name ? $('#n-contact') : $('#n-name')).focus(); return; }
    const v = $('#d-value').value.trim();
    const row = {
      name: name.slice(0,120), contact: contact.slice(0,160), service: $('#n-service').value,
      offer: $('#n-offer').value.trim().slice(0,120) || null, event_date: $('#n-date').value.trim().slice(0,120) || null,
      details: $('#n-details').value.trim().slice(0,2000) || null, source: $('#n-source').value, page: 'Added by hand',
      status: $('#d-status').value, value_rwf: v === '' ? null : Math.max(0, Math.round(Number(v))),
      assigned_to: $('#d-assigned').value || null, notes: $('#d-notes').value.slice(0,5000) || null
    };
    try{ const saved = await api.addLead(row); leads.unshift(saved); filter = 'all'; renderLeads(); closeDrawer(); toast('Lead added'); }catch(e){ fail(e); }
  }

  function closeDrawer(){ openId = null; $('#drawer').classList.remove('is-open'); $('#drawer').setAttribute('aria-hidden','true'); $('#drawer-scrim').hidden = true; }

  async function saveLead(){
    if(openId === 'new') return addLead();
    const l = leads.find(x => x.id === openId); if(!l) return;
    const v = $('#d-value').value.trim();
    const patch = { status: $('#d-status').value, value_rwf: v === '' ? null : Math.max(0, Math.round(Number(v))), assigned_to: $('#d-assigned').value || null, notes: $('#d-notes').value.slice(0,5000) };
    try{ await api.updateLead(l.id, patch); Object.assign(l, patch, {updated_at: new Date().toISOString()}); renderLeads(); closeDrawer(); toast('Lead saved'); }catch(e){ fail(e); }
  }

  function exportCsv(){
    const cols = ['created_at','name','contact','service','offer','event_date','details','source','page','status','value_rwf','notes'];
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
    const header = [...cols, 'handled_by'];
    const csv = [header.join(','), ...leads.map(l => [...cols.map(c => cell(l[c])), cell(memberName(l.assigned_to))].join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], {type:'text/csv'}));
    a.download = 'crt-leads-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ------------------------------------------------------------------ content
  function renderContent(){
    const p = content.prices || {}, pk = content.packages || {}, ro = !isAdmin();
    $('#content-readonly').hidden = !ro;
    $('#prices-form').innerHTML = PRICE_FIELDS.map(([k,label,where]) => `
      <div class="price-item"><label for="p-${k}">${esc(label)}</label>
      <input id="p-${k}" name="${k}" type="number" min="0" step="1000" value="${esc(p[k] ?? '')}" ${ro?'disabled':''}>
      <small>${p[k] ? fmt(p[k]) + ' RWF · ' : ''}${esc(where)}</small></div>`).join('');
    $('#packages-form').innerHTML = PACKAGES.map(name => `
      <div class="field"><label for="pk-${name}">${esc(name)}</label>
      <textarea id="pk-${name}" name="${name}" ${ro?'disabled':''}>${esc((pk[name]||[]).join('\n'))}</textarea></div>`).join('');
    $$('[data-action="save-prices"],[data-action="save-packages"]').forEach(b => b.hidden = ro);
    renderTestimonials();
  }

  // Testimonials: real client words, shown on the home page when at least one exists.
  const MAX_TESTIMONIALS = 6;
  function renderTestimonials(){
    const list = Array.isArray(content.testimonials) ? content.testimonials : [], ro = !isAdmin();
    $('#testimonials-list').innerHTML = list.length ? list.map((t, i) => `
      <div class="testimonial-row" data-i="${i}">
        <div class="field"><label for="t-quote-${i}">What they said</label><textarea id="t-quote-${i}" data-t="quote" rows="3" maxlength="400" ${ro?'disabled':''}>${esc(t.quote)}</textarea></div>
        <div class="price-grid">
          <div class="field"><label for="t-name-${i}">Name</label><input id="t-name-${i}" data-t="name" maxlength="80" value="${esc(t.name)}" ${ro?'disabled':''}></div>
          <div class="field"><label for="t-role-${i}">Project or company</label><input id="t-role-${i}" data-t="role" maxlength="80" value="${esc(t.role)}" placeholder="e.g. Wedding, June 2026" ${ro?'disabled':''}></div>
        </div>
        ${ro ? '' : `<button class="link danger" data-action="remove-testimonial" data-i="${i}">Remove</button>`}
      </div>`).join('') : '<p class="muted small">No testimonials yet. The section stays hidden on the site until you add one.</p>';
    $$('[data-action="add-testimonial"],[data-action="save-testimonials"]').forEach(b => b.hidden = ro);
  }
  function readTestimonials(){
    return $$('#testimonials-list .testimonial-row').map(row => ({
      quote: row.querySelector('[data-t="quote"]').value.trim().slice(0, 400),
      name: row.querySelector('[data-t="name"]').value.trim().slice(0, 80),
      role: row.querySelector('[data-t="role"]').value.trim().slice(0, 80)
    }));
  }
  async function saveTestimonials(){
    const list = readTestimonials();
    if(list.some(t => !t.quote || !t.name)){ toast('Each testimonial needs the words and a name'); return; }
    try{ await api.saveContent('testimonials', list); content.testimonials = list; renderTestimonials(); toast(list.length ? 'Testimonials saved. Live on the home page.' : 'Saved. The section is hidden.'); }catch(e){ fail(e); }
  }
  async function savePrices(){
    const next = {}; let bad = false;
    PRICE_FIELDS.forEach(([k]) => { const v = Number($('#p-'+k).value); if(!(v > 0)) bad = true; next[k] = Math.round(v); });
    if(bad){ toast('Every price needs a number above 0'); return; }
    try{ await api.saveContent('prices', next); content.prices = next; renderContent(); toast('Prices saved. The site updates on the next page load.'); }catch(e){ fail(e); }
  }
  async function savePackages(){
    const next = {};
    for(const name of PACKAGES){
      const items = $('#pk-'+name).value.split('\n').map(s => s.trim()).filter(Boolean).slice(0,12);
      if(!items.length){ toast(name + ' needs at least one item'); return; }
      next[name] = items.map(s => s.slice(0,120));
    }
    try{ await api.saveContent('packages', next); content.packages = next; renderContent(); toast('Packages saved. The site updates on the next page load.'); }catch(e){ fail(e); }
  }

  // ------------------------------------------------------------------ inbox
  let inbox = [], inboxLoaded = false, inboxOpen = null, inboxStart = 1;
  const INBOX_PAGE = 50;
  const mailWhen = ms => ms ? when(new Date(ms).toISOString()) : '';
  function renderInbox(){
    $('#inbox-list').innerHTML = inbox.map(m => `
      <li data-mid="${esc(m.messageId)}" class="${m.unread ? 'unread' : ''}${inboxOpen && inboxOpen.messageId === m.messageId ? ' is-open' : ''}">
        <div class="m-row"><span class="m-from">${esc(m.from || m.fromAddress)}</span><span class="m-time">${esc(mailWhen(m.received))}</span></div>
        <div class="m-subject">${esc(m.subject)}</div>
        <div class="m-summary">${esc(m.summary)}</div>
      </li>`).join('');
    $('#inbox-empty').hidden = inbox.length > 0;
    const unread = inbox.filter(m => m.unread).length;
    $('#inbox-count').hidden = !unread; $('#inbox-count').textContent = unread;
  }
  async function loadInbox(more){
    $('#inbox-setup').hidden = true;
    try{
      if(!more) inboxStart = 1;
      const res = await api.inbox({action:'list', limit:INBOX_PAGE, start:inboxStart});
      const got = res.messages || [];
      inbox = more ? inbox.concat(got) : got;
      inboxStart += got.length;
      $('#inbox-more').hidden = got.length < INBOX_PAGE;
      inboxLoaded = true; renderInbox();
      $('#inbox-sub').textContent = 'Email sent to hello@crt.rw and alain@crt.rw' + (LIVE ? '.' : ' (demo).');
    }catch(e){
      const notConnected = /not_connected/.test(e.message);
      $('#inbox-setup').hidden = false;
      $('#inbox-setup-msg').innerHTML = notConnected
        ? 'The inbox isn’t connected yet. Follow <code>admin/INBOX-SETUP.txt</code> to connect Zoho Mail (about 10 minutes, once).'
        : 'Couldn’t load email: ' + esc(e.message) + '. If this keeps happening, check the Zoho connection in <code>admin/INBOX-SETUP.txt</code>.';
      inbox = []; renderInbox();
    }
  }
  async function openMail(mid){
    const m = inbox.find(x => x.messageId === mid); if(!m) return;
    inboxOpen = m; m.unread = false; renderInbox();
    const r = $('#inbox-reader');
    r.innerHTML = `<h2>${esc(m.subject)}</h2>
      <div class="reader-meta">From <strong>${esc(m.from)}</strong> &lt;${esc(m.fromAddress)}&gt; · ${esc(m.received ? new Date(m.received).toLocaleString('en-GB') : '')}</div>
      <div class="reader-actions">
        <a class="btn small" href="mailto:${esc(m.fromAddress)}?subject=${encodeURIComponent('Re: ' + m.subject)}">Reply</a>
        <button class="btn secondary small" data-action="mail-to-lead">Save as lead</button>
        <a class="btn secondary small" href="https://mail.zoho.com/zm/#mail/folder/inbox/p/${encodeURIComponent(m.messageId)}" target="_blank" rel="noopener">Open in Zoho ↗</a>
      </div>
      <p class="muted small" id="reader-status">Loading…</p>`;
    try{
      const res = await api.inbox({action:'read', folderId:m.folderId, messageId:m.messageId});
      if(inboxOpen !== m) return;
      const frame = document.createElement('iframe');
      frame.className = 'reader-frame'; frame.title = 'Email: ' + m.subject;
      // No scripts can run inside the email; links open in a new tab.
      frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src \'none\'"><base target="_blank"><style>body{font:15px/1.5 -apple-system,system-ui,sans-serif;margin:16px;color:#141a2e}img{max-width:100%;height:auto}</style>' + (res.html || '<p>(empty message)</p>');
      $('#reader-status').replaceWith(frame);
    }catch(e){ const s = $('#reader-status'); if(s) s.textContent = 'Couldn’t open this email: ' + e.message; }
  }
  async function mailToLead(){
    const m = inboxOpen; if(!m) return;
    const row = {
      name: (m.from || m.fromAddress || 'Email enquiry').slice(0,120), contact: (m.fromAddress || m.from || 'unknown').slice(0,160),
      service: 'Creative project', offer: null, event_date: null,
      details: (m.subject + (m.summary ? ': ' + m.summary : '')).slice(0,2000),
      source: 'Email', page: 'Email to crt.rw', status: 'new', value_rwf: null,
      assigned_to: me ? me.user_id : null, notes: null
    };
    try{ const saved = await api.addLead(row); leads.unshift(saved); renderLeads(); toast('Saved as a lead. Find it in Leads.'); }catch(e){ fail(e); }
  }

  // ------------------------------------------------------------------ team
  function renderTeam(){
    const ro = !isAdmin();
    $('#team-table tbody').innerHTML = team.map(m => `
      <tr data-uid="${esc(m.user_id)}">
        <td>${ro ? esc(m.name) : `<input type="text" value="${esc(m.name)}" data-field="name" aria-label="Name">`}${m.user_id === me.user_id ? ' <span class="lead-sub">(you)</span>' : ''}</td>
        <td>${ro || m.user_id === me.user_id ? esc(m.role === 'admin' ? 'Admin' : 'Staff') :
          `<select data-field="role" aria-label="Role"><option value="staff"${m.role==='staff'?' selected':''}>Staff</option><option value="admin"${m.role==='admin'?' selected':''}>Admin</option></select>`}</td>
        <td class="num">${ro || m.user_id === me.user_id ? '' : '<button class="link danger" data-action="remove-member">Remove</button>'}</td>
      </tr>`).join('');
  }

  // ------------------------------------------------------------------ boot
  async function loadAll(){
    [leads, team, content] = await Promise.all([api.leads(), api.team(), api.content()]);
    renderLeads(); renderContent(); renderTeam(); renderCases();
  }

  async function boot(){
    $('#demo-banner').hidden = LIVE;
    let session = null;
    try{ session = await api.session(); }catch(e){ fail(e); }
    if(!session){ show('view-login'); return; }
    if(started) return; started = true;
    try{ me = await api.me(session.user.id); }catch(e){ fail(e); }
    if(!me){ $('#noaccess-email').textContent = session.user.email; show('view-noaccess'); return; }
    me.email = session.user.email;
    $('#me-name').textContent = me.name || me.email;
    show('view-app');
    try{ await loadAll(); }catch(e){ fail(e); }
    setInterval(async () => { if(document.hidden || openId) return; try{ leads = await api.leads(); renderLeads(); }catch(e){} }, 60000);
  }

  // ------------------------------------------------------------------ events
  document.addEventListener('click', async e => {
    const li = e.target.closest('#inbox-list li[data-mid]'); if(li){ openMail(li.dataset.mid); return; }
    const t = e.target.closest('[data-action],[data-tab],[data-filter],tr[data-id]');
    if(!t) return;
    if(t.dataset.tab){
      $$('.tab').forEach(b => b.classList.toggle('is-active', b === t));
      $$('.tab-panel').forEach(p => p.hidden = p.id !== 'tab-' + t.dataset.tab);
      if(t.dataset.tab === 'inbox' && !inboxLoaded) loadInbox();
      return;
    }
    if(t.dataset.filter){ filter = t.dataset.filter; renderLeads(); return; }
    if(t.matches('tr[data-id]')){ openDrawer(Number(t.dataset.id)); return; }
    const a = t.dataset.action;
    if(a === 'signout') api.signOut();
    else if(a === 'new-lead') openNewLead();
    else if(a === 'inbox-refresh'){ await loadInbox(); toast('Inbox up to date'); }
    else if(a === 'inbox-more') loadInbox(true);
    else if(a === 'mail-to-lead') mailToLead();
    else if(a === 'refresh'){ try{ leads = await api.leads(); renderLeads(); toast('Up to date'); }catch(err){ fail(err); } }
    else if(a === 'export') exportCsv();
    else if(a === 'close-drawer') closeDrawer();
    else if(a === 'save-lead') saveLead();
    else if(a === 'wa-reply'){ const l = leads.find(x => x.id === openId); if(l && l.status === 'new'){ $('#d-status').value = 'replied'; } }
    else if(a === 'delete-lead'){
      if(!confirm('Delete this lead permanently?')) return;
      try{ await api.deleteLead(openId); leads = leads.filter(l => l.id !== openId); closeDrawer(); renderLeads(); toast('Lead deleted'); }catch(err){ fail(err); }
    }
    else if(a === 'save-prices'){ e.preventDefault(); savePrices(); }
    else if(a === 'save-packages'){ e.preventDefault(); savePackages(); }
    else if(a === 'add-testimonial'){
      const list = readTestimonials();
      if(list.length >= MAX_TESTIMONIALS){ toast('Maximum ' + MAX_TESTIMONIALS + ' testimonials'); return; }
      content.testimonials = [...list, {quote:'', name:'', role:''}]; renderTestimonials();
      const rows = $$('#testimonials-list .testimonial-row'); rows[rows.length - 1].querySelector('textarea').focus();
    }
    else if(a === 'remove-testimonial'){ const list = readTestimonials(); list.splice(Number(t.dataset.i), 1); content.testimonials = list; renderTestimonials(); }
    else if(a === 'save-testimonials') saveTestimonials();
    else if(a === 'copy-review-msg'){ try{ await navigator.clipboard.writeText($('#review-msg').textContent); toast('Copied. Paste it into WhatsApp.'); }catch(err){ toast('Select the text and copy it'); } }
    else if(a === 'save-film-url'){
      const raw = $('#film-url').value.trim();
      let ok = false; try{ ok = new URL(raw).protocol === 'https:'; }catch(err){}
      if(!ok){ toast('Paste a full https:// link, e.g. from YouTube or Vimeo'); return; }
      const entry = caseEntry(), old = entry.video;
      entry.video = {type:'link', url: raw};
      if(old && old.type === 'file') api.removeFile(old.url).catch(()=>{});
      renderCases(); saveCases('Film link saved. Live on the site.');
    }
    else if(a === 'remove-film'){
      const entry = caseEntry(); if(!entry.video) return;
      if(!confirm('Remove the film from this case study?')) return;
      if(entry.video.type === 'file') api.removeFile(entry.video.url).catch(()=>{});
      entry.video = null; renderCases(); saveCases('Film removed.');
    }
    else if(a === 'remove-photo'){
      const i = Number(t.dataset.i), entry = caseEntry(), p = entry.photos[i];
      if(!p || !confirm('Remove this photo?')) return;
      entry.photos.splice(i, 1); api.removeFile(p.url).catch(()=>{});
      renderCases(); saveCases('Photo removed.');
    }
    else if(a === 'remove-member'){
      const uid = t.closest('tr').dataset.uid; if(!confirm('Remove this person from the dashboard?')) return;
      try{ await api.removeMember(uid); team = team.filter(m => m.user_id !== uid); renderTeam(); toast('Removed'); }catch(err){ fail(err); }
    }
  });
  document.addEventListener('change', async e => {
    const el = e.target;
    if(el.id === 'case-select'){ caseSlug = el.value; renderCases(); return; }
    if(el.id === 'film-file' && el.files[0]){ const f0 = el.files[0]; el.value = ''; uploadFilm(f0); return; }
    if(el.dataset && el.dataset.photo !== undefined && el.files && el.files.length){ const files = [...el.files]; el.value = ''; addPhotos(files, Number(el.dataset.photo)); return; }
    if(el.classList && el.classList.contains('slot-caption')){
      const entry = caseEntry(), p = entry.photos[Number(el.dataset.i)];
      if(p){ p.caption = el.value.trim().slice(0, 160); saveCases('Caption saved.'); }
      return;
    }
    const f = el.closest('#team-table [data-field]'); if(!f) return;
    const uid = f.closest('tr').dataset.uid, patch = {[f.dataset.field]: f.value.trim()};
    try{ await api.updateMember(uid, patch); Object.assign(team.find(m => m.user_id === uid), patch); toast('Team updated'); }catch(err){ fail(err); }
  });
  $('#drawer-scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && openId) closeDrawer(); });
  $('#search').addEventListener('input', e => { query = e.target.value; renderLeads(); });
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#login-email').value.trim(), msg = $('#login-msg');
    const btn = e.target.querySelector('button[type="submit"]');
    msg.textContent = 'Signing in…'; btn.disabled = true;
    let error = null;
    try{ ({error} = await api.signIn(email, $('#login-password').value)); }catch(err){ error = err; }
    btn.disabled = false;
    if(error){ msg.textContent = /invalid/i.test(error.message || '') ? 'Wrong email or password.' : 'Couldn’t sign in: ' + (error.message || 'please try again') + '.'; return; }
    msg.textContent = '';
    $('#login-password').value = '';
    if(!LIVE) boot();
  });
  $$('#prices-form,#packages-form').forEach(f => f.addEventListener('submit', e => e.preventDefault()));
  if(LIVE) sb.auth.onAuthStateChange((ev) => { if(ev === 'SIGNED_IN' && !started) boot(); });

  boot();
})();
