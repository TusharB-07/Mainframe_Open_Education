let sitemapData = null;
let currentUrl = null;
let currentTitle = '';
let currentMode = 'auto';
let quizzesData = null;
const GITHUB_BASE = 'https://github.com/open-mainframe-project/mainframe-open-education/blob/main';

async function fetchSitemap() {
  const res = await fetch('/api/sitemap');
  return res.json();
}

async function fetchPageContent(url, mode) {
  let endpoint = `/api/page?url=${encodeURIComponent(url)}`;
  if (mode === 'raw') endpoint += '&mode=raw';
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error('Failed to load page');
  return res.json();
}

async function loadQuizzes() {
  try {
    const res = await fetch('/quizzes.json');
    if (res.ok) quizzesData = await res.json();
  } catch {
    quizzesData = {};
  }
}

function buildNavTree(nodes, container, depth = 0) {
  for (const node of nodes) {
    const item = document.createElement('div');
    item.className = 'nav-item';
    if (node.url) item.dataset.url = node.url;
    const label = document.createElement('div');
    label.className = 'nav-label';
    const hasChildren = node.children && node.children.length > 0;
    const toggle = document.createElement('span');
    toggle.className = `nav-toggle${hasChildren ? '' : ' leaf'}`;
    toggle.textContent = '\u25B6';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!hasChildren) return;
      const childrenEl = item.querySelector('.nav-children');
      const isOpen = childrenEl.classList.toggle('open');
      toggle.classList.toggle('expanded', isOpen);
    });
    const title = document.createElement('span');
    title.className = 'nav-title';
    title.textContent = node.title;
    label.appendChild(toggle);
    label.appendChild(title);
    if (node.url) {
      const check = document.createElement('span');
      check.className = 'nav-checkmark';
      label.appendChild(check);
    }
    item.appendChild(label);
    label.addEventListener('click', () => {
      if (hasChildren) {
        const childrenEl = item.querySelector('.nav-children');
        const isOpen = childrenEl.classList.toggle('open');
        toggle.classList.toggle('expanded', isOpen);
      }
      if (node.url) loadPage(node);
    });
    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'nav-children';
      buildNavTree(node.children, childrenContainer, depth + 1);
      item.appendChild(childrenContainer);
    }
    container.appendChild(item);
  }
}

function setActiveNavItem(url) {
  document.querySelectorAll('.nav-item.active').forEach(el => el.classList.remove('active'));
  if (!url) return;
  const node = findNodeByUrl(sitemapData, url);
  if (!node) return;
  document.querySelectorAll('.nav-item').forEach(item => {
    const titleEl = item.querySelector('.nav-title');
    if (titleEl && titleEl.textContent === node.title) {
      item.classList.add('active');
      let parent = item.parentElement;
      while (parent && !parent.matches('#nav-tree')) {
        if (parent.classList.contains('nav-children')) {
          parent.classList.add('open');
          const parentItem = parent.closest('.nav-item');
          if (parentItem) {
            const t = parentItem.querySelector('.nav-toggle');
            if (t) t.classList.add('expanded');
          }
        }
        parent = parent.parentElement;
      }
    }
  });
}

function findNodeByUrl(nodes, url) {
  for (const node of nodes) {
    if (node.url === url) return node;
    if (node.children) {
      const found = findNodeByUrl(node.children, url);
      if (found) return found;
    }
  }
  return null;
}

function flattenSitemap(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.url) result.push(node);
    if (node.children) result.push(...flattenSitemap(node.children));
  }
  return result;
}

function renderPageNav(url) {
  const flat = flattenSitemap(sitemapData);
  const idx = flat.findIndex(n => n.url === url);
  if (idx === -1) return '';
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;
  if (!prev && !next) return '';
  let html = '<div class="page-nav">';
  if (prev) {
    html += `<a class="page-nav-link page-nav-prev" href="#" data-url="${escapeHtml(prev.url)}"><span class="page-nav-direction">Previous</span><span class="page-nav-title">${escapeHtml(prev.title)}</span></a>`;
  } else {
    html += '<span class="page-nav-spacer"></span>';
  }
  if (next) {
    html += `<a class="page-nav-link page-nav-next" href="#" data-url="${escapeHtml(next.url)}"><span class="page-nav-direction">Next</span><span class="page-nav-title">${escapeHtml(next.title)}</span></a>`;
  }
  html += '</div>';
  return html;
}

