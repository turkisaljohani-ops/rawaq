

/**
 * client.js — منطق العميل للعبة رواق
 * يدير: الاتصال بالخادم، واجهة المضيف والاعب، المؤقتات، والتأثيرات
 */

// ─── الاتصال بالخادم ───────────────────────────────────────
const socket = io({ reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1500 });

// ─── الحالة العامة ─────────────────────────────────────────
const state = {
  role: null,        // 'host' | 'player'
  pin: null,
  name: null,
  score: 0,
  currentTimer: null,
  timerInterval: null,
  answered: false,
  nextCountdown: null
};

// ─── مساعدات الشاشة ───────────────────────────────────────
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

// ─── إنشاء غرفة ───────────────────────────────────────────
function createRoom() {
  const hostName = document.getElementById('host-name').value.trim();
  if (!hostName) return showToast('⚠️ أدخل اسمك أولاً');

  socket.emit('create_room', { hostName }, (res) => {
    if (!res.success) return showToast('❌ حدث خطأ');

    state.role = 'host';
    state.pin  = res.pin;
    state.name = hostName;

    setupLobby(res.pin, 'host');
    showScreen('screen-lobby');
  });
}

// ─── الانضمام لغرفة ───────────────────────────────────────
function joinRoom() {
  const pin    = document.getElementById('join-pin').value.trim();
  const player = document.getElementById('player-name').value.trim();

  if (!pin || pin.length < 6)   return showToast('⚠️ أدخل رمز الغرفة');
  if (!player) return showToast('⚠️ أدخل اسمك أولاً');

  socket.emit('join_room', { pin, playerName: player }, (res) => {
    if (!res.success) return showToast('❌ ' + res.error);

    state.role = 'player';
    state.pin  = pin;
    state.name = player;

    setupLobby(pin, 'player');
    showScreen('screen-lobby');
  });
}

// ─── إعداد Lobby ──────────────────────────────────────────
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

// ─── بدء اللعبة (للمضيف) ──────────────────────────────────
function startGame() {
  socket.emit('start_game');
}

// ─── إرسال الإجابة ────────────────────────────────────────
function submitAnswer(index) {
  if (state.answered) return;
  state.answered = true;

  socket.emit('submit_answer', { answerIndex: index });

  // تظليل الزر المختار
  const btns = document.querySelectorAll('.answer-btn');
  btns.forEach((b, i) => {
    b.disabled = true;
    if (i === index) b.classList.add('selected');
  });
}

// ─── المؤقت المشترك ───────────────────────────────────────
function startTimer(seconds, timerTextId, timerCircleId, onExpire) {
  clearTimers();
  let remaining = seconds;
  const circumference = 163.4;
  const circle = document.getElementById(timerCircleId);
  const text   = document.getElementById(timerTextId);

  function updateTimer() {
    if (text)   text.textContent = remaining;
    if (circle) {
      const offset = circumference * (1 - remaining / seconds);
      circle.style.strokeDashoffset = offset;

      // تحذير عند 5 ثوانٍ
      if (remaining <= 5)  circle.style.stroke = '#e74c3c';
      else if (remaining <= 10) circle.style.stroke = '#f39c12';
      else                 circle.style.stroke = 'var(--primary)';
    }
  }

  updateTimer();
  state.timerInterval = setInterval(() => {
    remaining--;
    updateTimer();
    if (remaining <= 0) {
      clearTimers();
      if (onExpire) onExpire();
    }
  }, 1000);
}

function clearTimers() {
  clearInterval(state.timerInterval);
  clearTimeout(state.currentTimer);
  clearInterval(state.nextCountdown);
  state.timerInterval = null;
}

// ─── Confetti ─────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    w: 8 + Math.random() * 8,
    h: 6 + Math.random() * 6,
    color: ['#6c63ff','#ffd700','#ff6584','#2ecc71','#3498db'][Math.floor(Math.random()*5)],
    speed: 2 + Math.random() * 4,
    angle: Math.random() * 360,
    spin:  (Math.random() - .5) * 6,
    drift: (Math.random() - .5) * 2
  }));

  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.y     += p.speed;
      p.x     += p.drift;
      p.angle += p.spin;
    });
    if (pieces.some(p => p.y < canvas.height)) {
      frame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  draw();
  setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height); }, 5000);
}

