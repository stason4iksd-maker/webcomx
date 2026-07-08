(async function () {
  const container = document.getElementById('books-container');

  let data;
  try {
    data = await loadComicsData();
  } catch (e) {
    container.innerHTML = `<p class="mono-label" style="text-align:center;padding:2rem;">Не удалось загрузить данные: ${e.message}</p>`;
    return;
  }

  document.getElementById('site-title').textContent = data.site.title;
  document.title = `${data.site.title} — ${data.site.subtitle || ''}`;
  document.getElementById('site-tagline').textContent = data.site.tagline || '';
  if (data.site.subtitle) {
    document.getElementById('site-tagline-label').textContent = data.site.subtitle;
  }

  container.innerHTML = '';

  data.books.forEach(book => {
    const theme = resolveStyle(data, { type: 'theme', value: book.defaultTheme });

    const section = document.createElement('section');
    section.className = 'book-section';
    section.style.setProperty('--book-accent', theme.accent);

    const heading = document.createElement('div');
    heading.className = 'book-heading';
    heading.innerHTML = `
      <span class="num" style="color:${theme.accent}">КНИГА ${romanize(book.number)}</span>
      <h2>${book.title}</h2>
    `;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'chapter-grid';

    book.chapters.forEach(ch => {
      const chTheme = resolveStyle(data, ch.style);
      const pageCount = ch.pages ? ch.pages.length : 0;
      const hasPages = pageCount > 0;

      const card = document.createElement('a');
      card.className = 'chapter-card';
      card.href = `reader.html?ch=${encodeURIComponent(ch.id)}`;
      card.style.setProperty('--card-accent', ch.style && ch.style.type === 'color' ? ch.style.value : chTheme.accent);
      card.innerHTML = `
        <div class="swatch"></div>
        <div class="ch-num">Глава ${ch.number}</div>
        <h3>${ch.title}</h3>
        <span class="status ${hasPages ? 'ready' : ''}">${hasPages ? pageCount + (pageCount === 1 ? ' страница' : ' страниц') : 'скоро'}</span>
      `;
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
})();

function romanize(num) {
  const map = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return map[num] || String(num);
}
