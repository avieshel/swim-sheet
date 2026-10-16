// The playground page, kept apart from the server so its inline script can be
// syntax-checked in tests.
//
// This is a template literal, so any escape the browser should receive has to be
// doubled here: a stray \n becomes a real newline in the emitted JavaScript and
// breaks the whole script into a parse error, which silently disables every
// button on the page.

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Session draft playground</title>
<style>
  :root {
    --bg: #12131a; --panel: #1b1d27; --line: #2c2f3d; --text: #e8e9f0;
    --dim: #9aa0b5; --accent: #8ab4ff; --good: #4ade80; --bad: #f87171; --warn: #fbbf24;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 14px/1.5 system-ui, -apple-system, sans-serif; }
  header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px;
           flex-wrap: wrap; padding: 10px 16px; background: var(--panel);
           border-bottom: 1px solid var(--line); }
  h1 { font-size: 15px; margin: 0; font-weight: 600; }
  .meta { color: var(--dim); font-size: 12px; font-family: var(--mono); }
  .grow { flex: 1; }
  button { font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid var(--line);
           background: #262a38; color: var(--text); padding: 7px 13px; }
  button:hover { background: #303549; }
  button.primary { background: var(--accent); color: #10131d; border-color: transparent; font-weight: 600; }
  button.primary:disabled { opacity: .5; cursor: not-allowed; }
  main { display: grid; grid-template-columns: minmax(340px, 42%) 1fr; gap: 14px; padding: 14px;
         align-items: start; height: calc(100vh - 53px); }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; height: auto; } }
  .left { display: flex; flex-direction: column; gap: 10px; height: 100%; }
  textarea { width: 100%; flex: 1; min-height: 160px; resize: vertical; background: #0e0f15;
             color: var(--text); border: 1px solid var(--line); border-radius: 10px; padding: 11px;
             font: 13px/1.55 var(--mono); }
  textarea:focus { outline: none; border-color: var(--accent); }
  .hint { color: var(--dim); font-size: 12px; }
  .right { overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px; }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
    .group { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
    .group > h2 { margin: 0; padding: 9px 13px; font-size: 11px; text-transform: uppercase;
                  letter-spacing: .09em; color: var(--dim); background: #15171f;
                  border-bottom: 1px solid var(--line); font-weight: 700; }
    .group > h2 .badge { float: right; color: var(--dim); font-weight: 500;
                         letter-spacing: 0; text-transform: none; }
    .group section { border: 0; border-radius: 0; border-top: 1px solid var(--line); }
    .group section:first-of-type { border-top: 0; }
  summary { cursor: pointer; padding: 9px 13px; font-weight: 600; font-size: 12px;
           text-transform: uppercase; letter-spacing: .05em; color: var(--dim);
           list-style: none; display: flex; align-items: center; gap: 8px; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: '▸'; color: var(--dim); transition: transform .12s; }
  details[open] summary::before { transform: rotate(90deg); }
  .body { padding: 0 13px 12px; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.5 var(--mono);
        color: #cdd2e4; max-height: 380px; overflow: auto; }
  .tag { font-size: 11px; padding: 2px 7px; border-radius: 999px; font-weight: 600;
         letter-spacing: .03em; }
  .tag.good { background: rgba(74,222,128,.15); color: var(--good); }
  .tag.bad { background: rgba(248,113,113,.15); color: var(--bad); }
  .tag.warn { background: rgba(251,191,36,.15); color: var(--warn); }
  .removed { color: var(--warn); font-size: 12px; font-family: var(--mono); }
  .drill { border-left: 2px solid var(--accent); padding: 2px 0 2px 11px; margin: 9px 0; }
  .drill h4 { margin: 0 0 3px; font-size: 13px; }
  .item { color: var(--dim); font: 12px/1.6 var(--mono); }
  .empty { color: var(--dim); padding: 26px 13px; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>Session draft playground</h1>
  <span class="meta" id="meta"></span>
  <span class="grow"></span>
  <span class="meta" id="status"></span>
  <button id="examples">Examples</button>
  <button id="toggle">Collapse all</button>
  <button id="clear">Clear</button>
</header>
<main>
  <div class="left">
    <textarea id="prompt" placeholder="Type a coach request, e.g.&#10;4 x 100m freestyle, the last one with fins.&#10;&#10;Ctrl+Enter to send."></textarea>
    <div style="display:flex; gap:10px; align-items:center;">
      <button class="primary" id="send">Send</button>
      <span class="hint">One provider call per send. Expect ~20-50s locally.</span>
    </div>
  </div>
  <div class="right" id="out">
    <div class="empty">No run yet. Type a coach request and press Send.</div>
  </div>
</main>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
const panel = (title, body, open = true, tag = '') =>
  '<details' + (open ? ' open' : '') + '><summary>' + esc(title) + tag + '</summary><div class="body">' + body + '</div></details>';

const EXAMPLES = [
  '4 x 100m freestyle, the last one with fins.',
  '3 x 100m: first easy, second medium, third hard. All freestyle.',
  'A 2000m aerobic set for a club squad: 300 free warmup, then 10x100 freestyle on 1:40 at moderate effort, finish with 4x50 backstroke easy.',
  'Sarah Chen: 8x50 on 1:20, last four with paddles',
  'What is the weather like today?',
];

async function boot() {
  const r = await fetch('/api/config');
  const c = await r.json();
  $('meta').textContent = c.model + ' · ' + c.baseUrl + ' · ' + c.poolLength + c.distanceUnits
    + ' · equipment: ' + (c.equipment.join(', ') || 'none')
    + (c.knownNames.length ? ' · redacting: ' + c.knownNames.join(', ') : '');
}

function renderDraft(draft) {
  return draft.drills.map((d) => {
    const sets = d.repeatCount > 1 ? ' <span class="item">' + d.repeatCount + ' sets</span>' : '';
    return '<div class="drill"><h4>' + esc(d.name) + sets + '</h4>' +
      d.items.map((i) => '<div class="item">' + esc([i.distance + 'm', i.stroke, 'x' + i.repeatCount,
        i.intensity || '-', i.interval || '', (i.equipment || []).join('+')].filter(Boolean).join('  ')) + '</div>').join('') +
      '</div>';
  }).join('');
}

async function send() {
  const text = $('prompt').value.trim();
  if (!text) return;
  $('send').disabled = true;
  $('status').textContent = 'running…';
  $('out').innerHTML = '<div class="empty">Waiting for the model…</div>';
  let d;
  try {
    const r = await fetch('/api/draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
    });
    d = await r.json();

    const removed = d.sanitized.removedCategories.length
      ? ' <span class="removed">removed: ' + esc(d.sanitized.removedCategories.join(', ')) + '</span>' : '';
    const group = (title, badge, body) =>
      '<div class="group"><h2>' + title + '<span class="badge">' + badge + '</span></h2>' + body + '</div>';

    const planBody = Array.isArray(d.plan) && d.plan.length
      ? '<pre>' + d.plan.map((l) => '\u2022 ' + esc(l)).join('\\n') + '</pre>'
      : '<p class="empty" style="padding:12px 0">No plan returned — this model did not emit one.</p>';

    const request = group('Agent &rarr; request', esc(d.model),
      panel('Coach input (sanitised)', '<pre>' + esc(d.sanitized.text) + '</pre>' + removed, true)
      + panel('Context sent', '<pre>' + esc(d.userContent) + '</pre>', true)
      + panel('System prompt', '<pre>' + esc(d.systemPrompt) + '</pre>', true,
          ' <span class="meta">' + d.systemPrompt.length + ' chars</span>'));

    const planGroup = group('Agent &rarr; plan', Array.isArray(d.plan) ? d.plan.length + ' lines' : 'none',
      panel('How the agent read the request', planBody, true));

    const toolGroup = group('Agent &rarr; tools', 'none', panel('Tool calls',
      '<p class="empty" style="padding:12px 0">No tools yet. Library lookup will show here.</p>', true));

    let verdict;
    if (d.error) {
      verdict = '<span class="tag bad">provider ' + esc(d.error.kind) + '</span><pre>' + esc(d.error.message) + '</pre>';
    } else if (d.validation && !d.validation.ok) {
      verdict = '<span class="tag bad">rejected &middot; ' + esc(d.validation.code) + '</span>'
        + (d.validation.advice ? '<p style="margin:6px 0 0">' + esc(d.validation.advice) + '</p>' : '')
        + '<pre style="margin-top:8px">' + esc(d.validation.message) + '</pre>';
    } else if (d.outcome === 'not_actionable') {
      verdict = '<span class="tag warn">not_actionable</span><pre>' + esc(d.message) + '</pre>';
    } else {
      const sm = d.summary;
      verdict = '<span class="tag good">draft</span> <span class="meta">'
        + sm.drills + ' drills &middot; ' + sm.items + ' items &middot; ' + sm.totalDistance + 'm</span>'
        + renderDraft(d.raw.draft);
    }

    const result = group('Model &rarr; result', esc((d.elapsedMs / 1000).toFixed(1) + 's'),
      panel('Verdict', verdict, true)
      + panel('Drills (matching notation)',
          '<pre>' + (d.lines || []).map(esc).join('\\n') + '</pre>', true)
      + panel('Raw model output', '<pre>' + esc(JSON.stringify(d.raw, null, 2)) + '</pre>', false));

    const parts = [request, planGroup, toolGroup, result];

    $('out').innerHTML = parts.join('');
  } catch (e) {
    $('out').innerHTML = '<div class="empty">' + esc(String(e)) + '</div>';
    $('status').textContent = 'failed';
    $('send').disabled = false;
    return;
  }
  $('send').disabled = false;
  $('status').textContent = (d.elapsedMs / 1000).toFixed(1) + 's'
    + (d.ok ? '' : ' · not usable');
}

$('send').onclick = send;
$('prompt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
});
$('clear').onclick = () => {
  $('prompt').value = '';
  $('out').innerHTML = '<div class="empty">Cleared. Type a coach request and press Send.</div>';
  $('status').textContent = '';
};
$('toggle').onclick = () => {
  const open = $('out').querySelectorAll('details[open]').length;
  $('out').querySelectorAll('details').forEach((d) => { d.open = open === 0; });
  $('toggle').textContent = open === 0 ? 'Collapse all' : 'Expand all';
};
$('examples').onclick = () => {
  $('prompt').value = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
  $('prompt').focus();
};
boot();
</script>
</body>
</html>
`;
