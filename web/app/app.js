/**
 * JumpNet Web Application
 * Single-page app served from Express.
 * All data comes from the local JumpNet REST API — no external CDN or network.
 */

import { renderHome }       from './pages/home.js';
import { renderLessons,   renderLesson   } from './pages/lessons.js';
import { renderExamples,  renderExample  } from './pages/examples.js';
import { renderDemos,     renderDemo     } from './pages/demos.js';
import { renderChallenges,renderChallenge} from './pages/challenges.js';
import { renderClassify }   from './pages/classify.js';
import { renderDataset }    from './pages/dataset.js';
import { renderTrain   }    from './pages/train.js';
import { renderStatus  }    from './pages/status.js';

// ── State ─────────────────────────────────────────────────────────────────────
const state = { page: 'home', subId: null };

// ── DOM refs ──────────────────────────────────────────────────────────────────
const container  = document.getElementById('page-container');
const navLinks   = document.querySelectorAll('.nav-link');
const statusDot  = document.getElementById('status-dot');
const menuToggle = document.getElementById('menu-toggle');
const sidebar    = document.getElementById('sidebar');

// ── Router ────────────────────────────────────────────────────────────────────
const PAGES = {
  home:       (el, subId, nav) => renderHome(el, subId, nav),
  lessons:    (el, subId, nav) => subId ? renderLesson(el, subId, nav)    : renderLessons(el, subId, nav),
  examples:   (el, subId, nav) => subId ? renderExample(el, subId, nav)   : renderExamples(el, subId, nav),
  demos:      (el, subId, nav) => subId ? renderDemo(el, subId, nav)      : renderDemos(el, subId, nav),
  challenges: (el, subId, nav) => subId ? renderChallenge(el, subId, nav) : renderChallenges(el, subId, nav),
  classify:   (el, subId, nav) => renderClassify(el, subId, nav),
  dataset:    (el, subId, nav) => renderDataset(el, subId, nav),
  train:      (el, subId, nav) => renderTrain(el, subId, nav),
  status:     (el, subId, nav) => renderStatus(el, subId, nav),
};

export function navigate(page, subId = null) {
  state.page  = page;
  state.subId = subId;

  // Update active nav link
  navLinks.forEach(l => l.classList.toggle('active', l.dataset.page === page));

  // Close sidebar on mobile after navigation
  sidebar.classList.remove('open');

  // Render
  container.innerHTML = '';
  const renderer = PAGES[page];
  if (renderer) renderer(container, subId, navigate);

  // Scroll to top
  document.getElementById('main').scrollTo(0, 0);
}

// ── Nav click handler ─────────────────────────────────────────────────────────
navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigate(link.dataset.page);
  });
});

// ── Mobile menu ───────────────────────────────────────────────────────────────
menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
document.addEventListener('click', e => {
  if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuToggle) {
    sidebar.classList.remove('open');
  }
});

// ── Status polling ────────────────────────────────────────────────────────────
async function pollStatus() {
  try {
    const r = await fetch('/status', { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const ok = d?.jumpnet?.status === 'ok';
    statusDot.className = ok ? 'ok' : 'error';
    statusDot.title = ok ? 'Server online' : 'Server error';
  } catch {
    statusDot.className = 'error';
    statusDot.title = 'Server unreachable';
  }
}
pollStatus();
setInterval(pollStatus, 15000);

// ── Toast utility (exported for pages) ───────────────────────────────────────
export function toast(msg, type = 'info', duration = 3500) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Initial render ────────────────────────────────────────────────────────────
navigate('home');
