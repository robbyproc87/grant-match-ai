# GrantMatch AI — Jazmine's Journey — Code Export

**Export Date:** May 2, 2026
**Purpose:** Full code snapshot for review

---

## Project Summary

A single-page frontend web app serving as a grant-writing assistant for the nonprofit "Jazmine's Journey." Built as a single self-contained `index.html` file using CDN-loaded React 18, in-browser Babel JSX transpilation, and Tailwind CSS.

### File Inventory
| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 410 | Entire application (HTML + CSS + React/JSX) |
| `.replit` | 38 | Replit environment, workflow & deployment config |
| `replit.md` | — | Project documentation |

### Tech Stack
- **React 18** (UMD via unpkg CDN)
- **Babel Standalone** (in-browser JSX transpile)
- **Tailwind CSS** (CDN)
- **Google Fonts — Inter**
- No package manager, no build step, no backend

### Runtime
- Served by Python's built-in `http.server` on port `5000`
- Replit workflow: `Start application`
- Deployment target: `static` (publicDir = `.`)

---

## `.replit`

```toml
modules = ["web", "python-3.11"]
[agent]
expertMode = true

[nix]
channel = "stable-25_05"

[workflows]
runButton = "Project"

[[workflows.workflow]]
name = "Project"
mode = "parallel"
author = "agent"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Start application"

[[workflows.workflow]]
name = "Start application"
author = "agent"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "python3 -m http.server 5000"
waitForPort = 5000

[workflows.workflow.metadata]
outputType = "webview"

[[ports]]
localPort = 5000
externalPort = 80

[deployment]
deploymentTarget = "static"
publicDir = "."
```

---