/* ── Progress Tracking ── */
let totalQuizzes = 0;

function getCompletedQuizzes() {
  try {
    return JSON.parse(localStorage.getItem('moe_completed_quizzes') || '[]');
  } catch { return []; }
}

function isQuizCompleted(pageUrl) {
  return getCompletedQuizzes().includes(pageUrl);
}

function markQuizCompleted(pageUrl) {
  const list = getCompletedQuizzes();
  if (!list.includes(pageUrl)) {
    list.push(pageUrl);
    localStorage.setItem('moe_completed_quizzes', JSON.stringify(list));
  }
  updateProgressUI();
  updateSidebarCheckmarks();
}

function getProgress() {
  const completed = getCompletedQuizzes().length;
  return { completed, total: totalQuizzes, percentage: totalQuizzes > 0 ? Math.round((completed / totalQuizzes) * 100) : 0 };
}

function updateProgressUI() {
  const { completed, total, percentage } = getProgress();
  const textEl = document.getElementById('progress-text');
  const fillEl = document.getElementById('progress-fill');
  if (textEl) textEl.textContent = `Progress: ${completed}/${total}`;
  if (fillEl) fillEl.style.width = `${percentage}%`;
}

function updateSidebarCheckmarks() {
  document.querySelectorAll('.nav-item').forEach(item => {
    const url = item.dataset.url;
    const check = item.querySelector('.nav-checkmark');
    if (!url || !check) return;
    check.textContent = isQuizCompleted(url) ? '\u2713' : '';
    check.className = 'nav-checkmark' + (isQuizCompleted(url) ? ' completed' : '');
  });
}

/* ── Quiz ── */
function renderQuiz(url) {
  if (!quizzesData || !quizzesData[url]) return;
  const quizData = quizzesData[url];
  const container = document.createElement('div');
  container.className = 'quiz-container';
  container.id = 'quiz-container';
  const heading = document.createElement('h2');
  heading.className = 'quiz-heading';
  heading.textContent = 'Knowledge Check';
  container.appendChild(heading);
  const form = document.createElement('form');
  form.className = 'quiz-form';
  form.noValidate = true;
  for (const q of quizData.questions) {
    const qEl = document.createElement('div');
    qEl.className = 'quiz-question';
    qEl.dataset.questionId = q.id;
    const prompt = document.createElement('div');
    prompt.className = 'quiz-prompt';
    prompt.textContent = q.prompt;
    qEl.appendChild(prompt);
    const optionsEl = document.createElement('div');
    optionsEl.className = 'quiz-options';
    const isMulti = q.type === 'multi';
    const inputType = isMulti ? 'checkbox' : 'radio';
    const nameAttr = q.id;
    for (let i = 0; i < q.options.length; i++) {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = inputType;
      input.name = isMulti ? `${nameAttr}_${i}` : nameAttr;
      input.value = i;
      input.dataset.index = i;
      const span = document.createElement('span');
      span.className = 'quiz-option-text';
      span.textContent = q.options[i];
      label.appendChild(input);
      label.appendChild(span);
      optionsEl.appendChild(label);
    }
    qEl.appendChild(optionsEl);
    form.appendChild(qEl);
  }
  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'quiz-submit';
  submitBtn.textContent = 'Submit Answers';
  form.appendChild(submitBtn);
  const resultEl = document.createElement('div');
  resultEl.className = 'quiz-result';
  form.appendChild(resultEl);
  const retakeBtn = document.createElement('button');
  retakeBtn.type = 'button';
  retakeBtn.className = 'quiz-retake';
  retakeBtn.textContent = 'Retake Quiz';
  retakeBtn.style.display = 'none';
  form.appendChild(retakeBtn);
  submitBtn.addEventListener('click', () => gradeQuiz(form, quizData.questions, resultEl, submitBtn, retakeBtn, url));
  retakeBtn.addEventListener('click', () => retakeQuiz(form, quizData.questions, resultEl, submitBtn, retakeBtn));
  container.appendChild(form);
  return container;
}

