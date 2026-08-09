const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "STRUCTURE_PLAN.md");
const outputPath = path.join(rootDir, "public", "structures.js");
const practiceOutputPath = path.join(rootDir, "public", "practice-extensions.js");

function tableCells(line, expectedCount) {
  const cells = line.slice(1, -1).split("|").map(cell => cell.trim());
  if (cells.length !== expectedCount || cells.some(cell => !cell)) {
    throw new Error(`Hàng trong kế hoạch không hợp lệ: ${line}`);
  }
  return cells;
}

function parseStructurePlan(markdown) {
  const result = {};
  const structureIds = new Set();
  let currentLesson = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## (l\d{4}) · ([^·]+) · (.+)$/);
    if (heading) {
      const [, lessonId, rawDate, rawTopic] = heading;
      if (result[lessonId]) throw new Error(`Ngày bị lặp: ${lessonId}`);
      currentLesson = {
        date: rawDate.trim(),
        topic: rawTopic.trim(),
        items: []
      };
      result[lessonId] = currentLesson;
      continue;
    }

    if (!line.match(/^\| l\d{4}-s\d+ \|/)) continue;
    if (!currentLesson) throw new Error("Cấu trúc nằm trước tiêu đề ngày.");

    const [id, formula, usage, example, meaning] = tableCells(line, 5);
    const lessonId = id.match(/^(l\d{4})-s\d+$/)?.[1];
    if (!lessonId || lessonId !== Object.keys(result).at(-1)) {
      throw new Error(`Mã cấu trúc không khớp ngày: ${id}`);
    }
    if (structureIds.has(id)) throw new Error(`Mã cấu trúc bị lặp: ${id}`);

    structureIds.add(id);
    currentLesson.items.push({ id, formula, usage, example, meaning });
  }

  const days = Object.entries(result);
  if (!days.length) throw new Error("Không tìm thấy ngày nào trong kế hoạch.");
  for (const [lessonId, day] of days) {
    if (!day.items.length) throw new Error(`${lessonId} chưa có cấu trúc.`);
  }
  return result;
}

