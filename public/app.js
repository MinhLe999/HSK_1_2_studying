(() => {
  "use strict";

  const content = window.HSK_CONTENT;
  const exampleSupplements = window.HSK_EXAMPLE_SUPPLEMENTS;
  const structures = window.HSK_STRUCTURES;
  const practiceExtensions = window.HSK_PRACTICE_EXTENSIONS;
  const production = window.HSK_PRODUCTION;
  const measureWords = window.HSK_MEASURE_WORDS;
  const commonStructures = window.HSK_COMMON_STRUCTURES;
  const lessons = content.lessons;
  const measurePageSize = 20;
  const navEl = document.querySelector("#lessonNav");
  const contentEl = document.querySelector("#content");
  const activeDateEl = document.querySelector("#activeDate");
  const activeTitleEl = document.querySelector("#activeTitle");
  const progressTextEl = document.querySelector("#progressText");
  const progressFillEl = document.querySelector("#progressFill");
  const saveStatusEl = document.querySelector("#saveStatus");
  const dialogEl = document.querySelector("#editorDialog");
  const editorFormEl = document.querySelector("#editorForm");
  const dialogTitleEl = document.querySelector("#dialogTitle");
  const dialogFieldsEl = document.querySelector("#dialogFields");
  const toastEl = document.querySelector("#toast");

  let savedData = null;
  let saveTimer = null;
  let saveRevision = 0;
  let lastSavedRevision = 0;
  let toastTimer = null;
  let editorContext = null;

  const ui = {
    lessonIndex: 0,
    view: "lesson",
    cardScope: "lesson",
    cardIndex: 0,
    cardRevealed: false,
    measureMode: "choice",
    measurePage: 0,
    vocabShowPinyin: true,
    vocabShowMeaning: true,
    vocabShuffleOrder: null,
    imageLookup: { status: "idle", message: "", words: [], unknown: [], hanCount: 0 }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35];

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function todayIso() {
    return isoDate(new Date());
  }

  function addDaysIso(iso, days) {
    const date = new Date(`${iso}T00:00:00`);
    date.setDate(date.getDate() + days);
    return isoDate(date);
  }

  function formatIsoAsVn(iso) {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function rotateChoice(rawQuestion, id) {
    const [prompt, rawOptions, rawAnswer, explanation] = rawQuestion;
    const shift = hash(id) % rawOptions.length;
    const options = rawOptions.slice(shift).concat(rawOptions.slice(0, shift));
    return {
      id,
      type: "choice",
      prompt,
      options,
      answer: (rawAnswer - shift + rawOptions.length) % rawOptions.length,
      explanation
    };
  }

  function shuffledTokens(tokens, id) {
    return tokens
      .map((token, index) => ({ token, weight: hash(`${id}-${index}`) }))
      .sort((left, right) => left.weight - right.weight)
      .map(item => item.token);
  }

  function fillQuestion(rawFill, id) {
    const [prompt, accepted, explanation] = rawFill;
    const blanks = Array.isArray(accepted[0]) ? accepted : [accepted];
    return {
      id,
      type: "fill",
      prompt,
      blanks,
      answer: blanks.map(item => item[0]).join(" / "),
      explanation
    };
  }

  function clozeQuestion(rawQuestion, id) {
    return rawQuestion.length === 3 ? fillQuestion(rawQuestion, id) : rotateChoice(rawQuestion, id);
  }

  function orderQuestion(rawOrder, id) {
    return {
      id,
      type: "order",
      prompt: "Sắp xếp các phần thành câu hoàn chỉnh.",
      tokens: shuffledTokens(rawOrder[0], id),
      answer: rawOrder[1],
      explanation: `Câu hoàn chỉnh: ${rawOrder[1]}`
    };
  }

  function uniqueMeanings(vocab, answerMeaning) {
    const options = [answerMeaning];
    for (const item of vocab) {
      if (!options.includes(item[2])) options.push(item[2]);
      if (options.length === 4) break;
    }
    return options;
  }

  function vocabQuestion(vocabItem, candidatePool, id) {
    const rawOptions = uniqueMeanings(candidatePool, vocabItem[2]);
    return rotateChoice(
      [
        `${vocabItem[0]} nghĩa là gì?`,
        rawOptions,
        0,
        `${vocabItem[0]} (${vocabItem[1]}): ${vocabItem[2]}.`
      ],
      id
    );
  }

  function uniqueValues(vocab, fieldIndex, answerValue) {
    const options = [answerValue];
    for (const item of vocab) {
      if (!options.includes(item[fieldIndex])) options.push(item[fieldIndex]);
      if (options.length === 4) break;
    }
    return options;
  }

  function reverseVocabQuestion(vocabItem, candidatePool, id) {
    return rotateChoice(
      [
        `Từ nào mang nghĩa “${vocabItem[2]}”?`,
        uniqueValues(candidatePool, 0, vocabItem[0]),
        0,
        `${vocabItem[0]} (${vocabItem[1]}): ${vocabItem[2]}.`
      ],
      id
    );
  }

  function pinyinVocabQuestion(vocabItem, candidatePool, id) {
    return rotateChoice(
      [
        `Từ nào có phiên âm “${vocabItem[1]}”?`,
        uniqueValues(candidatePool, 0, vocabItem[0]),
        0,
        `${vocabItem[1]} là phiên âm của ${vocabItem[0]}.`
      ],
      id
    );
  }

  function pickVocab(vocab, count, seed) {
    if (!vocab.length) return [];
    return vocab
      .map((item, index) => ({ item, weight: hash(`${seed}-${index}`) }))
      .sort((left, right) => left.weight - right.weight)
      .slice(0, Math.min(count, vocab.length))
      .map(entry => entry.item);
  }

  function displayNumber(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function largeNumberOptions(values, fieldIndex, answer, seed) {
    return [answer].concat(
      values
        .map(value => value[fieldIndex])
        .filter(value => value !== answer)
        .map(value => ({ value, weight: hash(`${seed}-${value}`) }))
        .sort((left, right) => left.weight - right.weight)
        .slice(0, 3)
        .map(item => item.value)
    );
  }

  function buildLargeNumberQuestions(lessonItem) {
    const values = lessonItem.numberGuide?.values || [];
    return values.flatMap(([arabic, hanzi], index) => [
      rotateChoice(
        [
          `Số ${displayNumber(arabic)} đọc thế nào?`,
          largeNumberOptions(values, 1, hanzi, `number-hanzi-${arabic}`),
          0,
          `${displayNumber(arabic)} đọc là ${hanzi}.`
        ],
        `large-number-read-${lessonItem.id}-${index}`
      ),
      rotateChoice(
        [
          `“${hanzi}” tương ứng với số nào?`,
          largeNumberOptions(values, 0, arabic, `number-arabic-${arabic}`)
            .map(displayNumber),
          0,
          `${hanzi} là ${displayNumber(arabic)}.`
        ],
        `large-number-write-${lessonItem.id}-${index}`
      )
    ]);
  }

  function buildPracticeSections(lessonIndex) {
    const lesson = lessons[lessonIndex];
    const practiceExtension = practiceExtensions[lesson.id];
    const currentPool = lesson.vocab;
    const previousPool = lessons.slice(0, lessonIndex).flatMap(item => item.vocab);
    const oldPool = previousPool.length ? previousPool : currentPool;
    const allPool = previousPool.concat(currentPool);
    const previousLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : lesson;
    const pickedCurrentVocab = pickVocab(currentPool, 3, `${lesson.id}-new`);
    const pickedOldVocab = pickVocab(oldPool, 2, `${lesson.id}-old`);

    const currentVocab = [
      vocabQuestion(pickedCurrentVocab[0], currentPool, `vocab-new-${lesson.id}-0`),
      reverseVocabQuestion(pickedCurrentVocab[1], currentPool, `vocab-new-${lesson.id}-1`),
      pinyinVocabQuestion(pickedCurrentVocab[2], currentPool, `vocab-new-${lesson.id}-2`)
    ];
    const oldVocab = [
      reverseVocabQuestion(pickedOldVocab[0], allPool, `vocab-old-${lesson.id}-0`),
      vocabQuestion(pickedOldVocab[1], allPool, `vocab-old-${lesson.id}-1`)
    ];
    const clozeBlocks = [];
    let looseCloze = [];
    lesson.practice.cloze.forEach((entry, index) => {
      if (Array.isArray(entry)) {
        looseCloze.push(clozeQuestion(entry, `vocab-mixed-${lesson.id}-${index}`));
        return;
      }
      clozeBlocks.push({
        id: `cloze-block-${lesson.id}-${index}`,
        title: entry.title,
        description: entry.description || "",
        questions: entry.items.map((item, itemIndex) =>
          clozeQuestion(item, `vocab-mixed-${lesson.id}-${index}-${itemIndex}`)
        )
      });
    });
    const mixedVocab = looseCloze;
    const newGrammar = lesson.quiz.slice(0, 3).map((question, index) =>
      rotateChoice(question, `grammar-new-${lesson.id}-${index}`)
    );
    const oldGrammarSources = lessonIndex === 0
      ? [lesson, lesson]
      : [
          lessons[lessonIndex - 1],
          lessons[Math.max(0, lessonIndex - 3)]
        ];
    const oldGrammar = oldGrammarSources.map((sourceLesson, index) => {
      const questionIndex = (lessonIndex + index * 2) % sourceLesson.quiz.length;
      return rotateChoice(
        sourceLesson.quiz[questionIndex],
        `grammar-old-${lesson.id}-${sourceLesson.id}-${questionIndex}`
      );
    });
    const orderBlocks = [];
    const looseOrders = [];
    lesson.practice.orders.forEach((entry, index) => {
      if (Array.isArray(entry)) {
        looseOrders.push(orderQuestion(entry, `grammar-mixed-${lesson.id}-${index}`));
        return;
      }
      orderBlocks.push({
        id: `order-block-${lesson.id}-${index}`,
        title: entry.title,
        description: entry.description || "",
        questions: entry.items.map((item, itemIndex) =>
          orderQuestion(item, `grammar-mixed-${lesson.id}-${index}-${itemIndex}`)
        )
      });
    });
    const mixedGrammar = looseOrders;
    const largeNumberQuestions = buildLargeNumberQuestions(lesson);
    const largeNumberSection = largeNumberQuestions.length
      ? {
          id: "large-numbers",
          title: "Đếm số trên 100, trên 1.000 và từ một vạn",
          description: "Luyện cả hai chiều: nhìn số viết cách đọc và nhìn chữ Hán chọn số tương ứng.",
          questions: largeNumberQuestions
        }
      : null;
    const writtenPractice = (production[lesson.id] || []).map((question, index) => ({
      ...question,
      id: `written-${lesson.id}-${index}`,
      type: "written"
    }));
    const givenWordPractice = (practiceExtension?.wordTasks || []).map(question => ({
      ...question,
      id: `written-${question.id}`,
      type: "written"
    }));
    const writtenKindOrder = [
      "sentence-vocab",
      "sentence-pattern",
      "question-from-answer",
      "answer-from-question"
    ];
    const writtenSections = writtenKindOrder
      .map(kind => {
        const questions = writtenPractice.filter(question => question.kind === kind);
        if (!questions.length) return null;
        return {
          id: kind,
          title: {
            "sentence-vocab": "Đặt câu với từ mới",
            "sentence-pattern": "Đặt câu với cấu trúc mới",
            "question-from-answer": "Đặt câu hỏi từ câu trả lời",
            "answer-from-question": "Viết câu trả lời từ câu hỏi"
          }[kind],
          description: {
            "sentence-vocab": "Tự tạo một câu mới, không chép lại câu ví dụ của bài.",
            "sentence-pattern": "Áp dụng mẫu mới vào tình huống khác với phần nhận diện.",
            "question-from-answer": "Xác định thông tin cần hỏi rồi viết câu hỏi phù hợp.",
            "answer-from-question": "Trả lời thành câu đầy đủ, không chỉ ghi một từ."
          }[kind],
          questions
        };
      })
      .filter(Boolean);
    const givenWordSection = givenWordPractice.length
      ? {
          id: "sentence-given-words",
          title: "Đặt câu với từ cho sẵn",
          description: "Mỗi câu phải dùng đủ 2-3 từ được đưa ra; có thể thêm từ đã học.",
          questions: givenWordPractice
        }
      : null;
    const readingPlan = practiceExtension?.reading;
    const reading = readingPlan
      ? readingPlan.questions.map(question =>
          rotateChoice(
            [question.prompt, question.options, question.answer, question.explanation],
            `reading-${question.id}`
          )
        )
      : lesson.practice.reading[2].map((question, index) =>
          rotateChoice(question, `reading-${lesson.id}-${index}`)
        );
    const listeningSections = (lesson.listening || []).map((clip, clipIndex) => {
      const orderId = `listening-order-${lesson.id}-${clipIndex}`;
      const orderQuestionItem = {
        id: orderId,
        type: "order",
        prompt: "Nghe rồi sắp xếp các câu thoại theo đúng thứ tự.",
        tokens: shuffledTokens(clip.dialogueLines, orderId),
        answer: clip.dialogueLines.join(""),
        explanation: `Hội thoại đầy đủ: ${clip.dialogueLines.join(" ")}`
      };
      const trueFalseQuestions = clip.trueFalse.map((item, tfIndex) =>
        rotateChoice(
          [item[0], ["Đúng", "Sai"], item[1] ? 0 : 1, item[2]],
          `listening-tf-${lesson.id}-${clipIndex}-${tfIndex}`
        )
      );
      return {
        id: `listening-${lesson.id}-${clipIndex}`,
        title: clip.title,
        description: clip.note || "Nghe đoạn ghi âm rồi làm bài tập bên dưới.",
        audio: clip.url,
        questions: [orderQuestionItem, ...trueFalseQuestions]
      };
    });

    return [
      {
        id: "new-vocab",
        title: "Từ mới",
        description: "Nhận diện từ trong bảng của ngày đang học.",
        questions: currentVocab
      },
      writtenSections[0],
      {
        id: "old-vocab",
        title: lessonIndex ? "Từ cũ" : "Từ nền",
        description: lessonIndex
          ? "Lấy lại từ của các ngày trước."
          : "Củng cố nhóm từ đầu tiên của lộ trình.",
        questions: oldVocab
      },
      ...(mixedVocab.length ? [{
        id: "mixed-vocab",
        title: "Từ mới + cũ",
        description: "Chọn từ phù hợp với ngữ cảnh của câu.",
        questions: mixedVocab
      }] : []),
      ...clozeBlocks,
      {
        id: "new-grammar",
        title: "Cấu trúc mới",
        description: "Kiểm tra mẫu câu và điểm ngữ pháp của ngày.",
        questions: newGrammar
      },
      ...(largeNumberSection ? [largeNumberSection] : []),
      writtenSections[1],
      ...(givenWordSection ? [givenWordSection] : []),
      {
        id: "old-grammar",
        title: lessonIndex ? "Cấu trúc cũ" : "Cấu trúc nền",
        description: lessonIndex
          ? "Hai cấu trúc được lấy từ hai ngày học khác nhau để tránh lặp mẫu."
          : "Củng cố cấu trúc mở đầu.",
        questions: oldGrammar
      },
      ...(mixedGrammar.length ? [{
        id: "mixed-grammar",
        title: "Cấu trúc mới + cũ",
        description: "Sắp xếp câu có nhiều thành phần đã học.",
        questions: mixedGrammar
      }] : []),
      ...orderBlocks,
      writtenSections[2],
      writtenSections[3],
      {
        id: "reading",
        title: "Đọc hiểu",
        description: readingPlan
          ? "Đọc đoạn văn và đoạn hội thoại rồi chọn đáp án."
          : lesson.practice.reading[0],
        reading: readingPlan
          ? { prose: readingPlan.prose, dialogue: readingPlan.dialogue }
          : null,
        passage: readingPlan ? "" : lesson.practice.reading[1],
        questions: reading
      },
      ...listeningSections
    ];
  }

  function lesson() {
    return lessons[ui.lessonIndex];
  }

  function ensurePracticeState(lessonId) {
    savedData.progress.practice[lessonId] ||= {
      answers: {},
      checked: false,
      score: 0,
      total: 0,
      revealed: {},
      selfReview: {}
    };
    const practiceState = savedData.progress.practice[lessonId];
    practiceState.answers ||= {};
    practiceState.revealed ||= {};
    practiceState.selfReview ||= {};
    return practiceState;
  }

  function ensureRoadmapState() {
    savedData.roadmap ||= { currentLessonId: lessons[0].id, reviewStage: {} };
    savedData.roadmap.reviewStage ||= {};
    return savedData.roadmap;
  }

  function seedRoadmapReviews() {
    const roadmap = ensureRoadmapState();
    const currentIndex = Math.max(0, lessons.findIndex(item => item.id === roadmap.currentLessonId));
    const learned = lessons.slice(0, currentIndex + 1);
    const today = todayIso();
    learned.forEach((lessonItem, index) => {
      if (!roadmap.reviewStage[lessonItem.id]) {
        roadmap.reviewStage[lessonItem.id] = {
          stage: 0,
          lastReviewedAt: null,
          nextReviewDate: addDaysIso(today, index % 5)
        };
      }
    });
  }

  function dueReviewsToday() {
    const roadmap = ensureRoadmapState();
    const today = todayIso();
    return Object.entries(roadmap.reviewStage)
      .filter(([, entry]) => entry.nextReviewDate && entry.nextReviewDate <= today)
      .map(([lessonId, entry]) => ({ lesson: lessons.find(item => item.id === lessonId), entry }))
      .filter(item => item.lesson)
      .sort((a, b) => a.entry.nextReviewDate.localeCompare(b.entry.nextReviewDate));
  }

  function upcomingReviews(days = 7) {
    const roadmap = ensureRoadmapState();
    const today = todayIso();
    const horizon = addDaysIso(today, days);
    return Object.entries(roadmap.reviewStage)
      .map(([lessonId, entry]) => ({ lesson: lessons.find(item => item.id === lessonId), entry }))
      .filter(item => item.lesson && item.entry.nextReviewDate > today && item.entry.nextReviewDate <= horizon)
      .sort((a, b) => a.entry.nextReviewDate.localeCompare(b.entry.nextReviewDate));
  }

  function markLessonReviewed(lessonId) {
    const roadmap = ensureRoadmapState();
    const entry = roadmap.reviewStage[lessonId] || { stage: 0, lastReviewedAt: null, nextReviewDate: null };
    const today = todayIso();
    const nextStage = Math.min(entry.stage + 1, REVIEW_INTERVALS_DAYS.length);
    const intervalIndex = Math.min(nextStage - 1, REVIEW_INTERVALS_DAYS.length - 1);
    roadmap.reviewStage[lessonId] = {
      stage: nextStage,
      lastReviewedAt: today,
      nextReviewDate: addDaysIso(today, REVIEW_INTERVALS_DAYS[intervalIndex])
    };
    markDirty();
    renderContent();
  }

  function advanceCurrentLesson() {
    const roadmap = ensureRoadmapState();
    const currentIndex = lessons.findIndex(item => item.id === roadmap.currentLessonId);
    const nextLesson = lessons[currentIndex + 1];
    if (!nextLesson) return;
    roadmap.currentLessonId = nextLesson.id;
    seedRoadmapReviews();
    markDirty();
    renderContent();
  }

  function normalizeSentence(value) {
    return String(value).replace(/[\s。？！，、,.?!]/g, "");
  }

  function isQuestionCorrect(question, answer) {
    if (question.type === "order") {
      if (!Array.isArray(answer)) return false;
      const sentence = answer.map(index => question.tokens[index]).join("");
      return normalizeSentence(sentence) === normalizeSentence(question.answer);
    }
    if (question.type === "fill") {
      const given = Array.isArray(answer) ? answer : [answer];
      return question.blanks.every((accepted, index) => {
        const normalized = normalizeMeasureAnswer(given[index]);
        return Boolean(normalized) && accepted.some(item => normalizeMeasureAnswer(item) === normalized);
      });
    }
    return Number(answer) === question.answer;
  }

  function scoreQuestions(questions, answers) {
    return questions.reduce(
      (score, question) => score + (isQuestionCorrect(question, answers[question.id]) ? 1 : 0),
      0
    );
  }

  function allPracticeQuestions(sections) {
    return sections.flatMap(section => section.questions);
  }

  function allVocab() {
    return lessons.flatMap(item =>
      item.vocab.map(card => [card[0], card[1], card[2], item.shortDate])
    );
  }

  function lessonExamples(item) {
    return item.examples.concat(exampleSupplements[item.id]?.additions || []);
  }

  function currentCards() {
    if (ui.cardScope === "all") return allVocab();
    return lesson().vocab.map(card => [card[0], card[1], card[2], lesson().shortDate]);
  }

  function setSaveStatus(text, kind = "") {
    saveStatusEl.textContent = text;
    saveStatusEl.className = `save-status ${kind}`.trim();
  }

  function markDirty() {
    saveRevision += 1;
    setSaveStatus("Chưa lưu", "saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 450);
  }

  async function saveNow() {
    if (!savedData || lastSavedRevision === saveRevision) return;
    const revision = saveRevision;
    setSaveStatus("Đang lưu", "saving");
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedData)
      });
      if (!response.ok) throw new Error("Không lưu được dữ liệu.");
      lastSavedRevision = revision;
      if (lastSavedRevision === saveRevision) setSaveStatus("Đã lưu trên máy");
    } catch (error) {
      setSaveStatus("Lỗi lưu dữ liệu", "error");
      showToast("Chưa lưu được dữ liệu. Máy chủ cần tiếp tục chạy.");
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function completedLessonCount() {
    return lessons.filter((item, index) =>
      practiceResultIsCurrent(savedData.progress.practice[item.id], index)
    ).length;
  }

  function practiceResultIsCurrent(result, lessonIndex) {
    if (!result?.checked) return false;
    const scoredTotal = allPracticeQuestions(buildPracticeSections(lessonIndex))
      .filter(question => question.type !== "written")
      .length;
    return result.total === scoredTotal;
  }

  function renderShell() {
    const done = completedLessonCount();
    progressTextEl.textContent = `${done}/${lessons.length}`;
    progressFillEl.style.width = `${Math.round((done / lessons.length) * 100)}%`;

    navEl.innerHTML = lessons.map((item, index) => {
      const result = savedData.progress.practice[item.id];
      const resultIsCurrent = practiceResultIsCurrent(result, index);
      const stat = resultIsCurrent ? `${result.score}/${result.total}` : item.vocab.length;
      return `
        <button class="lesson-button ${index === ui.lessonIndex ? "active" : ""}"
          data-action="selectLesson" data-index="${index}">
          <span class="lesson-date">${escapeHtml(item.shortDate)}</span>
          <span class="lesson-title">${escapeHtml(item.title)}</span>
          <span class="lesson-stat ${resultIsCurrent ? "done" : ""}">${escapeHtml(stat)}</span>
        </button>
      `;
    }).join("");

    document.querySelectorAll("[data-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.view === ui.view);
    });
    const tabsEl = document.querySelector(".view-tabs");
    const activeTabEl = tabsEl.querySelector("[data-view].active");
    requestAnimationFrame(() => {
      const activeLeft = activeTabEl.offsetLeft;
      const activeRight = activeLeft + activeTabEl.offsetWidth;
      if (activeLeft < tabsEl.scrollLeft || activeRight > tabsEl.scrollLeft + tabsEl.clientWidth) {
        tabsEl.scrollTo({ left: Math.max(0, activeLeft - 12), behavior: "smooth" });
      }
    });

    if (ui.view === "similar") {
      activeDateEl.textContent = "Dữ liệu cá nhân";
      activeTitleEl.textContent = "Phân biệt chữ gần giống";
      return;
    }

    if (ui.view === "notes") {
      activeDateEl.textContent = "Dữ liệu cá nhân";
      activeTitleEl.textContent = "Ghi chú";
      return;
    }

    if (ui.view === "image") {
      activeDateEl.textContent = `Tra trong ${lessons.length} ngày học`;
      activeTitleEl.textContent = "Tra từ qua ảnh";
      return;
    }

    if (ui.view === "common") {
      activeDateEl.textContent = "Tra cứu nhanh";
      activeTitleEl.textContent = "Cấu trúc thông dụng";
      return;
    }

    if (ui.view === "roadmap") {
      activeDateEl.textContent = "Dữ liệu cá nhân";
      activeTitleEl.textContent = "Lộ trình học";
      return;
    }

    if (ui.view === "final") {
      activeDateEl.textContent = `Tổng hợp ${lessons.length} ngày học`;
      activeTitleEl.textContent = "Bài kiểm tra cuối";
      return;
    }

    if (ui.view === "measure") {
      activeDateEl.textContent = `Tổng hợp ${lessons.length} ngày học`;
      activeTitleEl.textContent = "Luyện điền lượng từ";
      return;
    }

    const current = lesson();
    activeDateEl.textContent = `${current.date} · ${current.pages}`;
    activeTitleEl.textContent = current.title;
  }

  function vocabInOrder(item) {
    const order = ui.vocabShuffleOrder;
    if (!order || order.length !== item.vocab.length) return item.vocab;
    return order.map(index => item.vocab[index]);
  }

  function vocabCard(card) {
    return `
      <article class="vocab-item">
        <span class="hanzi">${escapeHtml(card[0])}</span>
        <span class="pinyin">${escapeHtml(card[1])}</span>
        <p class="meaning">${escapeHtml(card[2])}</p>
      </article>
    `;
  }

  function renderNumberGuide(guide) {
    if (!guide) return "";
    return `
      <section class="section number-guide">
        <div class="section-heading">
          <div>
            <p class="focus-line">Từ hàng trăm đến hàng vạn</p>
            <h3>Đếm số lớn</h3>
          </div>
          <p>Không kèm phiên âm trong ví dụ</p>
        </div>
        <ul class="plain-list number-rules">
          ${guide.rules.map(rule => `<li>${escapeHtml(rule)}</li>`).join("")}
        </ul>
        <div class="table-scroll number-table-scroll">
          <table class="number-guide-table">
            <thead>
              <tr>
                <th>Phạm vi</th>
                <th>Đơn vị</th>
                <th>Cách ghép</th>
                <th>Ví dụ</th>
              </tr>
            </thead>
            <tbody>
              ${guide.groups.map(group => `
                <tr>
                  <td><strong>${escapeHtml(group.range)}</strong></td>
                  <td><span class="number-unit" lang="zh-Hans">${escapeHtml(group.unit)}</span></td>
                  <td>${escapeHtml(group.formula)}</td>
                  <td>
                    <div class="number-examples">
                      ${group.examples.map(([number, hanzi]) => `
                        <span><small>${escapeHtml(number)}</small><strong lang="zh-Hans">${escapeHtml(hanzi)}</strong></span>
                      `).join("")}
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderLesson() {
    const item = lesson();
    const examples = lessonExamples(item);
    const patternEvidence = exampleSupplements[item.id]?.patternEvidence || [];
    const exampleMeanings = new Map(examples.map(example => [example[0], example[1]]));
    contentEl.innerHTML = `
      <section class="lesson-intro">
        <div class="lesson-summary">
          <p class="focus-line">${escapeHtml(item.focus)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.notes[0])}</p>
          <div class="toolbar">
            <button class="button primary" data-action="startPractice">Làm bài tập ngày này</button>
            <button class="button secondary" data-action="openCards">Ôn thẻ nhớ</button>
            <a class="button secondary" href="/HSK.pdf#page=${item.page}" target="_blank" rel="noreferrer">
              Mở trang PDF
            </a>
          </div>
        </div>
        <div class="source-frame">
          <object data="/HSK.pdf#page=${item.page}" type="application/pdf">
            <div class="source-fallback">
              Không mở được bản xem trước. Tài liệu nằm trong HSK.pdf, ${escapeHtml(item.pages)}.
            </div>
          </object>
        </div>
      </section>

      <div class="two-columns">
        <section class="section">
          <div class="section-heading">
            <h3>Ghi nhớ</h3>
            <p>${item.notes.length} điểm</p>
          </div>
          <ul class="plain-list">
            ${item.notes.map(note => `<li>${escapeHtml(note)}</li>`).join("")}
          </ul>
        </section>

        <section class="section">
          <div class="section-heading">
            <h3>Mẫu câu</h3>
            <p>${item.patterns.length} mẫu</p>
          </div>
          <ul class="pattern-list">
            ${item.patterns.map((pattern, index) => {
              // Mẫu câu và cấu trúc là một-một, nên lấy luôn bảng của cấu trúc
              // thay vì kể lại nội dung bảng bằng lời.
              const patternTable = (structures[item.id]?.items || [])[index]?.table || null;
              return `
              <li class="pattern-row">
                <span class="pattern">${escapeHtml(pattern[0])}</span>
                <span class="pattern-note">${escapeHtml(pattern[1])}</span>
                ${patternTable ? `
                  <div class="table-scroll">
                    <table class="structure-table structure-compare">
                      <thead>
                        <tr>
                          ${patternTable.columns.map(column => `
                            <th${column ? "" : ' class="structure-col-corner"'}>${escapeHtml(column)}</th>
                          `).join("")}
                        </tr>
                      </thead>
                      <tbody>
                        ${patternTable.rows.map(row => `
                          <tr>
                            <th scope="row">${escapeHtml(row[0])}</th>
                            ${row.slice(1).map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>
                  </div>
                ` : ""}
                ${patternEvidence[index] ? `
                  <div class="pattern-example">
                    <span>Ví dụ: ${escapeHtml(patternEvidence[index])}</span>
                    <small>${escapeHtml(exampleMeanings.get(patternEvidence[index]) || "")}</small>
                  </div>
                ` : ""}
              </li>
            `;
            }).join("")}
          </ul>
        </section>
      </div>

      ${renderNumberGuide(item.numberGuide)}

      <section class="section">
        <div class="section-heading">
          <h3>Từ vựng</h3>
          <p>${item.vocab.length} mục từ</p>
        </div>
        <div class="vocab-toggles">
          <label><input type="checkbox" data-choice-context="vocabDisplay" data-vocab-toggle="pinyin" ${ui.vocabShowPinyin ? "checked" : ""}> Hiện phiên âm</label>
          <label><input type="checkbox" data-choice-context="vocabDisplay" data-vocab-toggle="meaning" ${ui.vocabShowMeaning ? "checked" : ""}> Hiện nghĩa tiếng Việt</label>
          <button type="button" class="button secondary" data-action="shuffleVocab">Xáo trộn thứ tự</button>
        </div>
        <div class="vocab-grid${ui.vocabShowPinyin ? "" : " hide-pinyin"}${ui.vocabShowMeaning ? "" : " hide-meaning"}">${vocabInOrder(item).map(vocabCard).join("")}</div>
      </section>

      <div class="two-columns">
        <section class="section">
          <div class="section-heading">
            <h3>Ví dụ</h3>
            <p>${examples.length} câu · Không hiện phiên âm</p>
          </div>
          <ul class="example-list">
            ${examples.map(example => `
              <li class="example-row">
                <span class="example-hanzi">${escapeHtml(example[0])}</span>
                <div class="example-meaning">${escapeHtml(example[1])}</div>
              </li>
            `).join("")}
          </ul>
        </section>

        <section class="section">
          <div class="section-heading">
            <h3>Luyện dịch câu</h3>
            <p>Tự viết trước khi xem đáp án</p>
          </div>
          <ul class="writing-list">
            ${item.drills.map((drill, index) => {
              const key = `${item.id}-${index}`;
              return `
                <li class="writing-row">
                  <p class="write-prompt">${index + 1}. ${escapeHtml(drill[0])}</p>
                  <button class="button secondary" data-action="toggleWriting" data-key="${key}">
                    ${savedData.progress.writingShown[key] ? "Ẩn đáp án" : "Xem đáp án"}
                  </button>
                  <div class="write-answer ${savedData.progress.writingShown[key] ? "" : "hidden"}">
                    ${escapeHtml(drill[1])}
                  </div>
                </li>
              `;
            }).join("")}
          </ul>
        </section>
      </div>
    `;
  }

  function renderStructures() {
    const item = lesson();
    const structureDay = structures[item.id];

    if (!structureDay?.items.length) {
      contentEl.innerHTML = `
        <section class="structure-empty">
          <h3>Ngày ${escapeHtml(item.shortDate)} không có cấu trúc câu riêng</h3>
          <p>Chọn một ngày khác trong danh sách để tiếp tục ôn.</p>
        </section>
      `;
      return;
    }

    contentEl.innerHTML = `
      <section class="structure-intro">
        <p class="focus-line">${escapeHtml(structureDay.topic)}</p>
        <h3>Cấu trúc câu ngày ${escapeHtml(item.shortDate)}</h3>
        <p>
          ${structureDay.items.length} cấu trúc, mỗi cấu trúc có cách dùng và câu ví dụ.
          Phần ví dụ không kèm phiên âm.
        </p>
      </section>

      <div class="structure-list">
        ${structureDay.items.map((structure, index) => {
          const lines = structure.usage.split("\n").map(line => line.trim()).filter(Boolean);
          const plain = [];
          const labelled = [];
          lines.forEach(line => {
            const match = line.match(/^([^:：]{2,26})[:：]\s*(.+)$/);
            if (match) labelled.push([match[1].trim(), match[2].trim()]);
            else plain.push(line);
          });
          return `
            <article class="structure-item">
              <div class="structure-number" aria-hidden="true">
                ${String(index + 1).padStart(2, "0")}
              </div>
              <div class="structure-body">
                <h4 class="structure-formula">${escapeHtml(structure.formula)}</h4>
                ${structure.sense ? `
                  <p class="structure-sense">${escapeHtml(structure.sense)}</p>
                ` : ""}

                <div class="structure-section">
                  <span class="structure-label">Cách dùng</span>
                  ${plain.map(line => `<p class="structure-usage">${escapeHtml(line)}</p>`).join("")}
                  ${labelled.length ? `
                    <dl class="structure-forms">
                      ${labelled.map(([term, detail]) => `
                        <div class="structure-form-row">
                          <dt>${escapeHtml(term)}</dt>
                          <dd lang="zh-Hans">${escapeHtml(detail)}</dd>
                        </div>
                      `).join("")}
                    </dl>
                  ` : ""}
                </div>

                ${structure.table ? `
                  <div class="structure-section">
                    <span class="structure-label">Bảng trong sách</span>
                    <div class="table-scroll">
                      <table class="structure-table structure-compare">
                        <thead>
                          <tr>
                            ${structure.table.columns.map(column => `
                              <th${column ? "" : ' class="structure-col-corner"'}>${escapeHtml(column)}</th>
                            `).join("")}
                          </tr>
                        </thead>
                        <tbody>
                          ${structure.table.rows.map(row => `
                            <tr>
                              <th scope="row">${escapeHtml(row[0])}</th>
                              ${row.slice(1).map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}
                            </tr>
                          `).join("")}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ` : ""}

                <div class="structure-section">
                  <span class="structure-label">
                    Ví dụ${structure.examples.length > 1 ? ` (${structure.examples.length})` : ""}
                  </span>
                  <div class="table-scroll">
                    <table class="structure-table">
                      <thead>
                        <tr><th class="structure-col-index">#</th><th>Câu tiếng Trung</th><th>Nghĩa</th></tr>
                      </thead>
                      <tbody>
                        ${structure.examples.map((example, exampleIndex) => `
                          <tr>
                            <td class="structure-col-index">${exampleIndex + 1}</td>
                            <td class="structure-cell-zh" lang="zh-Hans">${escapeHtml(example)}</td>
                            <td class="structure-cell-vi">${escapeHtml(structure.meanings[exampleIndex])}</td>
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderCards() {
    const cards = currentCards();
    if (ui.cardIndex >= cards.length) ui.cardIndex = 0;
    const card = cards[ui.cardIndex];

    contentEl.innerHTML = `
      <section class="flashcard-lab">
        <div class="scope-control" aria-label="Phạm vi thẻ nhớ">
          <button class="${ui.cardScope === "lesson" ? "active" : ""}" data-action="cardScope" data-scope="lesson">
            Ngày này
          </button>
          <button class="${ui.cardScope === "all" ? "active" : ""}" data-action="cardScope" data-scope="all">
            Tất cả
          </button>
        </div>

        <article class="flashcard">
          <div>
            <p class="flash-meta">${escapeHtml(card[3])} · ${ui.cardIndex + 1}/${cards.length}</p>
            <span class="hanzi">${escapeHtml(card[0])}</span>
            <div class="flash-answer ${ui.cardRevealed ? "" : "hidden"}">
              <span class="pinyin">${escapeHtml(card[1])}</span>
              <p>${escapeHtml(card[2])}</p>
            </div>
          </div>
        </article>

        <div class="toolbar">
          <button class="button secondary" data-action="previousCard">← Trước</button>
          <button class="button primary" data-action="flipCard">
            ${ui.cardRevealed ? "Ẩn nghĩa" : "Hiện nghĩa"}
          </button>
          <button class="button secondary" data-action="nextCard">Tiếp →</button>
          <button class="button secondary" data-action="randomCard">Trộn thẻ</button>
        </div>
      </section>
    `;
  }

  function renderChoiceQuestion(question, answer, checked, context, number) {
    const correct = checked ? isQuestionCorrect(question, answer) : null;
    return `
      <article class="question ${correct === true ? "correct" : ""} ${correct === false ? "incorrect" : ""}">
        <h4>${number}. ${escapeHtml(question.prompt)}</h4>
        <div class="options">
          ${question.options.map((option, optionIndex) => `
            <label class="option">
              <input type="radio"
                name="${escapeHtml(context)}-${escapeHtml(question.id)}"
                data-choice-context="${escapeHtml(context)}"
                data-question-id="${escapeHtml(question.id)}"
                value="${optionIndex}"
                ${Number(answer) === optionIndex ? "checked" : ""}>
              <span>${escapeHtml(option)}</span>
            </label>
          `).join("")}
        </div>
        ${checked ? `
          <div class="answer-note">
            ${correct ? "Đã chọn đúng." : `Đáp án: ${escapeHtml(question.options[question.answer])}.`}
            ${escapeHtml(question.explanation)}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderFillQuestion(question, answer, checked, context, number) {
    const correct = checked ? isQuestionCorrect(question, answer) : null;
    const given = Array.isArray(answer) ? answer : [answer];
    const segments = question.prompt.split("____");
    const inlinePrompt = segments.map((segment, index) => {
      if (index === segments.length - 1) return escapeHtml(segment);
      return `${escapeHtml(segment)}<input type="text" class="fill-inline" autocomplete="off" lang="zh-Hans"
        data-fill-context="${escapeHtml(context)}"
        data-question-id="${escapeHtml(question.id)}"
        data-blank-index="${index}"
        value="${escapeHtml(given[index] || "")}"
        aria-label="Chỗ trống ${index + 1}">`;
    }).join("");
    return `
      <article class="question ${correct === true ? "correct" : ""} ${correct === false ? "incorrect" : ""}">
        <h4>${number}. Điền từ/cụm từ còn thiếu${question.blanks.length > 1 ? ` (${question.blanks.length} chỗ trống)` : ""}</h4>
        <p class="fill-sentence" lang="zh-Hans">${inlinePrompt}</p>
        ${checked ? `
          <div class="answer-note">
            ${correct ? "Đã điền đúng." : `Đáp án: ${escapeHtml(question.answer)}.`}
            ${escapeHtml(question.explanation)}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderOrderQuestion(question, answer, checked, number) {
    const selected = Array.isArray(answer) ? answer : [];
    const correct = checked ? isQuestionCorrect(question, selected) : null;
    return `
      <article class="question ${correct === true ? "correct" : ""} ${correct === false ? "incorrect" : ""}">
        <h4>${number}. ${escapeHtml(question.prompt)}</h4>
        <div class="order-answer">
          ${selected.map(tokenIndex => `
            <span class="token-button">${escapeHtml(question.tokens[tokenIndex])}</span>
          `).join("")}
        </div>
        <div class="token-bank">
          ${question.tokens.map((token, tokenIndex) => `
            <button class="token-button" data-action="addOrderToken"
              data-question-id="${escapeHtml(question.id)}" data-token-index="${tokenIndex}"
              ${selected.includes(tokenIndex) ? "disabled" : ""}>
              ${escapeHtml(token)}
            </button>
          `).join("")}
        </div>
        <div class="order-tools">
          <button class="text-button" data-action="undoOrder" data-question-id="${escapeHtml(question.id)}">Lùi một bước</button>
          <button class="text-button danger" data-action="clearOrder" data-question-id="${escapeHtml(question.id)}">Xóa thứ tự</button>
        </div>
        ${checked ? `
          <div class="answer-note">
            ${correct ? "Câu đã được sắp xếp đúng." : escapeHtml(question.explanation)}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderWrittenQuestion(question, answer, practiceState, number) {
    const revealed = Boolean(practiceState.revealed[question.id]);
    const selfReview = practiceState.selfReview[question.id] || "";
    return `
      <article class="question written-question">
        <h4>${number}. ${escapeHtml(question.prompt)}</h4>
        <div class="writing-requirement">
          <span>${question.kind === "sentence-given-words" ? "Phải dùng đủ" : "Từ hoặc cấu trúc bắt buộc"}</span>
          ${question.words ? `
            <div class="required-words">
              ${question.words.map(word => `<strong>${escapeHtml(word)}</strong>`).join("")}
            </div>
          ` : `<strong>${escapeHtml(question.required)}</strong>`}
        </div>
        <textarea class="written-input"
          data-written-question="${escapeHtml(question.id)}"
          rows="3"
          placeholder="Viết câu tiếng Trung tại đây…">${escapeHtml(answer || "")}</textarea>
        <div class="written-tools">
          <button class="button secondary" data-action="toggleWrittenSample"
            data-question-id="${escapeHtml(question.id)}">
            ${revealed ? "Ẩn câu mẫu" : "Xem câu mẫu"}
          </button>
          ${revealed ? `
            <button class="button ${selfReview === "pass" ? "primary" : "secondary"}"
              data-action="reviewWritten" data-question-id="${escapeHtml(question.id)}" data-review="pass">
              Đạt
            </button>
            <button class="button ${selfReview === "retry" ? "danger" : "secondary"}"
              data-action="reviewWritten" data-question-id="${escapeHtml(question.id)}" data-review="retry">
              Cần làm lại
            </button>
          ` : ""}
        </div>
        ${revealed ? `
          <div class="answer-note written-sample">
            <strong>Câu mẫu:</strong> ${escapeHtml(question.sample)}
            <span>Đây là một cách viết; câu khác vẫn dùng được nếu đúng từ, đúng cấu trúc và đúng nghĩa.</span>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderReadingMaterial(reading) {
    return `
      <div class="reading-material">
        <div class="reading-block reading-prose">
          <div class="reading-label">Đoạn văn</div>
          <p lang="zh-Hans">${escapeHtml(reading.prose)}</p>
        </div>
        <div class="reading-block reading-dialogue">
          <div class="reading-label">Hội thoại</div>
          <div class="dialogue-lines">
            ${reading.dialogue.map(line => {
              const separatorIndex = line.indexOf("：");
              const speaker = separatorIndex >= 0 ? line.slice(0, separatorIndex) : "";
              const speech = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : line;
              return `
                <p class="dialogue-line" lang="zh-Hans">
                  ${speaker ? `<strong>${escapeHtml(speaker)}</strong>` : ""}
                  <span>${escapeHtml(speech)}</span>
                </p>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderPractice() {
    const item = lesson();
    const sections = buildPracticeSections(ui.lessonIndex);
    const questions = allPracticeQuestions(sections);
    const scoredQuestions = questions.filter(question => question.type !== "written");
    const writtenQuestions = questions.filter(question => question.type === "written");
    const practiceState = ensurePracticeState(item.id);
    const resultIsCurrent = practiceState.checked
      && practiceState.total === scoredQuestions.length;
    const hit = scoreQuestions(scoredQuestions, practiceState.answers);
    const reviewedWritten = writtenQuestions.filter(
      question => practiceState.selfReview[question.id]
    ).length;

    contentEl.innerHTML = `
      <section class="practice-overview">
        <div>
          <h3>Bài tập ngày ${escapeHtml(item.shortDate)}</h3>
          <p>
            ${questions.length} câu: ${scoredQuestions.length} câu chấm tự động,
            ${writtenQuestions.length} câu tự viết và một bài đọc gồm đoạn văn, hội thoại.
          </p>
        </div>
        ${resultIsCurrent ? `
          <div class="score-box">
            <strong>${hit}/${scoredQuestions.length}</strong>
            <span>Chấm tự động</span>
            <small>${reviewedWritten}/${writtenQuestions.length} câu tự viết đã đối chiếu</small>
          </div>
        ` : ""}
      </section>

      ${sections.map(section => `
        <section class="exercise-section">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.description)}</p>
          ${section.audio ? `
            <div class="listening-audio">
              <audio controls preload="none" src="${escapeHtml(section.audio)}"></audio>
            </div>
          ` : ""}
          ${section.reading ? renderReadingMaterial(section.reading) : section.passage ? `
            <div class="reading-passage">
              <div class="reading-label">Bài đọc</div>
              ${escapeHtml(section.passage)}
            </div>
          ` : ""}
          <div class="question-list">
            ${section.questions.map((question, index) => {
              const answer = practiceState.answers[question.id];
              if (question.type === "written") {
                return renderWrittenQuestion(question, answer, practiceState, index + 1);
              }
              if (question.type === "order") {
                return renderOrderQuestion(question, answer, resultIsCurrent, index + 1);
              }
              if (question.type === "fill") {
                return renderFillQuestion(question, answer, resultIsCurrent, "practice", index + 1);
              }
              return renderChoiceQuestion(
                question,
                answer,
                resultIsCurrent,
                "practice",
                index + 1
              );
            }).join("")}
          </div>
        </section>
      `).join("")}

      <div class="practice-actions">
        <button class="button secondary" data-action="resetPractice">Làm lại</button>
        <button class="button primary" data-action="checkPractice">Chấm bài</button>
      </div>
    `;
  }

  function ensureMeasureState() {
    savedData.progress.measureWords ||= { answers: {}, checkedPages: {} };
    savedData.progress.measureWords.answers ||= {};
    savedData.progress.measureWords.checkedPages ||= {};
    return savedData.progress.measureWords;
  }

  function measureOptions(answer, excluded, seed) {
    const blocked = new Set([answer].concat(excluded || []));
    const distractors = measureWords.classifiers
      .map(item => item.hanzi)
      .filter(item => !blocked.has(item))
      .map(item => ({ item, weight: hash(`${seed}-${item}`) }))
      .sort((left, right) => left.weight - right.weight)
      .slice(0, 3)
      .map(item => item.item);
    return [answer].concat(distractors);
  }

  function measureQuestions(mode = ui.measureMode) {
    if (mode === "choice") {
      return measureWords.pairs.map(pair => ({
        ...rotateChoice(
          [
            `Chọn lượng từ phù hợp nhất cho “${pair.target}”.`,
            measureOptions(pair.classifier, pair.accepted, `choice-${pair.id}`),
            0,
            pair.explanation
          ],
          `measure-choice-${pair.id}`
        ),
        sentence: pair.sentence,
        accepted: pair.accepted
      }));
    }

    if (mode === "fill") {
      return measureWords.pairs.map(pair => ({
        id: `measure-fill-${pair.id}`,
        type: "fill",
        prompt: `Tự điền lượng từ cho “${pair.target}”.`,
        sentence: pair.sentence,
        answer: pair.classifier,
        accepted: pair.accepted,
        explanation: pair.explanation
      }));
    }

    if (mode === "numbers") {
      return measureWords.largeNumbers.values.flatMap(item => [
        {
          id: `number-write-chinese-${item.value}`,
          type: "fill",
          prompt: "Viết số sau bằng chữ Hán.",
          sentence: item.display,
          answer: item.chinese,
          accepted: item.acceptedChinese,
          inputLabel: "Chữ Hán",
          placeholder: "Nhập cách đọc bằng chữ Hán",
          maxLength: 32,
          explanation: `${item.display} đọc là ${item.chinese}.`
        },
        {
          id: `number-write-digits-${item.value}`,
          type: "fill",
          prompt: "Viết số sau bằng chữ số.",
          sentence: item.chinese,
          answer: String(item.value),
          accepted: [String(item.value)],
          inputLabel: "Chữ số",
          placeholder: "Nhập chữ số",
          inputMode: "numeric",
          maxLength: 12,
          explanation: `${item.chinese} là ${item.display}.`
        }
      ]);
    }

    return measureWords.classifiers.map(item => ({
      ...rotateChoice(
        [
          `Lượng từ nào phù hợp với nhóm: ${item.nouns}?`,
          measureOptions(item.hanzi, [], `group-${item.id}`),
          0,
          item.explanation
        ],
        `measure-group-${item.id}`
      ),
      sentence: item.example.replace(item.hanzi, "___"),
      accepted: [item.hanzi]
    }));
  }

  function normalizeMeasureAnswer(value) {
    return String(value ?? "").trim().replace(/[，。！？,.!?\s]/g, "");
  }

  function isMeasureQuestionCorrect(question, answer) {
    if (question.type === "fill") {
      const normalized = normalizeMeasureAnswer(answer);
      return question.accepted.some(item => normalizeMeasureAnswer(item) === normalized);
    }
    return Number(answer) === question.answer;
  }

  function measurePageKey() {
    return `${ui.measureMode}-${ui.measurePage}`;
  }

  function renderMeasureQuestion(question, answer, checked, number) {
    const correct = checked ? isMeasureQuestionCorrect(question, answer) : null;
    const resultClass = correct === true ? "correct" : correct === false ? "incorrect" : "";

    if (question.type === "fill") {
      return `
        <article class="question measure-question ${resultClass}">
          <h4>${number}. ${escapeHtml(question.prompt)}</h4>
          <p class="measure-sentence" lang="zh-Hans">${escapeHtml(question.sentence)}</p>
          <label class="measure-fill-label">
            <span>${escapeHtml(question.inputLabel || "Lượng từ")}</span>
            <input type="text" inputmode="${escapeHtml(question.inputMode || "text")}"
              maxlength="${question.maxLength || 4}" autocomplete="off"
              data-measure-fill="${escapeHtml(question.id)}"
              value="${escapeHtml(answer || "")}"
              placeholder="${escapeHtml(question.placeholder || "Nhập chữ Hán")}">
          </label>
          ${checked ? `
            <div class="answer-note">
              ${correct ? "Đã điền đúng." : `Đáp án: ${escapeHtml(question.answer)}.`}
              ${escapeHtml(question.explanation)}
            </div>
          ` : ""}
        </article>
      `;
    }

    return `
      <article class="question measure-question ${resultClass}">
        <h4>${number}. ${escapeHtml(question.prompt)}</h4>
        <p class="measure-sentence" lang="zh-Hans">${escapeHtml(question.sentence)}</p>
        <div class="options measure-options">
          ${question.options.map((option, optionIndex) => `
            <label class="option">
              <input type="radio"
                name="measure-${escapeHtml(question.id)}"
                data-choice-context="measure"
                data-question-id="${escapeHtml(question.id)}"
                value="${optionIndex}"
                ${Number(answer) === optionIndex ? "checked" : ""}>
              <span lang="zh-Hans">${escapeHtml(option)}</span>
            </label>
          `).join("")}
        </div>
        ${checked ? `
          <div class="answer-note">
            ${correct ? "Đã chọn đúng." : `Đáp án: ${escapeHtml(question.options[question.answer])}.`}
            ${escapeHtml(question.explanation)}
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderMeasureWords() {
    const state = ensureMeasureState();
    const questions = measureQuestions();
    const pageCount = Math.ceil(questions.length / measurePageSize);
    if (ui.measurePage >= pageCount) ui.measurePage = Math.max(0, pageCount - 1);
    const pageStart = ui.measurePage * measurePageSize;
    const pageQuestions = questions.slice(pageStart, pageStart + measurePageSize);
    const pageKey = measurePageKey();
    const savedResult = state.checkedPages[pageKey];
    const checked = savedResult?.total === pageQuestions.length;
    const score = pageQuestions.filter(question =>
      isMeasureQuestionCorrect(question, state.answers[question.id])
    ).length;
    const answeredCount = Object.values(state.answers).filter(answer =>
      answer !== undefined && answer !== null && String(answer).trim() !== ""
    ).length;
    const modeLabels = {
      choice: "Chọn đáp án",
      fill: "Tự điền",
      group: "Ôn theo nhóm",
      numbers: "Số lớn"
    };

    contentEl.innerHTML = `
      <section class="measure-reference">
        <div class="section-heading">
          <div>
            <p class="focus-line">Bảng lượng từ không trùng</p>
            <h3>Tất cả lượng từ dùng với nội dung đã học</h3>
          </div>
          <p>${measureWords.classifiers.length} lượng từ</p>
        </div>
        <p class="measure-reference-note">
          Một danh từ có thể dùng nhiều lượng từ tùy cách nhìn. Bảng gộp các danh từ vào
          lượng từ tương ứng; phần giải thích nêu rõ sắc thái và ngữ cảnh thường dùng.
        </p>
        <div class="table-scroll">
          <table class="measure-table">
            <thead>
              <tr>
                <th>Lượng từ</th>
                <th>Phiên âm</th>
                <th>Nhóm</th>
                <th>Dùng với</th>
                <th>Giải thích</th>
                <th>Ví dụ</th>
              </tr>
            </thead>
            <tbody>
              ${measureWords.classifiers.map(item => `
                <tr>
                  <td><strong class="measure-hanzi" lang="zh-Hans">${escapeHtml(item.hanzi)}</strong></td>
                  <td><span class="pinyin">${escapeHtml(item.pinyin)}</span></td>
                  <td>${escapeHtml(item.group)}</td>
                  <td>${escapeHtml(item.nouns)}</td>
                  <td>${escapeHtml(item.explanation)}</td>
                  <td><span class="measure-example" lang="zh-Hans">${escapeHtml(item.example)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>

      <section class="large-number-reference">
        <div class="section-heading">
          <div>
            <p class="focus-line">Từ hàng trăm đến hàng triệu</p>
            <h3>Đếm số trên 100, trên 1.000 và theo vạn</h3>
          </div>
          <p>${measureWords.largeNumbers.exerciseCount} câu riêng</p>
        </div>

        <div class="table-scroll">
          <table class="number-unit-table">
            <thead>
              <tr>
                <th>Mốc</th>
                <th>Phiên âm</th>
                <th>Giá trị</th>
                <th>Cách hiểu</th>
                <th>Ví dụ</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              ${measureWords.largeNumbers.units.map(item => `
                <tr>
                  <td><strong class="measure-hanzi" lang="zh-Hans">${escapeHtml(item.hanzi)}</strong></td>
                  <td><span class="pinyin">${escapeHtml(item.pinyin)}</span></td>
                  <td>${escapeHtml(item.value)}</td>
                  <td>${escapeHtml(item.meaning)}</td>
                  <td><span class="measure-example" lang="zh-Hans">${escapeHtml(item.example)}</span></td>
                  <td>${escapeHtml(item.result)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <ol class="number-rule-list">
          ${measureWords.largeNumbers.rules.map((rule, index) => `
            <li>
              <span class="number-rule-index">${index + 1}</span>
              <div>
                <h4>${escapeHtml(rule.title)}</h4>
                <p>${escapeHtml(rule.explanation)}</p>
                <strong lang="zh-Hans">${escapeHtml(rule.example)}</strong>
              </div>
            </li>
          `).join("")}
        </ol>
      </section>

      <section class="measure-practice">
        <div class="measure-practice-heading">
          <div>
            <p class="focus-line">${measureWords.exerciseCount} câu luyện tập</p>
            <h3>${ui.measureMode === "numbers" ? "Đọc và viết số lớn" : "Điền lượng từ"}</h3>
            <p>Đã trả lời ${answeredCount} câu. Mỗi trang có tối đa ${measurePageSize} câu.</p>
          </div>
          ${checked ? `
            <div class="score-box">
              <strong>${score}/${pageQuestions.length}</strong>
              <span>Kết quả trang này</span>
            </div>
          ` : ""}
        </div>

        <div class="measure-controls">
          <div class="scope-control measure-mode" aria-label="Dạng bài lượng từ và số lớn">
            ${Object.entries(modeLabels).map(([mode, label]) => `
              <button class="${ui.measureMode === mode ? "active" : ""}"
                data-action="measureMode" data-mode="${mode}">${label}</button>
            `).join("")}
          </div>
          <div class="measure-pagination">
            <button class="icon-button" data-action="measurePreviousPage"
              title="Trang trước" ${ui.measurePage === 0 ? "disabled" : ""}>←</button>
            <strong>Trang ${ui.measurePage + 1}/${pageCount}</strong>
            <button class="icon-button" data-action="measureNextPage"
              title="Trang sau" ${ui.measurePage === pageCount - 1 ? "disabled" : ""}>→</button>
          </div>
        </div>

        <div class="question-list measure-exercises">
          ${pageQuestions.map((question, index) => renderMeasureQuestion(
            question,
            state.answers[question.id],
            checked,
            pageStart + index + 1
          )).join("")}
        </div>

        <div class="measure-page-actions">
          <button class="button secondary" data-action="resetMeasurePage">Làm lại trang này</button>
          <button class="button primary" data-action="checkMeasurePage">Chấm trang này</button>
        </div>
      </section>
    `;
  }

  function finalQuestionSets() {
    return {
      main: content.finalQuestions.map((question, index) =>
        rotateChoice(question, `final-main-${index}`)
      ),
      reading: content.finalReading.questions.map((question, index) =>
        rotateChoice(question, `final-reading-${index}`)
      )
    };
  }

  function renderFinal() {
    const finalState = savedData.progress.final;
    const sets = finalQuestionSets();
    const allQuestions = sets.main.concat(sets.reading);
    const resultIsCurrent = finalState.checked && finalState.total === allQuestions.length;
    const hit = scoreQuestions(allQuestions, finalState.answers);

    contentEl.innerHTML = `
      <section class="practice-overview">
        <div>
          <h3>Tổng ôn từ 27/05 đến 29/07</h3>
          <p>
            ${allQuestions.length} câu bao phủ toàn bộ từ vựng, cấu trúc,
            chữ gần giống và một bài đọc tích lũy.
          </p>
        </div>
        ${resultIsCurrent ? `
          <div class="score-box">
            <strong>${hit}/${allQuestions.length}</strong>
            <span>Kết quả gần nhất</span>
          </div>
        ` : ""}
      </section>

      <section class="exercise-section">
        <h3>Phần 1 · Từ vựng và cấu trúc</h3>
        <p>Câu hỏi được trộn vị trí đáp án khi tải bài.</p>
        <div class="question-list">
          ${sets.main.map((question, index) =>
            renderChoiceQuestion(
              question,
              finalState.answers[question.id],
              resultIsCurrent,
              "final",
              index + 1
            )
          ).join("")}
        </div>
      </section>

      <section class="exercise-section">
        <h3>Phần 2 · Đọc hiểu</h3>
        <p>${escapeHtml(content.finalReading.title)}</p>
        <div class="reading-passage">
          <div class="reading-label">Bài đọc tổng hợp</div>
          ${escapeHtml(content.finalReading.text)}
        </div>
        <div class="question-list">
          ${sets.reading.map((question, index) =>
            renderChoiceQuestion(
              question,
              finalState.answers[question.id],
              resultIsCurrent,
              "final",
              index + 1
            )
          ).join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <h3>Phần 3 · Viết câu</h3>
          <p>${content.finalWriting.length} câu</p>
        </div>
        <ul class="writing-list">
          ${content.finalWriting.map((drill, index) => {
            const key = `final-${index}`;
            return `
              <li class="writing-row">
                <p class="write-prompt">${index + 1}. ${escapeHtml(drill[0])}</p>
                <button class="button secondary" data-action="toggleWriting" data-key="${key}">
                  ${savedData.progress.writingShown[key] ? "Ẩn đáp án" : "Xem đáp án"}
                </button>
                <div class="write-answer ${savedData.progress.writingShown[key] ? "" : "hidden"}">
                  ${escapeHtml(drill[1])}
                </div>
              </li>
            `;
          }).join("")}
        </ul>
      </section>

      <div class="practice-actions">
        <button class="button secondary" data-action="resetFinal">Làm lại</button>
        <button class="button primary" data-action="checkFinal">Chấm bài cuối</button>
      </div>
    `;
  }

  function renderSimilar() {
    contentEl.innerHTML = `
      <section class="cluster-header">
        <p>
          Mỗi cụm gom các chữ hoặc từ dễ nhìn nhầm. Dữ liệu thêm, sửa hoặc xóa
          tại đây được lưu trong máy cùng với tiến độ bài tập.
        </p>
        <button class="button primary" data-action="newCluster">+ Cụm mới</button>
      </section>

      <div class="cluster-list">
        ${savedData.clusters.map(cluster => `
          <section class="cluster">
            <div class="cluster-heading">
              <div>
                <h3>${escapeHtml(cluster.name)}</h3>
                <p>${escapeHtml(cluster.hint || "Chưa có ghi chú phân biệt.")}</p>
              </div>
              <div class="cluster-actions">
                <button class="button secondary" data-action="newClusterItem" data-cluster-id="${escapeHtml(cluster.id)}">
                  + Thêm chữ
                </button>
                <button class="text-button" data-action="editCluster" data-cluster-id="${escapeHtml(cluster.id)}">
                  Sửa cụm
                </button>
                <button class="text-button danger" data-action="deleteCluster" data-cluster-id="${escapeHtml(cluster.id)}">
                  Xóa cụm
                </button>
              </div>
            </div>

            <div class="table-scroll">
              <table class="similar-table">
                <thead>
                  <tr>
                    <th class="character-cell">Chữ / từ</th>
                    <th class="sound-cell">Phiên âm</th>
                    <th>Nghĩa</th>
                    <th>Dấu hiệu phân biệt</th>
                    <th class="actions-cell">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${cluster.items.length ? cluster.items.map(item => `
                    <tr>
                      <td><span class="character-large">${escapeHtml(item.hanzi)}</span></td>
                      <td><span class="pinyin">${escapeHtml(item.pinyin || "—")}</span></td>
                      <td>${escapeHtml(item.meaning || "—")}</td>
                      <td>${escapeHtml(item.note || "—")}</td>
                      <td>
                        <div class="row-actions">
                          <button class="text-button" data-action="editClusterItem"
                            data-cluster-id="${escapeHtml(cluster.id)}" data-item-id="${escapeHtml(item.id)}">
                            Sửa
                          </button>
                          <button class="text-button danger" data-action="deleteClusterItem"
                            data-cluster-id="${escapeHtml(cluster.id)}" data-item-id="${escapeHtml(item.id)}">
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join("") : `
                    <tr><td class="empty-row" colspan="5">Cụm này chưa có chữ nào.</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </section>
        `).join("")}
      </div>
    `;
  }

  function renderRoadmap() {
    seedRoadmapReviews();
    const roadmap = ensureRoadmapState();
    const currentIndex = Math.max(0, lessons.findIndex(item => item.id === roadmap.currentLessonId));
    const nextLesson = lessons[currentIndex + 1] || null;
    const remainingCount = Math.max(0, lessons.length - currentIndex - 1);
    const dueToday = dueReviewsToday();
    const upcoming = upcomingReviews(7);
    const today = todayIso();

    const checkpointOptions = lessons.map(item => `
      <option value="${escapeHtml(item.id)}" ${item.id === roadmap.currentLessonId ? "selected" : ""}>
        ${escapeHtml(item.shortDate)} — ${escapeHtml(item.title)}
      </option>
    `).join("");

    const newLessonCard = nextLesson ? `
      <div class="roadmap-card">
        <div class="roadmap-card-head">
          <span class="roadmap-card-date">${escapeHtml(nextLesson.shortDate)}</span>
          <span class="roadmap-card-title">${escapeHtml(nextLesson.title)}</span>
        </div>
        <div class="roadmap-card-actions">
          <button class="button primary" type="button" data-action="goToLesson"
            data-lesson-id="${escapeHtml(nextLesson.id)}" data-target-view="lesson">Học bài này</button>
          <button class="button secondary" type="button" data-action="advanceCurrentLesson">Đánh dấu đã học xong</button>
        </div>
      </div>
    ` : `
      <p class="roadmap-empty">Đã học hết toàn bộ bài hiện có. Chờ bổ sung tài liệu mới.</p>
    `;

    const dueCards = dueToday.length ? dueToday.map(({ lesson: lessonItem, entry }) => `
      <div class="roadmap-card roadmap-card-due">
        <div class="roadmap-card-head">
          <span class="roadmap-card-date">${escapeHtml(lessonItem.shortDate)}</span>
          <span class="roadmap-card-title">${escapeHtml(lessonItem.title)}</span>
          <span class="roadmap-card-meta">${entry.nextReviewDate < today ? "Quá hạn" : "Đến hạn hôm nay"} · lần ${entry.stage + 1}</span>
        </div>
        <div class="roadmap-card-actions">
          <button class="button primary" type="button" data-action="goToLesson"
            data-lesson-id="${escapeHtml(lessonItem.id)}" data-target-view="practice">Ôn ngay (làm bài tập)</button>
          <button class="button secondary" type="button" data-action="markReviewed"
            data-lesson-id="${escapeHtml(lessonItem.id)}">Đã ôn xong</button>
        </div>
      </div>
    `).join("") : `
      <p class="roadmap-empty">Không có buổi nào cần ôn hôm nay.</p>
    `;

    const upcomingList = upcoming.length ? `
      <ul class="roadmap-upcoming-list">
        ${upcoming.map(({ lesson: lessonItem, entry }) => `
          <li>
            <span class="roadmap-upcoming-date">${escapeHtml(formatIsoAsVn(entry.nextReviewDate))}</span>
            <span class="roadmap-upcoming-title">${escapeHtml(lessonItem.shortDate)} — ${escapeHtml(lessonItem.title)}</span>
          </li>
        `).join("")}
      </ul>
    ` : `
      <p class="roadmap-empty">Chưa có buổi nào lên lịch trong 7 ngày tới.</p>
    `;

    contentEl.innerHTML = `
      <section class="roadmap-page">
        <div class="roadmap-today">
          <p class="roadmap-today-label">Hôm nay</p>
          <p class="roadmap-today-date">${escapeHtml(formatIsoAsVn(today))}</p>
          <p class="roadmap-today-note">
            Đã đánh dấu học đến <strong>${escapeHtml(lessons[currentIndex].shortDate)} — ${escapeHtml(lessons[currentIndex].title)}</strong>.
            Còn ${remainingCount} buổi chưa học trong chương trình hiện có.
          </p>
          <label class="roadmap-checkpoint">
            Chỉnh lại mốc đã học tới (nếu khai sai)
            <select data-roadmap-select="currentLesson">${checkpointOptions}</select>
          </label>
        </div>

        <div class="section">
          <div class="section-heading">
            <h3>📘 Bài mới hôm nay</h3>
          </div>
          ${newLessonCard}
        </div>

        <div class="section">
          <div class="section-heading">
            <h3>🔁 Ôn tập hôm nay (active recall)</h3>
            <p>Mở bài tập và tự làm lại, không xem trước đáp án.</p>
          </div>
          <div class="roadmap-review-list">${dueCards}</div>
        </div>

        <div class="section">
          <div class="section-heading">
            <h3>📅 7 ngày tới</h3>
          </div>
          ${upcomingList}
        </div>
      </section>
    `;
  }

  function renderCommonStructures() {
    const entries = commonStructures?.entries || [];
    contentEl.innerHTML = `
      <section class="common-page">
        <p class="common-intro">
          Bảng tra nhanh các cụm từ và cấu trúc hay gặp, không gắn với ngày học nào.
        </p>
        ${entries.map(entry => `
          <article class="common-entry">
            <header class="common-entry-head">
              <span class="common-entry-hanzi" lang="zh-Hans">${escapeHtml(entry.hanzi)}</span>
              <div>
                <h3>${escapeHtml(entry.title)}</h3>
                <p class="common-entry-pinyin">${escapeHtml(entry.pinyin)}</p>
              </div>
            </header>
            <p class="common-entry-summary">${escapeHtml(entry.summary)}</p>

            ${entry.phraseTable ? `
              <h4 class="common-block-title">${escapeHtml(entry.phraseTable.title)}</h4>
              <div class="table-scroll">
                <table class="common-table">
                  <thead><tr>${entry.phraseTable.columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
                  <tbody>
                    ${entry.phraseTable.rows.map(row => `
                      <tr>
                        <td class="common-phrase" lang="zh-Hans">${escapeHtml(row.phrase)}</td>
                        <td class="common-pinyin">${escapeHtml(row.pinyin)}</td>
                        <td class="common-hanviet">${escapeHtml(row.hanViet)}</td>
                        <td><ul class="common-meaning-list">${row.meanings.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul></td>
                        <td>
                          <ul class="common-example-list">
                            ${row.examples.map(([zh, vi]) => `
                              <li><span lang="zh-Hans">${escapeHtml(zh)}</span><em>${escapeHtml(vi)}</em></li>
                            `).join("")}
                          </ul>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            ` : ""}

            ${entry.patternTable ? `
              <h4 class="common-block-title">${escapeHtml(entry.patternTable.title)}</h4>
              <div class="table-scroll">
                <table class="common-table">
                  <thead><tr>${entry.patternTable.columns.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
                  <tbody>
                    ${entry.patternTable.rows.map(row => `
                      <tr>
                        <td class="common-formula" lang="zh-Hans">${escapeHtml(row.formula)}</td>
                        <td class="common-strong">${escapeHtml(row.meaning)}</td>
                        <td>${escapeHtml(row.usage)}</td>
                        <td>
                          <ul class="common-example-list">
                            ${row.examples.map(([zh, vi]) => `
                              <li><span lang="zh-Hans">${escapeHtml(zh)}</span><em>${escapeHtml(vi)}</em></li>
                            `).join("")}
                          </ul>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            ` : ""}

            ${entry.tipList ? `
              <h4 class="common-block-title">${escapeHtml(entry.tipList.title)}</h4>
              <ul class="common-tip-list">
                ${entry.tipList.items.map(item => `
                  <li>
                    <span class="common-tip-phrase" lang="zh-Hans">${escapeHtml(item.phrase)}</span>
                    <span class="common-tip-pinyin">${escapeHtml(item.pinyin)}</span>
                    <span class="common-tip-focus">${escapeHtml(item.focus)}</span>
                    <span class="common-tip-detail">${escapeHtml(item.detail)}</span>
                  </li>
                `).join("")}
              </ul>
            ` : ""}

            ${entry.mnemonic ? `
              <h4 class="common-block-title">${escapeHtml(entry.mnemonic.title)}</h4>
              <div class="common-mnemonic">
                <p class="common-mnemonic-sentence" lang="zh-Hans">${escapeHtml(entry.mnemonic.sentence)}</p>
                <p class="common-mnemonic-pinyin">${escapeHtml(entry.mnemonic.pinyin)}</p>
                <p class="common-mnemonic-meaning">${escapeHtml(entry.mnemonic.meaning)}</p>
              </div>
            ` : ""}
          </article>
        `).join("")}
      </section>
    `;
  }

  function renderNotes() {
    contentEl.innerHTML = `
      <section class="notes-page">
        <p class="notes-hint">
          Ghi chú tự do, không gắn với ngày học nào. Lưu cùng máy với tiến độ bài tập.
        </p>
        <textarea class="notes-textarea" data-notes-field
          placeholder="Viết ghi chú tại đây…">${escapeHtml(savedData.notes || "")}</textarea>
      </section>
    `;
  }

  // Từ điển tra ngược: một từ trong giáo trình → các ngày học có dạy từ đó.
  // Dựng một lần, dùng cho cả tách từ và tra nghĩa ở tab Tra ảnh.
  const vocabIndex = (() => {
    const byWord = new Map();
    lessons.forEach((item, index) => {
      item.vocab.forEach(([hanzi, pinyin, meaning]) => {
        // Một số mục từ vựng trong giáo trình không chỉ có chữ Hán: dạng kèm
        // biến thể (没有 / 没), dạng có chỗ trống (太...了) hoặc phần tùy chọn
        // (聊天（儿）). Tách thành từng đoạn chữ Hán để tra được, còn nguyên văn
        // vẫn giữ để hiển thị.
        // Phần trong ngoặc là thành phần tùy chọn chứ không phải từ riêng, nên bỏ
        // hẳn: 聊天（儿） chỉ cho khóa 聊天, không cho khóa 儿.
        const keys = hanzi
          .replace(/[（(][^）)]*[）)]/gu, " ")
          .split(/[^\p{Script=Han}]+/u)
          .filter(Boolean);
        keys.forEach(key => {
          if (!byWord.has(key)) byWord.set(key, { key, forms: [], meanings: [], lessons: [] });
          const entry = byWord.get(key);
          if (!entry.forms.some(form => form.hanzi === hanzi)) {
            entry.forms.push({ hanzi, pinyin });
          }
          if (!entry.meanings.includes(meaning)) entry.meanings.push(meaning);
          if (!entry.lessons.some(one => one.index === index)) {
            entry.lessons.push({ index, id: item.id, date: item.date, order: index + 1 });
          }
        });
      });
    });

    // Chữ lẻ nào không tự thành một từ thì vẫn tra được qua các từ có chứa nó,
    // ví dụ 你 chỉ xuất hiện trong 你好.
    const byCharacter = new Map();
    byWord.forEach(entry => {
      for (const character of entry.key) {
        if (!byCharacter.has(character)) byCharacter.set(character, []);
        if (!byCharacter.get(character).includes(entry)) byCharacter.get(character).push(entry);
      }
    });

    // Nhiều chữ chỉ xuất hiện trong câu ví dụ, bài đọc hoặc bài tập chứ không
    // nằm trong bảng từ vựng ngày nào (ví dụ 她、们、需、注). Nếu chỉ tra bảng từ
    // vựng thì tab Tra ảnh báo nhầm là "chưa gặp trong bài nào", nên dựng thêm
    // một chỉ mục phụ theo từng chữ: chữ đó gặp ở ngày nào và ở phần nào.
    const byContext = new Map();
    const noteContext = (text, index, item, where) => {
      if (typeof text !== "string") return;
      for (const character of text) {
        if (!/\p{Script=Han}/u.test(character)) continue;
        if (!byContext.has(character)) byContext.set(character, []);
        const list = byContext.get(character);
        let entry = list.find(one => one.index === index);
        if (!entry) {
          entry = { index, id: item.id, date: item.date, order: index + 1, where: [] };
          list.push(entry);
        }
        if (!entry.where.includes(where)) entry.where.push(where);
      }
    };

    lessons.forEach((item, index) => {
      const add = (text, where) => noteContext(text, index, item, where);
      (item.examples || []).forEach(([hanzi]) => add(hanzi, "câu ví dụ"));
      (item.drills || []).forEach(([, answer]) => add(answer, "bài tập"));
      (item.patterns || []).forEach(([formula]) => add(formula, "mẫu câu"));
      (item.listening || []).forEach(part => {
        (part.dialogueLines || []).forEach(line => add(line, "bài nghe"));
        (part.trueFalse || []).forEach(([claim]) => add(claim, "bài nghe"));
      });

      const supplement = exampleSupplements[item.id];
      if (supplement) {
        (supplement.additions || []).forEach(([hanzi]) => add(hanzi, "câu ví dụ"));
        (supplement.patternEvidence || []).forEach(line => add(line, "câu ví dụ"));
      }

      const structure = structures[item.id];
      if (structure) {
        (structure.items || []).forEach(one => {
          add(one.formula, "mẫu câu");
          (one.examples || []).forEach(line => add(line, "câu ví dụ"));
        });
      }

      const extension = practiceExtensions[item.id];
      if (extension) {
        const reading = extension.reading || {};
        add(reading.prose, "bài đọc");
        (reading.dialogue || []).forEach(line => add(line, "bài đọc"));
        (reading.questions || []).forEach(one => {
          add(one.prompt, "bài đọc");
          (one.options || []).forEach(option => add(option, "bài đọc"));
        });
        (extension.wordTasks || []).forEach(one => {
          add(one.prompt, "bài tập");
          add(one.sample, "bài tập");
          (one.words || []).forEach(word => add(word, "bài tập"));
        });
      }

      (production[item.id] || []).forEach(one => {
        add(one.prompt, "bài tự viết");
        add(one.required, "bài tự viết");
        add(one.sample, "bài tự viết");
      });
    });

    // Tab Cấu trúc thông dụng không gắn với ngày học nào nhưng vẫn là nơi tra
    // được, ví dụ 除 chỉ xuất hiện ở mục 除了…以外.
    const byCommonStructure = new Map();
    (commonStructures && commonStructures.entries ? commonStructures.entries : []).forEach(entry => {
      // Các khối của một mục có cấu trúc lồng nhau khác nhau (bảng cụm từ, bảng
      // cấu trúc, mẹo), nên duyệt đệ quy mọi chuỗi thay vì đoán từng tầng.
      const collect = value => {
        if (typeof value === "string") {
          for (const character of value) {
            if (!/\p{Script=Han}/u.test(character)) continue;
            if (!byCommonStructure.has(character)) byCommonStructure.set(character, []);
            const list = byCommonStructure.get(character);
            if (!list.some(one => one.id === entry.id)) {
              list.push({ id: entry.id, label: entry.title || entry.hanzi });
            }
          }
          return;
        }
        if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === "object") Object.values(value).forEach(collect);
      };
      collect(entry);
    });

    const maxWordLength = Math.max(...[...byWord.keys()].map(word => [...word].length));
    return { byWord, byCharacter, byContext, byCommonStructure, maxWordLength };
  })();

  // Tách chuỗi chữ Hán theo kiểu khớp dài nhất trước, chỉ nhận những từ có
  // trong giáo trình — nhờ vậy không cần thư viện phân từ tiếng Trung.
  function lookupHanText(text) {
    const characters = [...text].filter(character => /\p{Script=Han}/u.test(character));
    const hits = new Map();
    const unknown = new Map();

    for (let position = 0; position < characters.length; ) {
      let matched = null;
      const remaining = Math.min(vocabIndex.maxWordLength, characters.length - position);
      for (let length = remaining; length >= 1; length--) {
        const candidate = characters.slice(position, position + length).join("");
        if (vocabIndex.byWord.has(candidate)) {
          matched = candidate;
          break;
        }
      }

      if (matched) {
        hits.set(matched, (hits.get(matched) || 0) + 1);
        position += [...matched].length;
        continue;
      }

      const character = characters[position];
      unknown.set(character, (unknown.get(character) || 0) + 1);
      position += 1;
    }

    const words = [...hits.entries()]
      .map(([key, count]) => ({ ...vocabIndex.byWord.get(key), count }))
      .sort((left, right) => left.lessons[0].order - right.lessons[0].order);

    const unknownWords = [...unknown.keys()].map(character => ({
      character,
      relatedWords: vocabIndex.byCharacter.get(character) || [],
      contextLessons: (vocabIndex.byContext.get(character) || [])
        .slice()
        .sort((left, right) => left.order - right.order),
      commonStructures: vocabIndex.byCommonStructure.get(character) || []
    }));

    return { words, unknown: unknownWords, hanCount: characters.length };
  }

  async function runImageLookup(blob) {
    ui.imageLookup = { status: "loading", message: "", words: [], unknown: [], hanCount: 0 };
    renderImageLookup();

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Máy chủ không xử lý được ảnh.");

      const result = lookupHanText(payload.text || "");
      ui.imageLookup = { status: "done", message: "", ...result };
    } catch (error) {
      ui.imageLookup = {
        status: "error",
        message: error.message || "Không tra được ảnh này.",
        words: [],
        unknown: [],
        hanCount: 0
      };
    }

    renderImageLookup();
  }

  // Chữ tới được đây thì không nằm trong từ ghép nào đã dạy (nhóm đó đã tách sang
  // bảng riêng), nhưng vẫn có thể đã gặp trong câu ví dụ, bài đọc, bài tập hoặc ở
  // tab Cấu trúc thông dụng. Không có chỗ nào mới là "chưa gặp trong bài nào".
  const UNKNOWN_LESSON_LIMIT = 4;
  const RELATED_WORD_LIMIT = 4;

  function describeUnknownCharacter(item) {
    const parts = [];

    if (item.contextLessons.length) {
      const places = [...new Set(item.contextLessons.flatMap(one => one.where))];
      // Chữ rất thông dụng (你、她、们) có mặt ở hàng chục ngày; liệt kê hết thì
      // kín màn hình, nên chỉ hiện vài ngày đầu rồi ghi số ngày còn lại.
      const shown = item.contextLessons.slice(0, UNKNOWN_LESSON_LIMIT);
      const hidden = item.contextLessons.length - shown.length;
      const buttons = shown
        .map(one => {
          const toPractice = one.where.some(where => where !== "câu ví dụ" && where !== "mẫu câu");
          const targetView = toPractice && !one.where.includes("câu ví dụ") ? "practice" : "lesson";
          return `
            <button class="image-lookup-jump" type="button" data-action="goToLesson"
              data-lesson-id="${escapeHtml(one.id)}" data-target-view="${targetView}">
              Bài ${one.order} · ${escapeHtml(one.date)}
            </button>
          `;
        })
        .join("");
      parts.push(`
        <span class="image-lookup-related">có trong ${escapeHtml(places.join("、"))} của:</span>
        <span class="image-lookup-lessons">
          ${buttons}
          ${hidden ? `<span class="image-lookup-more">+${hidden} ngày khác</span>` : ""}
        </span>
      `);
    }

    // Tab Cấu trúc thông dụng chỉ nhắc khi chữ đó không xuất hiện ở đâu khác,
    // nếu không thì chữ nào cũng kèm một dãy mục không liên quan.
    if (!parts.length && item.commonStructures.length) {
      parts.push(`<span class="image-lookup-related">có ở tab Cấu trúc thông dụng: ${item.commonStructures
        .map(one => escapeHtml(one.label))
        .join("、")}</span>`);
    }

    if (!parts.length) {
      return `<span class="image-lookup-related">chưa gặp trong bài nào</span>`;
    }

    return parts.join("");
  }

  function renderImageLookup() {
    const state = ui.imageLookup;

    const intro = `
      <div class="image-lookup-intro">
        <p class="image-lookup-hint">
          Dán ảnh bằng <kbd>⌘</kbd><kbd>V</kbd> vào trang này, hoặc chọn tệp ảnh.
          Chữ Hán trong ảnh được đọc bằng OCR của macOS, còn nghĩa và số bài lấy từ giáo trình.
        </p>
        <label class="button secondary image-lookup-file">
          Chọn tệp ảnh
          <input type="file" accept="image/*" data-action="pickLookupImage" hidden>
        </label>
      </div>
    `;

    if (state.status === "loading") {
      contentEl.innerHTML = `
        <section class="image-lookup">
          ${intro}
          <p class="image-lookup-status">Đang đọc chữ trong ảnh…</p>
        </section>
      `;
      return;
    }

    if (state.status === "error") {
      contentEl.innerHTML = `
        <section class="image-lookup">
          ${intro}
          <div class="error-panel">${escapeHtml(state.message)}</div>
        </section>
      `;
      return;
    }

    if (state.status === "idle") {
      contentEl.innerHTML = `
        <section class="image-lookup">
          ${intro}
          <p class="image-lookup-status">Chưa có ảnh nào. Dán ảnh để bắt đầu.</p>
        </section>
      `;
      return;
    }

    // Chữ nằm trong một từ ghép đã dạy thì coi như đã học, chỉ là OCR tách lẻ ra
    // nên không khớp nguyên từ; tách riêng khỏi nhóm thật sự chưa khớp.
    const learnedChars = state.unknown.filter(item => item.relatedWords.length);
    const looseChars = state.unknown.filter(item => !item.relatedWords.length);

    const summary = `
      <p class="image-lookup-summary">
        Đọc được <strong>${state.hanCount}</strong> chữ Hán ·
        nhận ra <strong>${state.words.length}</strong> từ trong giáo trình ·
        <strong>${learnedChars.length}</strong> chữ đã học trong từ ghép ·
        <strong>${looseChars.length}</strong> chữ chưa khớp
      </p>
    `;

    const table = state.words.length
      ? `
        <div class="table-scroll">
          <table class="image-lookup-table">
            <thead>
              <tr><th>Từ</th><th>Phiên âm</th><th>Nghĩa</th><th>Bài</th></tr>
            </thead>
            <tbody>
              ${state.words.map(word => {
                // Nguyên văn trong giáo trình có thể khác khóa tra, ví dụ khóa 太
                // đến từ mục 太...了 — hiện kèm để người học thấy dạng đầy đủ.
                const otherForms = word.forms
                  .map(form => form.hanzi)
                  .filter(hanzi => hanzi !== word.key);
                return `
                <tr>
                  <td class="image-lookup-word">${escapeHtml(word.key)}${
                    word.count > 1 ? `<span class="image-lookup-count">×${word.count}</span>` : ""
                  }</td>
                  <td class="image-lookup-pinyin">${escapeHtml(
                    [...new Set(word.forms.map(form => form.pinyin).filter(Boolean))].join(" / ")
                  )}</td>
                  <td>
                    ${escapeHtml(word.meanings.join(" / "))}
                    ${otherForms.length
                      ? `<span class="image-lookup-form">dạng trong bài: ${escapeHtml(otherForms.join("、"))}</span>`
                      : ""}
                  </td>
                  <td class="image-lookup-lessons">
                    ${word.lessons.map(one => `
                      <button class="image-lookup-jump" data-action="selectLesson" data-index="${one.index}">
                        Bài ${one.order} · ${escapeHtml(one.date)}
                      </button>
                    `).join("")}
                  </td>
                </tr>
              `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<p class="image-lookup-status">Không có từ nào trong ảnh khớp với giáo trình.</p>`;

    const learnedBlock = learnedChars.length
      ? `
        <div class="table-scroll">
          <h3 class="image-lookup-subhead">Chữ đã học trong từ ghép</h3>
          <table class="image-lookup-table">
            <thead>
              <tr><th>Chữ</th><th>Từ ghép đã học</th><th>Phiên âm</th><th>Nghĩa</th><th>Bài</th></tr>
            </thead>
            <tbody>
              ${learnedChars.map(item => {
                const shownWords = item.relatedWords.slice(0, RELATED_WORD_LIMIT);
                const hiddenWords = item.relatedWords.length - shownWords.length;
                const stack = values => values
                  .map(value => `<span class="image-lookup-line">${escapeHtml(value)}</span>`)
                  .join("");
                const lessonList = [];
                shownWords.forEach(word => word.lessons.forEach(one => {
                  if (!lessonList.some(other => other.index === one.index)) lessonList.push(one);
                }));
                lessonList.sort((left, right) => left.order - right.order);
                const shownLessons = lessonList.slice(0, UNKNOWN_LESSON_LIMIT);
                const hiddenLessons = lessonList.length - shownLessons.length;
                return `
                  <tr>
                    <td class="image-lookup-word">${escapeHtml(item.character)}</td>
                    <td class="image-lookup-word">
                      ${stack(shownWords.map(word => word.key))}
                      ${hiddenWords ? `<span class="image-lookup-more">+${hiddenWords} từ khác</span>` : ""}
                    </td>
                    <td class="image-lookup-pinyin">
                      ${stack(shownWords.map(word => (word.forms[0] || {}).pinyin || "—"))}
                    </td>
                    <td>${stack(shownWords.map(word => word.meanings.join(" / ")))}</td>
                    <td class="image-lookup-lessons">
                      ${shownLessons.map(one => `
                        <button class="image-lookup-jump" type="button"
                          data-action="selectLesson" data-index="${one.index}">
                          Bài ${one.order} · ${escapeHtml(one.date)}
                        </button>
                      `).join("")}
                      ${hiddenLessons ? `<span class="image-lookup-more">+${hiddenLessons} bài khác</span>` : ""}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `
      : "";

    const unknownBlock = looseChars.length
      ? `
        <div class="image-lookup-unknown">
          <h3>Chữ không khớp từ nào trong bảng từ vựng</h3>
          <ul>
            ${looseChars.map(item => `
              <li>
                <span class="image-lookup-word">${escapeHtml(item.character)}</span>
                ${describeUnknownCharacter(item)}
              </li>
            `).join("")}
          </ul>
        </div>
      `
      : "";

    contentEl.innerHTML = `
      <section class="image-lookup">
        ${intro}
        ${summary}
        ${table}
        ${learnedBlock}
        ${unknownBlock}
      </section>
    `;
  }

  function renderContent() {
    renderShell();
    if (ui.view === "lesson") renderLesson();
    if (ui.view === "roadmap") renderRoadmap();
    if (ui.view === "structures") renderStructures();
    if (ui.view === "cards") renderCards();
    if (ui.view === "practice") renderPractice();
    if (ui.view === "measure") renderMeasureWords();
    if (ui.view === "similar") renderSimilar();
    if (ui.view === "common") renderCommonStructures();
    if (ui.view === "notes") renderNotes();
    if (ui.view === "image") renderImageLookup();
    if (ui.view === "final") renderFinal();
  }

  function selectLesson(index) {
    const keepStructureView = ui.view === "structures";
    ui.lessonIndex = index;
    ui.view = keepStructureView ? "structures" : "lesson";
    ui.cardScope = "lesson";
    ui.cardIndex = 0;
    ui.cardRevealed = false;
    ui.vocabShuffleOrder = null;
    savedData.progress.lastLessonId = lesson().id;
    savedData.progress.lastView = ui.view;
    markDirty();
    renderContent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setView(view) {
    ui.view = view;
    ui.cardIndex = 0;
    ui.cardRevealed = false;
    ui.vocabShuffleOrder = null;
    savedData.progress.lastView = view;
    markDirty();
    renderContent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function findQuestion(questionId) {
    const sections = buildPracticeSections(ui.lessonIndex);
    return allPracticeQuestions(sections).find(question => question.id === questionId);
  }

  function updateOrder(questionId, updater) {
    const practiceState = ensurePracticeState(lesson().id);
    const current = Array.isArray(practiceState.answers[questionId])
      ? practiceState.answers[questionId]
      : [];
    practiceState.answers[questionId] = updater([...current]);
    practiceState.checked = false;
    markDirty();
    renderContent();
  }

  function openClusterEditor(cluster = null) {
    editorContext = { type: "cluster", clusterId: cluster?.id || null };
    dialogTitleEl.textContent = cluster ? "Sửa cụm chữ" : "Tạo cụm chữ";
    dialogFieldsEl.innerHTML = `
      <div class="field">
        <label for="clusterName">Tên cụm</label>
        <input id="clusterName" name="name" maxlength="80" required
          value="${escapeHtml(cluster?.name || "")}" placeholder="Ví dụ: 大 / 太 / 天">
      </div>
      <div class="field">
        <label for="clusterHint">Ghi chú chung</label>
        <textarea id="clusterHint" name="hint" maxlength="240"
          placeholder="Nêu nét hoặc bộ cần chú ý">${escapeHtml(cluster?.hint || "")}</textarea>
      </div>
    `;
    dialogEl.showModal();
  }

  function openItemEditor(clusterId, item = null) {
    editorContext = { type: "item", clusterId, itemId: item?.id || null };
    dialogTitleEl.textContent = item ? "Sửa chữ trong cụm" : "Thêm chữ vào cụm";
    dialogFieldsEl.innerHTML = `
      <div class="field">
        <label for="itemHanzi">Chữ hoặc từ</label>
        <input id="itemHanzi" name="hanzi" maxlength="24" required
          value="${escapeHtml(item?.hanzi || "")}" placeholder="这">
      </div>
      <div class="field">
        <label for="itemPinyin">Phiên âm</label>
        <input id="itemPinyin" name="pinyin" maxlength="80"
          value="${escapeHtml(item?.pinyin || "")}" placeholder="zhè">
      </div>
      <div class="field">
        <label for="itemMeaning">Nghĩa tiếng Việt</label>
        <input id="itemMeaning" name="meaning" maxlength="160"
          value="${escapeHtml(item?.meaning || "")}" placeholder="này, đây">
      </div>
      <div class="field">
        <label for="itemNote">Dấu hiệu phân biệt</label>
        <textarea id="itemNote" name="note" maxlength="240"
          placeholder="Mô tả nét hoặc bộ dễ nhận ra">${escapeHtml(item?.note || "")}</textarea>
      </div>
    `;
    dialogEl.showModal();
  }

  function findCluster(clusterId) {
    return savedData.clusters.find(cluster => cluster.id === clusterId);
  }

  function createId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  async function migrateLegacyProgress() {
    if (Object.keys(savedData.progress.practice).length) return;
    const raw = localStorage.getItem("hsk1-on-tap-v2");
    if (!raw) return;

    try {
      const legacy = JSON.parse(raw);
      for (const item of lessons) {
        if (!legacy.quizAnswers?.[item.id]) continue;
        const practiceState = ensurePracticeState(item.id);
        for (const [index, value] of Object.entries(legacy.quizAnswers[item.id])) {
          practiceState.answers[`grammar-new-${item.id}-${index}`] = value;
        }
      }
      if (legacy.finalAnswers) {
        for (const [index, value] of Object.entries(legacy.finalAnswers)) {
          savedData.progress.final.answers[`final-main-${index}`] = value;
        }
      }
      savedData.progress.final.checked = Boolean(legacy.finalChecked);
      savedData.progress.writingShown = legacy.writingShown || {};
      markDirty();
      await saveNow();
      showToast("Đã chuyển tiến độ từ bản HTML cũ.");
    } catch {
      // Dữ liệu cũ hỏng không ảnh hưởng dữ liệu máy chủ hiện tại.
    }
  }

  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton && savedData) {
      setView(viewButton.dataset.view);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button || !savedData) return;
    const action = button.dataset.action;

    if (action === "selectLesson") {
      selectLesson(Number(button.dataset.index));
      return;
    }

    if (action === "goToLesson") {
      const targetIndex = lessons.findIndex(item => item.id === button.dataset.lessonId);
      if (targetIndex < 0) return;
      ui.lessonIndex = targetIndex;
      ui.view = button.dataset.targetView || "lesson";
      ui.cardScope = "lesson";
      ui.cardIndex = 0;
      ui.cardRevealed = false;
      ui.vocabShuffleOrder = null;
      savedData.progress.lastLessonId = lesson().id;
      savedData.progress.lastView = ui.view;
      markDirty();
      renderContent();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "advanceCurrentLesson") {
      advanceCurrentLesson();
      return;
    }

    if (action === "markReviewed") {
      markLessonReviewed(button.dataset.lessonId);
      return;
    }

    if (action === "startPractice") {
      setView("practice");
      return;
    }

    if (action === "openCards") {
      setView("cards");
      return;
    }

    if (action === "toggleWriting") {
      const key = button.dataset.key;
      savedData.progress.writingShown[key] = !savedData.progress.writingShown[key];
      markDirty();
      renderContent();
      return;
    }

    if (action === "cardScope") {
      ui.cardScope = button.dataset.scope;
      ui.cardIndex = 0;
      ui.cardRevealed = false;
      renderContent();
      return;
    }

    if (action === "previousCard" || action === "nextCard") {
      const cards = currentCards();
      const change = action === "previousCard" ? -1 : 1;
      ui.cardIndex = (ui.cardIndex + change + cards.length) % cards.length;
      ui.cardRevealed = false;
      renderContent();
      return;
    }

    if (action === "flipCard") {
      ui.cardRevealed = !ui.cardRevealed;
      renderContent();
      return;
    }

    if (action === "randomCard") {
      const cards = currentCards();
      ui.cardIndex = Math.floor(Math.random() * cards.length);
      ui.cardRevealed = false;
      renderContent();
      return;
    }

    if (action === "shuffleVocab") {
      const count = lesson().vocab.length;
      const order = Array.from({ length: count }, (_, index) => index);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      ui.vocabShuffleOrder = order;
      renderContent();
      return;
    }

    if (action === "measureMode") {
      ui.measureMode = button.dataset.mode;
      ui.measurePage = 0;
      renderContent();
      document.querySelector(".measure-practice")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (action === "measurePreviousPage" || action === "measureNextPage") {
      const direction = action === "measurePreviousPage" ? -1 : 1;
      const pageCount = Math.ceil(measureQuestions().length / measurePageSize);
      ui.measurePage = Math.max(0, Math.min(pageCount - 1, ui.measurePage + direction));
      renderContent();
      document.querySelector(".measure-practice")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (action === "checkMeasurePage") {
      const state = ensureMeasureState();
      const questions = measureQuestions().slice(
        ui.measurePage * measurePageSize,
        (ui.measurePage + 1) * measurePageSize
      );
      const score = questions.filter(question =>
        isMeasureQuestionCorrect(question, state.answers[question.id])
      ).length;
      state.checkedPages[measurePageKey()] = { score, total: questions.length };
      markDirty();
      renderContent();
      document.querySelector(".measure-practice")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (action === "resetMeasurePage") {
      if (!window.confirm("Xóa câu trả lời ở trang lượng từ này để làm lại?")) return;
      const state = ensureMeasureState();
      const questions = measureQuestions().slice(
        ui.measurePage * measurePageSize,
        (ui.measurePage + 1) * measurePageSize
      );
      for (const question of questions) delete state.answers[question.id];
      delete state.checkedPages[measurePageKey()];
      markDirty();
      renderContent();
      document.querySelector(".measure-practice")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (action === "checkPractice") {
      const sections = buildPracticeSections(ui.lessonIndex);
      const questions = allPracticeQuestions(sections)
        .filter(question => question.type !== "written");
      const practiceState = ensurePracticeState(lesson().id);
      practiceState.checked = true;
      practiceState.score = scoreQuestions(questions, practiceState.answers);
      practiceState.total = questions.length;
      markDirty();
      renderContent();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "resetPractice") {
      if (!window.confirm("Xóa các câu trả lời của ngày này để làm lại?")) return;
      savedData.progress.practice[lesson().id] = {
        answers: {},
        checked: false,
        score: 0,
        total: 0,
        revealed: {},
        selfReview: {}
      };
      markDirty();
      renderContent();
      return;
    }

    if (action === "addOrderToken") {
      const question = findQuestion(button.dataset.questionId);
      const tokenIndex = Number(button.dataset.tokenIndex);
      if (!question) return;
      updateOrder(question.id, answer => answer.includes(tokenIndex) ? answer : answer.concat(tokenIndex));
      return;
    }

    if (action === "undoOrder") {
      updateOrder(button.dataset.questionId, answer => answer.slice(0, -1));
      return;
    }

    if (action === "clearOrder") {
      updateOrder(button.dataset.questionId, () => []);
      return;
    }

    if (action === "toggleWrittenSample") {
      const practiceState = ensurePracticeState(lesson().id);
      const questionId = button.dataset.questionId;
      practiceState.revealed[questionId] = !practiceState.revealed[questionId];
      markDirty();
      renderContent();
      return;
    }

    if (action === "reviewWritten") {
      const practiceState = ensurePracticeState(lesson().id);
      practiceState.selfReview[button.dataset.questionId] = button.dataset.review;
      markDirty();
      renderContent();
      return;
    }

    if (action === "checkFinal") {
      const sets = finalQuestionSets();
      const questions = sets.main.concat(sets.reading);
      savedData.progress.final.checked = true;
      savedData.progress.final.score = scoreQuestions(questions, savedData.progress.final.answers);
      savedData.progress.final.total = questions.length;
      markDirty();
      renderContent();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "resetFinal") {
      if (!window.confirm("Xóa toàn bộ câu trả lời của bài cuối?")) return;
      savedData.progress.final = { answers: {}, checked: false, score: 0, total: 0 };
      markDirty();
      renderContent();
      return;
    }

    if (action === "newCluster") {
      openClusterEditor();
      return;
    }

    if (action === "editCluster") {
      openClusterEditor(findCluster(button.dataset.clusterId));
      return;
    }

    if (action === "deleteCluster") {
      const cluster = findCluster(button.dataset.clusterId);
      if (!cluster || !window.confirm(`Xóa cụm “${cluster.name}” và mọi chữ bên trong?`)) return;
      savedData.clusters = savedData.clusters.filter(item => item.id !== cluster.id);
      markDirty();
      renderContent();
      showToast("Đã xóa cụm chữ.");
      return;
    }

    if (action === "newClusterItem") {
      openItemEditor(button.dataset.clusterId);
      return;
    }

    if (action === "editClusterItem") {
      const cluster = findCluster(button.dataset.clusterId);
      const item = cluster?.items.find(entry => entry.id === button.dataset.itemId);
      if (cluster && item) openItemEditor(cluster.id, item);
      return;
    }

    if (action === "deleteClusterItem") {
      const cluster = findCluster(button.dataset.clusterId);
      const item = cluster?.items.find(entry => entry.id === button.dataset.itemId);
      if (!cluster || !item || !window.confirm(`Xóa “${item.hanzi}” khỏi cụm này?`)) return;
      cluster.items = cluster.items.filter(entry => entry.id !== item.id);
      markDirty();
      renderContent();
      showToast("Đã xóa chữ khỏi cụm.");
      return;
    }

    if (action === "closeDialog") {
      dialogEl.close();
    }
  });

  // Dán ảnh ở bất kỳ tab nào cũng chuyển sang tab Tra ảnh và tra luôn.
  document.addEventListener("paste", event => {
    const items = [...(event.clipboardData?.items || [])];
    const imageItem = items.find(item => item.type.startsWith("image/"));
    if (!imageItem) return;

    const blob = imageItem.getAsFile();
    if (!blob) return;

    event.preventDefault();
    if (ui.view !== "image") {
      ui.view = "image";
      if (savedData) {
        savedData.progress.lastView = ui.view;
        markDirty();
      }
      renderShell();
    }
    runImageLookup(blob);
  });

  document.addEventListener("change", event => {
    const lookupFile = event.target.closest("input[data-action='pickLookupImage']");
    if (lookupFile) {
      const [file] = lookupFile.files || [];
      if (file) runImageLookup(file);
      lookupFile.value = "";
      return;
    }

    const roadmapSelect = event.target.closest("select[data-roadmap-select]");
    if (roadmapSelect && savedData) {
      const roadmap = ensureRoadmapState();
      roadmap.currentLessonId = roadmapSelect.value;
      seedRoadmapReviews();
      markDirty();
      renderContent();
      return;
    }

    const input = event.target.closest("input[data-choice-context]");
    if (!input) return;
    const context = input.dataset.choiceContext;

    if (context === "vocabDisplay") {
      if (input.dataset.vocabToggle === "pinyin") ui.vocabShowPinyin = input.checked;
      if (input.dataset.vocabToggle === "meaning") ui.vocabShowMeaning = input.checked;
      renderContent();
      return;
    }

    if (!savedData) return;
    const questionId = input.dataset.questionId;

    if (context === "practice") {
      const practiceState = ensurePracticeState(lesson().id);
      const wasChecked = practiceState.checked;
      practiceState.answers[questionId] = Number(input.value);
      practiceState.checked = false;
      markDirty();
      if (wasChecked) renderContent();
      return;
    }

    if (context === "final") {
      const wasChecked = savedData.progress.final.checked;
      savedData.progress.final.answers[questionId] = Number(input.value);
      savedData.progress.final.checked = false;
      markDirty();
      if (wasChecked) renderContent();
      return;
    }

    if (context === "measure") {
      const state = ensureMeasureState();
      const pageKey = measurePageKey();
      const wasChecked = Boolean(state.checkedPages[pageKey]);
      state.answers[questionId] = Number(input.value);
      delete state.checkedPages[pageKey];
      markDirty();
      if (wasChecked) renderContent();
    }
  });

  document.addEventListener("input", event => {
    const fillInput = event.target.closest("input[data-fill-context]");
    if (fillInput && savedData) {
      const context = fillInput.dataset.fillContext;
      const questionId = fillInput.dataset.questionId;
      if (context === "practice") {
        const practiceState = ensurePracticeState(lesson().id);
        const blankIndex = Number(fillInput.dataset.blankIndex || 0);
        const current = Array.isArray(practiceState.answers[questionId])
          ? [...practiceState.answers[questionId]]
          : [];
        current[blankIndex] = fillInput.value;
        practiceState.answers[questionId] = current;
        practiceState.checked = false;
        const questionEl = fillInput.closest(".question");
        questionEl?.classList.remove("correct", "incorrect");
        questionEl?.querySelector(".answer-note")?.remove();
        markDirty();
      }
      return;
    }

    const measureInput = event.target.closest("input[data-measure-fill]");
    if (measureInput && savedData) {
      const state = ensureMeasureState();
      state.answers[measureInput.dataset.measureFill] = measureInput.value;
      delete state.checkedPages[measurePageKey()];
      const questionEl = measureInput.closest(".question");
      questionEl?.classList.remove("correct", "incorrect");
      questionEl?.querySelector(".answer-note")?.remove();
      document.querySelector(".measure-practice-heading .score-box")?.remove();
      markDirty();
      return;
    }

    const notesTextarea = event.target.closest("textarea[data-notes-field]");
    if (notesTextarea && savedData) {
      savedData.notes = notesTextarea.value;
      markDirty();
      return;
    }

    const textarea = event.target.closest("textarea[data-written-question]");
    if (!textarea || !savedData) return;
    const practiceState = ensurePracticeState(lesson().id);
    practiceState.answers[textarea.dataset.writtenQuestion] = textarea.value;
    markDirty();
  });

  editorFormEl.addEventListener("submit", event => {
    event.preventDefault();
    if (!editorContext) return;
    const formData = new FormData(editorFormEl);

    if (editorContext.type === "cluster") {
      const value = {
        name: String(formData.get("name") || "").trim(),
        hint: String(formData.get("hint") || "").trim()
      };
      if (!value.name) return;
      const existing = editorContext.clusterId ? findCluster(editorContext.clusterId) : null;
      if (existing) {
        existing.name = value.name;
        existing.hint = value.hint;
      } else {
        savedData.clusters.push({
          id: createId("cluster"),
          name: value.name,
          hint: value.hint,
          items: []
        });
      }
    }

    if (editorContext.type === "item") {
      const cluster = findCluster(editorContext.clusterId);
      if (!cluster) return;
      const value = {
        hanzi: String(formData.get("hanzi") || "").trim(),
        pinyin: String(formData.get("pinyin") || "").trim(),
        meaning: String(formData.get("meaning") || "").trim(),
        note: String(formData.get("note") || "").trim()
      };
      if (!value.hanzi) return;
      const existing = editorContext.itemId
        ? cluster.items.find(item => item.id === editorContext.itemId)
        : null;
      if (existing) {
        Object.assign(existing, value);
      } else {
        cluster.items.push({ id: createId("item"), ...value });
      }
    }

    dialogEl.close();
    editorContext = null;
    markDirty();
    renderContent();
    showToast("Dữ liệu cụm chữ đã được cập nhật.");
  });

  window.addEventListener("beforeunload", () => {
    if (!savedData || lastSavedRevision === saveRevision) return;
    fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedData),
      keepalive: true
    });
  });

  async function init() {
    contentEl.innerHTML = '<div class="loading">Đang tải dữ liệu đã lưu trên máy…</div>';
    try {
      const response = await fetch("/api/state");
      if (!response.ok) throw new Error("Không tải được dữ liệu.");
      savedData = await response.json();
      savedData.progress.final ||= { answers: {}, checked: false };
      savedData.progress.writingShown ||= {};
      savedData.progress.practice ||= {};
      savedData.progress.measureWords ||= { answers: {}, checkedPages: {} };
      savedData.clusters ||= [];

      const savedLessonIndex = lessons.findIndex(
        item => item.id === savedData.progress.lastLessonId
      );
      ui.lessonIndex = savedLessonIndex >= 0 ? savedLessonIndex : 0;
      ui.view = [
        "lesson", "roadmap", "structures", "common", "cards",
        "practice", "measure", "similar", "image", "notes", "final"
      ].includes(savedData.progress.lastView)
        ? savedData.progress.lastView
        : "lesson";

      await migrateLegacyProgress();
      renderContent();
      setSaveStatus("Đã tải dữ liệu trên máy");
    } catch (error) {
      activeDateEl.textContent = "Không kết nối được máy chủ";
      activeTitleEl.textContent = "Chưa thể mở webapp";
      setSaveStatus("Lỗi tải dữ liệu", "error");
      contentEl.innerHTML = `
        <div class="error-panel">
          Hãy chạy chương trình bằng <code>npm start</code> rồi mở lại trang cục bộ.
        </div>
      `;
    }
  }

  init();
})();
