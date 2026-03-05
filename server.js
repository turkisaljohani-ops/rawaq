/**
 * server.js — الخادم الرئيسي للعبة رواق
 * يدير: الغرف، اللاعبين، الأسئلة، النقاط، والتزامن عبر Socket.io
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 10000,
  pingInterval: 5000
});

// ─── تقديم الملفات الثابتة ───────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── بيانات الأسئلة الافتراضية ───────────────────────────
const DEFAULT_QUESTIONS = [
  {
    id: 1,
    text: 'ما هي عاصمة المملكة العربية السعودية؟',
    options: ['جدة', 'الرياض', 'مكة المكرمة', 'الدمام'],
    correct: 1,
    time: 15
  },
  {
    id: 2,
    text: 'كم عدد أيام السنة الميلادية؟',
    options: ['354', '365', '360', '370'],
    correct: 1,
    time: 10
  },
  {
    id: 3,
    text: 'ما هو أكبر كوكب في المجموعة الشمسية؟',
    options: ['زحل', 'الأرض', 'المشتري', 'أورانوس'],
    correct: 2,
    time: 15
  },
  {
    id: 4,
    text: 'من كتب رواية "ألف ليلة وليلة"؟',
    options: ['نجيب محفوظ', 'مجهول', 'طه حسين', 'جبران خليل جبران'],
    correct: 1,
    time: 20
  },
  {
    id: 5,
    text: 'ما هو الرمز الكيميائي للذهب؟',
    options: ['Ag', 'Fe', 'Au', 'Cu'],
    correct: 2,
    time: 10
  }
];

// ─── تخزين الغرف ─────────────────────────────────────────
// rooms = { [pin]: { hostId, players: {}, questions: [], state, currentQ, timer } }
const rooms = {};

// ─── توليد PIN عشوائي ─────────────────────────────────────
function generatePIN() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[pin]);
  return pin;
}

// ─── حساب النقاط حسب السرعة ──────────────────────────────
function calcScore(isCorrect, timeLeft, maxTime) {
  if (!isCorrect) return 0;
  const base = 1000;
  const bonus = Math.floor((timeLeft / maxTime) * 500);
  return base + bonus;
}

// ─── الحصول على Leaderboard ───────────────────────────────
function getLeaderboard(players, limit = 5) {
  return Object.values(players)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ name, score, streak }) => ({ name, score, streak }));
}

// ─── منطق Socket.io ──────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 اتصال جديد: ${socket.id}`);

  // ── إنشاء غرفة ─────────────────────────────────────────
  socket.on('create_room', ({ hostName, questions }, callback) => {
    const pin = generatePIN();
    const qs = (questions && questions.length > 0) ? questions : DEFAULT_QUESTIONS;

    rooms[pin] = {
      pin,
      hostId: socket.id,
      hostName,
      players: {},
      questions: qs,
      state: 'lobby',       // lobby | question | leaderboard | ended
      currentQ: -1,
      answeredCount: 0,
      timer: null
    };

    socket.join(pin);
    socket.data = { pin, role: 'host', name: hostName };

    console.log(`🏠 غرفة جديدة: ${pin} بواسطة ${hostName}`);
    callback({ success: true, pin });
  });

  // ── الانضمام لغرفة ──────────────────────────────────────
  socket.on('join_room', ({ pin, playerName }, callback) => {
    const room = rooms[pin];
    if (!room) return callback({ success: false, error: 'الغرفة غير موجودة' });
    if (room.state !== 'lobby') return callback({ success: false, error: 'اللعبة بدأت بالفعل' });

    const nameExists = Object.values(room.players).some(p => p.name === playerName);
    if (nameExists) return callback({ success: false, error: 'الاسم مستخدم بالفعل' });

    room.players[socket.id] = {
      id: socket.id,
      name: playerName,
      score: 0,
      streak: 0,
      answered: false,
      lastAnswer: null
    };

    socket.join(pin);
    socket.data = { pin, role: 'player', name: playerName };

    const playerList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
    io.to(pin).emit('player_joined', { players: playerList, count: playerList.length });

    console.log(`👤 ${playerName} انضم للغرفة ${pin}`);
    callback({ success: true, playerCount: playerList.length });
  });

  // ── بدء اللعبة ──────────────────────────────────────────
  socket.on('start_game', () => {
    const { pin, role } = socket.data || {};
    const room = rooms[pin];
    if (!room || role !== 'host') return;

    room.state = 'playing';
    console.log(`🎮 بدأت اللعبة في الغرفة ${pin}`);
    io.to(pin).emit('game_started');

    setTimeout(() => sendQuestion(pin), 1000);
  });

  // ── إرسال السؤال ────────────────────────────────────────
  function sendQuestion(pin) {
    const room = rooms[pin];
    if (!room) return;

    room.currentQ++;
    if (room.currentQ >= room.questions.length) {
      return endGame(pin);
    }

    const q = room.questions[room.currentQ];
    room.state = 'question';
    room.answeredCount = 0;
    room.questionStartTime = Date.now();

    // إعادة تعيين حالة الإجابة لكل لاعب
    Object.values(room.players).forEach(p => {
      p.answered = false;
      p.lastAnswer = null;
    });

    const questionData = {
      index: room.currentQ,
      total: room.questions.length,
      text: q.text,
      options: q.options,
      time: q.time
    };

    io.to(pin).emit('new_question', questionData);

    // مؤقت السؤال
    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => {
      if (room.state === 'question') showQuestionResult(pin);
    }, q.time * 1000 + 500);
  }

  // ── استقبال إجابة ───────────────────────────────────────
  socket.on('submit_answer', ({ answerIndex }) => {
    const { pin, role } = socket.data || {};
    const room = rooms[pin];
    if (!room || role !== 'player' || room.state !== 'question') return;

    const player = room.players[socket.id];
    if (!player || player.answered) return;

    const q = room.questions[room.currentQ];
    const elapsed = (Date.now() - room.questionStartTime) / 1000;
    const timeLeft = Math.max(0, q.time - elapsed);
    const isCorrect = answerIndex === q.correct;

    const points = calcScore(isCorrect, timeLeft, q.time);
    player.score += points;
    player.answered = true;
    player.lastAnswer = { answerIndex, isCorrect, points };

    if (isCorrect) {
      player.streak = (player.streak || 0) + 1;
    } else {
      player.streak = 0;
    }

    room.answeredCount++;

    // إشعار اللاعب بنتيجة إجابته
    socket.emit('answer_result', { isCorrect, points, score: player.score, streak: player.streak });

    // إشعار المضيف بعدد المجيبين
    const hostSocket = io.sockets.sockets.get(room.hostId);
    if (hostSocket) {
      hostSocket.emit('answer_count', {
        answered: room.answeredCount,
        total: Object.keys(room.players).length
      });
    }

    // إذا أجاب الجميع، انتقل فوراً
    if (room.answeredCount >= Object.keys(room.players).length) {
      if (room.timer) clearTimeout(room.timer);
      setTimeout(() => showQuestionResult(pin), 800);
    }
  });

  // ── عرض نتائج السؤال ────────────────────────────────────
  function showQuestionResult(pin) {
    const room = rooms[pin];
    if (!room || room.state !== 'question') return;

    room.state = 'leaderboard';
    const q = room.questions[room.currentQ];
    const leaderboard = getLeaderboard(room.players);

    io.to(pin).emit('question_result', {
      correctIndex: q.correct,
      leaderboard,
      isLast: room.currentQ === room.questions.length - 1
    });

    // الانتقال للسؤال التالي بعد 5 ثواني
    setTimeout(() => {
      if (room.currentQ < room.questions.length - 1) {
        sendQuestion(pin);
      } else {
        endGame(pin);
      }
    }, 5000);
  }

  // ── نهاية اللعبة ─────────────────────────────────────────
  function endGame(pin) {
    const room = rooms[pin];
    if (!room) return;

    room.state = 'ended';
    const finalLeaderboard = getLeaderboard(room.players, 3);

    io.to(pin).emit('game_ended', { winners: finalLeaderboard });
    console.log(`🏆 انتهت اللعبة في الغرفة ${pin}`);

    // تنظيف الغرفة بعد 10 دقائق
    setTimeout(() => {
      delete rooms[pin];
      console.log(`🗑️ حُذفت الغرفة ${pin}`);
    }, 10 * 60 * 1000);
  }

  // ── قطع الاتصال ──────────────────────────────────────────
  socket.on('disconnect', () => {
    const { pin, role, name } = socket.data || {};
    const room = rooms[pin];
    if (!room) return;

    if (role === 'player') {
      delete room.players[socket.id];
      const playerList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
      io.to(pin).emit('player_left', { name, players: playerList });
    } else if (role === 'host' && room.state === 'lobby') {
      io.to(pin).emit('host_disconnected');
      delete rooms[pin];
    }

    console.log(`❌ قطع اتصال: ${name || socket.id}`);
  });

  // ── إعادة الاتصال ────────────────────────────────────────
  socket.on('rejoin_room', ({ pin, playerName }, callback) => {
    const room = rooms[pin];
    if (!room) return callback({ success: false, error: 'الغرفة غير موجودة أو انتهت' });

    // إيجاد اللاعب القديم بالاسم
    const oldEntry = Object.entries(room.players).find(([, p]) => p.name === playerName);
    if (oldEntry) {
      const [oldId, playerData] = oldEntry;
      delete room.players[oldId];
      room.players[socket.id] = { ...playerData, id: socket.id };
    } else if (room.state === 'lobby') {
      room.players[socket.id] = { id: socket.id, name: playerName, score: 0, streak: 0, answered: false };
    } else {
      return callback({ success: false, error: 'اللعبة جارية ولا يمكن الانضمام' });
    }

    socket.join(pin);
    socket.data = { pin, role: 'player', name: playerName };

    const state = {
      roomState: room.state,
      score: room.players[socket.id].score,
      currentQ: room.currentQ,
      totalQ: room.questions.length
    };

    callback({ success: true, state });
  });
});

// ─── تشغيل الخادم ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 رواق يعمل على: http://localhost:${PORT}\n`);
});
