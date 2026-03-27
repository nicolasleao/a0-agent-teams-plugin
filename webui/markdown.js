export function renderMarkdown(src) {
  if (!src) return '';
  const lines = src.split('\n');
  let out = '';
  let inCode = false, codeLines = [];
  let listTag = null, listItems = [];

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  function flushList() {
    if (!listItems.length) return '';
    const tag = listTag || 'ul';
    const html = `<${tag}>${listItems.map(i => `<li>${inline(i)}</li>`).join('')}</${tag}>`;
    listItems = []; listTag = null;
    return html;
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        out += `<pre><code>${esc(codeLines.join('\n'))}</code></pre>`;
        codeLines = []; inCode = false;
      } else {
        out += flushList(); inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (!line.trim()) { out += flushList(); continue; }

    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) { out += flushList(); out += `<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`; continue; }
    if (/^[\-\*_]{3,}\s*$/.test(line.trim())) { out += flushList(); out += '<hr>'; continue; }

    const ul = line.match(/^\s*[-*+]\s+(.+)/);
    if (ul) { if (listTag !== 'ul') out += flushList(); listTag = 'ul'; listItems.push(ul[1]); continue; }
    const ol = line.match(/^\s*\d+\.\s+(.+)/);
    if (ol) { if (listTag !== 'ol') out += flushList(); listTag = 'ol'; listItems.push(ol[1]); continue; }

    out += flushList();
    out += `<p>${inline(line)}</p>`;
  }
  out += flushList();
  if (inCode) out += `<pre><code>${esc(codeLines.join('\n'))}</code></pre>`;
  return out;
}
