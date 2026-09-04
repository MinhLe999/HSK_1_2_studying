(() => {
  "use strict";

  const content = window.HSK_CONTENT;
  const exampleSupplements = window.HSK_EXAMPLE_SUPPLEMENTS;
  const structures = window.HSK_STRUCTURES;
  const practiceExtensions = window.HSK_PRACTICE_EXTENSIONS;
  const production = window.HSK_PRODUCTION;
  const measureWords = window.HSK_MEASURE_WORDS;
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
    vocabShuffleOrder: null
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    const mixedVocab = lesson.practice.cloze.map((question, index) =>
      rotateChoice(question, `vocab-mixed-${lesson.id}-${index}`)
    );
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
    const mixedGrammar = lesson.practice.orders.map((question, index) =>
      orderQuestion(question, `grammar-mixed-${lesson.id}-${index}`)
    );
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
    const writtenSections = writtenPractice.map(question => ({
      id: question.kind,
      title: {
        "sentence-vocab": "Đặt câu với từ mới",
        "sentence-pattern": "Đặt câu với cấu trúc mới",
        "question-from-answer": "Đặt câu hỏi từ câu trả lời",
        "answer-from-question": "Viết câu trả lời từ câu hỏi"
      }[question.kind],
      description: {
        "sentence-vocab": "Tự tạo một câu mới, không chép lại câu ví dụ của bài.",
        "sentence-pattern": "Áp dụng mẫu mới vào tình huống khác với phần nhận diện.",
        "question-from-answer": "Xác định thông tin cần hỏi rồi viết câu hỏi phù hợp.",
        "answer-from-question": "Trả lời thành câu đầy đủ, không chỉ ghi một từ."
      }[question.kind],
      questions: [question]
    }));
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
      {
        id: "mixed-vocab",
        title: "Từ mới + cũ",
        description: "Chọn từ phù hợp với ngữ cảnh của câu.",
        questions: mixedVocab
      },
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
      {
        id: "mixed-grammar",
        title: "Cấu trúc mới + cũ",
        description: "Sắp xếp câu có nhiều thành phần đã học.",
        questions: mixedGrammar
      },
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
      }
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

  function normalizeSentence(value) {
    return String(value).replace(/[\s。？！，、,.?!]/g, "");
  }

  function isQuestionCorrect(question, answer) {
    if (question.type === "order") {
      if (!Array.isArray(answer)) return false;
      const sentence = answer.map(index => question.tokens[index]).join("");
      return normalizeSentence(sentence) === normalizeSentence(question.answer);
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
            ${item.patterns.map((pattern, index) => `
              <li class="pattern-row">
                <span class="pattern">${escapeHtml(pattern[0])}</span>
                <span class="pattern-note">${escapeHtml(pattern[1])}</span>
                ${patternEvidence[index] ? `
                  <div class="pattern-example">
                    <span>Ví dụ: ${escapeHtml(patternEvidence[index])}</span>
                    <small>${escapeHtml(exampleMeanings.get(patternEvidence[index]) || "")}</small>
                  </div>
                ` : ""}
              </li>
            `).join("")}
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
        ${structureDay.items.map((structure, index) => `
          <article class="structure-item">
            <div class="structure-number" aria-hidden="true">
              ${String(index + 1).padStart(2, "0")}
            </div>
            <div class="structure-body">
              <h4 class="structure-formula">${escapeHtml(structure.formula)}</h4>
              <p class="structure-usage">${escapeHtml(structure.usage)}</p>
              <div class="structure-example">
                <span>Ví dụ</span>
                <strong lang="zh-Hans">${escapeHtml(structure.example)}</strong>
                <p>${escapeHtml(structure.meaning)}</p>
              </div>
            </div>
          </article>
        `).join("")}
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

  function renderContent() {
    renderShell();
    if (ui.view === "lesson") renderLesson();
    if (ui.view === "structures") renderStructures();
    if (ui.view === "cards") renderCards();
    if (ui.view === "practice") renderPractice();
    if (ui.view === "measure") renderMeasureWords();
    if (ui.view === "similar") renderSimilar();
    if (ui.view === "notes") renderNotes();
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

  document.addEventListener("change", event => {
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
      ui.view = ["lesson", "structures", "cards", "practice", "measure", "similar", "final"].includes(
        savedData.progress.lastView
      )
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