// ════════════════════════════════════════════════════════════
//  أحداث Socket.io
// ════════════════════════════════════════════════════════════

// ── تحديث قائمة اللاعبين ───────────────────────────────────
socket.on('player_joined', ({ players, count }) => {
  updatePlayersList(players);
  document.getElementById('player-count').textContent = count;

  if (state.role === 'host') {
    const startBtn = document.getElementById('start-btn');
    if (count >= 1) {
      startBtn.disabled = false;
      startBtn.textContent = `🚀 ابدأ اللعبة (${count} لاعب)`;
    }
  }
});

socket.on('player_left', ({ name, players }) => {
  updatePlayersList(players);
  showToast(`👋 ${name} غادر اللعبة`);
  const count = players.length;
  document.getElementById('player-count').textContent = count;

  if (state.role === 'host') {
    const startBtn = document.getElementById('start-btn');
    if (count === 0) {
      startBtn.disabled = true;
      startBtn.textContent = 'انتظار اللاعبين...';
    } else {
      startBtn.textContent = `🚀 ابدأ اللعبة (${count} لاعب)`;
    }
  }
});

function updatePlayersList(players) {
  const list = document.getElementById('players-list');
  list.innerHTML = players.map(p =>
    `<div class="player-chip">👤 ${escapeHtml(p.name)}</div>`
  ).join('');
}

// ── بدء اللعبة ──────────────────────────────────────────────
socket.on('game_started', () => {
  showToast('🎮 بدأت اللعبة!');
});

// ── سؤال جديد ───────────────────────────────────────────────
socket.on('new_question', ({ index, total, text, options, time }) => {
  state.answered = false;

  if (state.role === 'host') {
    showScreen('screen-host-question');
    document.getElementById('host-q-index').textContent = `${index + 1} / ${total}`;
    document.getElementById('host-question-text').textContent = text;
    document.getElementById('host-answer-count').textContent = `أجاب 0 / ${state.playerCount || '?'}`;

    const shapes = ['▲', '■', '●', '★'];
    const grid   = document.getElementById('host-options');
    grid.innerHTML = options.map((opt, i) =>
      `<div class="host-option host-option-${i}">
        <span class="host-option-icon">${shapes[i]}</span>
        <span>${escapeHtml(opt)}</span>
      </div>`
    ).join('');

    startTimer(time, 'host-timer-text', 'host-timer-circle', null);

  } else {
    showScreen('screen-player-question');
    document.getElementById('player-q-index').textContent = `سؤال ${index + 1}/${total}`;
    document.getElementById('player-score-display').textContent = `نقاطك: ${state.score}`;
    document.getElementById('answer-feedback').classList.add('hidden');

    // إظهار نص السؤال للاعب
    let qTextEl = document.getElementById('player-question-text');
    if (!qTextEl) {
      qTextEl = document.createElement('div');
      qTextEl.id = 'player-question-text';
      qTextEl.style.cssText = `
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 1.25rem 1.5rem;
        margin: 0 1.5rem;
        text-align: center;
        font-size: clamp(1rem, 3vw, 1.3rem);
        font-weight: 700;
        line-height: 1.6;
      `;
      const answerButtons = document.getElementById('player-buttons');
      answerButtons.parentNode.insertBefore(qTextEl, answerButtons);
    }
    qTextEl.textContent = text;

    const shapes = ['▲ ', '■ ', '● ', '★ '];
    const btns = document.querySelectorAll('.answer-btn');
    btns.forEach((btn, i) => {
      btn.textContent   = shapes[i] + (options[i] || '');
      btn.disabled      = false;
      btn.className     = `answer-btn color-${i}`;
    });

    startTimer(time, 'player-timer-text', 'player-timer-circle', null);
  }
});

// ── عدد المجيبين (للمضيف) ──────────────────────────────────
socket.on('answer_count', ({ answered, total }) => {
  state.playerCount = total;
  document.getElementById('host-answer-count').textContent = `أجاب ${answered} / ${total}`;
});

