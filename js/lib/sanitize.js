/* Make untrusted HTML (Google Calendar event descriptions) safe to display:
 * keep a small allow-list of formatting tags, keep only http(s)/mailto links,
 * and turn bare URLs into clickable links. */

const ALLOWED = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'UL', 'OL', 'LI', 'CODE', 'SPAN', 'DIV']);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH']);
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

function makeLink(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function linkifyTextNode(node) {
  const text = node.nodeValue;
  URL_RE.lastIndex = 0;
  if (!URL_RE.test(text)) return;
  URL_RE.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    frag.append(text.slice(last, m.index));
    const href = m[1].startsWith('www.') ? `https://${m[1]}` : m[1];
    frag.append(makeLink(href, m[1]));
    last = m.index + m[1].length;
  }
  frag.append(text.slice(last));
  node.replaceWith(frag);
}

function clean(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (!child.parentElement?.closest('a')) linkifyTextNode(child);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    if (DROP_WITH_CONTENT.has(child.tagName)) {
      child.remove();
      continue;
    }
    if (!ALLOWED.has(child.tagName)) {
      clean(child);
      child.replaceWith(...child.childNodes);
      continue;
    }
    const href = child.tagName === 'A' ? child.getAttribute('href') || '' : '';
    for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
    if (child.tagName === 'A') {
      if (/^(https?:|mailto:)/i.test(href.trim())) {
        child.setAttribute('href', href.trim());
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      } else {
        clean(child);
        child.replaceWith(...child.childNodes);
        continue;
      }
    }
    clean(child);
  }
}

/** Returns a DocumentFragment that is safe to append. */
export function sanitizeToFragment(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html || '').replace(/\n/g, '<br>')}</body>`, 'text/html');
  clean(doc.body);
  const frag = document.createDocumentFragment();
  frag.append(...doc.body.childNodes);
  return frag;
}
