/**
 * Lightweight markdown → HTML converter for AI responses.
 * Handles: headings, bold, italic, inline code, code blocks,
 * unordered/ordered lists, horizontal rules, and paragraphs.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const closeList = () => {
    if (inList) {
      out.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }
  };

  for (const raw of lines) {
    const line = raw;

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push(`<pre class="ai-code">${esc(codeLines.join("\n"))}</pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.trim() === "") {
      closeList();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push("<hr/>");
      continue;
    }

    const h3 = line.match(/^###\s+(.+)/);
    if (h3) { closeList(); out.push(`<h4 class="ai-h">${inline(h3[1])}</h4>`); continue; }

    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { closeList(); out.push(`<h3 class="ai-h">${inline(h2[1])}</h3>`); continue; }

    const h1 = line.match(/^#\s+(.+)/);
    if (h1) { closeList(); out.push(`<h3 class="ai-h">${inline(h1[1])}</h3>`); continue; }

    const ul = line.match(/^[-*]\s+(.+)/);
    if (ul) {
      if (inList !== "ul") { closeList(); out.push("<ul>"); inList = "ul"; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)/);
    if (ol) {
      if (inList !== "ol") { closeList(); out.push("<ol>"); inList = "ol"; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  if (inCodeBlock && codeLines.length > 0) {
    out.push(`<pre class="ai-code">${esc(codeLines.join("\n"))}</pre>`);
  }

  return out.join("");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let r = esc(s);
  r = r.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  r = r.replace(/__(.+?)__/g, "<strong>$1</strong>");
  r = r.replace(/\*(.+?)\*/g, "<em>$1</em>");
  r = r.replace(/_(.+?)_/g, "<em>$1</em>");
  r = r.replace(/`(.+?)`/g, '<code class="ai-inline-code">$1</code>');
  return r;
}
