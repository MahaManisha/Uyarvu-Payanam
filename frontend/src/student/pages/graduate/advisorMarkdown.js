/**
 * advisorMarkdown.js
 *
 * Small, deliberately narrow normalizer for AI Advisor responses.
 *
 * It only fixes the known display quirks of the model output — it does NOT
 * parse or enable raw HTML (react-markdown strips HTML unless rehype-raw is
 * added, which we intentionally do not do).
 *
 *  1. Literal <br>, <br/>, <br /> strings  →  a real line break (\n)
 *  2. "•", "·", "▪" bullet glyphs at line start  →  Markdown list items ("- ")
 *  3. Runs of 3+ newlines  →  a single blank line (clean paragraph spacing)
 */
export function normalizeAdvisorMarkdown(input) {
  let text = typeof input === 'string' ? input : input == null ? '' : String(input)
  if (!text) return ''

  // 1. Literal multi-variant <br> tags become line breaks.
  text = text.replace(/<br\s*\/?>/gi, '\n')

  // 2. Decorative bullets at the start of a line become proper list items.
  text = text.replace(/^[ \t]*[•·▪◦‣∙][ \t]+/gm, '- ')

  // 3. Collapse excessive blank lines so paragraphs keep even spacing.
  text = text.replace(/\n{3,}/g, '\n\n')

  return text
}
