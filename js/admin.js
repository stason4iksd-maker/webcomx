/* Состояние админки */
const state = {
  settings: ghLoadSettings(),
  data: null,
  dirty: false
};

const els = {
  owner: document.getElementById('gh-owner'),
  repo: document.getElementById('gh-repo'),
  branch: document.getElementById('gh-branch'),
  token: document.getElementById('gh-token'),
  log: document.getElementById('log-output'),
  editorPanel: document.getElementById('editor-panel'),
  booksEditor: document.getElementById('books-editor'),
  newBookTitle: document.getElementById('new-book-title'),
  newBookTheme: document.getElementById('new-book-theme')
};

function log(msg, kind) {
  const time = new Date().toLocaleTimeString('ru-RU');
  const line = document.createElement('div');
  if (kind) line.className = kind;
  line.textContent = `[${time}] ${msg}`;
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;
}

function fillSettingsForm() {
  els.owner.value = state.settings.owner || '';
  els.repo.value = state.settings.repo || '';
  els.branch.value = state.settings.branch || 'main';
  els.token.value = state.settings.token || '';
}

function readSettingsForm() {
  state.settings = {
    owner: els.owner.value.trim(),
    repo: els.repo.value.trim(),
    branch: (els.branch.value.trim() || 'main'),
    token: els.token.value.trim()
  };
  return state.settings;
}

function requireSettings() {
  const s = state.settings;
  if (!s.owner || !s.repo || !s.token) {
    log('Заполните owner, repo и token, затем нажмите «Сохранить настройки».', 'err');
    return false;
  }
  return true;
}

/* ---------- Кнопки блока подключения ---------- */

document.getElementById('btn-save-settings').addEventListener('click', () => {
  readSettingsForm();
  ghSaveSettings(state.settings);
  log('Настройки сохранены в этом браузере.', 'ok');
});

document.getElementById('btn-clear-settings').addEventListener('click', () => {
  ghClearSettings();
  state.settings = { owner: '', repo: '', branch: 'main', token: '' };
  fillSettingsForm();
  log('Токен и настройки удалены из этого браузера.');
});

document.getElementById('btn-test-conn').addEventListener('click', async () => {
  readSettingsForm();
  if (!requireSettings()) return;
  try {
    const repoInfo = await ghTestConnection(state.settings);
    log(`Подключение успешно: ${repoInfo.full_name} (default: ${repoInfo.default_branch})`, 'ok');
  } catch (e) {
    log(`Ошибка подключения: ${e.message}`, 'err');
  }
});

document.getElementById('btn-load-data').addEventListener('click', async () => {
  readSettingsForm();
  ghSaveSettings(state.settings);
  if (!requireSettings()) return;
  try {
    log('Загружаю data/comics.json из репозитория…');
    const file = await ghGetFile(state.settings, 'data/comics.json');
    if (!file) {
      log('Файл data/comics.json не найден в репозитории — беру локальный шаблон.', 'err');
      state.data = await loadComicsData();
    } else {
      state.data = JSON.parse(file.content);
      log('Данные загружены из GitHub.', 'ok');
    }
    state.dirty = false;
    renderEditor();
    els.editorPanel.style.display = '';
  } catch (e) {
    log(`Ошибка загрузки: ${e.message}`, 'err');
  }
});

document.getElementById('btn-save-now').addEventListener('click', () => persistData('Обновление comics.json из админки'));

document.getElementById('btn-add-book').addEventListener('click', () => {
  const title = els.newBookTitle.value.trim();
  if (!title) { log('Введите название книги.', 'err'); return; }
  const num = state.data.books.length + 1;
  const id = 'book' + num + '-' + slug(title).slice(0, 20);
  const theme = els.newBookTheme.value;
  state.data.books.push({ id, number: num, title, defaultTheme: theme, chapters: [] });
  els.newBookTitle.value = '';
  log(`Книга «${title}» добавлена (пока не сохранено).`);
  renderEditor();
});

/* ---------- Рендер редактора ---------- */

function themeOptionsHtml(selected) {
  return Object.entries(state.data.themes).map(([key, t]) =>
    `<option value="${key}" ${key === selected ? 'selected' : ''}>${t.label}</option>`
  ).join('');
}

