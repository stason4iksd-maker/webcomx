/*
  Загрузка data/comics.json. На самом GitHub Pages это обычный
  относительный fetch — работает без всякого API. GitHub API
  (github-api.js) нужен только внутри admin.html, чтобы можно
  было сохранять изменения обратно в репозиторий прямо из браузера.
*/

async function loadComicsData() {
  const res = await fetch('data/comics.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось загрузить data/comics.json');
  return res.json();
}

function findChapter(data, chapterId) {
  for (const book of data.books) {
    const ch = book.chapters.find(c => c.id === chapterId);
    if (ch) return { book, chapter: ch };
  }
  return null;
}

function resolveStyle(data, style) {
  if (!style) return { key: 'nactir', ...data.themes.nactir };
  if (style.type === 'theme') {
    const theme = data.themes[style.value] || data.themes.nactir;
    return { key: style.value, ...theme };
  }
  // произвольная заливка цветом
  return {
    key: 'custom',
    label: 'Свой цвет',
    bg: style.value,
    bg2: style.value,
    accent: style.accent || '#cf9d4f',
    text: style.text || '#ece6d8'
  };
}

function chapterPagePath(bookId, chapterId, filename) {
  return `assets/pages/${bookId}/${chapterId}/${filename}`;
}