function planSections(markdown) {
  const headings = [...markdown.matchAll(/^### (l\d{4}) · ([^\n]+)$/gm)];
  return headings.map((heading, index) => ({
    lessonId: heading[1],
    date: heading[2].trim(),
    body: markdown.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? markdown.length
    )
  }));
}

function quotedLinesBetween(body, startHeading, endHeading) {
  const start = body.indexOf(startHeading);
  const end = body.indexOf(endHeading, start + startHeading.length);
  if (start < 0 || end < 0) return [];
  return body
    .slice(start + startHeading.length, end)
    .split(/\r?\n/)
    .filter(line => line.startsWith("> "))
    .map(line => line.slice(2).trim())
    .filter(Boolean);
}

function parsePracticePlan(markdown) {
  const result = {};
  const allIds = new Set();

  for (const section of planSections(markdown)) {
    const { lessonId, date, body } = section;
    if (result[lessonId]) throw new Error(`Ngày bài tập bị lặp: ${lessonId}`);

    const proseLines = quotedLinesBetween(body, "#### Đoạn văn", "#### Hội thoại");
    const dialogue = quotedLinesBetween(body, "#### Hội thoại", "#### Câu hỏi đọc hiểu");
    const prose = proseLines.join("\n");
    const questionRows = body
      .split(/\r?\n/)
      .filter(line => new RegExp(`^\\| ${lessonId}-r\\d+ \\|`).test(line));
    const writingRows = body
      .split(/\r?\n/)
      .filter(line => new RegExp(`^\\| ${lessonId}-w\\d+ \\|`).test(line));

    const sentenceCount = (prose.match(/[。！？]/g) || []).length;
    const hanCharacterCount = ((prose + dialogue.join("")).match(/[\u3400-\u9fff]/g) || [])
      .length;
    if (sentenceCount < 6) throw new Error(`${lessonId} cần ít nhất sáu câu trong đoạn văn.`);
    if (dialogue.length < 8) throw new Error(`${lessonId} cần ít nhất tám lượt hội thoại.`);
    if (hanCharacterCount < 120) throw new Error(`${lessonId} có bài đọc quá ngắn.`);
    if (questionRows.length !== 5) throw new Error(`${lessonId} cần đúng năm câu đọc hiểu.`);
    if (writingRows.length !== 3) throw new Error(`${lessonId} cần đúng ba bài đặt câu.`);

    const questions = questionRows.map(line => {
      const [id, prompt, rawOptions, answerText, explanation] = tableCells(line, 5);
      const options = rawOptions.split("；").map(option => option.trim());
      const answer = options.indexOf(answerText);
      if (options.length !== 4 || answer < 0) {
        throw new Error(`${id} phải có bốn lựa chọn và một đáp án hợp lệ.`);
      }
      if (allIds.has(id)) throw new Error(`Mã bài tập bị lặp: ${id}`);
      allIds.add(id);
      return { id, prompt, options, answer, explanation };
    });

    const wordTasks = writingRows.map(line => {
      const [id, topic, structure, rawWords, prompt, sample] = tableCells(line, 6);
      const words = rawWords.split("；").map(word => word.trim());
      if (words.length < 2 || words.length > 3) {
        throw new Error(`${id} phải có từ hai đến ba từ bắt buộc.`);
      }
      const missingWords = words.filter(word => !sample.includes(word));
      if (missingWords.length) {
        throw new Error(`${id} có câu mẫu thiếu từ: ${missingWords.join("、")}`);
      }
      if (allIds.has(id)) throw new Error(`Mã bài tập bị lặp: ${id}`);
      allIds.add(id);
      return {
        id,
        kind: "sentence-given-words",
        topic,
        structure,
        words,
        required: words.join("、"),
        prompt,
        sample
      };
    });

    if (new Set(wordTasks.map(task => task.topic)).size !== wordTasks.length) {
      throw new Error(`${lessonId} có chủ đề đặt câu bị lặp.`);
    }
    if (new Set(wordTasks.map(task => task.structure)).size !== wordTasks.length) {
      throw new Error(`${lessonId} có công thức đặt câu bị lặp.`);
    }

    result[lessonId] = {
      date,
      reading: { prose, dialogue, questions },
      wordTasks
    };
  }

  if (!Object.keys(result).length) {
    throw new Error("Không tìm thấy kế hoạch bài đọc và đặt câu.");
  }
  return result;
}

function generatedSource(structures) {
  return `window.HSK_STRUCTURES = ${JSON.stringify(structures, null, 2)};\n`;
}

function generatedPracticeSource(practice) {
  return `window.HSK_PRACTICE_EXTENSIONS = ${JSON.stringify(practice, null, 2)};\n`;
}

function main() {
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const structures = parseStructurePlan(markdown);
  const practice = parsePracticePlan(markdown);
  const nextOutput = generatedSource(structures);
  const nextPracticeOutput = generatedPracticeSource(practice);

  if (JSON.stringify(Object.keys(structures)) !== JSON.stringify(Object.keys(practice))) {
    throw new Error("Danh sách ngày của phần cấu trúc và bài tập không khớp.");
  }

  if (process.argv.includes("--check")) {
    const currentOutput = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
    const currentPracticeOutput = fs.existsSync(practiceOutputPath)
      ? fs.readFileSync(practiceOutputPath, "utf8")
      : "";
    if (currentOutput !== nextOutput || currentPracticeOutput !== nextPracticeOutput) {
      throw new Error("Dữ liệu sinh chưa đồng bộ với STRUCTURE_PLAN.md.");
    }
    console.log(`Đã kiểm tra dữ liệu kế hoạch cho ${Object.keys(structures).length} ngày.`);
    return;
  }

  fs.writeFileSync(outputPath, nextOutput);
  fs.writeFileSync(practiceOutputPath, nextPracticeOutput);
  console.log(`Đã tạo dữ liệu cấu trúc và bài tập cho ${Object.keys(structures).length} ngày.`);
}

if (require.main === module) main();

module.exports = {
  generatedPracticeSource,
  generatedSource,
  parsePracticePlan,
  parseStructurePlan
};