function renderEditor() {
  populateThemeSelect(els.newBookTheme);
  els.booksEditor.innerHTML = '';

  state.data.books.forEach((book) => {
    const block = document.createElement('div');
    block.className = 'book-block';

    const head = document.createElement('div');
    head.className = 'book-block-head';
    head.innerHTML = `
      <input type="text" data-role="book-title" value="${escapeAttr(book.title)}">
      <select data-role="book-theme">${themeOptionsHtml(book.defaultTheme)}</select>
      <button class="btn danger ghost small" data-role="del-book">Удалить книгу</button>
    `;
    head.querySelector('[data-role="book-title"]').addEventListener('change', (e) => {
      book.title = e.target.value;
      markDirty();
    });
    head.querySelector('[data-role="book-theme"]').addEventListener('change', (e) => {
      book.defaultTheme = e.target.value;
      markDirty();
      persistData(`Смена темы по умолчанию у книги «${book.title}»`);
    });
    head.querySelector('[data-role="del-book"]').addEventListener('click', () => {
      if (!confirm(`Удалить книгу «${book.title}» со всеми главами (только из данных, файлы страниц в репозитории останутся)?`)) return;
      state.data.books = state.data.books.filter(b => b !== book);
      persistData(`Удаление книги «${book.title}»`);
    });
    block.appendChild(head);

    book.chapters
      .slice()
      .sort((a, b) => a.number - b.number)
      .forEach(ch => block.appendChild(renderChapterBlock(book, ch)));

    const addForm = document.createElement('div');
    addForm.className = 'add-chapter-form';
    const nextNum = book.chapters.length ? Math.max(...book.chapters.map(c => c.number)) + 1 : 1;
    addForm.innerHTML = `
      <label>№ <input type="number" data-role="new-ch-num" value="${nextNum}" min="1"></label>
      <label>Название главы <input type="text" data-role="new-ch-title" placeholder="Название"></label>
      <button class="btn ghost small" data-role="add-chapter">+ Добавить главу</button>
    `;
    addForm.querySelector('[data-role="add-chapter"]').addEventListener('click', () => {
      const numInput = addForm.querySelector('[data-role="new-ch-num"]');
      const titleInput = addForm.querySelector('[data-role="new-ch-title"]');
      const title = titleInput.value.trim();
      if (!title) { log('Введите название главы.', 'err'); return; }
      const number = parseInt(numInput.value, 10) || nextNum;
      const id = `${book.id}c${number}`;
      book.chapters.push({
        id, number, title,
        style: { type: 'theme', value: book.defaultTheme },
        pages: []
      });
      persistData(`Добавлена глава ${number} «${title}» в книгу «${book.title}»`);
    });
    block.appendChild(addForm);

    els.booksEditor.appendChild(block);
  });
}

function populateThemeSelect(select) {
  select.innerHTML = themeOptionsHtml(Object.keys(state.data.themes)[0]);
}

