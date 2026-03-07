

/**
 * client.js — منطق العميل للعبة رواق
 * يدير: الاتصال، الشاشات، المؤقتات، الأصوات، والتأثيرات
 */

const socket = io({ reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1500 });

// ─── الحالة ───────────────────────────────────────────────
const state = {
  role: null, pin: null, name: null, score: 0,
  timerInterval: null, nextCountdown: null, answered: false,
  questionCount: 10
};

// ─── الأصوات بـ Web Audio API ────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);

    if (type === 'correct') {
      o.type = 'sine';
      o.frequency.setValueAtTime(523, ctx.currentTime);
      o.frequency.setValueAtTime(659, ctx.currentTime + .1);
      o.frequency.setValueAtTime(784, ctx.currentTime + .2);
      g.gain.setValueAtTime(.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .5);
      o.start(); o.stop(ctx.currentTime + .5);

    } else if (type === 'wrong') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(200, ctx.currentTime);
      o.frequency.setValueAtTime(150, ctx.currentTime + .15);
      g.gain.setValueAtTime(.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .35);
      o.start(); o.stop(ctx.currentTime + .35);

    } else if (type === 'tick') {
      o.type = 'square';
      o.frequency.setValueAtTime(800, ctx.currentTime);
      g.gain.setValueAtTime(.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .05);
      o.start(); o.stop(ctx.currentTime + .05);

    } else if (type === 'warning') {
      o.type = 'square';
      o.frequency.setValueAtTime(440, ctx.currentTime);
      o.frequency.setValueAtTime(330, ctx.currentTime + .1);
      g.gain.setValueAtTime(.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .25);
      o.start(); o.stop(ctx.currentTime + .25);

    } else if (type === 'win') {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * .12);
        gain.gain.setValueAtTime(.25, ctx.currentTime + i * .12);
        gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .12 + .3);
        osc.start(ctx.currentTime + i * .12);
        osc.stop(ctx.currentTime + i * .12 + .3);
      });
      return;
    }
  } catch(e) {}
}

// ─── عبارات التشجيع ───────────────────────────────────────
const CORRECT_PHRASES = [
  '🔥 ممتاز!', '⚡ رائع!', '🎯 أحسنت!', '✨ صحيح!',
  '💪 عبقري!', '🚀 مذهل!', '👏 بالضبط!', '🌟 نجم!'
];
const WRONG_PHRASES = [
  '😅 حاول مرة ثانية!', '💡 كادت تكون!', '🤔 المرة القادمة!',
  '😬 للأسف!', '🙃 قريب!', '😤 لا تيأس!'
];
const STREAK_PHRASES = { 2: '🔥 سلسلة!', 3: '💥 ثلاثية!', 5: '⚡ لا يُصدق!', 10: '🏆 أسطورة!' };

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── الشاشات ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ─── عداد الأسئلة ────────────────────────────────────────
function changeCount(delta) {
  state.questionCount = Math.min(20, Math.max(3, state.questionCount + delta));
  document.getElementById('question-count').textContent = state.questionCount;
}

// ─── تحميل الفئات ────────────────────────────────────────
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const cats = await res.json();
    const sel = document.getElementById('category-select');
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = `${c.label} (${c.count} سؤال)`;
      sel.appendChild(opt);
    });
  } catch(e) {}
}

// ─── إنشاء غرفة ──────────────────────────────────────────
function createRoom() {
  const hostName = document.getElementById('host-name').value.trim();
  const category = document.getElementById('category-select').value;
  if (!hostName) return showToast('⚠️ أدخل اسمك أولاً');

  socket.emit('create_room', { hostName, category: category || null, questionCount: state.questionCount }, (res) => {
    if (!res.success) return showToast('❌ حدث خطأ');
    state.role = 'host'; state.pin = res.pin; state.name = hostName;
    setupLobby(res.pin, 'host');
    showScreen('screen-lobby');
  });
}