## `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GrantMatch AI — Jazmine's Journey</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.45s ease forwards; }
    @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
    .pulse-dot { animation: pulse-dot 1.4s ease-in-out infinite; }
    .card-shadow { box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .purple-gradient { background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 60%, #c4b5fd 100%); }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;

    const MOCK_GRANTS = [
      {
        id: 1,
        name: 'Arizona Community Foundation – Responsive Grants',
        funder: 'Arizona Community Foundation',
        amount: '$5,000 – $25,000',
        deadline: 'Rolling (next review: May 15, 2026)',
        fit: 94,
        fitColor: '#22c55e',
        tags: ['AZ Nonprofits', 'Community Health', 'Children'],
        whyFit: 'Direct alignment with pediatric focus, AZ-based, <$500K budget, 501(c)(3) confirmed',
        standOut: ['Lead with family-impact stories (emotional specificity wins)', 'Include data: # children/families served', 'Highlight hospital partnerships as community proof'],
        requirements: ['501(c)(3) letter', 'Most recent 990', 'Board list', 'Program budget', '2-page narrative'],
        url: 'https://azfoundation.org',
      },
      {
        id: 2,
        name: 'Vitalyst Health Foundation – Community Health Grant',
        funder: 'Vitalyst Health Foundation',
        amount: '$10,000 – $50,000',
        deadline: 'June 1, 2026',
        fit: 88,
        fitColor: '#22c55e',
        tags: ['Health Equity', 'Pediatric', 'Arizona'],
        whyFit: 'Strong match on pediatric dignity + comfort care; health equity framing recommended',
        standOut: ['Frame around health equity — underserved children in hospital settings', 'Show measurable dignity outcomes (ComfyCozy units delivered)', 'Request a LOI meeting before full proposal'],
        requirements: ['Letter of Inquiry (2 pages)', '990', 'Financials', 'Logic model'],
        url: 'https://vitalysthealth.org',
      },
      {
        id: 3,
        name: "Alex's Lemonade Stand Foundation – Grant Program",
        funder: "Alex's Lemonade Stand Foundation",
        amount: '$5,000 – $50,000',
        deadline: 'July 31, 2026',
        fit: 82,
        fitColor: '#f59e0b',
        tags: ['Pediatric Cancer', 'Comfort Care', 'National'],
        whyFit: 'Pediatric oncology-adjacent mission; comfort and dignity framing is competitive here',
        standOut: ['Focus on pediatric cancer patients specifically', 'Include patient/family testimonials', 'Show longevity — 14+ year track record stands out'],
        requirements: ['Online application', 'Budget narrative', 'Org financials', 'Mission statement'],
        url: 'https://alexslemonade.org',
      },
      {
        id: 4,
        name: 'Children\'s Health Fund – Pediatric Program Grants',
        funder: 'Children\'s Health Fund',
        amount: '$15,000 – $75,000',
        deadline: 'August 15, 2026',
        fit: 76,
        fitColor: '#f59e0b',
        tags: ['Pediatric Health', 'Hospital-based', 'National'],
        whyFit: 'Hospital partnership network is a strong qualifier; comfort care model differentiates',
        standOut: ['Emphasize hospital-based delivery model', 'Quantify reach: # of hospitals, # of patients', 'Include a physician or social worker endorsement letter'],
        requirements: ['Full proposal', '501(c)(3)', '990', 'Audited financials', 'Letters of support'],
        url: 'https://childrenshealthfund.org',
      },
    ];

    const NARRATIVE_SHELL = `# Grant Application Narrative — Jazmine's Journey

## Section 1 — Organization Overview
Jazmine's Journey was founded in [year] to [mission statement]. We serve [target population] across [geography] through [core programs]. To date, we have [key impact stat]. We are a 501(c)(3) nonprofit organization [EIN: ___].

## Section 2 — Statement of Need
Children facing serious illness deserve comfort and dignity — yet [X]% of pediatric patients in hospital settings lack access to [specific need]. Without support, [consequence for families]. Jazmine's Journey has witnessed this directly: [1–2 sentence story with consent]. This grant will help us close that gap for [X families/children] in [timeframe].

## Section 3 — Program Description
This funding will support our [program name] initiative. Over [timeframe], we will:
- Deliver [X] ComfyCozy comfort kits directly to pediatric patients at [hospital partners]
- Provide [specific service] to [# of] families
- Partner with [hospital/org] to ensure [outcome]
- Expand reach to [new geography/population]

## Section 4 — Goals & Measurable Outcomes
| Goal | Metric | Timeline |
|------|--------|----------|
| Expand comfort kit delivery | 200 kits delivered to 3 partner hospitals | By December 2026 |
| Increase family reach | 150 families served (up from 100) | By Q3 2026 |
| Strengthen hospital partnerships | 2 new MOUs signed | By June 2026 |

## Section 5 — Budget Narrative
We are requesting $[amount] to cover:
- Comfort materials and kits: $[X]
- Program staff / coordination: $[X]
- Delivery and logistics: $[X]
These funds represent [X]% of this program's total budget. The remaining [X]% is supported by [other sources].

## Section 6 — Sustainability
Beyond this grant period, [program] will continue through [ongoing funding sources]. We are actively pursuing [specific efforts — additional grants, major donors, community events] to ensure long-term impact without dependence on any single funder.

## Section 7 — Closing
Jazmine's Journey is grateful for [Funder Name]'s commitment to [their stated mission area]. With your partnership, we will bring comfort and dignity to [X] more children and families in [timeframe]. Contact: [Name, title, email, phone].
`;

    const CHECKLIST = [
      { section: 'Before You Write', items: ['Read funder guidelines end-to-end', 'Confirm eligibility (geography, org type, mission)', 'Note all word/page limits', 'Set deadline reminder (work backward 5 days)'] },
      { section: 'Required Documents', items: ['IRS 501(c)(3) determination letter', 'Most recent 990 or audited financials', 'Current year organizational budget', 'Grant-specific project budget', 'Board of Directors list with affiliations', 'Letters of support from hospital partners', 'W-9'] },
      { section: 'Narrative Quality', items: ['Statement of need includes at least one data point', 'Goals are specific and measurable', 'Budget narrative matches the numbers exactly', 'Sustainability section included', 'Spell-check complete — funder name spelled correctly'] },
      { section: 'Submission', items: ['All files named per funder convention', 'PDF vs. Word format confirmed', 'Portal login tested', 'Submitted 48 hrs early (portals crash)', 'Confirmation email saved to grants folder'] },
    ];

    const CHAT_RESPONSES = {
      'stand out': 'Great question! For Jazmine\'s Journey, your top differentiators are: (1) 14+ year track record — rare for small nonprofits, (2) direct hospital partnerships = institutional credibility, (3) ComfyCozy tangible product gives funders something concrete to visualize. Lead every narrative with these three things.',
      'statement of need': 'For your statement of need, lead with a child-level story (with consent), then back it with a stat. Example: "1 in 4 pediatric patients at Arizona Children\'s Hospital reports feeling isolated during treatment. Jazmine\'s Journey has served 400 families — but hundreds more go without." Then tie it to what this grant specifically fixes.',
      'budget': 'Keep your budget narrative simple and honest. Break costs into 3–4 line items max. Include a "Other Funding" line to show you\'re not 100% dependent on this grant. Most foundations want to see you have diversified revenue — even small amounts from community events count.',
      'deadline': 'My recommendation: build a 5-day buffer. Aim to submit by [deadline minus 5 days]. Portals regularly crash the day of. Set a calendar reminder now. Draft stage should be done 10 days out so you have review time.',
      'default': 'I can help with grant strategy, narrative writing, standing out from the competition, budget framing, and submission tips. Ask me anything about any of the grants on your list, or paste a specific question from a grant application and I\'ll help you answer it.',
    };

    function FitBadge({ fit, color }) {
      return (
        <div class="flex items-center gap-1.5">
          <div class="text-sm font-bold" style={{ color }}>{fit}%</div>
          <div class="flex gap-0.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} class="w-2 h-2 rounded-full" style={{ backgroundColor: i <= Math.ceil(fit/20) ? color : '#e5e7eb' }} />
            ))}
          </div>
          <span class="text-xs text-gray-400">fit</span>
        </div>
      );
    }

    function GrantCard({ grant, onSelect, selected }) {
      return (
        <div
          onClick={() => onSelect(grant)}
          class={`bg-white rounded-2xl card-shadow p-5 cursor-pointer transition-all border-2 ${selected ? 'border-purple-500' : 'border-transparent hover:border-purple-200'}`}
        >
          <div class="flex items-start justify-between gap-3 mb-2">
            <div>
              <div class="font-semibold text-gray-900 text-sm leading-snug">{grant.name}</div>
              <div class="text-xs text-gray-400 mt-0.5">{grant.funder}</div>
            </div>
            <FitBadge fit={grant.fit} color={grant.fitColor} />
          </div>
          <div class="flex flex-wrap gap-1.5 mb-2">
            {grant.tags.map(t => <span key={t} class="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full">{t}</span>)}
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>💰 {grant.amount}</span>
            <span>📅 {grant.deadline.split('(')[0].trim()}</span>
          </div>
        </div>
      );
    }

    function App() {
      const [tab, setTab] = useState('grants');
      const [selected, setSelected] = useState(null);
      const [chatMsg, setChatMsg] = useState('');
      const [chatHistory, setChatHistory] = useState([
        { role: 'ai', text: 'Hi! I\'m your grant writing assistant for Jazmine\'s Journey. I can help with any grant on your list — strategy, narrative, standing out, budget framing, or submission tips. What do you need?' }
      ]);
      const [checkedItems, setCheckedItems] = useState({});
      const [copiedShell, setCopiedShell] = useState(false);
      const [searchRunning, setSearchRunning] = useState(false);
      const [searchDone, setSearchDone] = useState(true);

      function sendChat() {
        if (!chatMsg.trim()) return;
        const userMsg = chatMsg.trim();
        setChatHistory(h => [...h, { role: 'user', text: userMsg }]);
        setChatMsg('');
        setTimeout(() => {
          const lower = userMsg.toLowerCase();
          let resp = CHAT_RESPONSES.default;
          for (const [key, val] of Object.entries(CHAT_RESPONSES)) {
            if (key !== 'default' && lower.includes(key)) { resp = val; break; }
          }
          setChatHistory(h => [...h, { role: 'ai', text: resp }]);
        }, 900);
      }

      function toggleCheck(key) {
        setCheckedItems(c => ({ ...c, [key]: !c[key] }));
      }

      const totalItems = CHECKLIST.reduce((a, s) => a + s.items.length, 0);
      const checkedCount = Object.values(checkedItems).filter(Boolean).length;

      return (
        <div class="min-h-screen bg-gray-50">
          {/* Header */}
          <div class="purple-gradient text-white px-4 pt-8 pb-6">
            <div class="max-w-lg mx-auto">
              <div class="flex items-center gap-2 mb-4">
                <span class="text-2xl">🌈</span>
                <div>
                  <div class="font-bold text-lg leading-none">Jazmine's Journey</div>
                  <div class="text-purple-200 text-xs">GrantMatch AI — Powered by Zen Aegis</div>
                </div>
              </div>
              <h1 class="text-2xl font-extrabold mb-1">Find & Win Grants</h1>
              <p class="text-purple-100 text-sm">AI-matched funding opportunities, application shells, and a writing assistant — all in one place.</p>
              {/* Stats */}
              <div class="flex gap-4 mt-4">
                {[
                  { label: 'Matched Grants', value: MOCK_GRANTS.length },
                  { label: 'Top Fit Score', value: '94%' },
                  { label: 'Avg Award', value: '$27K' },
                ].map(s => (
                  <div key={s.label} class="bg-white/20 rounded-xl px-3 py-2 text-center flex-1">
                    <div class="text-xl font-bold">{s.value}</div>
                    <div class="text-xs text-purple-200">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div class="max-w-lg mx-auto px-4">
            <div class="flex gap-1 bg-white rounded-xl card-shadow p-1 mt-4 mb-4">
              {[
                { id: 'grants', label: '🔍 Grants', },
                { id: 'checklist', label: '✅ Checklist' },
                { id: 'narrative', label: '📝 Shell' },
                { id: 'chat', label: '💬 Chat' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  class={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${tab === t.id ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* GRANTS TAB */}
            {tab === 'grants' && (
              <div class="fade-in space-y-3 pb-8">
                <p class="text-xs text-gray-400 px-1">Sorted by fit score for Jazmine's Journey • Tap any grant for details</p>
                {MOCK_GRANTS.map(g => <GrantCard key={g.id} grant={g} onSelect={setSelected} selected={selected?.id === g.id} />)}

                {selected && (
                  <div class="bg-white rounded-2xl card-shadow p-5 border-2 border-purple-500 fade-in">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="font-bold text-gray-900 text-sm">{selected.name}</h3>
                      <button onClick={() => setSelected(null)} class="text-gray-300 hover:text-gray-500 text-lg">×</button>
                    </div>
                    <div class="space-y-3 text-sm">
                      <div class="bg-green-50 border border-green-100 rounded-xl p-3">
                        <div class="font-semibold text-green-800 text-xs mb-1">✅ Why you qualify</div>
                        <div class="text-green-700 text-xs">{selected.whyFit}</div>
                      </div>
                      <div class="bg-purple-50 border border-purple-100 rounded-xl p-3">
                        <div class="font-semibold text-purple-800 text-xs mb-1">⭐ How to stand out</div>
                        <ul class="space-y-1">
                          {selected.standOut.map((s, i) => <li key={i} class="text-purple-700 text-xs">• {s}</li>)}
                        </ul>
                      </div>
                      <div class="bg-gray-50 rounded-xl p-3">
                        <div class="font-semibold text-gray-700 text-xs mb-1">📋 Required documents</div>
                        <ul class="space-y-0.5">
                          {selected.requirements.map((r, i) => <li key={i} class="text-gray-500 text-xs">• {r}</li>)}
                        </ul>
                      </div>
                      <button
                        onClick={() => setTab('narrative')}
                        class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                      >
                        Generate Application Shell →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CHECKLIST TAB */}
            {tab === 'checklist' && (
              <div class="fade-in pb-8">
                <div class="bg-purple-600 rounded-2xl p-4 text-white text-center mb-4">
                  <div class="text-2xl font-bold">{checkedCount}/{totalItems}</div>
                  <div class="text-purple-100 text-sm">items complete</div>
                  <div class="w-full bg-white/30 rounded-full h-2 mt-2">
                    <div class="bg-white h-2 rounded-full transition-all" style={{ width: `${(checkedCount/totalItems)*100}%` }} />
                  </div>
                </div>
                {CHECKLIST.map(section => (
                  <div key={section.section} class="bg-white rounded-2xl card-shadow p-5 mb-3">
                    <h3 class="font-bold text-gray-900 text-sm mb-3">{section.section}</h3>
                    <div class="space-y-2">
                      {section.items.map(item => {
                        const key = `${section.section}-${item}`;
                        return (
                          <label key={key} class="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!checkedItems[key]}
                              onChange={() => toggleCheck(key)}
                              class="mt-0.5 accent-purple-600 flex-shrink-0"
                            />
                            <span class={`text-sm ${checkedItems[key] ? 'line-through text-gray-300' : 'text-gray-700'}`}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* NARRATIVE SHELL TAB */}
            {tab === 'narrative' && (
              <div class="fade-in pb-8">
                <div class="bg-white rounded-2xl card-shadow p-5 mb-3">
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <h3 class="font-bold text-gray-900">Grant Application Shell</h3>
                      <p class="text-xs text-gray-400">Pre-filled for Jazmine's Journey — fill in the brackets</p>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(NARRATIVE_SHELL); setCopiedShell(true); setTimeout(() => setCopiedShell(false), 2000); }}
                      class="bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copiedShell ? '✅ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                  <div class="bg-gray-50 rounded-xl p-4 overflow-auto max-h-96">
                    <pre class="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{NARRATIVE_SHELL}</pre>
                  </div>
                </div>
                <div class="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                  <p class="text-purple-800 text-xs font-semibold mb-1">💡 Pro tip</p>
                  <p class="text-purple-700 text-xs">Every [bracket] is a fill-in. Don't skip the budget narrative — it's what many reviewers read first. Keep your outcome metrics specific and countable.</p>
                </div>
              </div>
            )}

            {/* CHAT TAB */}
            {tab === 'chat' && (
              <div class="fade-in pb-8">
                <div class="bg-white rounded-2xl card-shadow overflow-hidden">
                  <div class="p-4 border-b border-gray-100">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm">🤖</div>
                      <div>
                        <div class="text-sm font-semibold text-gray-900">Grant Writing Assistant</div>
                        <div class="text-xs text-green-500">● Online</div>
                      </div>
                    </div>
                  </div>
                  <div class="p-4 space-y-3 min-h-64 max-h-80 overflow-y-auto">
                    {chatHistory.map((msg, i) => (
                      <div key={i} class={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div class={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div class="p-4 border-t border-gray-100">
                    <div class="flex gap-2">
                      <input
                        type="text" value={chatMsg}
                        onChange={e => setChatMsg(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendChat()}
                        placeholder="Ask about grants, narratives, standing out..."
                        class="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button onClick={sendChat} class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-semibold">→</button>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-2">
                      {['How do I stand out?', 'Write a statement of need', 'Budget tips', 'Submission checklist'].map(q => (
                        <button key={q} onClick={() => { setChatMsg(q); }} class="bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full hover:bg-purple-100 transition-colors">{q}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>
```

---

## Observations for Review

### Functional Status
- App loads and renders all four tabs (Grants, Checklist, Shell, Chat).
- Workflow runs successfully on port 5000 and is reachable in the Replit preview.
- Static deployment is configured (`publicDir = "."`).

### Notable Issues Visible in the Code
1. **JSX uses `class` instead of `className`** throughout the components. React logs a warning at runtime: `Invalid DOM property 'class'. Did you mean 'className'?` — this currently works because React falls back, but it is non-idiomatic and will degrade in stricter environments.
2. **CDN Tailwind in production** — Tailwind itself warns: *"cdn.tailwindcss.com should not be used in production."* Acceptable for a prototype, not for production.
3. **In-browser Babel** — Babel itself warns: *"Be sure to precompile your scripts for production."* All JSX is transpiled in the user's browser on every page load.
4. **404 in browser console** — likely a missing `favicon.ico` request to the static server. Cosmetic only.
5. **Unused state** — `searchRunning` and `searchDone` are declared in `App` but never used.
6. **Mock data only** — `MOCK_GRANTS`, `CHAT_RESPONSES`, etc. are hardcoded; the "AI" chat is keyword matching, not a real model.
7. **No accessibility/ARIA** beyond defaults; tabs are `<button>` elements but lack `role="tablist"` semantics.
8. **No persistence** — checklist progress, chat history, and selected grant are lost on reload (no localStorage).
9. **Single-file architecture** — all components, data, and logic live in one 410-line `index.html`. Fine for a prototype, hard to scale.

### Suggested Next Steps (If Productionizing)
- Migrate to Vite + React + TypeScript with proper Tailwind build.
- Replace `class` with `className`.
- Persist state to `localStorage`.
- Replace keyword chat with a real LLM call (e.g., via an integration).
- Split components into separate files; extract mock data to a JSON module.
- Add a favicon.