// ── نتيجة إجابة اللاعب ─────────────────────────────────────
socket.on('answer_result', ({ isCorrect, points, score, streak }) => {
  state.score = score;
  clearTimers();

  const feedback = document.getElementById('answer-feedback');
  document.getElementById('feedback-icon').textContent   = isCorrect ? '✅' : '❌';
  document.getElementById('feedback-text').textContent   = isCorrect ? 'إجابة صحيحة!' : 'إجابة خاطئة';
  document.getElementById('feedback-points').textContent = isCorrect ? `+${points} نقطة` : '';
  document.getElementById('feedback-streak').textContent = streak >= 2 ? `🔥 سلسلة ${streak}!` : '';

  feedback.classList.remove('hidden');
  document.getElementById('player-score-display').textContent = `نقاطك: ${score}`;

  // إظهار الإجابة الصحيحة على الأزرار
  const btns = document.querySelectorAll('.answer-btn');
  btns.forEach(b => {
    if (b.classList.contains('selected') && !isCorrect) b.classList.add('wrong-answer');
  });
});

// ── نتائج السؤال والـ Leaderboard ──────────────────────────
socket.on('question_result', ({ correctIndex, leaderboard, isLast }) => {
  clearTimers();

  if (state.role === 'host') {
    // تظليل الإجابة الصحيحة
    const opts = document.querySelectorAll('.host-option');
    opts.forEach((opt, i) => {
      if (i === correctIndex) opt.classList.add('correct');
      else opt.style.opacity = '.4';
    });

    setTimeout(() => {
      showLeaderboard(leaderboard, isLast);
    }, 1500);
  } else {
    showLeaderboard(leaderboard, isLast);
  }
});

function showLeaderboard(leaderboard, isLast) {
  showScreen('screen-leaderboard');

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = leaderboard.map((p, i) =>
    `<div class="lb-item rank-${i+1}">
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

// ── نهاية اللعبة ─────────────────────────────────────────────
socket.on('game_ended', ({ winners }) => {
  clearTimers();
  showScreen('screen-end');
  launchConfetti();

  const podium = document.getElementById('winners-podium');
  const barClass  = ['first', 'second', 'third'];
  const medals    = ['🥇', '🥈', '🥉'];
  const order     = winners.length >= 2 ? [1, 0, 2] : [0]; // ترتيب المنصة: 2nd أيسر، 1st وسط

  const items = (winners.length >= 2 ? order : [0])
    .filter(i => i < winners.length)
    .map(i => {
      const w = winners[i];
      return `<div class="podium-item">
        <span class="podium-medal">${medals[i]}</span>
        <span class="podium-name">${escapeHtml(w.name)}</span>
        <span class="podium-score">${w.score.toLocaleString()}</span>
        <div class="podium-bar ${barClass[i]}">${i+1}</div>
      </div>`;
    });

  podium.innerHTML = items.join('');
});

// ── إعادة الاتصال ─────────────────────────────────────────────
socket.on('disconnect', () => {
  showToast('⚠️ انقطع الاتصال... جاري إعادة الاتصال');
});

socket.on('reconnect', () => {
  showToast('✅ تم إعادة الاتصال');
  if (state.pin && state.name && state.role === 'player') {
    socket.emit('rejoin_room', { pin: state.pin, playerName: state.name }, (res) => {
      if (res.success) {
        state.score = res.state.score || 0;
        showToast('🔄 تمت إعادة الانضمام للغرفة');
      }
    });
  }
});

socket.on('host_disconnected', () => {
  showToast('😢 المضيف قطع الاتصال. انتهت اللعبة.', 4000);
  setTimeout(() => showScreen('screen-home'), 3000);
});

// ─── التحقق من PIN في الرابط ──────────────────────────────
window.addEventListener('load', () => {
  const params = new URLSearchParams(location.search);
  const pin = params.get('pin');
  if (pin) {
    document.getElementById('join-pin').value = pin;
    showScreen('screen-join');
  }
});

// ─── مساعد HTML escape ────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