// ─── انضمام ──────────────────────────────────────────────
function joinRoom() {
  const pin = document.getElementById('join-pin').value.trim();
  const player = document.getElementById('player-name').value.trim();
  if (!pin || pin.length < 6) return showToast('⚠️ أدخل رمز الغرفة');
  if (!player) return showToast('⚠️ أدخل اسمك أولاً');

  socket.emit('join_room', { pin, playerName: player }, (res) => {
    if (!res.success) return showToast('❌ ' + res.error);
    state.role = 'player'; state.pin = pin; state.name = player;
    setupLobby(pin, 'player');
    showScreen('screen-lobby');
  });
}

function setupLobby(pin, role) {
  document.getElementById('lobby-pin').textContent = pin;
  const shareUrl = `${location.origin}?pin=${pin}`;
  document.getElementById('share-link').textContent = shareUrl;
  if (role === 'host') {
    document.getElementById('host-controls').classList.remove('hidden');
    document.getElementById('player-waiting').classList.add('hidden');
  } else {
    document.getElementById('host-controls').classList.add('hidden');
    document.getElementById('player-waiting').classList.remove('hidden');
  }
}

function copyPin() {
  const pin = document.getElementById('lobby-pin').textContent;
  navigator.clipboard.writeText(pin).then(() => showToast('📋 تم نسخ الرمز!'));
}

function startGame() { socket.emit('start_game'); }

function submitAnswer(index) {
  if (state.answered) return;
  state.answered = true;
  playSound('tick');
  socket.emit('submit_answer', { answerIndex: index });
  const btns = document.querySelectorAll('.answer-btn');
  btns.forEach((b, i) => { b.disabled = true; if (i === index) b.classList.add('selected'); });
}

// ─── المؤقت ──────────────────────────────────────────────
function startTimer(seconds, timerTextId, timerCircleId) {
  clearTimers();
  let remaining = seconds;
  const circumference = 163.4;
  const circle = document.getElementById(timerCircleId);
  const text = document.getElementById(timerTextId);

  function update() {
    if (text) text.textContent = remaining;
    if (circle) {
      circle.style.strokeDashoffset = circumference * (1 - remaining / seconds);
      circle.style.stroke = remaining <= 5 ? '#ef4444' : remaining <= 10 ? '#f59e0b' : 'var(--primary)';
    }
    if (remaining <= 5 && remaining > 0) playSound('warning');
    else if (remaining > 0) playSound('tick');
  }

  update();
  state.timerInterval = setInterval(() => {
    remaining--;
    update();
    if (remaining <= 0) clearTimers();
  }, 1000);
}

function clearTimers() {
  clearInterval(state.timerInterval);
  clearInterval(state.nextCountdown);
  state.timerInterval = null;
}

// ─── Confetti ─────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
    w: 8 + Math.random() * 8, h: 5 + Math.random() * 6,
    color: ['#7c6dfa','#fbbf24','#f472b6','#34d399','#3b82f6','#ef4444'][Math.floor(Math.random()*6)],
    speed: 2 + Math.random() * 4, angle: Math.random() * 360,
    spin: (Math.random() - .5) * 6, drift: (Math.random() - .5) * 2
  }));
  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.y += p.speed; p.x += p.drift; p.angle += p.spin;
    });
    if (pieces.some(p => p.y < canvas.height)) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
  setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height); }, 6000);
}

// ════════════════════════════════════════════════
//  أحداث Socket
// ════════════════════════════════════════════════

socket.on('player_joined', ({ players, count }) => {
  updatePlayersList(players);
  document.getElementById('player-count').textContent = count;
  if (state.role === 'host') {
    const btn = document.getElementById('start-btn');
    btn.disabled = count < 1;
    btn.textContent = count >= 1 ? `🚀 ابدأ اللعبة (${count} لاعب)` : 'انتظار اللاعبين...';
  }
});

