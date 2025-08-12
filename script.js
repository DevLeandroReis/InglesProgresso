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

  function defaultState(){
    const todayISO = new Date().toISOString().slice(0,10);
    return {
      startDate: todayISO,
      months: 4,
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
    for(const item of SCHEDULE){
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="badge"><strong>${item.time}</strong></div>
        <div class="activity">
          <span class="emoji" aria-hidden="true">${item.emoji}</span>
          <span class="name">${item.name}</span>
          <span class="duration">— ${item.duration}</span>
        </div>
      `;
      $scheduleTable.appendChild(row);
    }
  }

  // Render atividades com quadradinhos
  function renderActivities(){
    const start = clampDay(state.startDate);
    const end = addMonths(start, state.months);
    const today = clampDay(new Date());

    $rangeText.textContent = `${start.toLocaleDateString()} → ${end.toLocaleDateString()} (${state.months} meses)`;

    const days = eachDay(start, end);
  const byMonth = splitByMonth(days);

    $activities.innerHTML = '';

    for(const item of SCHEDULE){
      const block = document.createElement('div');
      block.className = 'activity-block';
      const doneCount = (state.progress[item.key]||[]).length;
      block.innerHTML = `
        <div class="header">
          <div class="title"><span class="emoji" aria-hidden="true">${item.emoji}</span> ${item.name}</div>
          <div class="meta">${doneCount}/${days.length} dias</div>
        </div>
        <div class="months" role="region" aria-label="Progresso por mês: ${item.name}"></div>
      `;

      const monthsContainer = block.querySelector('.months');

      let globalIdx = 0;
      for(const [key, monthDays] of byMonth.entries()){
        const monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';
        const monthDone = monthDays.filter(d=> state.progress[item.key]?.includes(toISODate(d))).length;
        monthBlock.innerHTML = `
          <div class="month-header">
            <div class="month-name">${monthLabel(key)}</div>
            <div class="month-meta">${monthDone}/${monthDays.length} dias</div>
          </div>
          <div class="month-grid" role="grid"></div>
        `;

        const grid = monthBlock.querySelector('.month-grid');
        monthDays.forEach((d, idx)=>{
          const iso = toISODate(d);
          const sq = document.createElement('button');
          sq.className = 'square';
          sq.type = 'button';
          sq.title = iso;
          sq.setAttribute('aria-label', `${item.name} em ${iso}`);
          const isDone = state.progress[item.key]?.includes(iso);
          if(isDone) sq.classList.add('done');
          if(d.getTime() === today.getTime()) sq.classList.add('today');
          if(d < today && !isDone) sq.classList.add('missed');
          if((globalIdx)%7===0) sq.classList.add('week-start');

          sq.addEventListener('click', async ()=>{
            toggleProgress(item.key, iso);
            sq.classList.toggle('done');
            const meta = block.querySelector('.meta');
            const newCount = state.progress[item.key].length;
            meta.textContent = `${newCount}/${days.length} dias`;
            // atualiza parcial do mês
            const monthMeta = monthBlock.querySelector('.month-meta');
            const mDone = monthDays.filter(d=> state.progress[item.key]?.includes(toISODate(d))).length;
            monthMeta.textContent = `${mDone}/${monthDays.length} dias`;
            await persist();
          });

          grid.appendChild(sq);
          globalIdx++;
        });

        monthsContainer.appendChild(monthBlock);
      }

      $activities.appendChild(block);
    }
  }

  function toggleProgress(key, dayISO){
    const list = state.progress[key] || (state.progress[key]=[]);
    const i = list.indexOf(dayISO);
    if(i>=0){ list.splice(i,1); }
    else { list.push(dayISO); }
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
})();
