(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const tg = window.Telegram?.WebApp; tg?.ready(); tg?.expand();
  const API_ENDPOINT=window.LUMI_API_URL||'';
  const iconPaths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15m6-12v15"/>',note:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',news:'<path d="M4 4h16v16H4z"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',send:'<path d="M12 19V5m-7 7 7-7 7 7"/>',arrow:'<path d="M7 17 17 7M7 7h10v10"/>',spark:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z"/>'};
  function svgIcon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]||iconPaths.spark}</svg>`}
  function setIcon(el,name){if(el)el.innerHTML=svgIcon(name)}
  $$('[data-icon]').forEach(element => setIcon(element, element.dataset.icon));
  setIcon($('.send'),'send');setIcon($('.voice'),'mic');
  $$('.map-shortcuts button').forEach((el,i)=>{el.innerHTML=svgIcon(['map','spark','spark'][i])+' '+el.textContent.replace('→','')+' '+svgIcon('arrow')});
  try { tg?.setHeaderColor('#101010'); tg?.setBackgroundColor('#101010'); } catch {}
  const storage = { read(k, fallback=[]) { try { return JSON.parse(localStorage.getItem('lumi:'+k)) ?? fallback; } catch { return fallback; } }, write(k,v) { localStorage.setItem('lumi:'+k,JSON.stringify(v)); } };
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
    if (preparingPhoto || activeRecorder || voicePending) return toast('Сначала закончи запись или подготовку вложения');
    if (id !== dialogId) {
      drafts.set(dialogId, {text: input.value, photo: draftPhoto});
      dialogId = id;
      storage.write('activeDialog', id);
      input.value = drafts.get(id)?.text || '';
      showPhoto(drafts.get(id)?.photo || null);
      resizeInput();
      voicePanel.open = false;
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
    }
  }
  viewport?.addEventListener('resize', fitViewport);
  fitViewport();
  const menu = $('#menu');
  const modelPicker = $('#model-picker');
  $('#open-model').addEventListener('click', () => {
    modelPicker.showModal();
    tg?.BackButton?.show();
  });
  modelPicker.addEventListener('close', () => {
    $('#open-model').focus();
    if (current === 'chat') tg?.BackButton?.hide();
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
  let current = 'chat', previous = 'chat', toastTimer;
  function show(id) {
    if (menu.open) menu.close();
    if (id === current) return;
    previous = current;
    current = id;
    $$('.view').forEach(view => view.classList.toggle('active', view.id === id));
    $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === id));
    document.querySelector('main').scrollTop = 0;
    const back = $('#' + id + ' [data-back] span');
    if (back) back.textContent = 'Назад';
    if (id === 'history') renderHistory();
    if (id === 'notes') renderNotes();
    if (id === 'day') renderTasks();
    if (id === 'news') loadNews();
    if (id === 'chat') tg?.BackButton?.hide();
    else tg?.BackButton?.show();
  }
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
  $$('[data-tab]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab,b.dataset.tab)));
  $$('[data-open]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.open,b.dataset.open==='chat'?'chat':'services')));
  $$('[data-back]').forEach(b=>b.addEventListener('click',()=>show(previous)));
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
      const details=item.role==='assistant'?separateSources(item.text):{body:item.text};
      row.textContent = details.body;
      attachSources(row,details);
      if (item.thumb?.startsWith('data:image/jpeg;base64,')) {
        const image = new Image();
        image.className = 'chat-photo';
        image.alt = 'Прикреплённое фото';
        image.src = item.thumb;
        row.prepend(image);
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
    const duration = Math.min(4800, letters.length * 22);
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

  async function sendMessage(text, fromVoice, photo = null) {
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
      if (fromVoice) speak(row.textContent);
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
      const history = messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-16);
      const payload = {
        initData: tg?.initData || '',
        preferences: storage.read('replyPrefs',''),
        memory: relatedNotes(text),
        messages: history.map(m => ({role: m.role, text: (m.role==='assistant'?separateSources(m.text).body.slice(0,4000):m.text) || (m.thumb ? 'Фото' : '')}))
      };
      while(payload.messages.length>1 && new TextEncoder().encode(JSON.stringify(payload)).length>23500) payload.messages.shift();
      if (photo) payload.photo = photo.data;
      const path = photo ? '/chat/photo' : '/chat';
      const response = await fetch(API_ENDPOINT.replace(/\/$/, '') + path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error(data.error || 'Не удалось получить ответ');
      }
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
      if(data.sources?.length && data.checkedAt) {
        savedReply+=sourceMarker+data.checkedAt+'\n'+data.sources.map(s=>s.title.replace(/\s+/g,' ')+'\n'+s.url).join('\n');
      }
      historyNow.push({id: uid(), role: 'assistant', text: savedReply, at: Date.now()});
      saveDialog(target, historyNow);
      scheduleSync();
      if (dialogId !== target) return;
      if (row.isConnected) revealReply(row, savedReply);
      else { pending.delete(target); renderChat(); }
      if (fromVoice) speak(data.reply);
      voiceStatus.textContent = 'Ответ LUMI готов.';
    } catch (error) {
      if (dialogId === target && !row.isConnected) { $('.waiting-turn')?.remove(); $('#messages').append(row); }
      row.textContent = error.message || 'Не удалось связаться с LUMI. Попробуй ещё раз.';
      if (photo && row.isConnected && dialogId === target) {
        showPhoto(photo);
        input.value = text;
        resizeInput();
      }
      if (fromVoice && row.isConnected) speak(row.textContent);
    } finally {
      pending.delete(target);
      syncComposer();
    }
  }
  renderChat();
  const voicePanel=document.createElement('details');voicePanel.className='voice-panel';voicePanel.id='voice-panel';voicePanel.innerHTML='<summary>Голосовой режим</summary><div class="voice-title">ГОЛОСОВОЙ ВВОД И ОТВЕТ</div><div class="voice-controls"><button class="voice-start" type="button"><span></span>Говорить</button><label for="voice-gender">Голос ответа</label><select id="voice-gender" aria-label="Голос ответа"><option value="female">Женский</option><option value="male">Мужской</option></select></div><div class="voice-status" aria-live="polite">Нажми «Говорить», скажи фразу и нажми ещё раз.</div><small class="voice-privacy">Запись до 25 секунд отправляется в Gemini для распознавания. LUMI не сохраняет аудиофайл.</small>';
  $('.composer').before(voicePanel);
  voicePanel.addEventListener('toggle', () => $('#composer-more').setAttribute('aria-expanded', String(voicePanel.open)));
  $('#composer-more').addEventListener('click',()=>{voicePanel.open=!voicePanel.open; if(voicePanel.open) voicePanel.scrollIntoView({block:'nearest',behavior:'smooth'});});
  const voiceStart=$('.voice-start'),voiceStatus=$('.voice-status');
  let activeRecorder=null,activeStream=null,recordedChunks=[],recordTimer=null,voiceRecordButton=null;
  let voicePending = false;
  function finishRecording(){if(activeRecorder?.state==='recording')activeRecorder.stop();}
  async function toggleRecording(button,autoSend){
    if(activeRecorder?.state==='recording'){finishRecording();return;}
    if (voicePending || pending.has(dialogId)) return;
    if(!API_ENDPOINT){voiceStatus.textContent='Сервер LUMI не настроен.';voicePanel.open=true;return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){voiceStatus.textContent='Запись с микрофона не поддерживается в этом приложении. Открой LUMI в обновлённом Telegram.';voicePanel.open=true;return;}
    try{
      voicePanel.open=true;voiceStatus.textContent='Запрашиваю доступ к микрофону…';
      voicePending=true;
      activeStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
      const formats=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];
      const mimeType=formats.find(type=>MediaRecorder.isTypeSupported(type));
      activeRecorder=mimeType?new MediaRecorder(activeStream,{mimeType}):new MediaRecorder(activeStream);
      voiceRecordButton=button;recordedChunks=[];
      activeRecorder.ondataavailable=e=>{if(e.data?.size)recordedChunks.push(e.data);};
      activeRecorder.onerror=()=>{voiceStatus.textContent='Ошибка записи. Проверь разрешение микрофона в Telegram.';};
      activeRecorder.onstop=async()=>{
        clearTimeout(recordTimer);activeStream?.getTracks().forEach(track=>track.stop());activeStream=null;
        const recorder=activeRecorder;activeRecorder=null;
        voiceStart.disabled=false;$('#voice').disabled=false;voiceStart.textContent='Говорить';setIcon($('#voice'),'mic');
        const blob=new Blob(recordedChunks,{type:recorder.mimeType||'audio/webm'});recordedChunks=[];
        if(blob.size<1200){voiceStatus.textContent='Запись слишком короткая. Нажми «Говорить» и произнеси фразу.';return;}
        if(blob.size>700000){voiceStatus.textContent='Запись длиннее 25 секунд. Попробуй сказать короче.';return;}
        voicePending=true;
        voiceStatus.textContent='Распознаю речь…';
        try{
          const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
          for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
          const mime=blob.type.split(';')[0].toLowerCase()||'audio/webm';
          const result=await fetch(API_ENDPOINT.replace(/\/$/,'')+'/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg?.initData||'',mimeType:mime,audioBase64:btoa(binary)})});
          const data=await result.json();if(!result.ok)throw new Error(data.error||'Не удалось распознать речь.');
          if(autoSend)sendMessage(data.transcript,true);else{$('#chat-input').value=($('#chat-input').value+' '+data.transcript).trim();voiceStatus.textContent='Речь добавлена в сообщение.';$('#chat-input').focus();}
        }catch(error){voiceStatus.textContent=error.message||'Не получилось обработать запись.';}finally{voicePending=false;}
      };
      voicePending=false;
      activeRecorder.start();voiceStatus.textContent='Записываю… нажми ещё раз, чтобы закончить.';
      if(button===voiceStart){voiceStart.textContent='Остановить';}else{setIcon($('#voice'),'spark');$('#voice').setAttribute('aria-label','Остановить запись');}
      recordTimer=setTimeout(finishRecording,25000);
    }catch(error){voicePending=false;activeStream?.getTracks().forEach(track=>track.stop());activeStream=null;activeRecorder=null;voiceStart.disabled=false;$('#voice').disabled=false;voiceStart.textContent='Говорить';setIcon($('#voice'),'mic');voicePanel.open=true;voiceStatus.textContent=error?.name==='NotAllowedError'?'Telegram не дал доступ к микрофону. Разреши микрофон для Telegram в настройках телефона и попробуй снова.':'Не удалось включить микрофон. Проверь разрешения Telegram и повтори попытку.';}
  }
  voiceStart.addEventListener('click',()=>toggleRecording(voiceStart,true));
  function speak(text){if(!window.speechSynthesis){voiceStatus.textContent='Озвучка не поддерживается браузером.';return;}const gender=$('#voice-gender').value;const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ru-RU';utterance.rate=1;utterance.pitch=gender==='female'?1.12:.88;const voices=speechSynthesis.getVoices();const matching=voices.find(v=>/^ru/i.test(v.lang)&&new RegExp(gender==='female'?'female|woman|милена|алёна|алена|ирина|жен':'male|man|павел|юрий|муж','i').test(v.name));if(matching)utterance.voice=matching;speechSynthesis.cancel();speechSynthesis.speak(utterance);}
  $('#voice').addEventListener('click',()=>toggleRecording($('#voice'),false));
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
    if (pending.has(id) || (id === dialogId && (preparingPhoto || activeRecorder || voicePending))) {
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
      voicePanel.open = false;
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
      const res=await fetch(API_ENDPOINT.replace(/\/$/,'')+'/news');
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
  tg?.BackButton?.onClick(() => {
    if (modelPicker.open) modelPicker.close();
    else if (menu.open) menu.close();
    else show($('.view.active').classList.contains('subview') ? previous : 'chat');
  });
})();
