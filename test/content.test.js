const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  parsePracticePlan,
  parseStructurePlan
} = require("../tools/build-structures.js");

global.window = {};
require("../public/content.js");
require("../public/example-supplements.js");
require("../public/structures.js");
require("../public/practice-extensions.js");
require("../public/production.js");
require("../public/measure-words.js");

const content = global.window.HSK_CONTENT;
const exampleSupplements = global.window.HSK_EXAMPLE_SUPPLEMENTS;
const structures = global.window.HSK_STRUCTURES;
const practiceExtensions = global.window.HSK_PRACTICE_EXTENSIONS;
const production = global.window.HSK_PRODUCTION;
const measureWords = global.window.HSK_MEASURE_WORDS;

function formAppearsInExamples(label, examples) {
  return label.split(/\s*\/\s*/).every(alternative => {
    const parts = alternative.split(/(?:\.\.\.|…)/).map(part => part.trim()).filter(Boolean);
    if (alternative === "没") {
      return examples.some(example => /没(?!有)/.test(example[0]));
    }
    return parts.length && examples.some(example =>
      parts.every(part => example[0].includes(part))
    );
  });
}

test("có đủ 17 ngày và ngày 29/07 mới", () => {
  assert.equal(content.lessons.length, 17);
  assert.deepEqual(
    content.lessons.slice(-4).map(lesson => lesson.date),
    ["22/07/2026", "24/07/2026", "27/07/2026", "29/07/2026"]
  );
  assert.equal(content.lessons.at(-1).pages, "trang 68-71");
});

test("bài 29/05 có hướng dẫn và bài luyện số lớn", () => {
  const lesson = content.lessons.find(item => item.id === "l2905");
  const guide = lesson.numberGuide;
  assert.ok(guide, "29/05 thiếu phần đếm số lớn");
  assert.ok(
    ["零", "百", "千", "万", "十万", "百万"]
      .every(word => lesson.vocab.some(item => item[0] === word))
  );
  assert.equal(guide.groups.length, 3);
  assert.ok(guide.rules.some(rule => rule.includes("零")));
  assert.ok(guide.rules.some(rule => rule.includes("两")));
  assert.ok(guide.values.length >= 30);
  assert.equal(new Set(guide.values.map(item => item[0])).size, guide.values.length);
  assert.ok(guide.values.some(item => item[0] === "105" && item[1] === "一百零五"));
  assert.ok(guide.values.some(item => item[0] === "1205" && item[1] === "一千二百零五"));
  assert.ok(guide.values.some(item => item[0] === "10000" && item[1] === "一万"));
  assert.ok(guide.values.some(item => item[0] === "12345" && item[1] === "一万二千三百四十五"));
  assert.ok(guide.values.length * 2 >= 60, "bài số lớn cần ít nhất 60 câu tự động");
});

test("mỗi ngày có bài đọc và đủ nhóm dữ liệu", () => {
  for (const lesson of content.lessons) {
    const reading = practiceExtensions[lesson.id].reading;
    assert.ok(lesson.vocab.length >= 10, `${lesson.date} thiếu từ vựng`);
    assert.ok(lesson.patterns.length >= 3, `${lesson.date} thiếu cấu trúc`);
    assert.ok(lesson.examples.length >= 8, `${lesson.date} thiếu ví dụ`);
    assert.ok((reading.prose.match(/[。！？]/g) || []).length >= 6, `${lesson.date} thiếu câu văn`);
    assert.ok(reading.dialogue.length >= 8, `${lesson.date} thiếu lượt hội thoại`);
    assert.equal(reading.questions.length, 5, `${lesson.date} thiếu câu đọc`);
    assert.equal(lesson.practice.cloze.length, 2, `${lesson.date} thiếu câu điền từ`);
    assert.equal(lesson.practice.orders.length, 2, `${lesson.date} thiếu câu sắp xếp`);
  }
});

test("ví dụ không còn trường phiên âm", () => {
  for (const lesson of content.lessons) {
    const examples = lesson.examples.concat(exampleSupplements[lesson.id]?.additions || []);
    for (const example of examples) {
      assert.equal(example.length, 2, `${lesson.date} còn dữ liệu phiên âm ở ví dụ`);
    }
  }
});

test("ví dụ bao phủ mọi mục từ của từng ngày", () => {
  for (const lesson of content.lessons) {
    const examples = lesson.examples.concat(exampleSupplements[lesson.id]?.additions || []);
    const missing = lesson.vocab
      .map(vocab => vocab[0])
      .filter(label => !formAppearsInExamples(label, examples));
    assert.deepEqual(missing, [], `${lesson.date} thiếu ví dụ cho: ${missing.join("、")}`);
  }
});

