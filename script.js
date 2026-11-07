(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const DB_NAME = 'dinesh-engineering-portfolio-v1';
  const STORE = 'photos';
  const CONTENT_KEY = 'dinesh-engineering-portfolio-content-v1';
  let dbPromise;

  function openDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('This browser does not support local photo storage.'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  async function putPhoto(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(record); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  }
  async function getPhotos() {
    const db = await openDB();
    return new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error); });
  }
  async function deletePhoto(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  }

  const toastEl = $('#toast');
  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }
  function applyBlob(img, blob) {
    if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
    const url = URL.createObjectURL(blob);
    img.dataset.objectUrl = url;
    img.src = url;
  }
  function makeAddedFigure(record) {
    const fig = document.createElement('figure');
    fig.className = 'photo-slot custom-added';
    fig.dataset.customId = record.id;
    fig.dataset.project = record.project;
    const img = document.createElement('img');
    img.alt = record.name || 'Additional project photograph';
    applyBlob(img, record.blob);
    const cap = document.createElement('figcaption');
    cap.textContent = record.caption || 'Additional project photograph';
    const tools = document.createElement('div');
    tools.className = 'photo-tools';
    const label = document.createElement('label');
    label.className = 'replace-button'; label.textContent = 'Replace image'; label.htmlFor = 'file-' + record.id;
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.id = 'file-' + record.id; input.dataset.replace = record.id;
    const del = document.createElement('button'); del.className = 'reset-button'; del.type = 'button'; del.textContent = 'Remove'; del.dataset.deleteCustom = record.id;
    tools.append(label, input, del); fig.append(img, cap, tools); return fig;
  }
  async function hydratePhotos() {
    try {
      const records = await getPhotos();
      for (const rec of records) {
        if (rec.kind === 'replace') {
          const img = $('[data-image-id="' + CSS.escape(rec.id) + '"]');
          if (img) applyBlob(img, rec.blob);
        } else if (rec.kind === 'add') {
          const gallery = $('[data-gallery="' + CSS.escape(rec.project) + '"]');
          if (gallery) gallery.append(makeAddedFigure(rec));
        }
      }
    } catch (e) { console.warn(e); }
  }

  // PHOTO EDITOR
  const editToggle = $('#editToggle');
  const editNote = $('#editNote');
  editToggle.addEventListener('click', () => {
    const on = !document.body.classList.contains('editing');
    document.body.classList.toggle('editing', on);
    editToggle.setAttribute('aria-pressed', String(on));
    editToggle.textContent = on ? 'Done photos' : 'Edit photos';
    editNote.hidden = !on;
    if (on) editNote.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#closeNote').addEventListener('click', () => { editNote.hidden = true; });

  document.addEventListener('change', async (event) => {
    const input = event.target.closest('input[type="file"][data-replace]');
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) { toast('Please choose an image file.'); return; }
    const id = input.dataset.replace;
    const isCustom = id.startsWith('custom-');
    try {
      const customFigure = isCustom ? input.closest('figure') : null;
      await putPhoto(isCustom
        ? { id, kind: 'add', project: customFigure?.dataset.project || 'other', blob: file, name: file.name, caption: file.name }
        : { id, kind: 'replace', blob: file, name: file.name });
      const img = isCustom ? customFigure.querySelector('img') : $('[data-image-id="' + CSS.escape(id) + '"]');
      if (img) applyBlob(img, file);
      if (isCustom) { const caption = $('figcaption', customFigure); if (caption) caption.textContent = file.name; }
      toast('Photo updated and saved in this browser.');
    } catch (err) { console.error(err); toast('Could not save this image. Try a smaller image.'); }
    input.value = '';
  });

  document.addEventListener('click', async (event) => {
    const reset = event.target.closest('[data-reset]');
    if (reset) {
      const id = reset.dataset.reset;
      try {
        await deletePhoto(id);
        const img = $('[data-image-id="' + CSS.escape(id) + '"]');
        if (img) { if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl); img.src = img.dataset.defaultSrc; }
        toast('Original image restored.');
      } catch (err) { toast('Could not reset the image.'); }
      return;
    }
    const del = event.target.closest('[data-delete-custom]');
    if (del) {
      const id = del.dataset.deleteCustom;
      try { await deletePhoto(id); del.closest('figure').remove(); toast('Added photo removed.'); }
      catch (err) { toast('Could not remove the photo.'); }
      return;
    }
    const add = event.target.closest('[data-add-photo]');
    if (add) { const chooser = $('#addPhotoInput'); chooser.dataset.project = add.dataset.addPhoto; chooser.click(); }
  });
  $('#addPhotoInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please choose an image file.'); return; }
    const project = event.target.dataset.project || 'other';
    const id = 'custom-' + project + '-' + Date.now();
    try {
      const record = { id, kind: 'add', project, blob: file, name: file.name, caption: file.name };
      await putPhoto(record);
      const gallery = $('[data-gallery="' + CSS.escape(project) + '"]');
      if (gallery) gallery.append(makeAddedFigure(record));
      toast('Photo added to this project.');
    } catch (err) { console.error(err); toast('Could not save this image. Try a smaller image.'); }
    event.target.value = '';
  });

  // CONTENT EDITOR. Text changes are stored separately from photo edits.
  const contentSelectors = [
    '.hero-overline', '.hero h1 span[data-editable]', '.hero h1 em[data-editable]', '.hero-lead',
    '.intro-content h2', '.intro-content p', '.credential-strip strong', '.credential-strip span',
    '.section-heading h2', '.section-subtitle', '.capability h3', '.capability p', '.tag-row span',
    '.project-card-head h3', '.project-focus', '.project-type', '.photo-slot figcaption',
    '.project-content-grid h4', '.project-content-grid p', '.contribution-list li', '.project-tags span',
    '.metric-label', '.metric-value', '.metric-note', '.heat-results-heading h4', '.heat-results-heading p',
    '.heat-results-table th', '.heat-results-table td', '.result-takeaway',
    '.other-work h3', '.other-work p', '.other-work-tags span',
    '.approach-head h2', '.approach-head p', '.approach-steps h3', '.approach-steps p',
    '.timeline-date', '.timeline-item h3', '.timeline-company', '.timeline-item p',
    '.education-block .small-label', '.education-block h3', '.education-block p', '.education-block li',
    '.contact-panel h2', '.contact-panel > div:first-child > p:last-child'
  ];
  const editableNodes = Array.from(new Set(contentSelectors.flatMap((selector) => $$(selector))));
  editableNodes.forEach((node, index) => { node.dataset.contentKey = node.dataset.contentKey || 'copy-' + String(index + 1).padStart(3, '0'); });

  function readSavedContent() {
    try {
      const raw = localStorage.getItem(CONTENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { console.warn('Saved text could not be read:', err); return null; }
  }
  function setPlainText(node, value) {
    const lines = String(value ?? '').split(/\r?\n/);
    node.replaceChildren();
    lines.forEach((line, index) => {
      if (index) node.append(document.createElement('br'));
      node.append(document.createTextNode(line));
    });
  }
  function applySavedContent(content) {
    if (!content || typeof content !== 'object') return;
    editableNodes.forEach((node) => {
      const key = node.dataset.contentKey;
      if (Object.prototype.hasOwnProperty.call(content, key) && typeof content[key] === 'string') setPlainText(node, content[key]);
    });
  }
  function currentContent() {
    const content = {};
    editableNodes.forEach((node) => { content[node.dataset.contentKey] = node.innerText ?? node.textContent ?? ''; });
    return content;
  }
  function saveContent(showMessage = true) {
    try {
      const payload = { version: 1, savedAt: new Date().toISOString(), content: currentContent() };
      localStorage.setItem(CONTENT_KEY, JSON.stringify(payload));
      if (showMessage) toast('Text changes saved in this browser.');
      return payload;
    } catch (err) {
      console.error(err);
      toast('Text could not be saved. Export a backup or check browser storage.');
      return null;
    }
  }
  function downloadJson(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'dinesh-portfolio-content-backup.json';
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  const contentToggle = $('#contentEditToggle');
  const contentPanel = $('#contentEditorPanel');
  function setContentEditing(on) {
    document.body.classList.toggle('content-editing', on);
    contentToggle.setAttribute('aria-pressed', String(on));
    contentToggle.textContent = on ? 'Done text' : 'Edit text';
    editableNodes.forEach((node) => { node.contentEditable = String(on); node.spellcheck = on; });
    contentPanel.hidden = !on;
    if (on) contentPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    else saveContent(false);
  }
  contentToggle.addEventListener('click', () => setContentEditing(!document.body.classList.contains('content-editing')));
  $('#saveContent').addEventListener('click', () => saveContent(true));
  $('#exportContent').addEventListener('click', () => {
    const payload = saveContent(false) || { version: 1, content: currentContent() };
    downloadJson(payload);
    toast('Content backup downloaded.');
  });
  $('#resetContent').addEventListener('click', () => {
    if (!window.confirm('Restore all editable website text to its original wording? Your photo changes will not be affected.')) return;
    try { localStorage.removeItem(CONTENT_KEY); window.location.reload(); }
    catch (err) { toast('Could not restore the original text in this browser.'); }
  });
  $('#contentImportInput').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const content = parsed.content && typeof parsed.content === 'object' ? parsed.content : parsed;
        applySavedContent(content);
        saveContent(false);
        toast('Text backup imported and saved in this browser.');
      } catch (err) { toast('That file is not a valid portfolio text backup.'); }
      event.target.value = '';
    };
    reader.onerror = () => { toast('Could not read the selected backup file.'); event.target.value = ''; };
    reader.readAsText(file);
  });
  applySavedContent(readSavedContent()?.content);

  // Navigation and footer year.
  const menu = $('#mobileMenu');
  const nav = $('#navLinks');
  menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }));
  $('#currentYear').textContent = new Date().getFullYear();
  hydratePhotos();
})();