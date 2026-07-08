(async function () {
  const params = new URLSearchParams(location.search);
  const chapterId = params.get('ch');
  const content = document.getElementById('r-content');
  const nav = document.getElementById('r-nav');

  if (!chapterId) {
    content.innerHTML = emptyBlock('Глава не выбрана', 'Вернитесь в оглавление и выберите главу.');
    return;
  }

  let data;
  try {
    data = await loadComicsData();
  } catch (e) {
    content.innerHTML = emptyBlock('Ошибка загрузки', e.message);
    return;
  }

  const found = findChapter(data, chapterId);
  if (!found) {
    content.innerHTML = emptyBlock('Глава не найдена', `Не найдена глава с id "${chapterId}".`);
    return;
  }

  const { book, chapter } = found;
  const style = resolveStyle(data, chapter.style);
  const isColor = chapter.style && chapter.style.type === 'color';

  // Применяем тему/цвет
  document.body.classList.add(isColor ? 'theme-custom' : `theme-${style.key}`);
  document.body.style.setProperty('--reader-bg', style.bg);
  document.body.style.setProperty('--reader-bg2', style.bg2);
  document.body.style.setProperty('--reader-accent', style.accent);

  document.title = `Гл. ${chapter.number}. ${chapter.title} — ${data.site.title}`;
  document.getElementById('r-book-name').textContent = `Книга ${book.number} · ${book.title}`;
  document.getElementById('r-ch-title').textContent = `Глава ${chapter.number}. ${chapter.title}`;

  if (!chapter.pages || chapter.pages.length === 0) {
    content.innerHTML = emptyBlock('Страницы скоро появятся', 'Эта глава ещё не выложена. Загляните позже.');
  } else {
    const strip = document.createElement('div');
    strip.className = 'reader-strip';
    chapter.pages.forEach((filename, i) => {
      const img = document.createElement('img');
      img.src = chapterPagePath(book.id, chapter.id, filename);
      img.alt = `${chapter.title} — страница ${i + 1}`;
      img.loading = i < 2 ? 'eager' : 'lazy';
      strip.appendChild(img);
    });
    content.innerHTML = '';
    content.appendChild(strip);
  }

  // Навигация между главами внутри всей трилогии (сквозная)
  const flatChapters = [];
  data.books.forEach(b => b.chapters.forEach(c => flatChapters.push({ book: b, chapter: c })));
  const idx = flatChapters.findIndex(x => x.chapter.id === chapter.id);
  const prev = idx > 0 ? flatChapters[idx - 1] : null;
  const next = idx < flatChapters.length - 1 ? flatChapters[idx + 1] : null;

  nav.innerHTML = `
    ${prev ? `<a href="reader.html?ch=${encodeURIComponent(prev.chapter.id)}">← Гл. ${prev.chapter.number}. ${prev.chapter.title}</a>` : '<span>Начало истории</span>'}
    ${next ? `<a href="reader.html?ch=${encodeURIComponent(next.chapter.id)}">Гл. ${next.chapter.number}. ${next.chapter.title} →</a>` : '<span>Конец истории (пока)</span>'}
  `;
})();

function emptyBlock(title, text) {
  return `<div class="empty-pages"><h3>${title}</h3><p>${text}</p></div>`;
}