socket.on('player_left', ({ name, players }) => {
  updatePlayersList(players);
  showToast(`👋 ${name} غادر`);
  const count = players.length;
  document.getElementById('player-count').textContent = count;
  if (state.role === 'host') {
    const btn = document.getElementById('start-btn');
    btn.disabled = count < 1;
    btn.textContent = count >= 1 ? `🚀 ابدأ اللعبة (${count} لاعب)` : 'انتظار اللاعبين...';
  }
});

function updatePlayersList(players) {
  document.getElementById('players-list').innerHTML =
    players.map(p => `<div class="player-chip">👤 ${escapeHtml(p.name)}</div>`).join('');
}

socket.on('game_started', () => showToast('🎮 بدأت اللعبة!'));

socket.on('new_question', ({ index, total, text, options, time }) => {
  state.answered = false;

  if (state.role === 'host') {
    showScreen('screen-host-question');
    document.getElementById('host-q-index').textContent = `${index + 1} / ${total}`;
    document.getElementById('host-question-text').textContent = text;
    document.getElementById('host-answer-count').textContent = `أجاب 0 / ${state.playerCount || '?'}`;

    const shapes = ['▲', '■', '●', '★'];
    document.getElementById('host-options').innerHTML = options.map((opt, i) =>
      `<div class="host-option host-option-${i}">
        <span>${shapes[i]}</span><span>${escapeHtml(opt)}</span>
      </div>`
    ).join('');

    startTimer(time, 'host-timer-text', 'host-timer-circle');

  } else {
    showScreen('screen-player-question');
    document.getElementById('player-q-index').textContent = `سؤال ${index + 1}/${total}`;
    document.getElementById('player-score-display').textContent = `نقاطك: ${state.score}`;
    document.getElementById('answer-feedback').classList.add('hidden');
    document.getElementById('player-question-box').textContent = text;

    const shapes = ['▲ ', '■ ', '● ', '★ '];
    document.querySelectorAll('.answer-btn').forEach((btn, i) => {
      btn.textContent = shapes[i] + (options[i] || '');
      btn.disabled = false;
      btn.className = `answer-btn color-${i}`;
    });

    startTimer(time, 'player-timer-text', 'player-timer-circle');
  }
});

socket.on('answer_count', ({ answered, total }) => {
  state.playerCount = total;
  document.getElementById('host-answer-count').textContent = `أجاب ${answered} / ${total}`;
});

socket.on('answer_result', ({ isCorrect, points, score, streak }) => {
  state.score = score;
  clearTimers();
  playSound(isCorrect ? 'correct' : 'wrong');

  const streakPhrase = Object.entries(STREAK_PHRASES).reverse()
    .find(([k]) => streak >= parseInt(k));

  document.getElementById('feedback-icon').textContent  = isCorrect ? '✅' : '❌';
  document.getElementById('feedback-text').textContent  = isCorrect ? randomFrom(CORRECT_PHRASES) : randomFrom(WRONG_PHRASES);
  document.getElementById('feedback-points').textContent = isCorrect ? `+${points} نقطة` : '';
  document.getElementById('feedback-streak').textContent = streakPhrase ? streakPhrase[1] : '';
  document.getElementById('answer-feedback').classList.remove('hidden');
  document.getElementById('player-score-display').textContent = `نقاطك: ${score}`;

  if (!isCorrect) {
    document.querySelectorAll('.answer-btn.selected').forEach(b => b.classList.add('wrong-answer'));
  }
});

socket.on('question_result', ({ correctIndex, leaderboard, isLast }) => {
  clearTimers();

  if (state.role === 'host') {
    document.querySelectorAll('.host-option').forEach((opt, i) => {
      if (i === correctIndex) opt.classList.add('correct');
      else opt.style.opacity = '.35';
    });
    setTimeout(() => showLeaderboard(leaderboard, isLast), 1500);
  } else {
    showLeaderboard(leaderboard, isLast);
  }
});

