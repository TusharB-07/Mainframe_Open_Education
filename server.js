const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.use('/logo', express.static(path.join(__dirname, 'logo')));

const GITBOOK_BASE = 'https://open-mainframe-project.gitbook.io';
const FETCH_TIMEOUT = 15000;

async function fetchUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MOE-Viewer/1.0)',
        'Accept': 'text/html, text/markdown, text/plain, application/json',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function fixImageUrls(text, baseUrl) {
  const base = baseUrl.replace(/\/[^/]*\.md$/, '').replace(/\/[^/]*$/, '');
  const root = GITBOOK_BASE;

  return text
    .replace(/(\()\/(?!\/)([^)]+)\)/g, (match, open, urlPath) => {
      if (urlPath.startsWith('api/')) return match;
      if (urlPath.startsWith('files/')) {
        const fileId = urlPath.replace('files/', '');
        return `${open}/api/file/${fileId})`;
      }
      if (urlPath.startsWith('~gitbook/')) {
        return `${open}${root}/${urlPath})`;
      }
      if (urlPath.match(/^[a-zA-Z0-9_-]+\//) || urlPath.match(/^pages\//)) {
        return `${open}${root}/${urlPath})`;
      }
      return match;
    })
    .replace(/(src=")\/(?!\/)([^"]+)"/g, (match, open, urlPath) => {
      if (urlPath.startsWith('api/')) return match;
      if (urlPath.startsWith('files/')) {
        const fileId = urlPath.replace('files/', '');
        return `${open}/api/file/${fileId}"`;
      }
      if (urlPath.startsWith('~gitbook/')) {
        return `${open}${root}/${urlPath}"`;
      }
      return `${open}${base}/${urlPath}"`;
    })
    .replace(/(href=")\/(?!\/)([^"]+)"/g, (match, open, urlPath) => {
      if (urlPath.startsWith('api/')) return match;
      if (urlPath.startsWith('files/')) {
        const fileId = urlPath.replace('files/', '');
        return `${open}/api/file/${fileId}"`;
      }
      if (urlPath.startsWith('~gitbook/')) {
        return `${open}${root}/${urlPath}"`;
      }
      return `${open}${base}/${urlPath}"`;
    });
}

