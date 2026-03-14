/** Home page */
export function renderHome(el, _subId, navigate) {
  el.innerHTML = `
    <div class="hero">
      <h1>⚡ Welcome to JumpNet</h1>
      <p class="page-subtitle">
        A portable AI learning platform — collect data, train models,
        and classify objects, all without an internet connection.
      </p>
      <div class="btn-group">
        <button class="btn btn-primary" data-goto="lessons">Start Learning</button>
        <button class="btn btn-secondary" data-goto="classify">Try Classify</button>
      </div>
    </div>

    <div class="section-header">
      <h2>Get Started</h2>
      <a href="#" data-goto="lessons">View all →</a>
    </div>
    <div class="card-grid" id="featured-lessons"></div>

    <div class="section-header">
      <h2>Featured Examples</h2>
      <a href="#" data-goto="examples">View all →</a>
    </div>
    <div class="card-grid" id="featured-examples"></div>

    <div class="section-header">
      <h2>Quick Tools</h2>
    </div>
    <div class="card-grid">
      <a class="card-link" data-goto="classify">
        <span class="card-icon">🔍</span>
        <div class="card-title">Classify an Image</div>
        <div class="card-desc">Upload or capture an image and classify it against a trained model.</div>
      </a>
      <a class="card-link" data-goto="dataset">
        <span class="card-icon">🗂️</span>
        <div class="card-title">Manage Datasets</div>
        <div class="card-desc">Browse, upload, and organise training images for your models.</div>
      </a>
      <a class="card-link" data-goto="status">
        <span class="card-icon">📡</span>
        <div class="card-title">System Status</div>
        <div class="card-desc">Check server health, connected devices, and hardware capabilities.</div>
      </a>
    </div>
  `;

  // Wire navigation buttons
  el.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      navigate(btn.dataset.goto);
    });
  });

  // Inject a few featured content cards
  populateFeatured(el, navigate);
}

function populateFeatured(el, navigate) {
  const lessons = getFeaturedLessons();
  const examples = getFeaturedExamples();

  const llEl = el.querySelector('#featured-lessons');
  lessons.forEach(item => {
    llEl.innerHTML += cardHTML(item, 'lesson', () => navigate('lessons', item.id));
  });

  const exEl = el.querySelector('#featured-examples');
  examples.forEach(item => {
    exEl.innerHTML += cardHTML(item, 'example', () => navigate('examples', item.id));
  });

  // Re-wire after innerHTML set
  el.querySelectorAll('.card-link[data-content]').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      const [section, id] = card.dataset.content.split(':');
      navigate(section, id);
    });
  });
}

function cardHTML(item, badgeClass, _fn) {
  return `
    <a class="card-link" href="#" data-content="${badgeClass}s:${item.id}">
      <span class="card-icon">${item.icon}</span>
      <div class="card-title">${item.title}</div>
      <div class="card-desc">${item.desc}</div>
      <span class="card-badge badge-${badgeClass}">${badgeClass.charAt(0).toUpperCase() + badgeClass.slice(1)}</span>
    </a>`;
}

function getFeaturedLessons() {
  return [
    { id: 'what-is-ml',       icon: '🧠', title: 'What is Machine Learning?', desc: 'A gentle introduction to how computers learn from examples.' },
    { id: 'image-class',       icon: '🖼️', title: 'Image Classification',       desc: 'Learn how models learn to tell objects apart.' },
    { id: 'training-workflow', icon: '🔄', title: 'The Training Workflow',      desc: 'Collect data → Train → Evaluate → Deploy.' },
  ];
}

function getFeaturedExamples() {
  return [
    { id: 'sorting-beads', icon: '🔴', title: 'Sorting Coloured Beads', desc: 'Classic beginner project using colour as the distinguishing feature.' },
    { id: 'rock-paper',    icon: '✊', title: 'Rock Paper Scissors',    desc: 'Hand-gesture classification with the camera.' },
    { id: 'leaves',        icon: '🍃', title: 'Plant Leaf Identification',desc: 'Distinguish healthy vs stressed leaves.' },
  ];
}
