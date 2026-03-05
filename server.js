/**
 * server.js — الخادم الرئيسي للعبة رواق
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingTimeout: 10000, pingInterval: 5000 });

app.use(express.static(path.join(__dirname, 'public')));

// ─── بنك الأسئلة المصنّفة ─────────────────────────────────
const QUESTION_BANK = {
  geography: {
    label: '🌍 جغرافيا',
    questions: [
      { text: 'ما هي عاصمة المملكة العربية السعودية؟', options: ['جدة', 'الرياض', 'مكة المكرمة', 'الدمام'], correct: 1, time: 15 },
      { text: 'ما هي أكبر دولة في العالم من حيث المساحة؟', options: ['كندا', 'الصين', 'الولايات المتحدة', 'روسيا'], correct: 3, time: 15 },
      { text: 'ما هو أطول نهر في العالم؟', options: ['الأمازون', 'النيل', 'المسيسيبي', 'اليانغتسي'], correct: 1, time: 15 },
      { text: 'في أي قارة تقع مصر؟', options: ['آسيا', 'أوروبا', 'أفريقيا', 'أمريكا'], correct: 2, time: 10 },
      { text: 'ما هي عاصمة اليابان؟', options: ['أوساكا', 'كيوتو', 'طوكيو', 'هيروشيما'], correct: 2, time: 10 },
      { text: 'ما هو أعلى جبل في العالم؟', options: ['كيليمنجارو', 'إيفرست', 'ماكينلي', 'الألب'], correct: 1, time: 15 },
      { text: 'ما هي عاصمة البرازيل؟', options: ['ريو دي جانيرو', 'ساو باولو', 'برازيليا', 'سلفادور'], correct: 2, time: 15 },
      { text: 'كم عدد دول العالم تقريباً؟', options: ['157', '172', '193', '210'], correct: 2, time: 20 },
      { text: 'ما هو المحيط الأكبر في العالم؟', options: ['الأطلسي', 'الهادئ', 'الهندي', 'المتجمد'], correct: 1, time: 10 },
      { text: 'ما هي عاصمة أستراليا؟', options: ['سيدني', 'ملبورن', 'كانبيرا', 'بريزبان'], correct: 2, time: 15 },
    ]
  },
  science: {
    label: '🔬 علوم',
    questions: [
      { text: 'ما هو أكبر كوكب في المجموعة الشمسية؟', options: ['زحل', 'الأرض', 'المشتري', 'أورانوس'], correct: 2, time: 15 },
      { text: 'ما هو الرمز الكيميائي للذهب؟', options: ['Ag', 'Fe', 'Au', 'Cu'], correct: 2, time: 10 },
      { text: 'كم عدد عظام جسم الإنسان البالغ؟', options: ['196', '206', '216', '226'], correct: 1, time: 20 },
      { text: 'ما هو أسرع حيوان بري في العالم؟', options: ['الأسد', 'النمر', 'الفهد', 'الغزال'], correct: 2, time: 15 },
      { text: 'ما هو الغاز الأكثر وفرة في الغلاف الجوي؟', options: ['الأكسجين', 'النيتروجين', 'ثاني أكسيد الكربون', 'الهيدروجين'], correct: 1, time: 15 },
      { text: 'ما هي درجة غليان الماء؟', options: ['90°', '95°', '100°', '105°'], correct: 2, time: 10 },
      { text: 'كم عدد أسنان الإنسان البالغ؟', options: ['28', '30', '32', '34'], correct: 2, time: 10 },
      { text: 'ما هو أصغر كوكب في المجموعة الشمسية؟', options: ['عطارد', 'المريخ', 'الزهرة', 'بلوتو'], correct: 0, time: 15 },
      { text: 'ما الذي يدور حول الأرض؟', options: ['الشمس', 'المريخ', 'القمر', 'زحل'], correct: 2, time: 10 },
      { text: 'من اخترع المصباح الكهربائي؟', options: ['نيوتن', 'إديسون', 'تسلا', 'فاراداي'], correct: 1, time: 15 },
    ]
  },
  history: {
    label: '📜 تاريخ',
    questions: [
      { text: 'في أي عام بدأت الحرب العالمية الثانية؟', options: ['1935', '1937', '1939', '1941'], correct: 2, time: 15 },
      { text: 'من هو أول رئيس للولايات المتحدة؟', options: ['أبراهام لينكولن', 'جورج واشنطن', 'توماس جيفرسون', 'جون آدامز'], correct: 1, time: 15 },
      { text: 'في أي عام فُتحت مكة المكرمة؟', options: ['6 هـ', '7 هـ', '8 هـ', '9 هـ'], correct: 2, time: 20 },
      { text: 'من بنى الأهرامات؟', options: ['الرومان', 'اليونانيون', 'المصريون القدماء', 'الفينيقيون'], correct: 2, time: 10 },
      { text: 'في أي عام سقطت الخلافة العثمانية؟', options: ['1920', '1922', '1924', '1926'], correct: 2, time: 20 },
      { text: 'من اخترع الطباعة؟', options: ['جوتنبرغ', 'ليوناردو', 'نيوتن', 'كوبرنيكوس'], correct: 0, time: 15 },
      { text: 'أي حضارة بنت سور الصين العظيم؟', options: ['اليابانية', 'الصينية', 'المغولية', 'الكورية'], correct: 1, time: 10 },
      { text: 'في أي عام وُلد الرسول محمد ﷺ؟', options: ['570 م', '571 م', '572 م', '573 م'], correct: 1, time: 20 },
      { text: 'من كشف أمريكا؟', options: ['ماجلان', 'فاسكو دي غاما', 'كولومبوس', 'كابوت'], correct: 2, time: 15 },
      { text: 'ما هي أقدم حضارة في العالم؟', options: ['المصرية', 'الرومانية', 'السومرية', 'اليونانية'], correct: 2, time: 20 },
    ]
  },
  sports: {
    label: '⚽ رياضة',
    questions: [
      { text: 'كم عدد لاعبي كرة القدم في الفريق الواحد؟', options: ['9', '10', '11', '12'], correct: 2, time: 10 },
      { text: 'كم مدة مباراة كرة القدم الرسمية؟', options: ['80 دقيقة', '85 دقيقة', '90 دقيقة', '95 دقيقة'], correct: 2, time: 10 },
      { text: 'في أي دولة أُقيمت كأس العالم 2022؟', options: ['الإمارات', 'السعودية', 'قطر', 'البحرين'], correct: 2, time: 10 },
      { text: 'كم مرة فازت البرازيل بكأس العالم؟', options: ['3', '4', '5', '6'], correct: 2, time: 15 },
      { text: 'ما هي الرياضة التي يُلعب فيها بمضرب وريشة؟', options: ['التنس', 'البادمنتون', 'سكواش', 'تنس الطاولة'], correct: 1, time: 10 },
      { text: 'كم حلقة في الشعار الأولمبي؟', options: ['4', '5', '6', '7'], correct: 1, time: 10 },
      { text: 'أين ستُقام كأس العالم 2034؟', options: ['الإمارات', 'مصر', 'السعودية', 'المغرب'], correct: 2, time: 15 },
      { text: 'في أي رياضة يُستخدم مصطلح غراند سلام؟', options: ['كرة القدم', 'كرة السلة', 'التنس', 'الغولف'], correct: 2, time: 15 },
      { text: 'كم طول ملعب كرة القدم القياسي؟', options: ['90-100م', '95-105م', '100-110م', '105-115م'], correct: 2, time: 20 },
      { text: 'ما هو الرقم القياسي لعدد الأهداف الدولية لرونالدو؟', options: ['117', '123', '128', '130'], correct: 2, time: 20 },
    ]
  },
  culture: {
    label: '🎭 ثقافة عامة',
    questions: [
      { text: 'من كتب رواية ألف ليلة وليلة؟', options: ['نجيب محفوظ', 'مجهول', 'طه حسين', 'جبران خليل جبران'], correct: 1, time: 20 },
      { text: 'كم عدد أيام السنة الميلادية؟', options: ['354', '365', '360', '370'], correct: 1, time: 10 },
      { text: 'ما هي لغة البرمجة التي تستخدم الثعبان شعاراً؟', options: ['Java', 'Ruby', 'Python', 'Swift'], correct: 2, time: 10 },
      { text: 'كم عدد ألوان قوس قزح؟', options: ['5', '6', '7', '8'], correct: 2, time: 10 },
      { text: 'ما هي أكثر لغة منطوقة في العالم؟', options: ['الإنجليزية', 'الإسبانية', 'الصينية المندرية', 'العربية'], correct: 2, time: 15 },
      { text: 'من رسم لوحة الموناليزا؟', options: ['مايكل أنجلو', 'رافائيل', 'ليوناردو دافنشي', 'بيكاسو'], correct: 2, time: 15 },
      { text: 'كم ساعة في الأسبوع؟', options: ['148', '156', '168', '172'], correct: 2, time: 15 },
      { text: 'ما هو عدد أوتار الغيتار الكلاسيكي؟', options: ['4', '5', '6', '7'], correct: 2, time: 10 },
      { text: 'كم كوكباً في المجموعة الشمسية؟', options: ['7', '8', '9', '10'], correct: 1, time: 10 },
      { text: 'ما هي عاصمة فرنسا؟', options: ['ليون', 'مرسيليا', 'باريس', 'بوردو'], correct: 2, time: 10 },
    ]
  },
  technology: {
    label: "💻 تقنية",
    questions: [
      { text: "ما معنى اختصار AI؟", options: ["اتصال متقدم", "ذكاء اصطناعي", "إنترنت متسارع", "تطبيق ذكي"], correct: 1, time: 10 },
      { text: "من أسس شركة Apple؟", options: ["بيل غيتس", "إيلون ماسك", "ستيف جوبز", "مارك زوكربرغ"], correct: 2, time: 10 },
      { text: "ما هي شركة تطوير ChatGPT؟", options: ["Google", "Meta", "OpenAI", "Microsoft"], correct: 2, time: 10 },
      { text: "ما لغة البرمجة الأكثر استخداماً في تطوير الويب؟", options: ["Python", "Java", "JavaScript", "C++"], correct: 2, time: 15 },
      { text: "كم بت في البايت الواحد؟", options: ["4", "8", "16", "32"], correct: 1, time: 10 },
      { text: "ما هو نظام تشغيل Google للجوال؟", options: ["iOS", "Android", "Windows Mobile", "HarmonyOS"], correct: 1, time: 10 },
      { text: "في أي عام أُطلق الإنترنت للعموم؟", options: ["1983", "1989", "1991", "1995"], correct: 2, time: 20 },
      { text: "ما هي شركة Claude AI؟", options: ["Google", "OpenAI", "Anthropic", "Meta"], correct: 2, time: 10 },
      { text: "ما هو معنى CPU؟", options: ["وحدة المعالجة المركزية", "وحدة الطاقة المركزية", "معالج الإخراج المركزي", "واجهة البرامج المركزية"], correct: 0, time: 15 },
      { text: "من مؤسس موقع Facebook؟", options: ["ستيف جوبز", "بيل غيتس", "مارك زوكربرغ", "جيف بيزوس"], correct: 2, time: 10 },
    ]
  },
  islam: {
    label: "☪️ إسلاميات",
    questions: [
      { text: "كم عدد سور القرآن الكريم؟", options: ["110", "114", "120", "124"], correct: 1, time: 10 },
      { text: "ما هي أطول سورة في القرآن الكريم؟", options: ["آل عمران", "النساء", "البقرة", "المائدة"], correct: 2, time: 15 },
      { text: "كم عدد أركان الإسلام؟", options: ["4", "5", "6", "7"], correct: 1, time: 10 },
      { text: "في أي شهر نزل القرآن الكريم؟", options: ["رجب", "شعبان", "رمضان", "محرم"], correct: 2, time: 10 },
      { text: "ما هي أول سورة نزلت؟", options: ["الفاتحة", "البقرة", "العلق", "المدثر"], correct: 2, time: 15 },
      { text: "كم عدد أنبياء الله المذكورين في القرآن؟", options: ["20", "25", "30", "35"], correct: 1, time: 20 },
      { text: "ما هي القبلة الأولى للمسلمين؟", options: ["مكة المكرمة", "المدينة المنورة", "بيت المقدس", "الكعبة"], correct: 2, time: 15 },
      { text: "كم عدد ركعات صلاة الفجر؟", options: ["1", "2", "3", "4"], correct: 1, time: 10 },
      { text: "ما هو اسم جبل نزول الوحي؟", options: ["جبل عرفات", "جبل أحد", "جبل النور", "جبل ثور"], correct: 2, time: 15 },
      { text: "كم عدد أيام شهر رمضان؟", options: ["28 أو 29", "29 أو 30", "30 أو 31", "دائماً 30"], correct: 1, time: 15 },
    ]
  },
  arabic: {
    label: "📖 لغة عربية",
    questions: [
      { text: "كم عدد حروف اللغة العربية؟", options: ["26", "28", "30", "32"], correct: 1, time: 10 },
      { text: "ما هو جمع كلمة كتاب؟", options: ["كتابات", "كتب", "أكتب", "كتابون"], correct: 1, time: 10 },
      { text: "ما هي علامة الرفع في الاسم المفرد؟", options: ["الفتحة", "الكسرة", "الضمة", "السكون"], correct: 2, time: 15 },
      { text: "ما هو ضد كلمة شجاع؟", options: ["كريم", "بخيل", "جبان", "قبيح"], correct: 2, time: 10 },
      { text: "من هو أمير الشعراء العرب؟", options: ["المتنبي", "أحمد شوقي", "نزار قباني", "أبو تمام"], correct: 1, time: 15 },
      { text: "ما هو مفرد كلمة أطباء؟", options: ["طبيب", "طب", "طبيبة", "أطب"], correct: 0, time: 10 },
      { text: "كم عدد حروف المد في العربية؟", options: ["2", "3", "4", "5"], correct: 1, time: 15 },
      { text: "ما نوع الجملة الطالب مجتهد؟", options: ["فعلية", "اسمية", "شرطية", "استفهامية"], correct: 1, time: 15 },
      { text: "ما هو المعجم العربي الأشهر؟", options: ["معجم الوسيط", "لسان العرب", "القاموس المحيط", "تاج العروس"], correct: 1, time: 20 },
      { text: "ما معنى كلمة فصيح؟", options: ["قوي", "واضح البيان", "شجاع", "حكيم"], correct: 1, time: 15 },
    ]
  }
};

const rooms = {};

function generatePIN() {
  let pin;
  do { pin = Math.floor(100000 + Math.random() * 900000).toString(); } while (rooms[pin]);
  return pin;
}

function calcScore(isCorrect, timeLeft, maxTime) {
  if (!isCorrect) return 0;
  return 1000 + Math.floor((timeLeft / maxTime) * 500);
}

function getLeaderboard(players, limit = 5) {
  return Object.values(players).sort((a, b) => b.score - a.score).slice(0, limit)
    .map(({ name, score, streak }) => ({ name, score, streak }));
}

app.get('/api/categories', (req, res) => {
  const cats = Object.entries(QUESTION_BANK).map(([key, val]) => ({
    key, label: val.label, count: val.questions.length
  }));
  res.json(cats);
});

io.on('connection', (socket) => {

  socket.on('create_room', ({ hostName, category, questionCount }, callback) => {
    const pin = generatePIN();
    let pool = category && QUESTION_BANK[category]
      ? [...QUESTION_BANK[category].questions]
      : Object.values(QUESTION_BANK).flatMap(c => c.questions);
    pool = pool.sort(() => Math.random() - 0.5);
    const count = Math.min(Math.max(parseInt(questionCount) || 5, 3), 20);
    const qs = pool.slice(0, count).map((q, i) => ({ ...q, id: i + 1 }));

    rooms[pin] = { pin, hostId: socket.id, hostName, players: {}, questions: qs, state: 'lobby', currentQ: -1, answeredCount: 0, timer: null };
    socket.join(pin);
    socket.data = { pin, role: 'host', name: hostName };
    callback({ success: true, pin });
  });

  socket.on('join_room', ({ pin, playerName }, callback) => {
    const room = rooms[pin];
    if (!room) return callback({ success: false, error: 'الغرفة غير موجودة' });
    if (room.state !== 'lobby') return callback({ success: false, error: 'اللعبة بدأت بالفعل' });
    if (Object.values(room.players).some(p => p.name === playerName)) return callback({ success: false, error: 'الاسم مستخدم' });

    room.players[socket.id] = { id: socket.id, name: playerName, score: 0, streak: 0, answered: false };
    socket.join(pin);
    socket.data = { pin, role: 'player', name: playerName };
    const playerList = Object.values(room.players).map(p => ({ id: p.id, name: p.name }));
    io.to(pin).emit('player_joined', { players: playerList, count: playerList.length });
    callback({ success: true });
  });

  socket.on('start_game', () => {
    const { pin, role } = socket.data || {};
    const room = rooms[pin];
    if (!room || role !== 'host') return;
    room.state = 'playing';
    io.to(pin).emit('game_started');
    setTimeout(() => sendQuestion(pin), 1000);
  });

  function sendQuestion(pin) {
    const room = rooms[pin];
    if (!room) return;
    room.currentQ++;
    if (room.currentQ >= room.questions.length) return endGame(pin);
    const q = room.questions[room.currentQ];
    room.state = 'question';
    room.answeredCount = 0;
    room.questionStartTime = Date.now();
    Object.values(room.players).forEach(p => { p.answered = false; p.lastAnswer = null; });
    io.to(pin).emit('new_question', { index: room.currentQ, total: room.questions.length, text: q.text, options: q.options, time: q.time });
    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => { if (room.state === 'question') showQuestionResult(pin); }, q.time * 1000 + 500);
  }

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
    player.streak = isCorrect ? (player.streak || 0) + 1 : 0;
    room.answeredCount++;
    socket.emit('answer_result', { isCorrect, points, score: player.score, streak: player.streak });
    const hostSocket = io.sockets.sockets.get(room.hostId);
    if (hostSocket) hostSocket.emit('answer_count', { answered: room.answeredCount, total: Object.keys(room.players).length });
    if (room.answeredCount >= Object.keys(room.players).length) {
      if (room.timer) clearTimeout(room.timer);
      setTimeout(() => showQuestionResult(pin), 800);
    }
  });

  function showQuestionResult(pin) {
    const room = rooms[pin];
    if (!room || room.state !== 'question') return;
    room.state = 'leaderboard';
    const q = room.questions[room.currentQ];
    io.to(pin).emit('question_result', { correctIndex: q.correct, leaderboard: getLeaderboard(room.players), isLast: room.currentQ === room.questions.length - 1 });
    setTimeout(() => { if (room.currentQ < room.questions.length - 1) sendQuestion(pin); else endGame(pin); }, 5000);
  }

  function endGame(pin) {
    const room = rooms[pin];
    if (!room) return;
    room.state = 'ended';
    io.to(pin).emit('game_ended', { winners: getLeaderboard(room.players, 3) });
    setTimeout(() => delete rooms[pin], 10 * 60 * 1000);
  }

  socket.on('disconnect', () => {
    const { pin, role, name } = socket.data || {};
    const room = rooms[pin];
    if (!room) return;
    if (role === 'player') {
      delete room.players[socket.id];
      io.to(pin).emit('player_left', { name, players: Object.values(room.players).map(p => ({ id: p.id, name: p.name })) });
    } else if (role === 'host' && room.state === 'lobby') {
      io.to(pin).emit('host_disconnected');
      delete rooms[pin];
    }
  });

  socket.on('rejoin_room', ({ pin, playerName }, callback) => {
    const room = rooms[pin];
    if (!room) return callback({ success: false, error: 'الغرفة غير موجودة' });
    const oldEntry = Object.entries(room.players).find(([, p]) => p.name === playerName);
    if (!oldEntry) return callback({ success: false, error: 'لا يمكن الانضمام' });
    const [oldId, playerData] = oldEntry;
    delete room.players[oldId];
    room.players[socket.id] = { ...playerData, id: socket.id };
    socket.join(pin);
    socket.data = { pin, role: 'player', name: playerName };
    callback({ success: true, state: { score: room.players[socket.id].score } });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🚀 رواق يعمل على: http://localhost:${PORT}\n`));