function gradeQuiz(form, questions, resultEl, submitBtn, retakeBtn, pageUrl) {
  let correctCount = 0;
  const total = questions.length;
  for (const q of questions) {
    const qEl = form.querySelector(`.quiz-question[data-question-id="${q.id}"]`);
    const inputs = qEl.querySelectorAll('input:checked');
    const allInputs = qEl.querySelectorAll('input');
    const selected = Array.from(inputs).map(inp => parseInt(inp.value));
    const isCorrect = Array.isArray(q.answer)
      ? selected.length === q.answer.length && q.answer.every(a => selected.includes(a))
      : selected.length === 1 && selected[0] === q.answer;
    if (isCorrect) correctCount++;
    for (const inp of allInputs) {
      const idx = parseInt(inp.value);
      const isCorrectAnswer = Array.isArray(q.answer) ? q.answer.includes(idx) : q.answer === idx;
      inp.disabled = true;
      const label = inp.closest('.quiz-option');
      if (isCorrectAnswer) {
        label.classList.add('correct');
      } else if (inp.checked && !isCorrectAnswer) {
        label.classList.add('incorrect');
      }
    }
  }
  const score = Math.round((correctCount / total) * 100);
  const allCorrect = correctCount === total;
  resultEl.className = 'quiz-result visible';
  resultEl.innerHTML = allCorrect
    ? `<span class="quiz-score quiz-passed">&#10003; Quiz Passed! (${score}%)</span>`
    : `<span class="quiz-score">${correctCount}/${total} correct (${score}%)</span>`;
  submitBtn.style.display = 'none';
  retakeBtn.style.display = '';
  if (pageUrl) markQuizCompleted(pageUrl);
}

function retakeQuiz(form, questions, resultEl, submitBtn, retakeBtn) {
  const questionEls = form.querySelectorAll('.quiz-question');
  for (const qEl of questionEls) {
    const inputs = qEl.querySelectorAll('input');
    for (const inp of inputs) {
      inp.checked = false;
      inp.disabled = false;
      inp.closest('.quiz-option').classList.remove('correct', 'incorrect');
    }
  }
  resultEl.className = 'quiz-result';
  resultEl.innerHTML = '';
  submitBtn.style.display = '';
  retakeBtn.style.display = 'none';
}

function findPathToNode(nodes, url, path = []) {
  for (const node of nodes) {
    const currentPath = [...path, node.title];
    if (node.url === url) return currentPath;
    if (node.children) {
      const found = findPathToNode(node.children, url, currentPath);
      if (found) return found;
    }
  }
  return null;
}

function renderPageToc(headings) {
  const toc = document.getElementById('page-toc');
  if (!headings || headings.length === 0) {
    toc.innerHTML = '';
    toc.style.display = 'none';
    return;
  }
  let html = '<div class="toc-header">On this page</div>';
  for (const h of headings) {
    const indent = (h.level - 2) * 12;
    html += `<a class="toc-item" href="#${escapeHtml(h.id)}" data-toc-id="${escapeHtml(h.id)}" style="padding-left:${12 + indent}px">${escapeHtml(h.text)}</a>`;
  }
  toc.innerHTML = html;
  toc.style.display = 'block';
}

