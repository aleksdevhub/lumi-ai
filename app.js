import {weatherRequest, imageRequest} from './intents.mjs?v=voice-fix-2';
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const tg = window.Telegram?.WebApp; tg?.ready(); tg?.expand();
  const API_ENDPOINT=window.LUMI_API_URL||'';
  const iconPaths={shortcut:'<rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 12h8m-4-4v8"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2.2 2.2m9.6 9.6L19 19M5 19l2.2-2.2m9.6-9.6L19 5"/><circle cx="12" cy="12" r="7"/>',home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15m6-12v15"/>',note:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',news:'<path d="M4 4h16v16H4z"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',send:'<path d="M12 19V5m-7 7 7-7 7 7"/>',arrow:'<path d="M7 17 17 7M7 7h10v10"/>',spark:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z"/>'};
  function svgIcon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]||iconPaths.spark}</svg>`}
  function setIcon(el,name){if(el)el.innerHTML=svgIcon(name)}
  $$('[data-icon]').forEach(element => setIcon(element, element.dataset.icon));
  setIcon($('.send'),'send');setIcon($('.voice'),'mic');
  $$('.map-shortcuts button').forEach((el,i)=>{el.innerHTML=svgIcon(['map','spark','spark'][i])+' '+el.textContent.replace('→','')+' '+svgIcon('arrow')});
  const storage = { read(k, fallback=[]) { try { return JSON.parse(localStorage.getItem('lumi:'+k)) ?? fallback; } catch { return fallback; } }, write(k,v) { localStorage.setItem('lumi:'+k,JSON.stringify(v)); } };
  const theme = $('#theme-select');
  function applyTheme(value) {
    const isLight = value === 'light';
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
    theme.value = isLight ? 'light' : 'dark';
    const background = isLight ? '#f4f4f2' : '#090909';
    $('meta[name="theme-color"]').content = background;
    try {
      tg?.setHeaderColor(isLight ? '#f4f4f2' : '#242424');
      tg?.setBackgroundColor(background);
      tg?.setBottomBarColor?.(background);
    } catch {}
  }
  applyTheme(document.documentElement.dataset.theme);
  theme.addEventListener('change', () => {
    applyTheme(theme.value);
    try { localStorage.setItem('lumi:theme', theme.value); }
    catch { toast('Не удалось сохранить тему на устройстве'); }
  });
  const modelLabels = {'lumi-1': 'Lumi 1.0', 'lumi-flash': 'Lumi 1.1 Flash', 'lumi-nova': 'Lumi 1.2 Nova'};
  let selectedModel = storage.read('selectedModelV2', 'lumi-nova');
  if (!Object.hasOwn(modelLabels, selectedModel)) selectedModel = 'lumi-nova';
  const prefix = 'lumi:dialog:';
  const uid = () => crypto.randomUUID();
  const legacy = storage.read('messages');
  const legacyId = '00000000-0000-4000-8000-000000000001';
  function dialogMessages(id) { return storage.read('dialog:' + id); }
  function saveDialog(id, messages) { storage.write('dialog:' + id, messages.slice(-100)); }
  if (legacy.length) {
    if (!localStorage.getItem(prefix + legacyId)) {
      saveDialog(legacyId, legacy.map(m => ({...m, id: uid()})));
    }
    localStorage.removeItem('lumi:messages');
  }
  let dialogId = storage.read('activeDialog', null) || (legacy.length ? legacyId : uid());
  storage.write('activeDialog', dialogId);
  const pending = new Set();
  const drafts = new Map();
  const removedDialogs = new Set(storage.read('removedDialogs'));
  function dialogIds() {
    return Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length)).filter(id => !removedDialogs.has(id));
  }
  function recentList(container, limit) {
    container.replaceChildren();
    const rows = dialogIds().map(id => {
      const ms = dialogMessages(id);
      const first = ms.find(m => m.role === 'user');
      return {id, title: first?.text || 'Фото', at: ms.at(-1)?.at || 0};
    }).sort((a,b) => b.at - a.at);
    for (const item of rows.slice(0, limit)) {
      const b = document.createElement('button');
      b.className = 'dialog-link';
      b.textContent = item.title;
      b.setAttribute('aria-current', String(dialogId === item.id));
      b.onclick = () => openDialog(item.id);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'dialog-remove icon-button';
      remove.setAttribute('aria-label', 'Удалить чат: ' + item.title);
      remove.title = 'Удалить чат';
      remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
      remove.onclick = () => deleteDialog(item.id);
      const row = document.createElement('div');
      row.className = 'dialog-row';
      row.append(b, remove);
      container.append(row);
    }
    if (!rows.length) container.textContent = 'Здесь появятся твои чаты.';
  }
  function openDialog(id) {
    if (preparingPhoto || capture) return toast('Сначала закончи запись или подготовку вложения');
    if (id !== dialogId) {
      drafts.set(dialogId, {text: input.value, photo: draftPhoto});
      dialogId = id;
      storage.write('activeDialog', id);
      input.value = drafts.get(id)?.text || '';
      showPhoto(drafts.get(id)?.photo || null);
      resizeInput();
      if (voicePanel.open) voicePanel.close();
      window.speechSynthesis?.cancel();
    }
    show('chat');
    renderChat();
    syncComposer();
  }
  function syncComposer() {
    input.disabled = pending.has(dialogId);
    $('.send').disabled = input.disabled;
    $('#attach-photo').disabled = preparingPhoto || input.disabled;
  }
  $$('[data-new-chat]').forEach(button => button.onclick = () => openDialog(dialogMessages(dialogId).length || input.value || draftPhoto ? uid() : dialogId));
  const date = new Date();
  $('#day-long-date').textContent = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(date).toUpperCase();
  const profileForm = $('#profile-form');
  const telegramId = tg?.initDataUnsafe?.user?.id;
  if (telegramId) {
    const idField = $('#profile-telegram-id');
    idField.value = String(telegramId);
    idField.closest('label').hidden = false;
  }
  function renderProfile() {
    const {name = '', city = ''} = storage.read('profile', {});
    const displayName = name || tg?.initDataUnsafe?.user?.first_name || '';
    $('#profile-display-name').value = displayName;
    $('#profile-city').value = city;
    $('#profile-name').textContent = displayName || 'Твой профиль';
    $('#profile-initial').textContent = (Array.from(displayName)[0] || 'L').toLocaleUpperCase('ru-RU');
    $('#profile-location').textContent = city;
    $('#profile-location').hidden = !city;
  }
  profileForm.addEventListener('submit', event => {
    event.preventDefault();
    try {
      storage.write('profile', {name: $('#profile-display-name').value.trim(), city: $('#profile-city').value.trim()});
      renderProfile();
      toast('Профиль сохранён');
    } catch { toast('Не удалось сохранить профиль на устройстве'); }
  });
  renderProfile();
  const viewport = window.visualViewport;
  function fitViewport() {
    if (viewport && viewport.scale === 1) {
      document.documentElement.style.setProperty('--visible-height', viewport.height + 'px');
      const expandedHeight = Math.max(window.innerHeight, tg?.viewportStableHeight || 0);
      $('.app-shell').classList.toggle('keyboard-open', expandedHeight - viewport.height > 120);
    }
  }
  viewport?.addEventListener('resize', fitViewport);
  fitViewport();
  const menu = $('#menu');
  const modelPicker = $('#model-picker');
  const novaOption = $('#nova-option');
  let novaAvailable = false;
  let novaCheck;
  let modelTrigger;
  function checkNova() {
    if (!API_ENDPOINT || !tg?.initData || novaCheck) return;
    novaCheck = fetch(API_ENDPOINT.replace(/\/$/, '') + '/models', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({initData: tg.initData}),
    })
      .then(result => result.ok ? result.json() : null)
      .then(status => {
        if (status) novaAvailable = status.novaAvailable === true;
        novaOption.hidden = !novaAvailable && selectedModel !== 'lumi-nova';
        novaOption.querySelector('input').disabled = !novaAvailable;
      })
      .catch(() => {})
      .finally(() => { novaCheck = null; });
  }
  function renderModel() {
    $$('[data-model-label]').forEach(label => { label.textContent = modelLabels[selectedModel]; });
    $('#open-model').setAttribute('aria-label', 'Выбрать модель: ' + modelLabels[selectedModel]);
    modelPicker.querySelector('input[value="' + selectedModel + '"]').checked = true;
  }
  renderModel();
  modelPicker.querySelector('form').addEventListener('submit', () => {
    const selected = modelPicker.querySelector('input:checked');
    if (!selected || selected.disabled) return;
    selectedModel = selected.value;
    renderModel();
    try { storage.write('selectedModelV2', selectedModel); } catch {}
  });
  $$('[data-model]').forEach(button => button.addEventListener('click', () => {
    modelTrigger = button;
    renderModel();
    checkNova();
    modelPicker.showModal();
    tg?.BackButton?.show();
  }));
  modelPicker.addEventListener('close', () => {
    modelTrigger?.focus();
    if (current === activeTab) tg?.BackButton?.hide();
  });
  modelPicker.addEventListener('click', event => {
    if (event.target === modelPicker) modelPicker.close();
  });
  const menuButton = $('#open-menu');
  menuButton.addEventListener('click', () => { recentList($('#recent-chats'), 12); menu.showModal(); });
  $('#close-menu').addEventListener('click', () => menu.close());
  menu.addEventListener('click', event => {
    if (event.target === menu && event.clientX > menu.getBoundingClientRect().right) menu.close();
  });
  let current = 'home', activeTab = 'home', toastTimer;
  const tabs = $$('[data-tab]');
  const topbar = $('.topbar');
  const backStack = [];
  const goBack = () => show(backStack.pop() || activeTab, false);
  function show(id, remember = true) {
    if (menu.open) menu.close();
    if (id === current) return;
    const isTab = tabs.some(tab => tab.dataset.tab === id);
    if (isTab) {
      activeTab = id;
      backStack.length = 0;
    } else if (remember) {
      backStack.push(current);
    }
    current = id;
    topbar.hidden = id !== 'chat';
    $$('.view').forEach(view => view.classList.toggle('active', view.id === id));
    tabs.forEach(tab => {
      const selected = tab.dataset.tab === activeTab;
      tab.classList.toggle('active', selected);
      if (selected) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    document.querySelector('main').scrollTop = 0;
    const back = $('#' + id + ' [data-back] span');
    if (back) back.textContent = 'Назад';
    if (id === 'history') renderHistory();
    if (id === 'notes') renderNotes();
    if (id === 'day') renderTasks();
    if (id === 'news') loadNews();
    if (isTab) tg?.BackButton?.hide();
    else tg?.BackButton?.show();
  }
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
  tabs.forEach(button => button.addEventListener('click', () => show(button.dataset.tab)));
  $$('[data-open]').forEach(button => button.addEventListener('click', () => {
    show(button.dataset.open);
    if (button.dataset.open === 'chat') renderChat();
  }));
  $$('[data-back]').forEach(button => button.addEventListener('click', goBack));
  const photoFile = $('#photo-file');
  const preview = $('#photo-preview');
  let draftPhoto = null;
  let preparingPhoto = false;
  function showPhoto(photo) {
    draftPhoto = photo;
    preview.hidden = !photo;
    const image = preview.querySelector('img');
    if (photo) image.src = photo.thumb;
    else image.removeAttribute('src');
  }
  function jpeg(image, limit, quality) {
    const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }
  $('#attach-photo').onclick = () => photoFile.click();
  $('#remove-photo').onclick = () => showPhoto(null);
  photoFile.onchange = async () => {
    const file = photoFile.files[0];
    photoFile.value = '';
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) return toast('Выбери фото до 24 МБ');
    preparingPhoto = true;
    $('#attach-photo').disabled = true;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      let data = jpeg(image, 1600, 0.8);
      if (data.length > 1500000) data = jpeg(image, 1080, 0.65);
      if (!data.startsWith('data:image/jpeg;base64,') || data.length > 1500000) throw Error();
      showPhoto({data: data.split(',')[1], thumb: jpeg(image, 180, 0.62)});
    } catch {
      toast('Не удалось открыть фото. Попробуй JPEG или PNG.');
    } finally {
      URL.revokeObjectURL(url);
      preparingPhoto = false;
      $('#attach-photo').disabled = input.disabled;
    }
  };
  $('#chat-form').addEventListener('submit', event => {
    event.preventDefault();
    if (capture?.committed) return toast('Дождись ответа на голосовую реплику.');
    if (preparingPhoto) return toast('Фото готовится…');
    const caption = input.value.trim();
    if (input.disabled || (!caption && !draftPhoto)) return;
    if (caption.length > 4000) return toast('Сообщение должно быть короче 4001 символа');
    const photo = draftPhoto;
    showPhoto(null);
    input.value = '';
    resizeInput();
    sendMessage(caption, false, photo);
  });
  const input = $('#chat-input');
  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  input.addEventListener('input', resizeInput);
  $$('.suggestions [data-prompt]').forEach(button => button.addEventListener('click', () => {
    input.value = button.dataset.prompt;
    input.focus();
    resizeInput();
  }));
  const sourceMarker = '\n\nИсточники · ';
  function separateSources(text) {
    const index = text.lastIndexOf(sourceMarker);
    if (index < 0) return {body:text};
    const [stamp,...lines] = text.slice(index+sourceMarker.length).split('\n');
    if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(stamp) || lines.length % 2) return {body:text};
    const links = [];
    for (let i=0;i<lines.length;i+=2) {
      try {
        const url=new URL(lines[i+1]);
        if(url.protocol!=='https:') return {body:text};
        links.push({title:lines[i],url:url.href});
      } catch {return {body:text};}
    }
    return {body:text.slice(0,index),stamp,links};
  }
  function attachSources(row,details) {
    if(!details.links?.length) return;
    const block=document.createElement('div');
    block.className='sources';
    block.textContent='Источники · '+new Date(details.stamp).toLocaleString('ru-RU');
    for (const {title,url} of details.links) {
      const link=document.createElement('a');
      link.textContent=title;link.href=url;link.target='_blank';link.rel='noopener noreferrer';
      block.append(link);
    }
    row.append(block);
  }

  const forecastMarker = '\n\nПрогноз LUMI · ';
  function replyDetails(text) {
    const details = separateSources(text);
    const marker = details.body.lastIndexOf(forecastMarker);
    if (marker < 0) return details;
    try {
      const cards = JSON.parse(details.body.slice(marker + forecastMarker.length));
      if (Array.isArray(cards) && cards.length <= 7) return {...details, body: details.body.slice(0, marker), cards};
    } catch {}
    return details;
  }

  const conditions = [
    [0, '☀', 'Ясно'], [2, '⛅', 'Переменная облачность'], [3, '☁', 'Облачно'],
    [48, '≋', 'Туман'], [57, '☂', 'Морось'], [67, '☂', 'Дождь'],
    [77, '❄', 'Снег'], [82, '☂', 'Ливень'], [86, '❄', 'Снегопад'], [99, 'ϟ', 'Гроза'],
  ];
  function appendForecast(row, cards) {
    if (!cards?.length) return;
    const grid = document.createElement('div');
    grid.className = 'chat-forecast';
    for (const card of cards) {
      if (!card || typeof card.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(card.date)) continue;
      const [, symbol, label] = conditions.find(([limit]) => Number.isFinite(card.code) && card.code <= limit) || [0, '—', ''];
      const tile = document.createElement('article');
      tile.className = 'forecast-tile';
      const day = document.createElement('small');
      day.textContent = new Date(card.date + 'T12:00:00Z').toLocaleDateString('ru-RU', {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'});
      const temp = document.createElement('strong');
      const degrees = value => Number.isFinite(value) ? value + '°' : '—';
      const range = degrees(card.min) + ' / ' + degrees(card.max);
      temp.textContent = symbol + ' ' + (Number.isFinite(card.temperature) ? degrees(card.temperature) : range);
      const info = document.createElement('span');
      info.textContent = label;
      const extra = document.createElement('small');
      extra.textContent = [
        ...(Number.isFinite(card.temperature) ? [range] : []),
        ...(Number.isFinite(card.feels) ? ['Ощущается ' + degrees(card.feels)] : []),
        ...(Number.isFinite(card.rain) ? ['Осадки ' + card.rain + '%'] : []),
      ].join(' · ');
      tile.append(day, temp, info, extra);
      grid.append(tile);
    }
    row.append(grid);
  }

  let recentPosition;
  async function getWeatherPosition() {
    if (recentPosition && Date.now() - recentPosition.time < 300000) return recentPosition.coords;
    const manager = tg?.LocationManager;
    const coords = await new Promise(resolve => {
      let timer;
      function finish(result) {
        clearTimeout(timer);
        if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) return resolve(null);
        resolve({latitude: Number(result.latitude.toFixed(2)), longitude: Number(result.longitude.toFixed(2))});
      }
      function browserLocation() {
        if (!navigator.geolocation) return finish(null);
        navigator.geolocation.getCurrentPosition(position => finish(position.coords), () => finish(null), {timeout: 7000, maximumAge: 300000});
      }
      timer = setTimeout(() => finish(null), 12000);
      if (!tg?.initData || !tg.isVersionAtLeast?.('8.0') || !manager) return browserLocation();
      try {
        const get = () => {
          if (!manager.isLocationAvailable) return browserLocation();
          try { manager.getLocation(finish); } catch { browserLocation(); }
        };
        if (manager.isInited) get();
        else manager.init(get);
      } catch { browserLocation(); }
    });
    if (coords) recentPosition = {coords, time: Date.now()};
    return coords;
  }

  async function generatedThumbnail(base64) {
    if (typeof base64 !== 'string' || !base64.startsWith('/9j/') || base64.length > 5000000) throw Error('Сервер вернул неподдерживаемое изображение.');
    const image = new Image();
    image.src = 'data:image/jpeg;base64,' + base64;
    await image.decode();
    let scaled = jpeg(image, 620, 0.8);
    if (scaled.length > 99000) scaled = jpeg(image, 480, 0.63);
    if (scaled.length > 99000) scaled = jpeg(image, 360, 0.55);
    if (scaled.length > 99000) throw Error('Изображение слишком большое для истории.');
    return scaled;
  }
  const memoryKey='webNotes:'+(tg?.initDataUnsafe?.user?.id || 'guest');
  const enabledKey=memoryKey+':enabled';
  const memoryEnabled=$('#web-memory');
  memoryEnabled.checked=storage.read(enabledKey,true);
  function refreshNotes() {
    const notes=storage.read(memoryKey);
    $('#web-count').textContent='Сохранено страниц: '+notes.length;
    const list=$('#web-list');
    list.replaceChildren();
    for(const n of notes) {
      const row=document.createElement('p');
      row.textContent=n.title+' · '+new Date(n.date).toLocaleDateString('ru-RU')+' — '+n.excerpt;
      list.append(row);
    }
  }
  function relatedNotes(text) {
    if(!memoryEnabled.checked) return [];
    const words=(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).map(w=>w.slice(0,6));
    return storage.read(memoryKey).map(note=>{
      const content=(note.title+' '+note.excerpt+' '+note.url).toLowerCase();
      return {note,score:words.filter(w=>content.includes(w)).length};
    }).filter(item=>item.score).sort((a,b)=>b.score-a.score).slice(0,3).map(item=>item.note);
  }
  memoryEnabled.onchange=()=>storage.write(enabledKey,memoryEnabled.checked);
  $('#forget-web').onclick=()=>{storage.write(memoryKey,[]);refreshNotes();};
  refreshNotes();
  const prefs = $('#reply-prefs');
  prefs.value=storage.read('replyPrefs','');
  $('#save-prefs').onclick=()=>{storage.write('replyPrefs',prefs.value.trim());toast('Предпочтения сохранены');};
  function renderChat() {
    const list = dialogMessages(dialogId);
    $('#welcome').hidden = list.length > 0;
    const box = $('#messages');
    box.replaceChildren();
    for (const item of list.slice(-30)) {
      const row = document.createElement('div');
      row.className = 'message ' + (item.role === 'assistant' ? 'system' : 'user');
      const details=item.role==='assistant'?replyDetails(item.text):{body:item.text};
      row.textContent = details.body;
      appendForecast(row, details.cards);
      attachSources(row,details);
      if (item.thumb?.startsWith('data:image/jpeg;base64,')) {
        const image = new Image();
        image.className = 'chat-photo';
        image.alt = item.role === 'assistant' ? 'Изображение, созданное LUMI' : 'Прикреплённое фото';
        image.src = item.thumb;
        if (item.role === 'assistant') {
          image.classList.add('generated-photo');
          const download = document.createElement('a');
          download.className = 'image-download';
          download.href = item.thumb;
          download.download = 'lumi-' + item.id + '.jpg';
          download.textContent = 'Скачать изображение';
          row.append(image, download);
        } else row.prepend(image);
      }
      box.append(row);
    }
    const scroll = $('#chat-scroll');
    if (pending.has(dialogId)) {
      const waiting = document.createElement('div');
      waiting.className='message system waiting-turn'; waiting.textContent='Думаю…'; box.append(waiting);
    }
    scroll.scrollTop = scroll.scrollHeight;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function revealReply(row, reply) {
    const scroll = $('#chat-scroll');
    const details=separateSources(reply);
    const letters = Array.from(details.body);
    const duration = Math.min(400, letters.length * 5);
    const start = performance.now();
    const text = document.createTextNode('');
    row.replaceChildren(text);
    row.setAttribute('aria-busy', 'true');
    let shown = 0;
    function frame(now) {
      if (!row.isConnected) return;
      const follow = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 48;
      const immediate = reducedMotion.matches || document.hidden || current !== 'chat';
      const count = immediate || !duration ? letters.length :
        Math.min(letters.length, 1 + Math.floor(letters.length * (now - start) / duration));
      if (count > shown) text.appendData(letters.slice(shown, count).join(''));
      shown = count;
      if (follow) scroll.scrollTop = scroll.scrollHeight;
      if (shown < letters.length) requestAnimationFrame(frame);
      else {row.removeAttribute('aria-busy');attachSources(row,details);if(follow)scroll.scrollTop=scroll.scrollHeight;}
    }
    frame(start);
  }

  function modelHistory(messages, count, replyLimit = 4000) {
    return messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-count).map(m => ({
      role: m.role, text: (m.role === 'assistant' ? replyDetails(m.text).body.slice(0, replyLimit) : m.text) || (m.thumb ? 'Фото' : ''),
    }));
  }

  async function sendMessage(text, session, photo = null, prepared = null) {
    const target = dialogId;
    if (pending.has(target)) return;
    const messages = dialogMessages(target);
    messages.push({id: uid(), role: 'user', text, at: Date.now(), ...(photo && {thumb: photo.thumb})});
    try { saveDialog(target, messages); } catch { input.value=text; showPhoto(photo); toast('На устройстве недостаточно места для сообщения'); return; }
    scheduleSync();
    renderChat();
    const box = $('#messages');
    box.lastElementChild?.classList.add('new-turn');
    const row = document.createElement('div');
    row.className = 'message system new-turn';
    box.append(row);
    if (!API_ENDPOINT) {
      row.textContent = 'Сервер LUMI ещё не настроен. Сообщение сохранено на этом устройстве.';
      return;
    }
    row.innerHTML = 'Думаю<span class="waiting-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>';
    const scroll = $('#chat-scroll');
    scroll.scrollTop = scroll.scrollHeight;
    pending.add(target);
    input.disabled = true;
    $('#attach-photo').disabled = true;
    $('.send').disabled = true;
    try {
      let data = prepared;
      if (prepared?.replyError) throw new Error(prepared.replyError);
      if (!data) {
        const nova = selectedModel === 'lumi-nova';
        const payload = {
          initData: tg?.initData || '',
          preferences: storage.read('replyPrefs', ''),
          model: selectedModel,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          memory: relatedNotes(text),
          messages: nova ? modelHistory(messages, 24, 10000) : modelHistory(messages, 16),
        };
        const weather = !photo && weatherRequest(text);
        if (weather && !weather.city) {
          row.textContent = 'Определяю местоположение…';
          payload.coords = await getWeatherPosition();
          if (!payload.coords) payload.weatherCity = storage.read('profile', {}).city || '';
          row.textContent = 'Получаю прогноз…';
        } else if (!photo && imageRequest(text)?.prompt) {
          row.textContent = 'Создаю изображение…';
        }
        const maxPayload = nova ? 72000 : 23500;
        const encoder = new TextEncoder();
        while (payload.messages.length > 1 && encoder.encode(JSON.stringify(payload)).length > maxPayload) {
          payload.messages.shift();
        }
        if (photo) payload.photo = photo.data;
        const path = photo ? '/chat/photo' : '/chat';
        const response = await fetch(API_ENDPOINT.replace(/\/$/, '') + path, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
        });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Не удалось получить ответ');
      }
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Модель не вернула ответ.');
      const historyNow = dialogMessages(target);
      if (!historyNow.some(m => m.id === messages.at(-1).id)) return;
      if(memoryEnabled.checked && data.note?.url && data.note.excerpt) {
        try {
          const notes=storage.read(memoryKey).filter(n=>n.url!==data.note.url);
          storage.write(memoryKey,[data.note,...notes].slice(0,40));
          refreshNotes();
        } catch {toast('Не удалось сохранить страницу на устройстве');}
      }
      let savedReply=data.reply;
      if (Array.isArray(data.weather?.cards)) savedReply += forecastMarker + JSON.stringify(data.weather.cards);
      const thumb = data.image ? await generatedThumbnail(data.image) : null;
      if(data.sources?.length && data.checkedAt) {
        savedReply+=sourceMarker+data.checkedAt+'\n'+data.sources.map(s=>s.title.replace(/\s+/g,' ')+'\n'+s.url).join('\n');
      }
      historyNow.push({id: uid(), role: 'assistant', text: savedReply, at: Date.now(), ...(thumb && {thumb})});
      saveDialog(target, historyNow);
      scheduleSync();
      if (dialogId !== target) return;
      if (row.isConnected && !session && !data.sources?.length && !data.weather && !thumb) revealReply(row, savedReply);
      else { pending.delete(target); renderChat(); }
      if (activeVoice(session)) speak(data.reply, session);
    } catch (error) {
      if (dialogId === target && !row.isConnected) { $('.waiting-turn')?.remove(); $('#messages').append(row); }
      row.textContent = error.message || 'Не удалось связаться с LUMI. Попробуй ещё раз.';
      if (photo && row.isConnected && dialogId === target) {
        showPhoto(photo);
        input.value = text;
        resizeInput();
      }
      if (activeVoice(session)) voiceState('ready', row.textContent);
    } finally {
      pending.delete(target);
      syncComposer();
    }
  }
  renderChat();
  const voicePanel = $('#voice-panel');
  const voiceStatus = $('#voice-status');
  const voiceStart = $('#voice-start');
  const voiceSend = $('#voice-send');
  const voicePlay = $('#voice-play');
  const voiceChoice = $('#voice-gender');
  const audio = $('#voice-audio');
  const microphone = $('#voice');
  let capture = null;
  let voiceSession = null;
  let audioUrl = '';
  let voiceBuffer = null;
  let activeSound = null;
  let spokenText = '';
  let deviceSpeech = false;
  let speechHint = '';
  const savedVoice = storage.read('voiceChoice', 'female');
  if (['female', 'male', 'system'].includes(savedVoice)) voiceChoice.value = savedVoice;
  voiceChoice.addEventListener('change', () => {
    try { storage.write('voiceChoice', voiceChoice.value); } catch {}
  });

  function voiceState(state, message) {
    voicePanel.dataset.state = state;
    voiceStatus.textContent = message;
    voiceStart.hidden = state === 'listening' || state === 'waiting';
    if (state !== 'listening') voiceSend.hidden = true;
    voicePlay.textContent = state === 'speaking' ? 'Остановить' : 'Воспроизвести';
  }

  function setVoiceAudioMode(type) {
    try {
      const session = navigator.audioSession;
      if (session && session.type !== type) session.type = type;
    } catch {}
  }

  function resetPlayback() {
    stopBufferedPlayback();
    audio.pause();
    audio.removeAttribute('src');
    window.speechSynthesis?.cancel();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = '';
    voiceBuffer = null;
    spokenText = '';
    speechHint = '';
    voicePlay.hidden = true;
    setVoiceAudioMode('auto');
  }

  function activeVoice(session) {
    return !!session && session === voiceSession && voicePanel.open;
  }

  function finishPlayback(resume = false) {
    const session = voiceSession;
    if (activeVoice(session) && voicePanel.dataset.state === 'speaking') {
      setVoiceAudioMode('auto');
      voiceState('ready', speechHint || 'Ответ сохранён в чате.');
      if (resume && !session.manualTurns) setTimeout(() => {
        if (activeVoice(session) && voicePanel.dataset.state === 'ready') toggleRecording(session, true);
      }, 450);
    }
  }

  audio.addEventListener('ended', () => finishPlayback(true));

  function stopBufferedPlayback() {
    if (!activeSound) return;
    const source = activeSound;
    activeSound = null;
    source.onended = null;
    source.stop();
    source.disconnect();
  }

  async function playReply() {
    const session = voiceSession;
    if (!activeVoice(session) || !spokenText || capture) return;
    if (voicePanel.dataset.state === 'speaking') {
      stopBufferedPlayback();
      audio.pause();
      window.speechSynthesis?.cancel();
      finishPlayback();
      return;
    }
    // The recorder has released its microphone tracks before a reply can play.
    setVoiceAudioMode('playback');
    try {
      if (deviceSpeech) {
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) throw Error();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = /[а-яё]/i.test(spokenText) ? 'ru-RU' : 'en-US';
        const locale = utterance.lang.slice(0, 2);
        const voices = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith(locale));
        utterance.voice = voices.find(v => /enhanced|premium|natural|улучш/i.test(v.name)) || voices[0] || null;
        utterance.onstart = () => { if (activeVoice(session)) voiceState('speaking', 'Фонарик говорит…'); };
        utterance.onend = () => { if (activeVoice(session)) finishPlayback(true); };
        utterance.onerror = ({error}) => {
          if (activeVoice(session) && !['interrupted', 'canceled'].includes(error)) {
            setVoiceAudioMode('auto');
            voiceState('ready', 'Не удалось воспроизвести голос. Ответ есть в чате.');
          }
        };
        speechSynthesis.speak(utterance);
      } else if (voiceBuffer && session.audioContext?.state === 'running') {
        const source = session.audioContext.createBufferSource();
        source.buffer = voiceBuffer;
        source.connect(session.audioContext.destination);
        source.onended = () => {
          if (activeSound !== source) return;
          activeSound = null;
          source.disconnect();
          finishPlayback(true);
        };
        source.start();
        activeSound = source;
        voiceState('speaking', 'Фонарик говорит…');
      } else {
        audio.currentTime = 0;
        await audio.play();
        if (activeVoice(session) && !audio.paused) voiceState('speaking', 'Фонарик говорит…');
      }
    } catch {
      if (activeVoice(session)) {
        setVoiceAudioMode('auto');
        voiceState('ready', 'Нажми «Воспроизвести». Ответ есть в чате.');
      }
    }
  }

  voicePlay.addEventListener('click', playReply);

  async function speak(text, session) {
    if (!activeVoice(session)) return;
    resetPlayback();
    const plain = text.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/gi, '').replace(/[*#\x60_]/g, '').replace(/\s+/g, ' ').trim();
    if (!plain) { voiceState('ready', 'Ответ сохранён в чате.'); return; }
    const voice = voiceChoice.value;
    deviceSpeech = voice === 'system';
    const excerpt = plain.length > 450 && !deviceSpeech;
    spokenText = excerpt ? plain.slice(0, 450).replace(/\s+\S*$/, '').trim() : plain;
    speechHint = excerpt ? 'Озвучено начало. Полный ответ в чате.' : '';
    if (!deviceSpeech) {
      voiceState('waiting', 'Готовлю озвучку…');
      try {
        const result = await fetch(API_ENDPOINT.replace(/\/$/, '') + '/speak', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          signal: session.signal,
          body: JSON.stringify({initData: tg?.initData || '', voice, text: spokenText}),
        });
        if (!result.ok || !result.headers.get('Content-Type')?.startsWith('audio/')) throw Error();
        const sound = await result.blob();
        if (!activeVoice(session)) return;
        audioUrl = URL.createObjectURL(sound);
        audio.src = audioUrl;
        if (session.audioContext?.state === 'running' && typeof session.audioContext.decodeAudioData === 'function') {
          const buffer = await session.audioContext.decodeAudioData(await sound.arrayBuffer()).catch(() => null);
          if (!activeVoice(session)) return;
          voiceBuffer = buffer;
        }
      } catch {
        if (!activeVoice(session)) return;
        deviceSpeech = true;
        speechHint = 'Нейроголос недоступен. Использую голос устройства.';
      }
    }
    voiceState('ready', speechHint || 'Ответ сохранён в чате.');
    voicePlay.hidden = false;
    await playReply();
  }

  function releaseCapture(turn) {
    if (capture !== turn) return;
    clearTimeout(turn.timer);
    stopSpeechDetection(turn);
    turn.stream?.getTracks().forEach(track => track.stop());
    capture = null;
  }

  async function finishCapture(turn, chunks) {
    if (capture !== turn) return;
    clearTimeout(turn.timer);
    stopSpeechDetection(turn);
    turn.stream.getTracks().forEach(track => track.stop());
    turn.stream = null;
    const blob = new Blob(chunks, {type: chunks.find(chunk => chunk.type)?.type || turn.recorder.mimeType || turn.mimeType});
    const inform = message => activeVoice(turn.session) ? voiceState('ready', message) : toast(message);
    try {
      if (blob.size < 80) throw Error('Telegram вернул пустую запись. Нажми «Говорить» и повтори фразу.');
      if (blob.size > 670000) throw Error('Запись слишком большая. Скажи чуть короче.');
      if (activeVoice(turn.session)) voiceState('waiting', 'Фонарик слушает запись и готовит ответ…');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const signature = new TextDecoder().decode(bytes.subarray(0, 12));
      const mimeType = signature.startsWith('RIFF') && signature.endsWith('WAVE') ? 'audio/wav'
        : signature.slice(4, 8) === 'ftyp' ? 'audio/mp4'
        : signature.startsWith('OggS') ? 'audio/ogg'
        : bytes[0] === 0x1a && bytes[1] === 0x45 ? 'audio/webm'
        : blob.type.split(';')[0].toLowerCase().replace(/^video\//, 'audio/');
      if (!mimeType) throw Error('Telegram не указал формат записи. Попробуй начать запись заново.');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const result = await fetch(API_ENDPOINT.replace(/\/$/, '') + '/transcribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        signal: turn.controller.signal,
        body: JSON.stringify({
          initData: tg?.initData || '',
          mimeType,
          audioBase64: btoa(binary),
          conversation: true,
          model: turn.model,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          history: modelHistory(dialogMessages(dialogId), 8).map(message => ({...message, text: message.text.slice(0, 1200)})),
          preferences: storage.read('replyPrefs', ''),
        }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok || typeof data.transcript !== 'string' || !data.transcript.trim()) {
        throw Error(data.error || 'Не удалось распознать речь.');
      }
      if (capture !== turn) return;
      if (activeVoice(turn.session)) voiceState('waiting', 'Фонарик думает…');
      releaseCapture(turn);
      await sendMessage(data.transcript, turn.session, null, data.reply || data.replyError ? data : null);
      if (activeVoice(turn.session) && voiceStatus.textContent === 'Фонарик думает…') {
        voiceState('ready', 'Проверь ответ в чате.');
      }
    } catch (error) {
      if (capture === turn && !turn.controller.signal.aborted) inform(error.message || 'Не удалось обработать запись.');
    } finally {
      releaseCapture(turn);
    }
  }

  function submitCapture(turn) {
    if (capture !== turn || turn.recorder.state !== 'recording') return;
    turn.committed = true;
    if (!turn.heardSpeech) turn.session.manualTurns = true;
    stopSpeechDetection(turn);
    turn.recorder.stop();
  }

  function stopSpeechDetection(turn) {
    clearInterval(turn.silenceTimer);
    turn.inputNode?.disconnect();
    turn.inputNode = null;
    turn.silentOutput?.disconnect();
    turn.silentOutput = null;
  }

  function detectEndOfSpeech(turn) {
    const context = turn.session.audioContext;
    if (!context || context.state === 'closed') return false;
    try {
      const analyser = context.createAnalyser();
      if (typeof analyser.getFloatTimeDomainData !== 'function') return false;
      analyser.fftSize = 1024;
      turn.inputNode = context.createMediaStreamSource(turn.stream);
      turn.inputNode.connect(analyser);
      if (context.createGain) {
        turn.silentOutput = context.createGain();
        turn.silentOutput.gain.value = 0;
        analyser.connect(turn.silentOutput);
        turn.silentOutput.connect(context.destination);
      }
      const samples = new Float32Array(analyser.fftSize);
      let noise = 0.004, activeFrames = 0, lastSpeech = 0;
      const started = performance.now();
      turn.silenceTimer = setInterval(() => {
        if (capture !== turn || turn.recorder.state !== 'recording') return;
        const now = performance.now();
        if (context.state === 'running') {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
          if (rms > Math.min(0.04, Math.max(0.006, noise * 2.1))) {
            activeFrames++;
            if (activeFrames >= 2 || lastSpeech) {
              lastSpeech = now;
              turn.heardSpeech = true;
            }
          } else {
            activeFrames = 0;
            if (!lastSpeech) noise = noise * 0.9 + Math.min(rms, 0.02) * 0.1;
          }
        }
        if (lastSpeech && now - lastSpeech >= 780) return submitCapture(turn);
        if (!lastSpeech && now - started >= 1800) voiceSend.hidden = false;
        if (!lastSpeech && now - started >= 7300 && !turn.automatic) {
          submitCapture(turn);
        } else if (!lastSpeech && now - started >= 9500 && turn.automatic) {
          releaseCapture(turn);
          if (turn.recorder.state === 'recording') turn.recorder.stop();
          if (activeVoice(turn.session)) voiceState('ready', 'Нажми «Говорить», когда будешь готов продолжить.');
        }
      }, 65);
      return true;
    } catch {
      stopSpeechDetection(turn);
      return false;
    }
  }

  async function toggleRecording(session, automatic = false) {
    if (!activeVoice(session) || capture || pending.has(dialogId)) return;
    const inform = message => activeVoice(session) && voiceState('ready', message);
    if (!API_ENDPOINT) return inform('Сервер LUMI недоступен.');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return inform('Запись с микрофона недоступна в этом браузере.');
    }
    const turn = {controller: new AbortController(), session, model: selectedModel, automatic};
    capture = turn;
    resetPlayback();
    voiceState('waiting', 'Запрашиваю доступ к микрофону…');
    try {
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (Context && !session.audioContext) session.audioContext = new Context();
        if (session.audioContext?.state === 'suspended') session.audioContext.resume().catch(() => {});
      } catch {}
      const ios = tg?.platform === 'ios' || /iPhone|iPad|iPod/i.test(navigator.userAgent);
      turn.stream = await navigator.mediaDevices.getUserMedia({audio: ios ? true : {echoCancellation: true, noiseSuppression: true, channelCount: 1}});
      if (capture !== turn) { turn.stream.getTracks().forEach(track => track.stop()); return; }
      const formats = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'];
      if (ios) formats.unshift('audio/mp4');
      else formats.push('audio/mp4');
      const mimeType = formats.find(type => MediaRecorder.isTypeSupported?.(type));
      turn.mimeType = mimeType || '';
      let recorder;
      try {
        recorder = new MediaRecorder(turn.stream, {...(mimeType && {mimeType}), audioBitsPerSecond: 48000});
      } catch { recorder = new MediaRecorder(turn.stream); }
      turn.recorder = recorder;
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onstop = () => finishCapture(turn, chunks);
      recorder.onerror = () => {
        if (capture !== turn) return;
        releaseCapture(turn);
        inform('Ошибка записи. Попробуй ещё раз.');
      };
      recorder.start();
      const canDetect = detectEndOfSpeech(turn);
      turn.timer = setTimeout(() => submitCapture(turn), canDetect ? 25000 : 7300);
      voiceSend.hidden = canDetect;
      voiceState('listening', 'Слушаю. После паузы отвечу автоматически.');
    } catch (error) {
      if (capture !== turn) return;
      releaseCapture(turn);
      inform(error.name === 'NotAllowedError' ? 'Telegram не дал доступ к микрофону.' : 'Не удалось включить микрофон.');
    }
  }

  microphone.addEventListener('click', () => {
    if (capture || pending.has(dialogId)) return toast('Дождись текущего ответа.');
    input.blur();
    voiceSession = new AbortController();
    voiceState('ready', 'Нажми «Говорить» и задай вопрос.');
    voicePanel.showModal();
    tg?.BackButton?.show();
    toggleRecording(voiceSession);
  });
  voicePanel.addEventListener('close', () => {
    if (voicePanel.open) return;
    if (capture && capture.session === voiceSession && !capture.committed) {
      const turn = capture;
      turn.controller.abort();
      releaseCapture(turn);
      if (turn.recorder?.state === 'recording') turn.recorder.stop();
    }
    voiceSession?.abort();
    resetPlayback();
    voiceSession?.audioContext?.close().catch(() => {});
    voiceSession = null;
    if (current === activeTab) tg?.BackButton?.hide();
  });
  $('#voice-close').addEventListener('click', () => voicePanel.close());
  $('#voice-read').addEventListener('click', () => voicePanel.close());
  voiceStart.addEventListener('click', () => toggleRecording(voiceSession));
  voiceSend.addEventListener('click', () => { if (capture) submitCapture(capture); });
  function renderTasks(){const tasks=storage.read('tasks');const list=$('#tasks-list');list.innerHTML='';$('#day-count').textContent=tasks.length?`Выполнено: ${tasks.filter(t=>t.done).length} из ${tasks.length}`:'Нет дел';if(!tasks.length){list.innerHTML='<div class="empty">Планов пока нет. Добавь то, о чём хочется помнить.</div>';return;}tasks.forEach(t=>{const row=document.createElement('div');row.className='entry task-entry'+(t.done?' done':'');row.innerHTML=`<button class="check" aria-label="Отметить план">${t.done?'✓':''}</button><span></span><button class="remove" aria-label="Удалить">×</button>`;row.querySelector('span').textContent=t.text;row.querySelector('.check').onclick=()=>{t.done=!t.done;storage.write('tasks',tasks);renderTasks()};row.querySelector('.remove').onclick=()=>{storage.write('tasks',tasks.filter(x=>x.id!==t.id));renderTasks()};list.append(row);});}
  $('#task-form').addEventListener('submit',e=>{e.preventDefault();const input=$('#task-input'),text=input.value.trim();if(!text)return;const tasks=storage.read('tasks');tasks.unshift({id:Date.now(),text,done:false});storage.write('tasks',tasks);input.value='';renderTasks()});renderTasks();
  function renderNotes(){const notes=storage.read('notes');const list=$('#notes-list');list.innerHTML='';if(!notes.length){list.innerHTML='<div class="empty">Здесь появятся сохранённые заметки.</div>';return;}notes.forEach(n=>{const row=document.createElement('div');row.className='entry';row.innerHTML='<span></span><button aria-label="Удалить заметку">×</button>';row.querySelector('span').textContent=n.text;const small=document.createElement('small');small.textContent=new Date(n.at).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});row.querySelector('span').append(small);row.querySelector('button').onclick=()=>{storage.write('notes',notes.filter(x=>x.id!==n.id));renderNotes()};list.append(row);});}
  $('#note-form').addEventListener('submit',e=>{e.preventDefault();const input=$('#note-input'),text=input.value.trim();if(!text)return;const notes=storage.read('notes');notes.unshift({id:Date.now(),text,at:Date.now()});storage.write('notes',notes);input.value='';renderNotes();toast('Заметка сохранена')});renderNotes();
  const pcStatus = $('#pc-status');
  const pcUserKey = 'sync:' + (tg?.initDataUnsafe?.user?.id || 'guest');
  let connection = storage.read(pcUserKey, null);
  let running = false, syncTimer, syncAgain = false;
  const acknowledged = new Set();
  function pcControls() {
    $('#pc-forget').hidden = !connection;
    $('#pc-code').parentElement.hidden = !!connection;
  }
  function disconnectPC() {
    clearTimeout(syncTimer);
    connection = null;
    localStorage.removeItem('lumi:' + pcUserKey);
    acknowledged.clear();
    $('#pc-code').value = '';
    pcStatus.textContent = 'Синхронизация выключена.';
    pcControls();
  }
  function scheduleSync() {
    if (!connection) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPC, 800);
  }
  async function syncPC() {
    if (running) { syncAgain = true; return; }
    if (!tg?.initData) { pcStatus.textContent = 'Открой LUMI через Telegram.'; return; }
    const session = connection || {code:$('#pc-code').value.trim(), after:0};
    if (!/^[0-9a-f]{48}$/i.test(session.code)) {pcStatus.textContent='Введи код из файла pair.txt на ПК.'; return;}
    connection = session;
    running = true;
    pcStatus.textContent = 'Подключаюсь к ПК…';
    try {
      const upload = [];
      for (const id of dialogIds()) {
        for (const m of dialogMessages(id)) {
          if (!acknowledged.has(m.id)) upload.push({...m, dialog:id});
        }
      }
      let pos = 0, more;
      do {
        const batch = [];
        let size = 0;
        while (pos < upload.length && batch.length < 50) {
          if (removedDialogs.has(upload[pos].dialog)) { pos++; continue; }
          const next = new TextEncoder().encode(JSON.stringify(upload[pos])).length;
          if (batch.length && size + next > 145000) break;
          batch.push(upload[pos++]); size += next;
        }
        const res = await fetch(API_ENDPOINT.replace(/\/$/,'')+'/dialogs/sync',{
          method:'POST', headers:{'Content-Type':'application/json','X-Lumi-Pair':session.code},
          body:JSON.stringify({initData:tg.initData,after:session.after,items:batch})
        });
        if (connection !== session) return;
        const data = await res.json();
        if (!res.ok) {
          if(res.status===403) disconnectPC();
          throw Error(data.error || 'Синхронизация временно недоступна.');
        }
        let visibleChanged = false;
        for (const {dialog,seq,...message} of data.rows) {
          session.after = seq;
          if (removedDialogs.has(dialog)) continue;
          const local = dialogMessages(dialog);
          if (!local.some(m => m.id === message.id)) {
            local.push(message);
            local.sort((a,b)=>a.at-b.at);
            saveDialog(dialog, local);
            if (dialog===dialogId) visibleChanged=true;
          }
          acknowledged.add(message.id);
        }
        for (const m of batch) acknowledged.add(m.id);
        storage.write(pcUserKey, session);
        if(visibleChanged && !pending.has(dialogId)) renderChat();
        more = data.more;
      } while (connection===session && (pos < upload.length || more));
      $('#pc-code').value='';
      pcStatus.textContent='Сохранено в SQL Server · '+new Date().toLocaleTimeString('ru-RU');
      if(current==='history') renderHistory();
      if(menu.open) recentList($('#recent-chats'),12);
    } catch (error) {
      pcStatus.textContent=error.message || 'Компьютер сейчас недоступен.';
      if(!storage.read(pcUserKey,null)) connection=null;
    } finally {
      running=false; pcControls();
      if(syncAgain){syncAgain=false;scheduleSync();}
    }
  }
  $('#pc-forget').onclick=disconnectPC;
  $('#pc-sync').onclick=syncPC;
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) scheduleSync();});
  pcControls();
  scheduleSync();
  function renderHistory(){ recentList($('#history-list'), Infinity); }
  function deleteDialog(id) {
    if (pending.has(id) || (id === dialogId && (preparingPhoto || capture))) {
      toast('Сначала дождись завершения текущего действия');
      return;
    }
    if (!confirm('Удалить этот чат с устройства? Копия в SQL Server, если она есть, сохранится.')) return;
    try {
      storage.write('removedDialogs', [...removedDialogs, id]);
    } catch {
      toast('Не удалось сохранить удаление на устройстве');
      return;
    }
    removedDialogs.add(id);
    localStorage.removeItem(prefix + id);
    drafts.delete(id);
    if (id === dialogId) {
      dialogId = uid();
      storage.write('activeDialog', dialogId);
      input.value = '';
      showPhoto(null);
      resizeInput();
      if (voicePanel.open) voicePanel.close();
      window.speechSynthesis?.cancel();
      renderChat();
      syncComposer();
    }
    renderHistory();
    if (menu.open) recentList($('#recent-chats'), 12);
    const list = menu.open ? $('#recent-chats') : $('#history-list');
    (list.querySelector('.dialog-link') || (menu.open ? $('#close-menu') : $('#history [data-new-chat]'))).focus();
    toast('Чат удалён с устройства');
  }
  function clearDialogs() {
    disconnectPC();
    for (const id of dialogIds()) localStorage.removeItem(prefix + id);
    drafts.clear();
    dialogId = uid();
    storage.write('activeDialog', dialogId);
    input.value = ''; showPhoto(null); resizeInput();
    renderChat(); renderHistory(); syncComposer();
  }
  $('#clear-history').onclick = () => {
    if (confirm('Удалить все чаты на этом устройстве и отключить синхронизацию?')) clearDialogs();
  };
  $('#clear-data').onclick = () => {
    if (!confirm('Удалить профиль, чаты, заметки и планы на этом устройстве?')) return;
    clearDialogs();
    localStorage.removeItem('lumi:'+memoryKey); localStorage.removeItem('lumi:'+enabledKey); memoryEnabled.checked=true; refreshNotes();
    prefs.value='';
    for (const key of ['tasks','notes','replyPrefs','profile']) localStorage.removeItem('lumi:'+key);
    renderTasks(); renderNotes(); renderProfile(); toast('Локальные данные удалены');
  };
  $('#map-form').addEventListener('submit',e=>{e.preventDefault();const q=$('#map-query').value.trim();if(q)window.open('https://yandex.ru/maps/?text='+encodeURIComponent(q),'_blank','noopener');});
  $$('[data-map]').forEach(b=>b.addEventListener('click',()=>window.open('https://yandex.ru/maps/?text='+encodeURIComponent(b.dataset.map+' рядом'),'_blank','noopener')));
  $('#locate').addEventListener('click',()=>{if(!navigator.geolocation){toast('Геопозиция не поддерживается');return;}$('#weather-place').textContent='Определяю местоположение…';navigator.geolocation.getCurrentPosition(async p=>{try{const {latitude,longitude}=p.coords;const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);if(!r.ok)throw Error();const d=await r.json(),c=d.current;$('#temperature').textContent=Math.round(c.temperature_2m)+'°';$('#weather-place').textContent='Рядом с тобой';$('#weather-detail').textContent=`Ощущается как ${Math.round(c.apparent_temperature)}° · сегодня ${Math.round(d.daily.temperature_2m_min[0])}° / ${Math.round(d.daily.temperature_2m_max[0])}°`;$('#weather-icon').textContent=c.weather_code===0?'☼':c.weather_code<60?'◒':'☂';}catch{$('#weather-place').textContent='Прогноз временно недоступен';toast('Не удалось загрузить погоду')}},()=>{$('#weather-place').textContent='Нет доступа к геопозиции';toast('Разреши доступ к геопозиции в браузере')},{timeout:10000});});
  let lastNewsLoad=0, loadingNews=false;
  async function loadNews() {
    if(loadingNews || Date.now()-lastNewsLoad<300000) return;
    loadingNews=true;
    const list=$('#news-list');
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res=await fetch(API_ENDPOINT.replace(/\/$/,'')+'/news?timeZone='+encodeURIComponent(zone));
      if(!res.ok) throw Error();
      const {items}=await res.json();
      const links=items.map(item=>{
        const link=document.createElement('a');
        link.className='news-entry';link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
        const row=document.createElement('div');row.className='entry';
        const title=document.createElement('strong');title.textContent=item.title;
        const date=document.createElement('small');date.textContent=new URL(item.url).hostname+' · '+new Date(item.date).toLocaleString('ru-RU');
        row.append(title,date);link.append(row);return link;
      });
      list.replaceChildren(...links);lastNewsLoad=Date.now();
    } catch {list.textContent='Не удалось обновить ленту. Открой раздел чуть позже.';}
    finally {loadingNews=false;}
  }
  const shortcutButtons = $$('[data-home-shortcut]');
  const shortcutSupported = tg?.initData && tg?.isVersionAtLeast?.('8.0') && typeof tg.addToHomeScreen === 'function';
  let shortcutStatus = shortcutSupported ? 'unknown' : 'unsupported';

  function updateShortcut(status) {
    shortcutStatus = status;
    shortcutButtons.forEach(button => {
      const label = button.querySelector('[data-shortcut-label]');
      if (status === 'added') label.textContent = 'Ярлык добавлен';
      else label.textContent = button.classList.contains('home-install') ? 'На главный экран' : 'Добавить на главный экран';
    });
  }

  shortcutButtons.forEach(button => button.addEventListener('click', () => {
    if (shortcutStatus === 'added') return toast('LUMI уже есть на домашнем экране.');
    if (shortcutStatus === 'unsupported') return toast('Ярлык доступен в поддерживаемых мобильных версиях Telegram.');
    try { tg.addToHomeScreen(); } catch { toast('Telegram не смог добавить ярлык на этом устройстве.'); }
  }));

  if (shortcutSupported) {
    tg.onEvent?.('homeScreenAdded', () => updateShortcut('added'));
    try { tg.checkHomeScreenStatus?.(updateShortcut); } catch {}
  }

  function updateFullscreen() {
    document.documentElement.classList.toggle('telegram-fullscreen', tg?.isFullscreen === true);
    fitViewport();
  }

  if (tg?.initData && tg?.isVersionAtLeast?.('8.0')) {
    tg.onEvent?.('fullscreenChanged', updateFullscreen);
    tg.onEvent?.('safeAreaChanged', updateFullscreen);
    tg.onEvent?.('contentSafeAreaChanged', updateFullscreen);
    updateFullscreen();
    if (!tg.isFullscreen) {
      try { tg.requestFullscreen?.(); } catch {}
    }
  }

  tg?.BackButton?.onClick(() => {
    if (voicePanel.open) voicePanel.close();
    else if (modelPicker.open) modelPicker.close();
    else if (menu.open) menu.close();
    else goBack();
  });
})();