function renderChapterBlock(book, ch) {
  const wrap = document.createElement('div');
  wrap.className = 'chapter-block';

  const isColor = ch.style && ch.style.type === 'color';

  const top = document.createElement('div');
  top.className = 'chapter-block-top';
  top.innerHTML = `
    <span class="ch-num-badge">Гл. ${ch.number}</span>
    <input type="text" data-role="ch-title" value="${escapeAttr(ch.title)}">
    <button class="btn danger ghost small" data-role="del-chapter">Удалить главу</button>
  `;
  top.querySelector('[data-role="ch-title"]').addEventListener('change', (e) => {
    ch.title = e.target.value;
    persistData(`Переименована глава ${ch.number} книги «${book.title}»`);
  });
  top.querySelector('[data-role="del-chapter"]').addEventListener('click', () => {
    if (!confirm(`Удалить главу ${ch.number} «${ch.title}»? Файлы страниц в репозитории останутся, но перестанут отображаться.`)) return;
    book.chapters = book.chapters.filter(c => c !== ch);
    persistData(`Удалена глава ${ch.number} «${ch.title}»`);
  });
  wrap.appendChild(top);

  const styleRow = document.createElement('div');
  styleRow.className = 'style-row';
  styleRow.innerHTML = `
    <div class="radio-group">
      <label><input type="radio" name="style-${ch.id}" value="theme" ${!isColor ? 'checked' : ''}> Готовая тема</label>
      <label><input type="radio" name="style-${ch.id}" value="color" ${isColor ? 'checked' : ''}> Свой цвет</label>
    </div>
    <select data-role="theme-select" ${isColor ? 'disabled' : ''}>${themeOptionsHtml(isColor ? '' : ch.style.value)}</select>
    <input type="color" data-role="color-pick" value="${isColor ? ch.style.value : '#222222'}" ${!isColor ? 'disabled' : ''}>
  `;
  const themeSelect = styleRow.querySelector('[data-role="theme-select"]');
  const colorPick = styleRow.querySelector('[data-role="color-pick"]');
  styleRow.querySelectorAll(`input[name="style-${ch.id}"]`).forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'theme') {
        themeSelect.disabled = false;
        colorPick.disabled = true;
        ch.style = { type: 'theme', value: themeSelect.value };
      } else {
        themeSelect.disabled = true;
        colorPick.disabled = false;
        ch.style = { type: 'color', value: colorPick.value };
      }
      persistData(`Смена стиля главы ${ch.number} «${ch.title}»`);
    });
  });
  themeSelect.addEventListener('change', () => {
    ch.style = { type: 'theme', value: themeSelect.value };
    persistData(`Смена темы главы ${ch.number} «${ch.title}»`);
  });
  colorPick.addEventListener('change', () => {
    ch.style = { type: 'color', value: colorPick.value };
    persistData(`Смена цвета фона главы ${ch.number} «${ch.title}»`);
  });
  wrap.appendChild(styleRow);

  const pagesList = document.createElement('div');
  pagesList.className = 'pages-list';
  (ch.pages || []).forEach((filename, i) => {
    const chip = document.createElement('span');
    chip.className = 'page-chip';
    chip.innerHTML = `${i + 1}. ${escapeHtml(filename)}
      <button data-role="up" title="Выше">↑</button>
      <button data-role="down" title="Ниже">↓</button>
      <button data-role="del" title="Удалить">✕</button>`;
    chip.querySelector('[data-role="up"]').addEventListener('click', () => {
      if (i === 0) return;
      [ch.pages[i - 1], ch.pages[i]] = [ch.pages[i], ch.pages[i - 1]];
      persistData(`Переупорядочены страницы главы ${ch.number}`);
    });
    chip.querySelector('[data-role="down"]').addEventListener('click', () => {
      if (i === ch.pages.length - 1) return;
      [ch.pages[i + 1], ch.pages[i]] = [ch.pages[i], ch.pages[i + 1]];
      persistData(`Переупорядочены страницы главы ${ch.number}`);
    });
    chip.querySelector('[data-role="del"]').addEventListener('click', async () => {
      if (!confirm(`Убрать страницу «${filename}» из главы? (Удалить файл из репозитория тоже?)`)) return;
      const alsoDeleteFile = confirm('Нажмите ОК, чтобы удалить файл и из GitHub-репозитория, или Отмена, чтобы просто убрать из списка.');
      ch.pages.splice(i, 1);
      if (alsoDeleteFile) {
        if (!requireSettings()) return;
        try {
          await ghDeleteFile(state.settings, chapterPagePath(book.id, ch.id, filename), `Удаление страницы ${filename} главы ${ch.number}`);
          log(`Файл ${filename} удалён из репозитория.`, 'ok');
        } catch (e) {
          log(`Не удалось удалить файл: ${e.message}`, 'err');
        }
      }
      persistData(`Удалена страница из главы ${ch.number} «${ch.title}»`);
    });
    pagesList.appendChild(chip);
  });
  wrap.appendChild(pagesList);

  const pagesRow = document.createElement('div');
  pagesRow.className = 'pages-row';
  const uploadId = `upload-${ch.id}`;
  pagesRow.innerHTML = `
    <input type="file" id="${uploadId}" accept="image/*" multiple style="display:none;">
    <button class="btn ghost small" data-role="upload-btn">↑ Загрузить страницы</button>
    <span class="mono-label" data-role="upload-status"></span>
  `;
  const fileInput = pagesRow.querySelector(`#${uploadId}`);
  const statusSpan = pagesRow.querySelector('[data-role="upload-status"]');
  pagesRow.querySelector('[data-role="upload-btn"]').addEventListener('click', () => {
    if (!requireSettings()) return;
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    statusSpan.textContent = `загрузка 0/${files.length}…`;
    let done = 0;
    for (const file of files) {
      const safeName = sanitizeFilename(file.name);
      const path = chapterPagePath(book.id, ch.id, safeName);
      try {
        await ghPutBinaryFile(state.settings, path, file, `Загрузка страницы ${safeName} — глава ${ch.number} «${ch.title}»`);
        ch.pages = ch.pages || [];
        ch.pages.push(safeName);
        done++;
        statusSpan.textContent = `загрузка ${done}/${files.length}…`;
        log(`Загружено: ${path}`, 'ok');
      } catch (e) {
        log(`Ошибка загрузки ${file.name}: ${e.message}`, 'err');
      }
    }
    statusSpan.textContent = '';
    fileInput.value = '';
    persistData(`Загружены страницы (${done}) в главу ${ch.number} «${ch.title}»`);
  });
  wrap.appendChild(pagesRow);

  return wrap;
}

function markDirty() {
  state.dirty = true;
}

async function persistData(message, attempt = 1) {
  markDirty();
  renderEditor();
  if (!requireSettings()) return;
  try {
    const text = JSON.stringify(state.data, null, 2);
    await ghPutTextFile(state.settings, 'data/comics.json', text, message);
    state.dirty = false;
    log(`Сохранено в GitHub: ${message}`, 'ok');
  } catch (e) {
    const isConflict = /409/.test(e.message);
    if (isConflict && attempt < 3) {
      log(`Конфликт версий, пробую снова (${attempt}/2)…`);
      await new Promise(r => setTimeout(r, 400));
      return persistData(message, attempt + 1);
    }
    log(`Не удалось сохранить: ${e.message}`, 'err');
  }
}

/* ---------- Утилиты ---------- */

function slug(str) {
  return str.toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'book';
}

function sanitizeFilename(name) {
  return name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}
function escapeHtml(str) {
  return String(str).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/* ---------- Инициализация ---------- */

fillSettingsForm();
if (state.settings.owner && state.settings.repo && state.settings.token) {
  log('Найдены сохранённые настройки подключения. Нажмите «Загрузить главы из GitHub».');
} else {
  log('Заполните данные репозитория, чтобы начать.');
}