function updateBreadcrumb(url) {
  const breadcrumb = document.getElementById('breadcrumb');
  if (!url) { breadcrumb.innerHTML = ''; return; }
  const path = findPathToNode(sitemapData, url);
  if (!path) { breadcrumb.innerHTML = ''; return; }
  const parts = path.map((p, i) => {
    if (i === path.length - 1) return `<span>${escapeHtml(p)}</span>`;
    return `<a href="#" class="breadcrumb-item">${escapeHtml(p)}</a>`;
  });
  breadcrumb.innerHTML = parts.join('<span class="breadcrumb-sep">/</span>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const WELCOME_URL = 'https://open-mainframe-project.gitbook.io/mainframe-open-education-project/welcome-learn-and-contribute-to-moe.md';
let welcomeHtml = '';

function showWelcome(title) {
  const contentEl = document.getElementById('page-content');
  contentEl.className = '';
  const titleHtml = title ? `<h1>${escapeHtml(title)}</h1>\n` : '';
  contentEl.innerHTML = titleHtml + welcomeHtml;
  renderPageToc(null);
  addFeedbackWidget();
  updateBreadcrumb(null);
  setActiveNavItem(null);
  document.title = title ? `${title} - MOE Documentation` : 'Mainframe Open Education';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addCopyButtons() {
  document.querySelectorAll('#page-content pre').forEach(pre => {
    if (pre.parentNode.classList.contains('code-wrapper')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      }).catch(() => {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
    wrapper.appendChild(btn);
  });
}

function setupImageLightbox() {
  document.querySelectorAll('#page-content img:not(.no-zoom)').forEach(img => {
    if (img.closest('.link-card-icon') || img.closest('.file-video') || img.closest('.embed-image')) return;
    img.classList.add('zoomable');
    img.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.className = 'lightbox-overlay';
      const clone = document.createElement('img');
      clone.src = img.src;
      clone.alt = img.alt;
      overlay.appendChild(clone);
      overlay.addEventListener('click', () => overlay.remove());
      overlay.addEventListener('wheel', () => overlay.remove(), { passive: true });
      document.body.appendChild(overlay);
    });
  });
}

function addFeedbackWidget() {
  const existing = document.querySelector('.page-feedback');
  if (existing) existing.remove();
  const nav = document.querySelector('.page-nav');
  if (!nav) return;
  const feedback = document.createElement('div');
  feedback.className = 'page-feedback';
  feedback.innerHTML = '<span class="feedback-label">Was this helpful?</span>' +
    '<button class="feedback-btn" data-feedback="yes">&#128077;</button>' +
    '<button class="feedback-btn" data-feedback="no">&#128078;</button>';
  feedback.querySelectorAll('.feedback-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      feedback.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  nav.parentNode.insertBefore(feedback, nav.nextSibling);
}

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.classList.toggle('dark');
  localStorage.setItem('moe-dark-mode', isDark ? 'dark' : 'light');
  document.getElementById('dark-toggle').textContent = isDark ? '\u2600' : '\u263E';
}

function applyDarkMode() {
  const saved = localStorage.getItem('moe-dark-mode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.getElementById('dark-toggle').textContent = '\u2600';
  } else {
    document.getElementById('dark-toggle').textContent = '\u263E';
  }
}

/* ── Skeleton Loading ── */
function showSkeleton(container) {
  container.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text skeleton-text--short"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-code"></div>
    <div class="skeleton skeleton-text"></div>
    <div class="skeleton skeleton-text skeleton-text--short"></div>
  `;
}

/* ── Edit Link ── */
function getEditUrl(pageUrl) {
  const relativePath = pageUrl
    .replace('https://open-mainframe-project.gitbook.io/mainframe-open-education-project/', '')
    .replace(/\.md$/, '.md');
  return `${GITHUB_BASE}/${relativePath}`;
}

/* ── Font Size Controls ── */
function changeFontSize(delta) {
  const el = document.getElementById('page-content');
  let size = parseFloat(localStorage.getItem('moe-font-size') || '16');
  size = Math.min(Math.max(size + delta, 12), 24);
  localStorage.setItem('moe-font-size', String(size));
  el.style.fontSize = size + 'px';
  document.getElementById('font-size-label').textContent = size + 'px';
}

function applyFontSize() {
  const saved = parseFloat(localStorage.getItem('moe-font-size') || '16');
  document.getElementById('page-content').style.fontSize = saved + 'px';
  const label = document.getElementById('font-size-label');
  if (label) label.textContent = saved + 'px';
}

/* ── Command Palette ── */
function openCommandPalette() {
  const overlay = document.getElementById('cmd-palette');
  const input = document.getElementById('cmd-input');
  overlay.classList.add('open');
  input.value = '';
  input.focus();
  filterCommandPalette('');
}

function closeCommandPalette() {
  document.getElementById('cmd-palette').classList.remove('open');
}

function filterCommandPalette(query) {
  const list = document.getElementById('cmd-results');
  const q = query.toLowerCase().trim();
  const flat = flattenSitemap(sitemapData);
  let results = flat;
  if (q) {
    results = flat.filter(n => n.title.toLowerCase().includes(q));
  }
  if (results.length === 0) {
    list.innerHTML = '<div class="cmd-empty">No results found</div>';
    return;
  }
  list.innerHTML = results.map((n, i) => `
    <div class="cmd-result${i === 0 ? ' cmd-selected' : ''}" data-url="${escapeHtml(n.url)}" data-index="${i}">
      <span class="cmd-result-title">${escapeHtml(n.title)}</span>
    </div>
  `).join('');
  list.querySelectorAll('.cmd-result').forEach(el => {
    el.addEventListener('click', () => {
      const url = el.dataset.url;
      const node = findNodeByUrl(sitemapData, url);
      if (node) { closeCommandPalette(); loadPage(node); }
    });
    el.addEventListener('mouseenter', () => {
      list.querySelectorAll('.cmd-selected').forEach(s => s.classList.remove('cmd-selected'));
      el.classList.add('cmd-selected');
    });
  });
  list._selectedIndex = 0;
}

function navigateCommandPalette(direction) {
  const items = document.querySelectorAll('.cmd-result');
  if (!items.length) return;
  let idx = Array.from(items).findIndex(el => el.classList.contains('cmd-selected'));
  items[idx]?.classList.remove('cmd-selected');
  idx = Math.min(Math.max(idx + direction, 0), items.length - 1);
  items[idx].classList.add('cmd-selected');
  items[idx].scrollIntoView({ block: 'nearest' });
}

function commitCommandPalette() {
  const selected = document.querySelector('.cmd-result.cmd-selected');
  if (selected) {
    const url = selected.dataset.url;
    const node = findNodeByUrl(sitemapData, url);
    if (node) { closeCommandPalette(); loadPage(node); }
  }
}

/* ── Prefetch ── */
function setupPrefetch() {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const link = entry.target;
        const url = link.dataset?.url || link.getAttribute('href');
        if (url && url.includes('gitbook.io')) {
          const prefetchLink = document.createElement('link');
          prefetchLink.rel = 'prefetch';
          prefetchLink.href = `/api/page?url=${encodeURIComponent(url)}`;
          document.head.appendChild(prefetchLink);
        }
        observer.unobserve(link);
      }
    }
  }, { rootMargin: '200px' });

  document.querySelectorAll('.nav-label, .page-nav-link, .welcome-card').forEach(el => observer.observe(el));
}

function triggerFadeIn(el) {
  el.classList.remove('fade-in');
  void el.offsetWidth;
  el.classList.add('fade-in');
}

async function loadPage(node) {
  const contentEl = document.getElementById('page-content');
  const sandboxContainer = document.getElementById('sandbox-container');
  if (currentMode === 'sandbox') {
    currentMode = 'auto';
    hideSandbox();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'auto'));
  }
  if (sandboxContainer.style.display !== 'none' && sandboxContainer.style.display !== '') {
    hideSandbox();
  }
  if (node.url === WELCOME_URL) {
    currentUrl = null;
    currentTitle = '';
    showWelcome(node.title);
    if (window.innerWidth <= 768) closeSidebar();
    return;
  }
  showSkeleton(contentEl);
  contentEl.className = '';
  currentUrl = node.url;
  currentTitle = node.title;
  try {
    const effectiveMode = currentMode === 'auto' ? 'markdown' : currentMode;
    const result = await fetchPageContent(node.url, effectiveMode);
    if (effectiveMode === 'raw') {
      contentEl.className = 'raw-mode';
      contentEl.innerHTML = `<h1>${escapeHtml(node.title)}</h1>\n`;
      const textarea = document.createElement('textarea');
      textarea.style.cssText = 'width:100%;min-height:80vh;border:none;background:transparent;font:inherit;resize:none;outline:none';
      textarea.readOnly = true;
      textarea.value = result.content;
      contentEl.appendChild(textarea);
    } else {
      contentEl.innerHTML = `<h1>${escapeHtml(node.title)}</h1>\n` + result.content;
    }
    const quizEl = renderQuiz(node.url);
    if (quizEl) contentEl.appendChild(quizEl);
    renderPageToc(result.headings);
    addInlineSandbox(contentEl, result.content);
    const navHtml = renderPageNav(node.url);
    if (navHtml) contentEl.insertAdjacentHTML('beforeend', navHtml);
    addPageMeta(node.url);
    addEditLink(node.url);
    addFeedbackWidget();
    addCopyButtons();
    setupImageLightbox();
    updateBreadcrumb(node.url);
    setActiveNavItem(node.url);
    updateSidebarCheckmarks();
    updateProgressUI();
    applyFontSize();
    triggerFadeIn(contentEl);
    document.title = `${node.title} - MOE Documentation`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth <= 768) closeSidebar();
  } catch (err) {
    contentEl.className = '';
    contentEl.innerHTML = `<div class="error">Failed to load page: ${escapeHtml(err.message)}</div>`;
  }
}

function addPageMeta(url) {
  const existing = document.querySelector('.page-meta');
  if (existing) existing.remove();
  const contentEl = document.getElementById('page-content');
  const firstH1 = contentEl.querySelector('h1');
  if (!firstH1) return;
  const meta = document.createElement('div');
  meta.className = 'page-meta';
  const done = isQuizCompleted(url);
  if (done) {
    meta.innerHTML = '<span class="page-meta-status completed">&#10003; Quiz passed</span>';
  }
  firstH1.after(meta);
}

function addEditLink(url) {
  const existing = document.querySelector('.page-edit-link');
  if (existing) existing.remove();
  const contentEl = document.getElementById('page-content');
  const lastChild = contentEl.lastElementChild;
  if (!lastChild) return;
  const editUrl = getEditUrl(url);
  const link = document.createElement('div');
  link.className = 'page-edit-link';
  link.innerHTML = `<a href="${escapeHtml(editUrl)}" target="_blank" rel="noopener">&#9998; Suggest a change on GitHub</a>`;
  contentEl.appendChild(link);
}

function setViewMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (mode === 'sandbox') { showSandbox(); return; }
  hideSandbox();
  if (currentUrl) {
    const node = findNodeByUrl(sitemapData, currentUrl);
    if (node) loadPage(node);
  }
}

function performSearch(query) {
  if (!query.trim()) {
    document.querySelectorAll('.nav-item').forEach(item => item.style.display = '');
    return;
  }
  const q = query.toLowerCase();
  document.querySelectorAll('.nav-item').forEach(item => {
    const title = item.querySelector('.nav-title');
    if (!title) return;
    item.style.display = title.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('app').classList.remove('sidebar-open');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const app = document.getElementById('app');
  const isOpen = sidebar.classList.toggle('open');
  app.classList.toggle('sidebar-open', isOpen);
}

function showSandbox() {
  document.getElementById('page-content').style.display = 'none';
  document.getElementById('content-toolbar').style.display = 'none';
  const container = document.getElementById('sandbox-container');
  container.style.display = 'flex';
  container.classList.add('visible');
}

function hideSandbox() {
  document.getElementById('sandbox-container').style.display = 'none';
  document.getElementById('sandbox-container').classList.remove('visible');
  document.getElementById('page-content').style.display = '';
  document.getElementById('content-toolbar').style.display = '';
}

function setSandboxOutput(html, className) {
  const output = document.getElementById('sandbox-output');
  output.innerHTML = html;
  output.className = 'sandbox-output' + (className ? ' ' + className : '');
}

function showSandboxSkeleton() {
  const output = document.getElementById('sandbox-output');
  output.className = 'sandbox-output';
  output.innerHTML = `<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div>`;
}

async function runSandboxCode() {
  const editor = document.getElementById('sandbox-editor');
  const lang = document.getElementById('sandbox-lang').value;
  const code = editor.value;
  const runBtn = document.getElementById('sandbox-run');
  if (!code.trim()) {
    setSandboxOutput('<span class="output-error">Please enter some code to execute.</span>');
    return;
  }
  runBtn.disabled = true;
  showSandboxSkeleton();
  try {
    const res = await fetch('/api/sandbox/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang, code })
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || data.message || `Server returned ${res.status}`;
      setSandboxOutput(`<span class="output-error">${escapeHtml(msg)}</span>`);
      return;
    }
    let html = '';
    if (data.run && data.run.stdout) html += '<span class="output-stdout">' + escapeHtml(data.run.stdout) + '</span>';
    if (data.run && data.run.stderr) html += '<span class="output-stderr">' + escapeHtml(data.run.stderr) + '</span>';
    if (data.compile && data.compile.stderr) html += '<span class="output-stderr">Compiler stderr:\n' + escapeHtml(data.compile.stderr) + '</span>';
    if (data.run && data.run.signal) html += '<span class="output-error">Process terminated by signal: ' + escapeHtml(data.run.signal) + '</span>';
    if (!html) {
      if (data.run && data.run.output) {
        html = '<span class="output-stdout">' + escapeHtml(data.run.output) + '</span>';
      } else {
        html = '<span class="output-success">Code executed successfully (no output).</span>';
      }
    }
    setSandboxOutput(html);
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      setSandboxOutput('<span class="output-error">Piston sandbox is not reachable. Make sure the Piston container is running on port 2000.</span>');
    } else if (err.name === 'AbortError' || err.message.includes('timeout')) {
      setSandboxOutput('<span class="output-error">Execution timed out. The code may contain an infinite loop or long-running operation.</span>');
    } else {
      setSandboxOutput('<span class="output-error">Unexpected error: ' + escapeHtml(err.message) + '</span>');
    }
  } finally {
    runBtn.disabled = false;
  }
}

function hasCobolContent(content) {
  if (!content) return false;
  const text = content.replace(/<[^>]+>/g, ' ').toLowerCase();
  return text.includes('cobol');
}

function addInlineSandbox(contentEl, contentText) {
  if (!hasCobolContent(contentText)) return;
  if (contentEl.querySelector('.inline-sandbox')) return;
  const section = document.createElement('div');
  section.className = 'inline-sandbox';
  section.innerHTML = `<h2 class="inline-sandbox-heading">COBOL Sandbox</h2>
<p class="inline-sandbox-desc">Try writing and running COBOL code right here.</p>
<div class="inline-sandbox-editor-wrapper">
  <textarea class="inline-sandbox-editor" spellcheck="false" placeholder="Write your COBOL code here...">       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO.
       PROCEDURE DIVISION.
           DISPLAY "Hello from COBOL".
           STOP RUN.</textarea>
</div>
<div class="inline-sandbox-controls">
  <button class="inline-sandbox-run">Run</button>
  <span class="inline-sandbox-status"></span>
</div>
<div class="inline-sandbox-output"></div>`;
  const runBtn = section.querySelector('.inline-sandbox-run');
  const editor = section.querySelector('.inline-sandbox-editor');
  const output = section.querySelector('.inline-sandbox-output');
  const status = section.querySelector('.inline-sandbox-status');
  runBtn.addEventListener('click', async () => {
    const code = editor.value;
    if (!code.trim()) {
      output.className = 'inline-sandbox-output visible';
      output.innerHTML = '<span class="output-error">Please enter some code.</span>';
      return;
    }
    runBtn.disabled = true;
    status.textContent = 'Running...';
    output.className = 'inline-sandbox-output visible';
    output.innerHTML = `<div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div>`;
    try {
      const res = await fetch('/api/sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'cobol', code })
      });
      const data = await res.json();
      if (!res.ok) {
        output.innerHTML = '<span class="output-error">' + escapeHtml(data.error || data.message || 'Server error') + '</span>';
        return;
      }
      let html = '';
      if (data.run && data.run.stdout) html += '<span class="output-stdout">' + escapeHtml(data.run.stdout) + '</span>';
      if (data.run && data.run.stderr) html += '<span class="output-stderr">' + escapeHtml(data.run.stderr) + '</span>';
      if (data.compile && data.compile.stderr) html += '<span class="output-stderr">Compiler stderr:\n' + escapeHtml(data.compile.stderr) + '</span>';
      if (data.run && data.run.signal) html += '<span class="output-error">Terminated by signal: ' + escapeHtml(data.run.signal) + '</span>';
      if (!html) {
        html = data.run && data.run.output
          ? '<span class="output-stdout">' + escapeHtml(data.run.output) + '</span>'
          : '<span class="output-success">Code executed successfully (no output).</span>';
      }
      output.innerHTML = html;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        output.innerHTML = '<span class="output-error">Sandbox not reachable. Make sure Piston is running on port 2000.</span>';
      } else {
        output.innerHTML = '<span class="output-error">Error: ' + escapeHtml(err.message) + '</span>';
      }
    } finally {
      runBtn.disabled = false;
      status.textContent = '';
    }
  });
  contentEl.appendChild(section);
}

function setupTocScrollTracking() {
  const tocItems = document.querySelectorAll('.toc-item');
  if (!tocItems.length) return;
  const headings = [];
  tocItems.forEach(item => {
    const id = item.dataset.tocId;
    const el = document.getElementById(id);
    if (el) headings.push({ el, item });
  });
  if (!headings.length) return;
  const observer = new IntersectionObserver((entries) => {
    let active = null;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const found = headings.find(h => h.el === entry.target);
        if (found && (!active || entry.boundingClientRect.top < active.boundingClientRect.top)) {
          active = entry.target;
        }
      }
    }
    if (active) {
      tocItems.forEach(i => i.classList.remove('active'));
      const found = headings.find(h => h.el === active);
      if (found) found.item.classList.add('active');
    }
  }, { rootMargin: '-80px 0px -60% 0px' });
  headings.forEach(h => observer.observe(h.el));
}