function normalizeEmbedUrl(url) {
  return url.trim()
    .replace(/^(&lt;|<)|(&gt;|>)$/g, '')
    .replace(/^"|"$/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function escapeHtmlAttr(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getYouTubeEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host.endsWith('youtube.com')) {
      const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
  } catch (err) {
    return null;
  }

  return null;
}

function renderEmbedBlock(url, label) {
  const cleanUrl = normalizeEmbedUrl(url);
  const caption = (label || '').trim();
  const safeCaption = escapeHtmlAttr(caption || 'Open in GitBook');

  if (/\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(cleanUrl)) {
    return `<figure class="embed embed-image"><img src="${escapeHtmlAttr(cleanUrl)}" alt="${safeCaption}"></figure>`;
  }

  const youtubeEmbedUrl = getYouTubeEmbedUrl(cleanUrl);
  if (youtubeEmbedUrl) {
    return `<div class="embed embed-video"><iframe src="${escapeHtmlAttr(youtubeEmbedUrl)}" title="${safeCaption}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
  }

  const displayUrl = cleanUrl.length > 80 ? cleanUrl.substring(0, 77) + '...' : cleanUrl;
  const labelHtml = caption ? `<div class="embed-link-label">${safeCaption}</div>` : '';
  return `<div class="embed embed-link">${labelHtml}<a href="${escapeHtmlAttr(cleanUrl)}" class="embed-link-url" target="_blank" rel="noopener">${escapeHtmlAttr(displayUrl)}</a></div>`;
}

function replaceGitBookRoleTables(text) {
  const startRegex = /<div[^>]*role="table"[^>]*>/g;
  const result = [];
  let lastIndex = 0;
  let match;

  const findMatchingDiv = (html, startPos) => {
    let depth = 1;
    let p = startPos;
    while (depth > 0 && p < html.length) {
      const no = html.indexOf('<div', p);
      const nc = html.indexOf('</div>', p);
      if (nc === -1) break;
      if (no !== -1 && no < nc) { depth++; p = no + 4; }
      else { depth--; p = nc + 6; }
    }
    return { html: html.substring(startPos, p - 6), end: p };
  };

  const findAllByRole = (html, role) => {
    const results = [];
    const re = new RegExp(`<div[^>]*role="${role}"[^>]*>`, 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      const { html: content } = findMatchingDiv(html, m.index + m[0].length);
      results.push({ full: html.substring(m.index, m.index + m[0].length + content.length + 6), content });
    }
    return results;
  };

  const cleanCell = (raw) => {
    let s = raw.replace(/<div[^>]*class="blocks[^"]*"[^>]*>/, '');
    s = s.replace(/<\/(?:div|p)>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return s;
  };

  while ((match = startRegex.exec(text)) !== null) {
    const start = match.index;
    const { html: tableHtml } = findMatchingDiv(text, start + match[0].length);

    const headerCells = findAllByRole(tableHtml, 'columnheader');
    const rows = findAllByRole(tableHtml, 'row').filter(
      r => r.full.indexOf('role="cell"') !== -1 || r.full.indexOf('role="columnheader"') !== -1
    );
    if (rows.length === 0) continue;

    let html = '<div class="table-wrapper"><table>';
    if (headerCells.length > 0) {
      html += '<thead><tr>';
      for (const hc of headerCells) html += '<th>' + cleanCell(hc.content) + '</th>';
      html += '</tr></thead>';
    }
    html += '<tbody>';
    for (const row of rows) {
      const cells = findAllByRole(row.full, 'cell');
      if (cells.length === 0 && row.full.indexOf('role="columnheader"') !== -1) continue;
      if (cells.length === 0) continue;
      html += '<tr>';
      for (const c of cells) html += '<td>' + cleanCell(c.content) + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    result.push(text.substring(lastIndex, start));
    result.push(html);
    lastIndex = start + match[0].length + tableHtml.length + 6;
  }
  result.push(text.substring(lastIndex));
  return result.join('');
}

function replaceGitBookFileCards(text) {
  const startRegex = /<div class="decoration-primary\/6 max-w-3xl w-full[^"]*"[^>]*>/g;
  const result = [];
  let lastIndex = 0;
  let match;
  while ((match = startRegex.exec(text)) !== null) {
    const start = match.index;
    const openTag = match[0];
    let depth = 1;
    let pos = start + openTag.length;
    while (depth > 0 && pos < text.length) {
      const nextOpen = text.indexOf('<div', pos);
      const nextClose = text.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4; }
      else { depth--; pos = nextClose + 6; }
    }
    const cardHtml = text.substring(start, pos);
    const isFileCard = /\d+\s*(?:KB|MB|GB)/.test(cardHtml) && /\.(pdf|docx?|xlsx?|pptx?|zip|txt|png|jpg|jpeg|gif|mp4|mov|avi|mkv|webm)/i.test(cardHtml);
    if (!isFileCard) continue;
    const sizeMatch = cardHtml.match(/(\d+(?:\.\d+)?\s*(?:KB|MB|GB))/);
    const fileSize = sizeMatch ? sizeMatch[1] : '';
    const linkMatch = cardHtml.match(/<a[^>]*href="([^"]*)"[^>]*>([^<]+\.(?:pdf|docx?|xlsx?|pptx?|zip|txt|png|jpg|jpeg|gif|mp4|mov|avi|mkv|webm))<\/a>/i);
    if (!linkMatch) continue;
    const fileUrl = linkMatch[1];
    const fileName = linkMatch[2];
    const extMatch = fileName.match(/\.(\w+)$/);
    const fileType = extMatch ? extMatch[1].toUpperCase() : '';
    const isVideo = /^MP4|MOV|AVI|MKV|WEBM$/.test(fileType);
    if (isVideo) {
      result.push(text.substring(lastIndex, start));
      result.push(`<div class="file-video"><video controls preload="metadata" width="100%"><source src="${escapeHtmlAttr(fileUrl)}" type="video/${fileType.toLowerCase()}"></video><div class="file-video-info"><a href="${fileUrl}" class="file-name">${fileName}</a><span class="file-size">${fileSize} — ${fileType}</span><a href="${fileUrl}" class="file-download" download>Download</a></div></div>`);
      lastIndex = pos;
      continue;
    }
    const icon = '\uD83D\uDCC4';
    result.push(text.substring(lastIndex, start));
    result.push(`<div class="file-card"><div class="file-icon">${icon}</div><div class="file-info"><a href="${fileUrl}" class="file-name">${fileName}</a><span class="file-size">${fileSize} — ${fileType}</span></div><a href="${fileUrl}" class="file-download">Download</a></div>`);
    lastIndex = pos;
  }
  result.push(text.substring(lastIndex));
  return result.join('');
}

function simplifyGitBookLists(text) {
  const listRegex = /<(ul|ol)[^>]*class="[^"]*decoration-primary\/6[^"]*"[^>]*>([\s\S]*?)<\/\1>/g;
  return text.replace(listRegex, (match, tag, inner) => {
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    const items = [];
    let liMatch;
    while ((liMatch = liRegex.exec(inner)) !== null) {
      let liInner = liMatch[1];
      const contentMatch = liInner.match(/<div[^>]*class="[^"]*flex[^"]*min-w-0[^"]*flex-1[^"]*"[^>]*>([\s\S]*)<\/div>\s*$/);
      if (contentMatch) {
        liInner = contentMatch[1];
      } else {
        liInner = liInner.replace(/<[^>]+>/g, '').trim();
      }
      items.push(`<li>${liInner.trim()}</li>`);
    }
    return items.length ? `<${tag}>${items.join('')}</${tag}>` : match;
  });
}

function preprocessGitBookFlavoredMd(raw, pageUrl) {
  let text = raw;

  // Decode HTML entities (order matters: &amp; first so &amp;lt; becomes &lt;)
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

  // Simplify GitBook complex list HTML to standard <ul>/<ol>/<li>
  text = simplifyGitBookLists(text);

  // Handle file embeds ({% file src="..." %}...{% endfile %})
  text = text.replace(/{%\s*file\s+src="([^"]+)"\s*%}([\s\S]*?){%\s*endfile\s*%}/g, (match, src, label) => {
    const fileId = src.replace(/^\/files\//, '');
    const fileName = (label || '').trim() || 'File';
    const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(fileName);
    if (isVideo) {
      return `<div class="file-video"><video controls preload="metadata" width="100%"><source src="/api/file/${fileId}" type="video/${fileName.split('.').pop().toLowerCase()}"></video><div class="file-video-info"><a href="/api/file/${fileId}" class="file-name">${fileName}</a><a href="/api/file/${fileId}" class="file-download" download>Download</a></div></div>`;
    }
    return `<div class="file-card"><div class="file-icon">\uD83D\uDCC4</div><div class="file-info"><a href="/api/file/${fileId}" class="file-name">${fileName}</a></div><a href="/api/file/${fileId}" class="file-download">Download</a></div>`;
  });
  // Handle self-closing file embeds ({% file src="..." %} with no endfile)
  text = text.replace(/{%\s*file\s+src="([^"]+)"\s*%}(?![\s\S]*?{%\s*endfile\s*%})/g, (match, src) => {
    const fileId = src.replace(/^\/files\//, '');
    return `<div class="file-card"><div class="file-icon">\uD83D\uDCC4</div><div class="file-info"><a href="/api/file/${fileId}" class="file-name">File</a></div><a href="/api/file/${fileId}" class="file-download">Download</a></div>`;
  });

  // Handle stepper ({% stepper %}...{% endstepper %} with {% step %}...{% endstep %})
  text = text.replace(/{%\s*stepper\s*%}([\s\S]*?){%\s*endstepper\s*%}/g, (match, content) => {
    const steps = content.match(/{%\s*step\s*%}([\s\S]*?){%\s*endstep\s*%}/g);
    if (!steps) return '';
    return steps.map((s, i) => {
      const inner = s.replace(/{%\s*step\s*%}|{%\s*endstep\s*%}/g, '').trim();
      return `${i + 1}. ${inner.replace(/\n\n+/g, '\n   ')}`;
    }).join('\n\n');
  });

  // Handle embeds with content ({% embed %}...{% endembed %})
  text = text.replace(/{%\s*embed\s+url="([^"]+)"\s*%}([\s\S]*?){%\s*endembed\s*%}/g, (match, url, label) => {
    return renderEmbedBlock(url, label || '');
  });
  // Handle self-closing embeds ({% embed url="..." %} with no endembed)
  text = text.replace(/{%\s*embed\s+url="([^"]+)"\s*%}/g, (match, url) => {
    return renderEmbedBlock(url, '');
  });

  text = text.replace(/{%\s*hint\s+(?:style=")?(\w+)"?\s*%}([\s\S]*?){%\s*endhint\s*%}/g, (match, type, content) => {
    const symbols = { danger: '\u26A0\uFE0F', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F', success: '\u2705' };
    const symbol = symbols[type] || '\u2139\uFE0F';
    return `> ${symbol} ${content.trim().replace(/\n/g, '\n> ')}\n`;
  });

  text = text.replace(/{%\s*columns\s*%}([\s\S]*?){%\s*endcolumns\s*%}/g, (match, content) => {
    const cols = content.match(/{%\s*column\s+width="([^"]*)"[^%]*%}([\s\S]*?){%\s*endcolumn\s*%}/g);
    if (!cols) return '';
    return cols.map(c => {
      const m = c.match(/width="([^"]*)"[^%]*%}([\s\S]*?){%\s*endcolumn\s*%}/);
      if (!m) return '';
      return m[2].trim();
    }).join('\n\n');
  });

  text = text.replace(/<table[\s\S]*?<\/table>/g, (match) => {
    const tagName = (match.match(/<table[^>]*>/i) || [''])[0];
    const hasHeader = /<th>/i.test(match);

    const rows = match.match(/<tr>[\s\S]*?<\/tr>/gi);
    if (!rows) return '';

    const cleanRows = rows.map(row => {
      const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi);
      if (!cells) return null;

      const cleaned = cells.map(c => {
        const keepTags = ['a', 'strong', 'b', 'em', 'i', 'code', 'span'];
        let cell = c
          .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<\/?([a-z]+)[^>]*>/gi, (m, tag) => keepTags.includes(tag.toLowerCase()) ? m : '')
          .replace(/\n/g, ' ').trim();
        return cell;
      });

      return cleaned;
    }).filter(Boolean);

    if (cleanRows.length === 0) return '';

    let htmlTable = '<div class="table-wrapper"><table>';
    if (hasHeader && cleanRows.length > 0) {
      htmlTable += '<thead><tr>' + cleanRows[0].map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
      htmlTable += '<tbody>' + cleanRows.slice(1).map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody>';
    } else {
      htmlTable += cleanRows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('');
    }
    htmlTable += '</table></div>';

    return htmlTable;
  });

  text = text.replace(/<figure>([\s\S]*?)<\/figure>/g, (match, inner) => {
    const imgMatch = inner.match(/<img[^>]+src="([^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/);
    if (!imgMatch) return match;
    const src = imgMatch[1];
    const alt = (imgMatch[2] || '').replace(/"/g, '&quot;');
    const captionMatch = inner.match(/<figcaption>([\s\S]*?)<\/figcaption>/);
    const imgTag = `<img src="${src}" alt="${alt}" style="max-width:100%;border-radius:8px;margin:16px 0">`;
    if (captionMatch) {
      const caption = captionMatch[1].trim();
      return `<figure>${imgTag}<figcaption>${caption}</figcaption></figure>`;
    }
    return imgTag;
  });

  text = text.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/g, '$1');

  text = text.replace(/&#x20;/g, ' ');

  // Handle GitBook picture-based video file cards (<picture> with .mp4/.mov/etc.)
  text = text.replace(/<picture[^>]*class="[^"]*decoration-primary\/6[^"]*"[^>]*>([\s\S]*?)<\/picture>/g, (match, inner) => {
    const linkMatch = inner.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+\.(?:mp4|mov|avi|mkv|webm))<\/a>/i);
    if (!linkMatch) return match;
    const fileUrl = linkMatch[1];
    const fileName = linkMatch[2];
    const extMatch = fileName.match(/\.(\w+)$/);
    const fileType = extMatch ? extMatch[1].toLowerCase() : '';
    const sizeMatch = inner.match(/(\d+(?:\.\d+)?\s*(?:KB|MB|GB))/);
    const fileSize = sizeMatch ? sizeMatch[1] : '';
    const captionMatch = inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/);
    const caption = captionMatch ? captionMatch[1].trim() : '';
    const fileUrlSafe = escapeHtmlAttr(fileUrl);
    const captionHtml = caption ? `<div class="file-video-caption">${escapeHtmlAttr(caption)}</div>` : '';
    return `<div class="file-video"><video controls preload="metadata" width="100%"><source src="${fileUrlSafe}" type="video/${fileType}"></video><div class="file-video-info"><a href="${fileUrlSafe}" class="file-name">${escapeHtmlAttr(fileName)}</a>${fileSize ? `<span class="file-size">${fileSize} &mdash; ${fileType.toUpperCase()}</span>` : ''}<a href="${fileUrlSafe}" class="file-download" download>Download</a></div>${captionHtml}</div>`;
  });

  // Style GitBook div-based file cards (size, filename, extension, download button)
  text = replaceGitBookFileCards(text);

  // Style GitBook link cards (image logo left, title+domain right, in a rectangle)
  text = text.replace(
    /<a[^>]*class="[^"]*ring-1[^"]*ring-tint-subtle[^"]*rounded-sm[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
    (match, href, inner) => {
      const imgMatch = inner.match(/<img[^>]*src="([^"]*)"[^>]*>/);
      const imgSrc = imgMatch ? imgMatch[1] : '';
      const textBaseSpans = [...inner.matchAll(/<span[^>]*class="[^"]*text-base[^"]*"[^>]*>([\s\S]*?)<\/span>/g)];
      let title = '', domain = '';
      if (textBaseSpans.length >= 2) {
        title = textBaseSpans[0][1].trim();
        domain = textBaseSpans[1][1].trim();
      } else if (textBaseSpans.length === 1) {
        title = textBaseSpans[0][1].trim();
      }
      const safeTitle = escapeHtmlAttr(title);
      const safeDomain = escapeHtmlAttr(domain);
      const iconHtml = imgSrc ? `<span class="link-card-icon"><img src="${imgSrc}" alt="Logo"></span>` : '';
      return `<a class="link-card" href="${href}" target="_blank" rel="noopener">${iconHtml}<span class="link-card-body"><span class="link-card-title">${safeTitle}</span><span class="link-card-domain">${safeDomain}</span></span></a>`;
    }
  );

  text = replaceGitBookRoleTables(text);
  text = text.replace(/<p[^>]*>\s*<\/p>/g, '');
  text = text.replace(/<div class="sr-only">[\s\S]*?<\/div>/, '');
  text = text.replace(/^>?\s*For the complete documentation index.*?(?:llms\.txt|\.md).*?(?:\n|$)/, '');
  text = text.replace(/---\s*\n\s*#\s*Agent Instructions[\s\S]*$/, '');
  text = text.replace(/#\s*Agent Instructions[\s\S]*$/, '');

}
app.get('/api/sitemap', (req, res) => {
  const mdPath = path.join(__dirname, 'sitemap.md');
  const markdown = fs.readFileSync(mdPath, 'utf-8');
  res.json(parseSitemap(markdown));
});
function gitBookUrl(mdUrl, rendered) {
  if (!rendered) return mdUrl;
  return mdUrl.replace(/\.md$/, '');
}
app.get('/api/page', async (req, res) => {
  const { url, mode } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });
  try {
    const fetchUrl_ = url.replace(/\.md$/, '');
    const rawText = await fetchUrl(fetchUrl_);
    if (mode === 'raw') {
      let rawMd = extractMarkdownFromHtml(rawText);
      if (!rawMd || rawMd.trim().length < 20) rawMd = rawText;
      rawMd = preprocessGitBookFlavoredMd(rawMd, url);
      rawMd = fixImageUrls(rawMd, url);
      return res.json({ content: rawMd, mode: 'raw', url });
    }
    let markdown = extractMarkdownFromHtml(rawText);
    if (!markdown || markdown.trim().length < 20) markdown = rawText;
    markdown = preprocessGitBookFlavoredMd(markdown, url);
    markdown = fixImageUrls(markdown, url);
    const html = require('marked').parse(markdown, { breaks: true, gfm: true });
    const headingRegex = /<h([234])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    const headings = []; let hMatch;
    while ((hMatch = headingRegex.exec(html)) !== null) {
      const text = hMatch[3].replace(/<[^>]+>/g, '').trim();
      if (text) headings.push({ level: parseInt(hMatch[1]), id: hMatch[2], text });
    }
    res.json({ content: html, mode: 'markdown', url, headings });
  } catch (err) {
    console.error('Failed to fetch ' + url + ':', err.message);
    res.status(502).json({ error: 'Failed to fetch content: ' + err.message });
  }
});
app.listen(PORT, () => console.log('MOE GitBook Viewer running at http://localhost:' + PORT));
