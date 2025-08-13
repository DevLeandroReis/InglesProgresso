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
  const $achievements = qs('#achievements');
  const $btnSelectFolder = qs('#btnSelectFolder');
  const $btnExport = qs('#btnExport');
  const $btnImport = qs('#btnImport');
  const $fileImport = qs('#fileImport');
  // sem botões adicionais

  const STORAGE_KEY = 'ingles-progresso:v2';
  let dirHandle = null; // Handle para pasta selecionada para backup automático

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
  lastCelebrateDay: '',
      achievements: {
        perfectDays: 0, // total histórico
        claimed: 0      // quantas conquistas já resgatadas (cada uma = 7 dias)
      },
      progress: {
        // por atividade: array de datas concluídas (ISO)
      }
    };
  }

  function ensureStructure(st){
    for(const item of SCHEDULE){
      if(!st.progress[item.key]) st.progress[item.key] = [];
    }
  if(typeof st.lastCelebrateDay !== 'string') st.lastCelebrateDay = '';
  if(!st.achievements) st.achievements = { perfectDays: 0, claimed: 0 };
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
    state.achievements = { perfectDays: 0, claimed: 0 };
    state.lastCelebrateDay = '';
    persistAndRender();
      }
    });

    // Backup/Export/Import handlers
    if($btnSelectFolder){
      $btnSelectFolder.addEventListener('click', async ()=>{
        try{
          await selectDirectory();
          await initializeFromFile();
        }catch(e){
          console.warn(e);
        }
      });
    }

    if($btnExport){
      $btnExport.addEventListener('click', ()=>{
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ingles-progresso-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    if($btnImport){
      $btnImport.addEventListener('click', ()=>{
        $fileImport.click();
      });
    }

    if($fileImport){
      $fileImport.addEventListener('change', async (e)=>{
        const file = e.target.files[0];
        if(!file) return;
        try{
          const text = await file.text();
          const imported = JSON.parse(text);
          if(confirm('Isso substituirá todo o progresso atual. Continuar?')){
            state = ensureStructure(imported);
            await persistAndRender();
            alert('Progresso importado com sucesso!');
          }
        }catch(err){
          alert('Erro ao importar arquivo: ' + err.message);
        }
        e.target.value = ''; // reset input
      });
    }
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
        const todayISO = toISODate(new Date());
        // snapshot antes
        const prevSet = computePerfectDaysSet();
        const prevCount = prevSet.size;
        const prevUnlocked = Math.floor(prevCount/7);
        const wasTodayPerfect = prevSet.has(todayISO);

        // toggle
        toggleProgress(key, todayISO);

        // atualiza label do botão
        const isNowDone = state.progress[key].includes(todayISO);
        e.currentTarget.textContent = isNowDone ? 'Feito hoje' : 'Marcar hoje';
        e.currentTarget.classList.toggle('done-today', isNowDone);

        // recálculo após toggle
        const newSet = computePerfectDaysSet();
        const newCount = newSet.size;
        const newUnlocked = Math.floor(newCount/7);
        const isTodayPerfect = newSet.has(todayISO);
        state.achievements.perfectDays = newCount;

        await persist();
        // atualiza gráficos e conquistas
        renderActivities();
        renderAchievements();

        // animações: conquista em múltiplos de 7, senão vitória simples ao virar perfeito hoje
        if(newUnlocked > prevUnlocked){
          const newlyIndex = newUnlocked - 1;
          triggerAchievementAnimation(newlyIndex);
          const target = document.querySelector('.achievements-card') || document.getElementById('achievements');
          if(target){ try{ target.scrollIntoView({ behavior:'smooth', block:'start' }); }catch{} }
        } else if(isTodayPerfect && !wasTodayPerfect){
          triggerVictoryAnimation();
        }
      });
    });
  }

  // Render progresso como gráfico (barras: feito vs faltante) por categoria + geral
  function renderActivities(){
    const start = clampDay(state.startDate);
    const end = addMonths(start, state.months);
    const days = eachDay(start, end);
    const totalDays = days.length;
    $rangeText.textContent = `${start.toLocaleDateString()} → ${end.toLocaleDateString()} (${state.months} meses)`;

    // Limpa container
    $activities.innerHTML = '';

    // Resumo geral (todas categorias somadas)
    const totalPossible = totalDays * SCHEDULE.length;
    const totalDone = SCHEDULE.reduce((acc, it)=> acc + ((state.progress[it.key]||[]).length), 0);
    const totalPct = totalPossible ? Math.round((totalDone/totalPossible)*100) : 0;

    const chart = document.createElement('div');
    chart.className = 'progress-chart';
    // linha geral
    const rowAll = document.createElement('div');
    rowAll.className = 'chart-row overall';
    rowAll.innerHTML = `
      <div class="chart-label"><strong>Geral</strong></div>
      <div class="chart-bar" aria-label="Progresso geral">
        <div class="chart-fill" style="width:${totalPct}%"></div>
      </div>
      <div class="chart-meta">${totalDone}/${totalPossible}</div>
    `;
    chart.appendChild(rowAll);

    // linhas por categoria
    for(const item of SCHEDULE){
      const done = (state.progress[item.key]||[]).length;
      const pct = totalDays ? Math.round((done/totalDays)*100) : 0;
      const row = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <div class="chart-label"><span class="emoji" aria-hidden="true">${item.emoji}</span> ${item.name}</div>
        <div class="chart-bar" aria-label="Progresso ${item.name}">
          <div class="chart-fill" style="width:${pct}%"></div>
        </div>
        <div class="chart-meta">${done}/${totalDays}</div>
      `;
      chart.appendChild(row);
    }

    $activities.appendChild(chart);
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
  renderAchievements();
  }
  // ===== Vitória (animação) =====
  function isAllDoneToday(){
    const todayISO = toISODate(new Date());
    return SCHEDULE.every(item => (state.progress[item.key]||[]).includes(todayISO));
  }
  function triggerVictoryAnimation(){
    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    // cria confetes
    const COUNT = 120;
    for(let i=0;i<COUNT;i++){
      const c = document.createElement('div');
      c.className = 'confetti';
      const left = Math.random()*100; // vw
      const size = 6 + Math.random()*8;
      const rot = Math.floor(Math.random()*360);
      const delay = Math.random()*0.3;
      const dur = 2.2 + Math.random()*0.8;
      const hue = Math.floor(Math.random()*360);
      c.style.left = left+'vw';
      c.style.width = size+'px';
      c.style.height = (size*0.6)+'px';
      c.style.background = `hsl(${hue} 85% 60%)`;
      c.style.transform = `rotate(${rot}deg)`;
      c.style.animationDelay = `${delay}s`;
      c.style.animationDuration = `${dur}s`;
      overlay.appendChild(c);
    }
    document.body.appendChild(overlay);
    // vibração rápida (se suportado)
    if(navigator.vibrate) try{ navigator.vibrate([120,40,120]); }catch{}
    // remove após término
    setTimeout(()=>{ overlay.remove(); }, 3200);
  }
  function celebrateIfAllDone(){
    const todayISO = toISODate(new Date());
    if(isAllDoneToday() && state.lastCelebrateDay !== todayISO){
  // Mantido para compatibilidade, mas a nova lógica de animação está no handler de clique.
  state.lastCelebrateDay = todayISO;
  writeStateToStorage(state);
  triggerVictoryAnimation();
    }
  }

  // Animação especial de conquista
  function triggerAchievementAnimation(prizeIndex){
    const overlay = document.createElement('div');
    overlay.className = 'achievement-overlay';
    const prize = getPrizeForIndex(prizeIndex || 0);
    overlay.innerHTML = `
      <div class="ach-card">
        <div class="ring"></div>
        <div class="medal">${prize.emoji || '🏅'}</div>
        <div class="title">Conquista desbloqueada!</div>
        <div class="name">${prize.name || 'Nova conquista'}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    if(navigator.vibrate) try{ navigator.vibrate([160,40,160]); }catch{}
    setTimeout(()=>{ overlay.remove(); }, 2600);
  }

  // ===== Conquistas (7 dias perfeitos) =====
  function computePerfectDaysSet(){
    // interseção de todas as datas concluídas entre as atividades
    const keys = SCHEDULE.map(s=> s.key);
    if(keys.length === 0) return new Set();
    let inter = new Set(state.progress[keys[0]] || []);
    for(let i=1;i<keys.length;i++){
      const setI = new Set(state.progress[keys[i]] || []);
      inter = new Set([...inter].filter(d => setI.has(d)));
      if(inter.size === 0) break;
    }
    return inter;
  }
  const FUN_PRIZES = [
    { emoji:'🏆', name:'Cálice da Fluência', desc:'Você ganhou um cálice dourado que melhora sua pronúncia por 0.0001%.' },
    { emoji:'🦄', name:'Unicórnio Bilíngue', desc:'Agora você pode dizer “hi” com glitter.' },
    { emoji:'🍕', name:'Pizza da Gramática', desc:'Cada fatia corrige um erro de preposição.' },
    { emoji:'🛡️', name:'Escudo Anti “Hesitation”', desc:'Bloqueia “ããã…” por 3 frases.' },
    { emoji:'🎩', name:'Cartola do Acento Britânico', desc:'Chá incluso. Açúcar, não.' },
    { emoji:'🪄', name:'Varinha do Vocabulário', desc:'Aprende 3 palavras mágicas: “consistent”, “practice”, “done”.' },
    { emoji:'🧊', name:'Gelo da Calma', desc:'Derrete a ansiedade em apresentações.' },
  ];
  function getPrizeForIndex(i){
    return FUN_PRIZES[i % FUN_PRIZES.length];
  }
  function renderAchievements(){
    if(!$achievements) return;
    const totalPerfect = state.achievements.perfectDays || 0;
    const unlocked = Math.floor(totalPerfect / 7);
    const nextProgress = totalPerfect % 7; // 0..6
    const nextNeed = 7 - nextProgress;
    const prize = getPrizeForIndex(unlocked); // o próximo a ser desbloqueado

    const barPct = Math.round((nextProgress / 7) * 100);
    $achievements.innerHTML = `
      <div class="achievement-header">
        <div class="achievement-title">Dias perfeitos: <strong>${totalPerfect}</strong></div>
        <div class="achievement-claimed">Conquistas: <strong>${unlocked}</strong></div>
      </div>
      <div class="progress-wrap" aria-label="Progresso para próxima conquista">
        <div class="progress-bar" style="width:${barPct}%"></div>
      </div>
      <div class="prize" role="status" aria-live="polite">
        <span class="emoji">${prize.emoji}</span>
        <div>
          <div class="name">Próxima conquista: ${prize.name}</div>
          <div class="desc" style="color:var(--muted)">${prize.desc} — Faltam <strong>${nextNeed}</strong> dia(s).</div>
        </div>
      </div>
    `;
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
  
  async function loadStateFromFile(){
    if(!dirHandle) return null;
    try{
      const fileHandle = await dirHandle.getFileHandle('ingles-progresso.json', { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    }catch(err){
      console.warn('Erro ao carregar arquivo:', err);
      return null;
    }
  }
  
  async function writeStateToFile(state){
    if(!dirHandle) return;
    try{
      const fileHandle = await dirHandle.getFileHandle('ingles-progresso.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(state, null, 2));
      await writable.close();
    }catch(err){
      console.warn('Erro ao salvar arquivo:', err);
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
    // Se houver diretório selecionado, também salva no arquivo
    if(dirHandle){
      await writeStateToFile(state);
    }
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
      const testItem = SCHEDULE[0];
      const bodyText = buildFunnyNotificationBody(testItem, true);
      const opts = {
        body: bodyText,
        icon: './icons/favicon.svg',
        image: './icons/notif-banner.png',
        badge: './icons/favicon.svg',
        vibrate: [80, 20, 80],
        actions: [
          { action: 'abrir', title: 'Abrir app' },
          { action: 'feito', title: 'Marcar feito' }
        ],
        tag: 'ingles-progresso:test',
        data: { url: '/', type: 'test' }
      };
      if(reg && reg.showNotification){ reg.showNotification('Inglês Progresso', opts); }
      else { new Notification('Inglês Progresso', opts); }
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
  const body = buildFunnyNotificationBody(item);
      const tag = `ingles-progresso:${item.key}:${new Date().toISOString().slice(0,10)}`;
      const todayISO = new Date().toISOString().slice(0,10);
      const opts = {
        body,
        tag,
        renotify: false,
        silent: false,
        icon: './icons/favicon.svg',
        badge: './icons/favicon.svg',
        image: './icons/notif-banner.png',
        vibrate: [90, 30, 90],
        actions: [
          { action: 'abrir', title: 'Abrir app' },
          { action: 'feito', title: 'Marcar feito' }
        ],
        data: { url: '/', type: 'activity', key: item.key, date: todayISO }
      };
      if(reg && reg.showNotification){ reg.showNotification(title, opts); }
      else { new Notification(title, opts); }
    }catch(e){ console.warn('Falha ao notificar', e); }
  }

  // ===== Frases engraçadas (familia-friendly) =====
  const NOTIF_PARTS = {
    intros: [
      'Hora do upgrade', 'Missão do dia', 'Ding ding', 'Nível +1', 'Alerta de XP', 'Sinal verde', 'Momento foco',
      'Check-in de constância', 'Chamado da fluência', 'Ritual do inglês', 'Quest ativa', 'Turbo ligado',
      'Mini sprint', 'Pomodoro pronto', 'Start now', 'Let’s go', 'Go time', 'Time to learn', 'Vibe de estudo', 'Foco on'
    ],
    middles: [
      '{act} começou agora', '{act} te chama', 'Primeiro passo: {act}', 'Ponte aérea rumo à fluência: {act}',
      'Só começar com {act}', '{act}: 1% melhor hoje', 'Anti-procrastinação: {act}',
      'Tiny habit do dia: {act}', 'XP em curso: {act}', 'Combo perfeito: respira e {act}',
      'Modo treino: {act}', 'Ritmo constante com {act}', 'Sem pressa, com {act}', '{act} para aquecer',
      'Checklist te esperando: {act}', 'Streak sorri com {act}', 'Seu eu do futuro ama {act}',
      '5 min viram 25 com {act}', 'Só dar play em {act}', 'Comece suave: {act}'
    ],
    outros: [
      'Bora?', 'Partiu?', 'Play!', 'Valendo!', 'Vai uma rodada?', 'Tô contigo!', 'Fé no processo.',
      'Seu progresso agradece.', 'Constância vence.', 'Você consegue!', 'Foco e vapo.', 'Só vem!',
      'Um passo por vez.', 'Agora é a hora.', 'Let’s do it!', 'Keep going!', 'Bora brilhar!', 'Rumo ao OK!',
      'Curto e direto.', 'Microvitória agora.'
    ]
  };
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function buildFunnyNotificationBody(item, includeTime=false){
    const act = `${item.emoji} ${item.name}`;
    const intro = pick(NOTIF_PARTS.intros);
    const midT = pick(NOTIF_PARTS.middles).replace('{act}', act);
    const outro = pick(NOTIF_PARTS.outros);
    const time = includeTime ? ` (${(item.time.split('–')[0]||'').trim()})` : '';
    return `${intro}! ${midT}${time}. ${outro}`;
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
      const VAPID_PUBLIC = 'BGNdJDGUIZIoJ8xk16xv6kXRc7k7j9cKr1-E-LMj7s5KLwW6bk8rX5YKf5F1Xm2VqJN9Ys8nHgj7TfUHOqvYnDQ';
      
      const ok = await ensureNotificationPermission();
      if(!ok) return;
      
      try{
        const sub = await subscribePush(VAPID_PUBLIC);
        console.log('Push subscription:', JSON.stringify(sub));
        alert('Assinatura de push criada com sucesso! Para receber notificações com o navegador fechado, um backend precisa ser configurado.');
      }catch(e){ 
        console.warn(e); 
        alert('Falha ao assinar Push: ' + e.message); 
      }
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
  // Recebe ações do Service Worker para marcar como feito ao clicar na ação da notificação
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', (event)=>{
      const msg = event.data;
      if(msg && msg.type === 'mark-today' && msg.key){
        const iso = msg.date || toISODate(new Date());
        toggleProgress(msg.key, iso);
        persistAndRender();
      }
    });
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
