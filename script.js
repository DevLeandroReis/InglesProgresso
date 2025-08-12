// Inglês Progresso – página única com salvamento local
(function(){
  const SCHEDULE = [
    { time: '08:00 – 08:30', emoji: '🃏', name: 'Flashcards', duration: '30 min', key: 'flashcards' },
    { time: '08:30 – 09:00', emoji: '📱', name: 'App Ewa English', duration: '30 min', key: 'ewa' },
    { time: '13:30 – 13:55', emoji: '▶️', name: 'YouTube Shorts/Vídeos', duration: '25 min', key: 'shorts' },
    { time: '13:55 – 14:10', emoji: '🎓', name: 'YouTube Aula de Inglês', duration: '15 min', key: 'aula' },
    { time: '20:00 – 20:30', emoji: '📖', name: 'Leitura (Livros ou Comics)', duration: '30 min', key: 'leitura' },
    { time: '20:30 – 21:00', emoji: '🎵', name: 'Estudo de músicas em inglês', duration: '30 min', key: 'musicas' },
    { time: '21:00 – 21:45', emoji: '🎬', name: 'Episódios de série em inglês', duration: '45 min', key: 'serie' },
  ];

  const qs = (sel, el=document) => el.querySelector(sel);
  const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  const $scheduleTable = qs('#scheduleTable');
  const $activities = qs('#activities');
  const $startDate = qs('#startDate');
  const $months = qs('#months');
  const $rangeText = qs('#rangeText');
  const $btnReset = qs('#btnReset');
  const $btnNotify = qs('#btnNotify');
  const $btnSubscribePush = qs('#btnSubscribePush');
  const $notifPrompt = qs('#notifPrompt');
  const $btnNotifPrompt = qs('#btnNotifPrompt');
  // sem botões adicionais

  const STORAGE_KEY = 'ingles-progresso:v2';

  function storageAvailable(){
    try{
      const k='__st_av__';
      localStorage.setItem(k,'1');
      localStorage.removeItem(k);
      return true;
    }catch{ return false; }
  }
  function safeParse(v){ try{ return JSON.parse(v); }catch{ return null; } }
  function loadStateFromStorage(){
    if(!storageAvailable()) return null;
    // prioridade: v2
    let raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ const s = safeParse(raw); if(s) return s; }
    // fallback: v1 legado
    raw = localStorage.getItem('ingles-progresso:v1');
    if(raw){ const s = safeParse(raw); if(s) return s; }
    // fallback: migrar da sessão
    try{
      raw = sessionStorage.getItem('ingles-progresso:session');
      if(raw){ const s = safeParse(raw); if(s) return s; }
    }catch{}
    return null;
  }
  function writeStateToStorage(current){
    if(!storageAvailable()) return;
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); }catch{}
  }
  function updateStorageWarning(){
    const el = document.getElementById('storageWarning');
    if(!el) return;
    el.hidden = storageAvailable();
  }
  function notifPromptSeen(seen){
    const KEY='ingles-progresso:notif-seen';
    if(typeof seen==='boolean'){
      try{ localStorage.setItem(KEY, seen?'1':'0'); }catch{}
      return seen;
    }
    try{ return localStorage.getItem(KEY)==='1'; }catch{ return false; }
  }

  function defaultState(){
    const todayISO = new Date().toISOString().slice(0,10);
    return {
      startDate: todayISO,
      months: 4,
  lastOpenDay: todayISO,
      progress: {
        // por atividade: array de datas concluídas (ISO)
      }
    };
  }

  function ensureStructure(st){
    for(const item of SCHEDULE){
      if(!st.progress[item.key]) st.progress[item.key] = [];
    }
    return st;
  }

  let state = defaultState();

  // UI bindings
  function bindControls(){
    $startDate.value = state.startDate;
    $months.value = String(state.months);

    $startDate.addEventListener('change', async ()=>{
      state.startDate = $startDate.value || state.startDate;
      await persistAndRender();
    });

    $months.addEventListener('change', async ()=>{
      state.months = parseInt($months.value, 10) || 4;
      await persistAndRender();
    });

    $btnReset.addEventListener('click', ()=>{
      if(confirm('Tem certeza que deseja limpar todas as marcações?')){
        state.progress = {};
        for(const item of SCHEDULE){ state.progress[item.key] = []; }
  persistAndRender();
      }
    });
  }

  // Utilidades de datas
  function addMonths(date, months){
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    // tratar meses com menos dias
    if(d.getDate() !== day){ d.setDate(0); }
    return d;
  }
  function clampDay(date){
    const d = new Date(date);
    d.setHours(0,0,0,0);
    return d;
  }
  function toISODate(date){
    return new Date(date).toISOString().slice(0,10);
  }
  function eachDay(start, end){
    const days = [];
    const d = clampDay(start);
    const last = clampDay(end);
    while(d <= last){
      days.push(new Date(d));
      d.setDate(d.getDate()+1);
    }
    return days;
  }
  function splitByMonth(days){
    const buckets = new Map(); // key: yyyy-mm -> array<Date>
    for(const d of days){
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(d);
    }
    return buckets; // mantém ordem de inserção
  }
  function monthLabel(yyyyMM){
    const [y,m] = yyyyMM.split('-').map(Number);
    const dt = new Date(y, m-1, 1);
    return dt.toLocaleDateString(undefined, { month:'long', year:'numeric' });
  }

  // Render tabela de horários
  function renderSchedule(){
    $scheduleTable.innerHTML = '';
    const todayISO = toISODate(new Date());
    for(const item of SCHEDULE){
      const isTodayDone = (state.progress[item.key]||[]).includes(todayISO);
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="activity">
          <span class="emoji" aria-hidden="true">${item.emoji}</span>
          <span class="name">${item.name}</span>
          <span class="time" aria-label="Horário">${item.time}</span>
          <span class="duration" aria-label="Duração">${item.duration}</span>
          <button class="btn mini mark-today ${isTodayDone?'done-today':''}" data-key="${item.key}">${isTodayDone ? 'Feito hoje' : 'Marcar hoje'}</button>
        </div>
      `;
      $scheduleTable.appendChild(row);
    }

    // Bind dos botões "Marcar hoje"
    qsa('.mark-today', $scheduleTable).forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const key = e.currentTarget.getAttribute('data-key');
        const iso = toISODate(new Date());
        toggleProgress(key, iso);
        // atualiza label do botão
        const isNowDone = state.progress[key].includes(iso);
        e.currentTarget.textContent = isNowDone ? 'Feito hoje' : 'Marcar hoje';
        e.currentTarget.classList.toggle('done-today', isNowDone);
        await persist();
        // atualiza grids e metas
        renderActivities();
      });
    });
  }

  // Render atividades com quadradinhos
  function renderActivities(){
    const start = clampDay(state.startDate);
    const end = addMonths(start, state.months);
    const today = clampDay(new Date());

    $rangeText.textContent = `${start.toLocaleDateString()} → ${end.toLocaleDateString()} (${state.months} meses)`;

  const days = eachDay(start, end);

    $activities.innerHTML = '';

    for(const item of SCHEDULE){
      const block = document.createElement('details');
      block.className = 'activity-block';
      const doneCount = (state.progress[item.key]||[]).length;
      block.innerHTML = `
        <summary class="header">
          <div class="title"><span class="emoji" aria-hidden="true">${item.emoji}</span> ${item.name}</div>
          <div class="meta">${doneCount}/${days.length} dias</div>
        </summary>
        <div class="grid" role="grid" aria-label="Progresso diário: ${item.name}"></div>
      `;

      const grid = block.querySelector('.grid');
      days.forEach((d, idx)=>{
        const iso = toISODate(d);
        const sq = document.createElement('div');
        sq.className = 'square';
        sq.title = iso;
        sq.setAttribute('aria-label', `${item.name} em ${iso} (somente leitura)`);
        const isDone = state.progress[item.key]?.includes(iso);
        if(isDone) sq.classList.add('done');
        if(d.getTime() === today.getTime()) sq.classList.add('today');
        if(d < today && !isDone) sq.classList.add('missed');
  // sem marca de início de semana
        grid.appendChild(sq);
      });

  $activities.appendChild(block);
    }
  }

  function toggleProgress(key, dayISO){
    const list = state.progress[key] || (state.progress[key]=[]);
    const i = list.indexOf(dayISO);
    if(i>=0){ list.splice(i,1); }
    else { list.push(dayISO); }
  }

  // Reset diário: limpa marcações de "hoje" nos botões ao virar o dia
  function dailyResetIfNeeded(){
    const todayISO = toISODate(new Date());
    if(state.lastOpenDay !== todayISO){
      state.lastOpenDay = todayISO;
      // Apenas o componente de horários é resetado (não mexe no histórico dos quadrinhos)
      // O botão “Feito hoje” é derivado de state.progress[...].includes(todayISO), então não há estado separado para limpar.
      // Nada para limpar aqui; renderSchedule atualizará os botões para o novo dia como "Marcar hoje".
      writeStateToStorage(state);
    }
  }

  function renderAll(){
    renderSchedule();
    renderActivities();
  }

  // ========= Persistência em arquivo (ler e escrever) =========
  function supportsDirPicker(){
    return 'showDirectoryPicker' in window;
  }
  async function selectDirectory(){
    if(!supportsDirPicker()){
      alert('Seu navegador não suporta seleção de pasta. Use Chrome/Edge atualizados.');
      throw new Error('Directory picker não suportado');
    }
    dirHandle = await window.showDirectoryPicker();
    // Request RW permissão
    try{
      const perm = await dirHandle.requestPermission({mode:'readwrite'});
      if(perm !== 'granted') throw new Error('Permissão negada');
    }catch(err){
      throw err;
    }
  }
  async function initializeFromFile(){
    const loaded = await loadStateFromFile();
    if(loaded){
      state = ensureStructure(loaded);
      renderAll();
      updateFileUI('Arquivo carregado da pasta.');
    }else{
      // cria o arquivo com estado padrão
      state = ensureStructure(state);
      await writeStateToFile(state);
      renderAll();
      updateFileUI('Arquivo criado na pasta.');
    }
  }
  async function persist(){
  writeStateToStorage(state);
  }
  async function persistAndRender(){
    await persist();
    renderAll();
  }
  function updateFileUI(){ /* não usado em sessionStorage */ }

  // inicialização
  const restored = loadStateFromStorage();
  if(restored){ state = ensureStructure(restored); }
  dailyResetIfNeeded();
  bindControls();
  renderAll();
  // garante que o estado inicial esteja salvo na sessão
  writeStateToStorage(state);
  updateStorageWarning();
  // tentativa extra de persistir ao ocultar/fechar a aba
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState !== 'visible'){
      writeStateToStorage(state);
    }
  });

  // ===== Notificações =====
  async function registerSW(){
    if('serviceWorker' in navigator){
      try{
        await navigator.serviceWorker.register('./sw.js');
      }catch(e){ console.warn('SW falhou', e); }
    }
  }
  async function ensureNotificationPermission(){
    if(!('Notification' in window)){
      alert('Seu navegador não suporta notificações.');
      return false;
    }
    let perm = Notification.permission;
    if(perm === 'default') perm = await Notification.requestPermission();
    if(perm !== 'granted'){
      alert('Permissão de notificação negada.');
      return false;
    }
    return true;
  }
  async function showLocalTestNotification(){
    try{
      const ok = await ensureNotificationPermission();
      if(!ok) return;
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
      if(reg && reg.showNotification){
        reg.showNotification('Inglês Progresso', { body: 'Exemplo de notificação ativa.' });
      }else{
        new Notification('Inglês Progresso', { body: 'Exemplo de notificação ativa.' });
      }
    }catch(e){ console.warn(e); }
  }
  // ===== Agendador de notificações locais (navegador aberto) =====
  let _notifTimers = [];
  let _midnightTimer = null;
  function _clearLocalNotificationTimers(){
    _notifTimers.forEach(id=> clearTimeout(id));
    _notifTimers = [];
    if(_midnightTimer){ clearTimeout(_midnightTimer); _midnightTimer = null; }
  }
  function _parseStartTime(range){
    // range como '08:00 – 08:30' (en dash). Pega o início.
    const startPart = (range.split('–')[0] || range.split('-')[0] || '').trim();
    const [h,m] = startPart.split(':').map(x=> parseInt(x,10));
    if(Number.isFinite(h) && Number.isFinite(m)) return {h,m};
    return null;
  }
  function _whenToday(h, m){
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    return d;
  }
  async function _showActivityNotification(item){
    try{
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
      const title = 'Inglês Progresso';
      const body = `${item.emoji} ${item.name} — começou agora (${item.time.split('–')[0].trim()})`;
      const tag = `ingles-progresso:${item.key}:${new Date().toISOString().slice(0,10)}`;
      const opts = { body, tag, renotify: false, silent: false, icon: undefined, badge: undefined };
      if(reg && reg.showNotification){ reg.showNotification(title, opts); }
      else { new Notification(title, opts); }
    }catch(e){ console.warn('Falha ao notificar', e); }
  }
  function scheduleLocalNotificationsForToday(){
    _clearLocalNotificationTimers();
    const now = new Date();
    for(const item of SCHEDULE){
      const parsed = _parseStartTime(item.time);
      if(!parsed) continue;
      const when = _whenToday(parsed.h, parsed.m);
      const delay = when.getTime() - now.getTime();
      if(delay > 500){
        const id = setTimeout(()=>{ _showActivityNotification(item); }, delay);
        _notifTimers.push(id);
      }
      // se já passou hoje, não agenda; o rollover da meia-noite cuidará do próximo dia
    }
    // agenda rollover na virada do dia (+2s de margem)
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 2, 0);
    _midnightTimer = setTimeout(()=>{ scheduleLocalNotificationsForToday(); }, tomorrow.getTime() - now.getTime());
  }
  async function startLocalNotifications(){
    const ok = await ensureNotificationPermission();
    if(!ok) return;
    scheduleLocalNotificationsForToday();
  }
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }
  async function subscribePush(vapidPublicKey){
    if(!('serviceWorker' in navigator)){
      alert('Service Worker não suportado.');
      return null;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
    }
    return sub;
  }

  // Inicializa SW e listeners de botões de notificação
  registerSW();
  if($btnNotify){
    $btnNotify.addEventListener('click', async ()=>{
      await startLocalNotifications();
      // feedback rápido
      showLocalTestNotification();
    });
  }
  if($btnSubscribePush){
    $btnSubscribePush.addEventListener('click', async ()=>{
      // IMPORTANTE: Para receber notificações com o navegador fechado, configure um backend de Web Push
      // e coloque aqui sua chave pública VAPID.
      const VAPID_PUBLIC = 'COLOQUE_SUA_CHAVE_PUBLICA_VAPID_AQUI';
      if(VAPID_PUBLIC.startsWith('COLOQUE_')){
        alert('Para Push em background, configure um backend (Web Push) e defina a chave VAPID.');
        return;
      }
      const ok = await ensureNotificationPermission();
      if(!ok) return;
      try{
        const sub = await subscribePush(VAPID_PUBLIC);
        console.log('Push subscription:', JSON.stringify(sub));
        alert('Assinatura criada. Envie essa subscription ao seu backend.');
      }catch(e){ console.warn(e); alert('Falha ao assinar Push.'); }
    });
  }
  // Verifica permissão ao abrir e mostra prompt se necessário
  function updateNotifPrompt(){
    if(!('Notification' in window)) return; // sem suporte, não mostra
    const alreadySeen = notifPromptSeen();
    const granted = Notification.permission === 'granted';
    $notifPrompt.hidden = granted || alreadySeen;
  }
  updateNotifPrompt();
  // Se a permissão já estiver concedida, inicia o agendador automaticamente
  if('Notification' in window && Notification.permission === 'granted'){
    startLocalNotifications();
  }
  if($btnNotifPrompt){
    $btnNotifPrompt.addEventListener('click', async ()=>{
      const ok = await ensureNotificationPermission();
      notifPromptSeen(true);
      updateNotifPrompt();
      if(ok) startLocalNotifications();
    });
  }
})();
