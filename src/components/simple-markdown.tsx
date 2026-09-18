import type { ReactNode } from "react";

const LIST_RE = /^\s*([-*•]|\d+[.)])\s+/;
const HEADING_RE = /^#{1,6}\s+/;
/** En linje som bare er fet tekst, f.eks. **Hva jeg ser**, brukes som overskrift. */
const BOLD_LINE_RE = /^\*\*[^*]+\*\*:?$/;

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

function renderList(lines: string[], key: string): ReactNode {
  const ordered = /^\s*\d+[.)]/.test(lines[0]);
  const items = lines.map((l, i) => <li key={i}>{inline(l.replace(LIST_RE, ""))}</li>);
  return ordered ? (
    <ol key={key} className="my-1.5 list-decimal space-y-1 pl-5">
      {items}
    </ol>
  ) : (
    <ul key={key} className="my-1.5 list-disc space-y-1 pl-5">
      {items}
    </ul>
  );
}

/**
 * Enkel gjengivelse av avsnitt, punktlister, overskrifter og fet tekst. Nok for svarene fra KI-assistenten.
 * Linjer i samme avsnitt kan blande overskrift, tekst og punkter; hver del gjengis for seg.
 */
export function SimpleMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length === 0) return null;
        const out: ReactNode[] = [];
        let textLines: string[] = [];
        let listLines: string[] = [];
        const flushText = () => {
          if (textLines.length === 0) return;
          const key = `${bi}-p${out.length}`;
          out.push(
            <p key={key} className="my-1.5">
              {textLines.map((l, i) => (
                <span key={i}>
                  {inline(l)}
                  {i < textLines.length - 1 && <br />}
                </span>
              ))}
            </p>
          );
          textLines = [];
        };
        const flushList = () => {
          if (listLines.length === 0) return;
          out.push(renderList(listLines, `${bi}-l${out.length}`));
          listLines = [];
        };
        for (const line of lines) {
          const trimmed = line.trim();
          if (LIST_RE.test(line)) {
            flushText();
            listLines.push(line);
          } else if (HEADING_RE.test(trimmed) || BOLD_LINE_RE.test(trimmed)) {
            flushText();
            flushList();
            const label = trimmed.replace(HEADING_RE, "").replace(/^\*\*|\*\*:?$/g, "");
            out.push(
              <p key={`${bi}-h${out.length}`} className="mt-2.5 mb-0.5 font-semibold">
                {label}
              </p>
            );
          } else {
            flushList();
            textLines.push(line);
          }
        }
        flushText();
        flushList();
        return out;
      })}
    </div>
  );
}
