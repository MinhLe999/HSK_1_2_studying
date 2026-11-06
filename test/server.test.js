const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const port = 43000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let child;
let temporaryDir;

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) return;
    } catch {
      // Máy chủ cần thêm thời gian để bắt đầu.
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Máy chủ kiểm thử không khởi động.");
}

test.before(async () => {
  temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), "hsk-review-test-"));
  child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      HSK_DATA_FILE: path.join(temporaryDir, "state.json")
    },
    stdio: "ignore"
  });
  await waitForServer();
});

test.after(async () => {
  child.kill("SIGTERM");
  await new Promise(resolve => child.once("exit", resolve));
  await fs.rm(temporaryDir, { recursive: true, force: true });
});

test("phục vụ giao diện và dữ liệu mặc định", async () => {
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Cấu trúc câu/);
  assert.match(html, /Chữ gần giống/);
  assert.match(html, /Ghi chú/);
  assert.match(html, /Lượng từ/);
  assert.match(html, /Lộ trình/);
  assert.match(html, /practice-extensions\.js/);
  assert.match(html, /measure-words\.js/);

  const practiceData = await fetch(`${baseUrl}/practice-extensions.js`);
  assert.equal(practiceData.status, 200);
  assert.match(await practiceData.text(), /HSK_PRACTICE_EXTENSIONS/);

  const state = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.equal(state.version, 1);
  assert.ok(state.clusters.length >= 5);
  assert.deepEqual(state.progress.measureWords, { answers: {}, checkedPages: {} });
  assert.equal(state.notes, "");
  assert.equal(state.roadmap.currentLessonId, "l2608");
  assert.deepEqual(state.roadmap.reviewStage, {});
});

test("lưu rồi đọc lại tiến độ và cụm chữ", async () => {
  const state = await (await fetch(`${baseUrl}/api/state`)).json();
  state.progress.practice.l2707 = {
    answers: { sample: 1 },
    checked: true,
    score: 1,
    total: 1
  };
  state.progress.measureWords = {
    answers: { "measure-fill-ge-friend": "个" },
    checkedPages: { "fill-0": { score: 1, total: 20 } }
  };
  state.clusters.push({
    id: "test-cluster",
    name: "未 và 末",
    hint: "Kiểm tra lưu dữ liệu",
    items: [{ id: "test-item", hanzi: "未", pinyin: "wèi", meaning: "chưa", note: "" }]
  });
  state.notes = "Ghi chú kiểm thử";
  state.roadmap.currentLessonId = "l2309";
  state.roadmap.reviewStage.l2309 = {
    stage: 1,
    lastReviewedAt: "2026-10-10",
    nextReviewDate: "2026-10-13"
  };

  const saved = await fetch(`${baseUrl}/api/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  assert.equal(saved.status, 200);

  const reloaded = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.equal(reloaded.progress.practice.l2707.score, 1);
  assert.equal(reloaded.progress.measureWords.answers["measure-fill-ge-friend"], "个");
  assert.equal(reloaded.progress.measureWords.checkedPages["fill-0"].total, 20);
  assert.equal(reloaded.clusters.at(-1).items[0].hanzi, "未");
  assert.equal(reloaded.notes, "Ghi chú kiểm thử");
  assert.equal(reloaded.roadmap.currentLessonId, "l2309");
  assert.equal(reloaded.roadmap.reviewStage.l2309.stage, 1);
  assert.equal(reloaded.roadmap.reviewStage.l2309.nextReviewDate, "2026-10-13");
});

test("phục vụ từng đoạn của PDF", async () => {
  const pdfSize = (await fs.stat(path.join(rootDir, "materials", "HSK.pdf"))).size;
  const response = await fetch(`${baseUrl}/HSK.pdf`, {
    headers: { Range: "bytes=0-99" }
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), `bytes 0-99/${pdfSize}`);
  assert.equal((await response.arrayBuffer()).byteLength, 100);
});

// Ảnh PNG trắng 16×16, dùng để kiểm tra đường đi của route mà không cần ảnh thật.
// Vision từ chối ảnh nhỏ hơn 2 px mỗi chiều nên không dùng được ảnh 1×1.
const blankPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAD0lEQVR4nGP4jwYYRrYAAID5/wEokJxdAAAAAElFTkSuQmCC",
  "base64"
);

test("từ chối ảnh rỗng khi tra ảnh", async () => {
  const response = await fetch(`${baseUrl}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: Buffer.alloc(0)
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.message, /ảnh/i);
});

test("từ chối dữ liệu không phải ảnh khi tra ảnh", async () => {
  const response = await fetch(`${baseUrl}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: Buffer.from("day khong phai anh")
  });
  assert.equal(response.status, 415);
  const payload = await response.json();
  assert.match(payload.message, /định dạng ảnh/i);
});

test("tra ảnh trả về danh sách dòng chữ đọc được", async t => {
  if (process.platform !== "darwin") {
    const response = await fetch(`${baseUrl}/api/ocr`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: blankPng
    });
    assert.equal(response.status, 501);
    return;
  }

  const response = await fetch(`${baseUrl}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blankPng
  });

  // Thiếu Xcode Command Line Tools thì không biên dịch được công cụ Swift.
  if (response.status === 501) {
    t.skip("Máy này chưa biên dịch được công cụ OCR.");
    return;
  }

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(typeof payload.text, "string");
  assert.ok(Array.isArray(payload.lines));
  // Ảnh một điểm ảnh không có chữ nào, nên danh sách phải rỗng.
  assert.deepEqual(payload.lines, []);
});