test("mỗi cấu trúc có một câu ví dụ đối chiếu", () => {
  for (const lesson of content.lessons) {
    const examples = lesson.examples.concat(exampleSupplements[lesson.id]?.additions || []);
    const chineseExamples = new Set(examples.map(example => example[0]));
    const evidence = exampleSupplements[lesson.id]?.patternEvidence || [];
    assert.equal(
      evidence.length,
      lesson.patterns.length,
      `${lesson.date} chưa ánh xạ đủ cấu trúc`
    );
    assert.equal(
      new Set(evidence).size,
      evidence.length,
      `${lesson.date} đang dùng lặp một câu cho nhiều cấu trúc`
    );
    for (const sentence of evidence) {
      assert.ok(chineseExamples.has(sentence), `${lesson.date} thiếu câu cấu trúc: ${sentence}`);
    }
  }
});

test("tab cấu trúc khớp bản kế hoạch và đủ từng ngày", () => {
  const sourcePath = path.resolve(__dirname, "..", "STRUCTURE_PLAN.md");
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const plannedStructures = parseStructurePlan(markdown);
  const plannedPractice = parsePracticePlan(markdown);
  assert.deepEqual(structures, plannedStructures);
  assert.deepEqual(practiceExtensions, plannedPractice);
  assert.deepEqual(Object.keys(structures), content.lessons.map(lesson => lesson.id));
  assert.deepEqual(Object.keys(practiceExtensions), content.lessons.map(lesson => lesson.id));

  for (const lesson of content.lessons) {
    const day = structures[lesson.id];
    assert.equal(
      day.items.length,
      lesson.patterns.length,
      `${lesson.date} có số cấu trúc không khớp bài học`
    );
    for (const structure of day.items) {
      assert.ok(structure.formula, `${structure.id} thiếu công thức`);
      assert.ok(structure.usage, `${structure.id} thiếu cách dùng`);
      assert.ok(structure.example, `${structure.id} thiếu ví dụ`);
      assert.ok(structure.meaning, `${structure.id} thiếu nghĩa`);
      assert.doesNotMatch(
        structure.example,
        /[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/,
        `${structure.id} còn phiên âm trong ví dụ`
      );
    }
  }
});

test("bài đọc có đoạn văn, hội thoại và đáp án hợp lệ", () => {
  for (const lesson of content.lessons) {
    const reading = practiceExtensions[lesson.id].reading;
    const hanCharacterCount = (
      reading.prose.concat(reading.dialogue.join("")).match(/[\u3400-\u9fff]/g) || []
    ).length;
    assert.ok(hanCharacterCount >= 120, `${lesson.date} có bài đọc quá ngắn`);
    assert.doesNotMatch(
      reading.prose.concat(reading.dialogue.join("")),
      /[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/,
      `${lesson.date} còn phiên âm trong bài đọc`
    );
    for (const question of reading.questions) {
      assert.equal(question.options.length, 4, `${question.id} không có bốn lựa chọn`);
      assert.ok(question.answer >= 0 && question.answer < 4, `${question.id} có đáp án sai`);
      assert.ok(question.explanation, `${question.id} thiếu giải thích`);
    }
  }
});

test("bài cuối có phần đọc và bao phủ ngày mới", () => {
  assert.ok(content.finalQuestions.length >= 54);
  assert.equal(content.finalReading.questions.length, 8);
  assert.match(content.finalReading.text, /下个星期/);
  assert.match(content.finalReading.text, /红色的手表/);
  assert.equal(content.source.pages, 71);
});

test("mỗi ngày có đủ bốn dạng tự viết", () => {
  const expectedKinds = [
    "sentence-vocab",
    "sentence-pattern",
    "question-from-answer",
    "answer-from-question"
  ];

  for (const lesson of content.lessons) {
    const tasks = production[lesson.id];
    assert.ok(tasks, `${lesson.date} chưa có phần tự viết`);
    assert.deepEqual(
      tasks.map(task => task.kind),
      expectedKinds,
      `${lesson.date} thiếu dạng tự viết`
    );
    for (const task of tasks) {
      assert.ok(task.prompt);
      assert.ok(task.required);
      assert.ok(task.sample);
    }
  }
});

test("mỗi ngày có ba bài đặt câu với 2-3 từ cho sẵn", () => {
  for (const lesson of content.lessons) {
    const tasks = practiceExtensions[lesson.id].wordTasks;
    assert.equal(tasks.length, 3, `${lesson.date} thiếu bài đặt câu với từ cho sẵn`);
    for (const task of tasks) {
      assert.equal(task.kind, "sentence-given-words");
      assert.ok(task.words.length >= 2 && task.words.length <= 3, `${task.id} sai số từ`);
      for (const word of task.words) {
        assert.match(task.sample, new RegExp(word), `${task.id} có câu mẫu thiếu ${word}`);
      }
    }
  }
});

test("không lặp chủ đề hoặc cấu trúc trong phần tự viết của một ngày", () => {
  for (const lesson of content.lessons) {
    const tasks = production[lesson.id].concat(practiceExtensions[lesson.id].wordTasks);
    assert.equal(
      new Set(tasks.map(task => task.topic)).size,
      tasks.length,
      `${lesson.date} bị lặp chủ đề`
    );
    assert.equal(
      new Set(tasks.map(task => task.structure)).size,
      tasks.length,
      `${lesson.date} bị lặp cấu trúc`
    );
    assert.equal(
      new Set(tasks.map(task => task.prompt)).size,
      tasks.length,
      `${lesson.date} bị lặp đề`
    );
  }
});

test("bảng lượng từ không trùng và có giải thích đầy đủ", () => {
  assert.ok(measureWords.classifiers.length >= 40);
  assert.equal(
    new Set(measureWords.classifiers.map(item => item.hanzi)).size,
    measureWords.classifiers.length,
    "bảng có lượng từ bị lặp"
  );

  for (const item of measureWords.classifiers) {
    assert.ok(item.id, "lượng từ thiếu mã");
    assert.ok(item.hanzi, `${item.id} thiếu chữ Hán`);
    assert.ok(item.pinyin, `${item.id} thiếu phiên âm`);
    assert.ok(item.group, `${item.id} thiếu nhóm`);
    assert.ok(item.nouns, `${item.id} thiếu danh từ áp dụng`);
    assert.ok(item.explanation, `${item.id} thiếu giải thích`);
    assert.ok(item.example.includes(item.hanzi), `${item.id} có ví dụ thiếu lượng từ`);
  }
});

test("bài lượng từ có nhiều câu và mọi đáp án đều nằm trong bảng", () => {
  const knownClassifiers = new Set(measureWords.classifiers.map(item => item.hanzi));
  assert.ok(measureWords.pairs.length >= 130);
  assert.equal(
    measureWords.exerciseCount,
    measureWords.pairs.length * 2
      + measureWords.classifiers.length
      + measureWords.largeNumbers.exerciseCount
  );
  assert.ok(measureWords.exerciseCount >= 590);
  assert.equal(new Set(measureWords.pairs.map(pair => pair.id)).size, measureWords.pairs.length);

  for (const pair of measureWords.pairs) {
    assert.ok(pair.noun, `${pair.id} thiếu danh từ`);
    assert.ok(pair.target, `${pair.id} thiếu yêu cầu tiếng Việt`);
    assert.match(pair.sentence, /___/, `${pair.id} thiếu chỗ trống`);
    assert.ok(knownClassifiers.has(pair.classifier), `${pair.id} có đáp án ngoài bảng`);
    assert.ok(pair.accepted.includes(pair.classifier), `${pair.id} không chấp nhận đáp án chính`);
    for (const answer of pair.accepted) {
      assert.ok(knownClassifiers.has(answer), `${pair.id} chấp nhận lượng từ ngoài bảng`);
    }
  }
});

test("phần số lớn phủ hàng trăm, hàng nghìn và vạn", () => {
  const largeNumbers = measureWords.largeNumbers;
  const byValue = new Map(largeNumbers.values.map(item => [item.value, item]));
  assert.equal(largeNumbers.units.find(item => item.hanzi === "万").value, "10.000");
  assert.ok(largeNumbers.rules.length >= 6);
  assert.equal(largeNumbers.values.length, 135);
  assert.equal(new Set(largeNumbers.values.map(item => item.value)).size, 135);
  assert.equal(largeNumbers.exerciseCount, 270);

  const expected = new Map([
    [101, "一百零一"],
    [110, "一百一十"],
    [200, "两百"],
    [1005, "一千零五"],
    [1010, "一千零一十"],
    [2000, "两千"],
    [10000, "一万"],
    [10001, "一万零一"],
    [10010, "一万零一十"],
    [20000, "两万"],
    [100001, "十万零一"],
    [123456, "十二万三千四百五十六"],
    [1000000, "一百万"]
  ]);

  for (const [value, chinese] of expected) {
    assert.equal(byValue.get(value)?.chinese, chinese, `đọc sai số ${value}`);
  }

  for (const item of largeNumbers.values) {
    assert.ok(item.acceptedChinese.includes(item.chinese));
    assert.ok(item.display);
  }
});