function showLeaderboard(leaderboard, isLast) {
  showScreen('screen-leaderboard');
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  document.getElementById('leaderboard-list').innerHTML = leaderboard.map((p, i) =>
    `<div class="lb-item">
      <span class="lb-rank">${medals[i] || i+1}</span>
      <span class="lb-name">${escapeHtml(p.name)}</span>
      <span class="lb-streak">${p.streak >= 2 ? '🔥'+p.streak : ''}</span>
      <span class="lb-score">${p.score.toLocaleString()}</span>
    </div>`
  ).join('');

  if (!isLast) {
    let secs = 5;
    document.getElementById('next-countdown').textContent = secs;
    state.nextCountdown = setInterval(() => {
      secs--;
      document.getElementById('next-countdown').textContent = secs;
      if (secs <= 0) clearInterval(state.nextCountdown);
    }, 1000);
  }
}

socket.on('game_ended', ({ winners }) => {
  clearTimers();
  showScreen('screen-end');
  playSound('win');
  launchConfetti();

  const barClass = ['first', 'second', 'third'];
  const medals   = ['🥇', '🥈', '🥉'];
  const order    = winners.length >= 2 ? [1, 0, 2] : [0];

  document.getElementById('winners-podium').innerHTML =
    order.filter(i => i < winners.length).map(i => {
      const w = winners[i];
      return `<div class="podium-item">
        <span class="podium-medal">${medals[i]}</span>
        <span class="podium-name">${escapeHtml(w.name)}</span>
        <span class="podium-score">${w.score.toLocaleString()}</span>
        <div class="podium-bar ${barClass[i]}">${i+1}</div>
      </div>`;
    }).join('');
});

socket.on('disconnect', () => showToast('⚠️ انقطع الاتصال...'));
socket.on('reconnect', () => {
  showToast('✅ تم إعادة الاتصال');
  if (state.pin && state.name && state.role === 'player') {
    socket.emit('rejoin_room', { pin: state.pin, playerName: state.name }, (res) => {
      if (res.success) { state.score = res.state.score || 0; showToast('🔄 تمت إعادة الانضمام'); }
    });
  }
});
socket.on('host_disconnected', () => {
  showToast('😢 المضيف قطع الاتصال.', 4000);
  setTimeout(() => showScreen('screen-home'), 3000);
});

// ─── التحقق من PIN في الرابط ──────────────────────────────
window.addEventListener('load', () => {
  loadCategories();
  const pin = new URLSearchParams(location.search).get('pin');
  if (pin) { document.getElementById('join-pin').value = pin; showScreen('screen-join'); }
});

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════
//  نظام الفيدباك
// ════════════════════════════════════════════════

let currentRating = 0;
const feedbackList = JSON.parse(localStorage.getItem('rawaq_feedback') || '[]');

function setRating(val) {
  currentRating = val;
  document.querySelectorAll('.star').forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
}

const FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbywetkjkkaztUeBzKFE6IzyyNMe3Wxb3Vr_oIxRqEg_o6J8YhzbqSEMwYrsQJPCDg/exec';

async function submitFeedback() {
  const name   = document.getElementById('feedback-name').value.trim() || 'مجهول';
  const text   = document.getElementById('feedback-text-input').value.trim();
  const rating = currentRating;

  if (!text)   return showToast('⚠️ اكتب رأيك أولاً');
  if (!rating) return showToast('⚠️ اختر تقييمك');

  showToast('⏳ جاري الإرسال...');

  try {
    await fetch(FEEDBACK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text, rating })
    });

    // إعادة ضبط الفورم
    document.getElementById('feedback-name').value = '';
    document.getElementById('feedback-text-input').value = '';
    setRating(0);
    currentRating = 0;

    showToast('✅ شكراً على رأيك!');
    setTimeout(() => showScreen('screen-home'), 1800);

  } catch (err) {
    showToast('❌ فشل الإرسال، تحقق من الاتصال');
  }
}
