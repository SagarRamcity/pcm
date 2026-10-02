const KEY = 'indiaQuizState', LEVELS = 10, PER_LEVEL = 10, LIMIT = 20;
const $ = (id) => document.getElementById(id);
const fresh = () => ({ unlocked: 1, rating: {}, lastSet: {}, lastVariant: {} });
let bank = [], state = load(), run = null, timer = null;

function load() {
  try { return Object.assign(fresh(), JSON.parse(sessionStorage.getItem(KEY))); } catch { return fresh(); }
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

function show(view) {
  ['levels-view', 'quiz-view', 'result-view'].forEach((id) => { $(id).hidden = id !== view; });
}

function renderLevels() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (let n = 1; n <= LEVELS; n++) {
    const b = document.createElement('button');
    const locked = n > state.unlocked, done = n < state.unlocked;
    b.type = 'button';
    b.className = 'level' + (done ? ' done' : '');
    b.disabled = locked;
    b.textContent = locked ? `Level ${n} (locked)` : done ? `Level ${n} (done)` : `Level ${n}`;
    b.addEventListener('click', () => startLevel(n));
    grid.appendChild(b);
  }
  show('levels-view');
}

/* Ratings: 0 = easy (<=7s), 1 = medium (<=15s or unseen), 2 = difficult (slow, wrong, timeout).
   Early levels favour easy questions, final levels favour difficult ones.
   Questions used in the last attempt of this level are pushed down so replays differ. */
function pickQuestions(level) {
  const target = ((level - 1) / (LEVELS - 1)) * 2;
  const last = state.lastSet[level] || [];
  return bank
    .map((q) => ({ q, s: Math.abs((state.rating[q.id] ?? 1) - target) + Math.random() * 1.2 + (last.includes(q.id) ? 3 : 0) }))
    .sort((a, b) => a.s - b.s).slice(0, PER_LEVEL).map((x) => x.q);
}

function startLevel(level) {
  const list = pickQuestions(level);
  state.lastSet[level] = list.map((q) => q.id);
  save();
  run = { level, list, i: 0, score: 0 };
  show('quiz-view');
  nextQuestion();
}

function nextQuestion() {
  if (run.i >= PER_LEVEL) return finishLevel();
  const q = run.list[run.i];
  const variants = [0, 1, 2].filter((v) => v !== state.lastVariant[q.id]);
  const v = variants[Math.random() * variants.length | 0];
  state.lastVariant[q.id] = v;
  const correct = 'ABCD'.indexOf(q.answer);
  const opts = shuffle(q.options.map((text, idx) => ({ text, ok: idx === correct })));
  run.current = { q, opts, start: Date.now(), locked: false };

  $('level-label').textContent = `Level ${run.level}`;
  $('count-label').textContent = `Question ${run.i + 1} of ${PER_LEVEL}`;
  $('question').textContent = q.questions[v];
  $('message').textContent = '';
  const box = $('options');
  box.innerHTML = '';
  opts.forEach((o, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    b.textContent = o.text;
    b.addEventListener('click', () => answer(idx));
    box.appendChild(b);
  });
  clearInterval(timer);
  timer = setInterval(tick, 100);
  tick();
}

function tick() {
  const used = (Date.now() - run.current.start) / 1000;
  $('timer-bar').style.width = Math.max(0, 100 - (used / LIMIT) * 100) + '%';
  $('timer-bar').className = used > 15 ? 'hot' : used > 7 ? 'warm' : '';
  $('timer-label').textContent = Math.max(0, Math.ceil(LIMIT - used)) + 's';
  if (used >= LIMIT) answer(-1);
}

function answer(idx) {
  const c = run.current;
  if (c.locked) return;
  c.locked = true;
  clearInterval(timer);
  const secs = (Date.now() - c.start) / 1000;
  const right = idx >= 0 && c.opts[idx].ok;
  state.rating[c.q.id] = right ? (secs <= 7 ? 0 : secs <= 15 ? 1 : 2) : 2;
  if (right) run.score++;
  [...$('options').children].forEach((b, i) => {
    b.disabled = true;
    if (c.opts[i].ok) b.classList.add('correct');
    else if (i === idx) b.classList.add('wrong');
  });
  $('message').textContent = right ? `Correct, in ${secs.toFixed(1)}s.` : idx < 0 ? 'Time is up. The correct answer is highlighted.' : 'Not quite. The correct answer is highlighted.';
  save();
  run.i++;
  setTimeout(nextQuestion, 1500);
}

function finishLevel() {
  const { level, score } = run, passed = score === PER_LEVEL, last = level === LEVELS;
  show('result-view');
  $('result-view').classList.toggle('win', passed);
  const primary = $('result-primary');
  if (passed) {
    state.unlocked = Math.min(LEVELS, Math.max(state.unlocked, level + 1));
    save();
    $('result-title').textContent = last ? 'You completed every level!' : `Level ${level} cleared!`;
    $('result-text').textContent = last ? 'Perfect score on the final level. You know your India.' : `10 out of 10. Level ${level + 1} is now unlocked.`;
    primary.textContent = last ? 'Play again from level 10' : `Start level ${level + 1}`;
    primary.onclick = () => startLevel(last ? level : level + 1);
    celebrate(last);
  } else {
    $('result-title').textContent = `Level ${level} not cleared`;
    $('result-text').textContent = `You scored ${score} out of ${PER_LEVEL}. All 10 must be correct to move on. Retrying brings a fresh set of questions.`;
    primary.textContent = 'Retry level ' + level;
    primary.onclick = () => startLevel(level);
  }
}

function celebrate(grand) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('confetti'), g = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const colors = ['#ff9933', '#ffffff', '#138808', '#31533a', '#e0b84a', '#c2410c'];
  const ps = Array.from({ length: grand ? 450 : 200 }, () => ({
    x: Math.random() * c.width, y: -Math.random() * c.height * 0.6,
    vx: Math.random() * 4 - 2, vy: 2 + Math.random() * 4, s: 6 + Math.random() * 8,
    r: Math.random() * 6, c: colors[Math.random() * colors.length | 0]
  }));
  let f = 0;
  (function frame() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.r += 0.12;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); g.restore();
    });
    if (++f < (grand ? 400 : 260)) requestAnimationFrame(frame); else g.clearRect(0, 0, c.width, c.height);
  })();
}

$('result-menu').addEventListener('click', renderLevels);
$('reset-button').addEventListener('click', () => { state = fresh(); save(); renderLevels(); });

fetch('questions.json')
  .then((r) => r.json())
  .then((data) => { bank = data; renderLevels(); })
  .catch(() => {
    $('load-error').hidden = false;
    $('load-error').textContent = 'Could not load questions.json. Open this page through a local server (for example: python3 -m http.server) instead of double-clicking the file.';
  });
