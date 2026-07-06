const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static('public'));
const GITBOOK_BASE = 'https://open-mainframe-project.gitbook.io';
function parseSitemap(markdown) {
  const lines = markdown.split('\n');
  const root = [];
  const stack = [{ children: root, level: -1 }];
  const linkRegex = /^\s*-\s*\[([^\]]+)\]\(([^)]+)\)/;
  for (const line of lines) {
    const match = line.match(linkRegex);
    if (!match) continue;
    const title = match[1], url = match[2];
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    const level = Math.floor(leadingSpaces / 2);
    const node = { title, url, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push({ children: node.children, level });
  }
  return root;
}
app.get('/api/sitemap', (req, res) => {
  const mdPath = path.join(__dirname, 'sitemap.md');
  const markdown = fs.readFileSync(mdPath, 'utf-8');
  res.json(parseSitemap(markdown));
});
app.listen(PORT, () => console.log('MOE GitBook Viewer running at http://localhost:' + PORT));
