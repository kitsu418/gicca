// Normalizes whatever the user pasted / uploaded into a value safe to drop
// into an <img src="…">. The user is the only consumer of their own
// IndexedDB so we don't have a real XSS surface, but we still strip
// <script> tags as a courtesy and prefer base64 data URLs over raw SVG.

export function normalizeLogoInput(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith('data:') || /^https?:\/\//i.test(t)) return t;
  let svg: string;
  if (t.startsWith('<svg')) {
    svg = t;
  } else if (t.startsWith('<')) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${t}</svg>`;
  } else {
    return null;
  }
  return svgToDataUrl(svg);
}

function svgToDataUrl(svg: string): string {
  const sanitized = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  const utf8 = unescape(encodeURIComponent(sanitized));
  return `data:image/svg+xml;base64,${btoa(utf8)}`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Best-effort detection for whether a stored merchant.logo value is
 * something <img> can render. Used to guard rendering against legacy /
 * malformed entries.
 */
export function isRenderableLogo(s: string | undefined): s is string {
  if (!s) return false;
  if (s.startsWith('data:image/')) return true;
  if (/^https?:\/\//i.test(s)) return true;
  return false;
}
