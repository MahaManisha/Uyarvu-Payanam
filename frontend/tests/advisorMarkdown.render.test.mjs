/**
 * Render test for the Graduate AI Advisor Markdown pipeline.
 *
 * Verifies that a representative AI response — heading, bold, paragraphs,
 * bullets, a numbered list, a Markdown table, a literal <br>, a divider and a
 * long body — is rendered as real HTML (not literal Markdown syntax) and that
 * tables are wrapped for horizontal scrolling inside the bubble.
 *
 * Run:  node tests/advisorMarkdown.render.test.mjs   (from the frontend folder)
 */
import assert from 'node:assert'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeAdvisorMarkdown } from '../src/student/pages/graduate/advisorMarkdown.js'

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed += 1
    console.log(`  FAIL  ${name}\n        ${err.message}`)
  }
}

const markdownComponents = {
  table: ({ node, ...props }) => React.createElement('div', { className: 'advisor-table-wrap' }, React.createElement('table', props)),
  a: ({ node, ...props }) => React.createElement('a', { ...props, target: '_blank', rel: 'noopener noreferrer' })
}

const sample = `## Career Options for You

You have a strong **B.E. Computer Science** background and *good* projects.

- Software Development
  - Full Stack Engineer
  - Backend Engineer
- Data & Analytics

1. Build two portfolio projects
2. Apply to ten roles each week

| Role | Core Skills | Typical Path |
| --- | --- | --- |
| Backend Engineer | Node.js, SQL | Internship first |
| Data Analyst | Python, SQL | Certification first |

Some models insert a literal <br> tag here.<br>This should be a new line.

See the [official guidance](https://example.com/careers) for details.

---

Next steps: update your resume and start applying.`

function render(text) {
  return renderToStaticMarkup(
    React.createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm, remarkBreaks],
      components: markdownComponents
    }, normalizeAdvisorMarkdown(text))
  )
}

console.log('============================================================')
console.log('GRADUATE AI ADVISOR — MARKDOWN RENDER TEST SUITE')
console.log('============================================================')

const html = render(sample)

test('heading renders as real <h2>', () => {
  assert.ok(/<h2[^>]*>Career Options for You<\/h2>/.test(html), 'missing h2 heading')
})

test('bold renders as <strong>', () => {
  assert.ok(/<strong>B\.E\. Computer Science<\/strong>/.test(html), 'missing strong')
})

test('italic renders as <em>', () => {
  assert.ok(/<em>good<\/em>/.test(html), 'missing em')
})

test('unordered list renders as <ul> with nested list', () => {
  assert.ok(/<ul>/.test(html), 'missing ul')
  assert.ok(/<ul>[\s\S]*<ul>[\s\S]*<\/ul>/.test(html), 'missing nested ul')
  assert.ok(/Backend Engineer/.test(html), 'missing list item text')
})

test('numbered list renders as <ol>', () => {
  assert.ok(/<ol>/.test(html), 'missing ol')
})

test('Markdown table renders as a real <table>, not pipe text', () => {
  assert.ok(/<table>/.test(html), 'missing table')
  assert.ok(/<th[^>]*>Role<\/th>/.test(html), 'missing th')
  assert.ok(/<td[^>]*>Backend Engineer<\/td>/.test(html), 'missing td')
  assert.ok(!/\|\s*---\s*\|/.test(html), 'pipe syntax leaked into output')
})

test('table is wrapped for horizontal scrolling', () => {
  assert.ok(/<div class="advisor-table-wrap">/.test(html), 'missing table scroll wrapper')
})

test('literal <br> is converted and never shown as raw text', () => {
  assert.ok(!/&lt;br&gt;/i.test(html), 'literal <br> leaked as escaped text')
  assert.ok(!/<br>/i.test(String(normalizeAdvisorMarkdown('a<br>b')).trim() || ''), 'normalizer left a <br>')
  assert.ok(/a\nb/.test(normalizeAdvisorMarkdown('a<br>b')), 'normalizer did not convert <br>')
  assert.ok(/a\nb/.test(normalizeAdvisorMarkdown('a<br/>b')), 'normalizer did not convert <br/>')
  assert.ok(/a\nb/.test(normalizeAdvisorMarkdown('a<br />b')), 'normalizer did not convert <br />')
})

test('decorative bullet glyphs become list items', () => {
  const out = normalizeAdvisorMarkdown('Intro:\n• First\n• Second')
  assert.ok(/- First/.test(out) && /- Second/.test(out), 'bullets not converted')
})

test('horizontal rule renders as <hr>', () => {
  assert.ok(/<hr\/?>/.test(html), 'missing hr')
})

test('links render as safe anchors opening in a new tab', () => {
  assert.ok(/<a[^>]*href="https:\/\/example\.com\/careers"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/.test(html), 'unsafe or missing link')
  assert.ok(!/javascript:/i.test(html), 'javascript: URL should not appear')
})

test('excessive blank lines collapse to single spacing', () => {
  const out = normalizeAdvisorMarkdown('a\n\n\n\n\nb')
  assert.strictEqual(out, 'a\n\nb')
})

test('long response stays inside the bubble container (wrapper present)', () => {
  const long = render(sample + '\n\n' + Array.from({ length: 40 }, (_, i) => `Paragraph ${i} discusses a specific next step for the student.`).join('\n\n'))
  assert.ok(long.length > html.length, 'long render did not grow')
  assert.ok(/advisor-table-wrap/.test(long), 'wrapper missing in long render')
})

console.log('------------------------------------------------------------')
console.log(`RESULT: ${passed} passed, ${failed} failed`)
console.log('------------------------------------------------------------')
if (failed > 0) process.exitCode = 1
