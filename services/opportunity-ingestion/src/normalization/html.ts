import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "blockquote",
  "a",
] as const;

export function sanitizeOpportunityHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [...allowedTags],
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    transformTags: {
      a: (_tagName, attributes) => {
        if (!attributes.href) return { tagName: "a", attribs: {} };
        let href: URL;
        try {
          href = new URL(attributes.href);
        } catch {
          return { tagName: "a", attribs: {} };
        }
        if (href.protocol !== "http:" && href.protocol !== "https:") {
          return { tagName: "a", attribs: {} };
        }
        return {
          tagName: "a",
          attribs: { href: href.toString(), rel: "noopener noreferrer", target: "_blank" },
        };
      },
    },
  }).trim();
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([a-f0-9]+)|amp|lt|gt|quot|apos);/giu,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return (
        { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[
          entity.toLowerCase()
        ] ?? entity
      );
    },
  );
}

export function htmlToPlainText(value: string): string {
  const text = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(text).replace(/\s+/gu, " ").trim();
}
