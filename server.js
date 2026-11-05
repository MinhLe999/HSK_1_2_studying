const http = require("node:http");
const path = require("node:path");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");

const rootDir = __dirname;
const publicDir = path.join(rootDir, "public");
const dataFile = process.env.HSK_DATA_FILE
  ? path.resolve(process.env.HSK_DATA_FILE)
  : path.join(rootDir, "data", "user-data.json");
const port = Number.parseInt(process.env.PORT || "4173", 10);
const host = process.env.HOST || "127.0.0.1";
const maxBodyBytes = 1024 * 1024;

const defaultState = {
  version: 1,
  progress: {
    practice: {},
    final: { answers: {}, checked: false },
    measureWords: { answers: {}, checkedPages: {} },
    writingShown: {},
    lastLessonId: "l2705",
    lastView: "lesson"
  },
  notes: "",
  roadmap: {
    currentLessonId: "l2608",
    reviewStage: {}
  },
  clusters: [
    {
      id: "cluster-shu-nian",
      name: "书 và 年",
      hint: "So sánh nét giữa và phần chân chữ.",
      items: [
        { id: "item-shu", hanzi: "书", pinyin: "shū", meaning: "sách", note: "Có nét móc ở giữa." },
        { id: "item-nian", hanzi: "年", pinyin: "nián", meaning: "năm", note: "Phần dưới có nét ngang dài." }
      ]
    },
    {
      id: "cluster-yu-ba",
      name: "鱼 và 爸",
      hint: "Nhìn phần đầu và bộ ở nửa dưới.",
      items: [
        { id: "item-yu", hanzi: "鱼", pinyin: "yú", meaning: "cá", note: "Phần dưới là một nét ngang." },
        { id: "item-ba", hanzi: "爸", pinyin: "bà", meaning: "bố", note: "Phần trên là 父." }
      ]
    },
    {
      id: "cluster-zhe-hai",
      name: "这 và 还",
      hint: "Cùng có bộ 辶; phần bên trong khác nhau.",
      items: [
        { id: "item-zhe", hanzi: "这", pinyin: "zhè", meaning: "này, đây", note: "Bên trong là 文." },
        { id: "item-hai", hanzi: "还", pinyin: "hái", meaning: "còn, vẫn", note: "Bên trong là 不." }
      ]
    },
    {
      id: "cluster-zai-zhu",
      name: "在 và 住",
      hint: "在 chỉ vị trí; 住 có bộ nhân đứng 亻.",
      items: [
        { id: "item-zai", hanzi: "在", pinyin: "zài", meaning: "ở, tại", note: "Không có bộ nhân đứng." },
        { id: "item-zhu", hanzi: "住", pinyin: "zhù", meaning: "ở, cư trú", note: "Bên trái là 亻." }
      ]
    },
    {
      id: "cluster-ren-ru",
      name: "人 và 入",
      hint: "Chú ý hướng mở của hai nét.",
      items: [
        { id: "item-ren", hanzi: "人", pinyin: "rén", meaning: "người", note: "Nét trái đè lên nét phải." },
        { id: "item-ru", hanzi: "入", pinyin: "rù", meaning: "vào", note: "Nét phải đè lên nét trái." }
      ]
    }
  ]
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function cleanText(value, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeState(value) {
  const fallback = cloneDefaultState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const progress = value.progress && typeof value.progress === "object"
    ? value.progress
    : fallback.progress;
  const clusters = Array.isArray(value.clusters) ? value.clusters : fallback.clusters;
  const roadmap = value.roadmap && typeof value.roadmap === "object"
    ? value.roadmap
    : fallback.roadmap;
  const reviewStage = roadmap.reviewStage && typeof roadmap.reviewStage === "object"
    ? roadmap.reviewStage
    : {};

  return {
    version: 1,
    progress: {
      practice: progress.practice && typeof progress.practice === "object" ? progress.practice : {},
      final: progress.final && typeof progress.final === "object"
        ? progress.final
        : { answers: {}, checked: false },
      measureWords: progress.measureWords && typeof progress.measureWords === "object"
        ? {
            answers: progress.measureWords.answers && typeof progress.measureWords.answers === "object"
              ? progress.measureWords.answers
              : {},
            checkedPages: progress.measureWords.checkedPages
              && typeof progress.measureWords.checkedPages === "object"
              ? progress.measureWords.checkedPages
              : {}
          }
        : { answers: {}, checkedPages: {} },
      writingShown: progress.writingShown && typeof progress.writingShown === "object"
        ? progress.writingShown
        : {},
      lastLessonId: cleanText(progress.lastLessonId, 40) || "l2705",
      lastView: cleanText(progress.lastView, 24) || "lesson"
    },
    notes: cleanText(value.notes, 20000),
    roadmap: {
      currentLessonId: cleanText(roadmap.currentLessonId, 40) || fallback.roadmap.currentLessonId,
      reviewStage: Object.fromEntries(
        Object.entries(reviewStage)
          .slice(0, 400)
          .map(([lessonId, entry]) => [
            cleanText(lessonId, 40),
            {
              stage: Number.isInteger(entry?.stage) ? Math.max(0, Math.min(10, entry.stage)) : 0,
              lastReviewedAt: cleanText(entry?.lastReviewedAt, 10) || null,
              nextReviewDate: cleanText(entry?.nextReviewDate, 10) || null
            }
          ])
          .filter(([lessonId]) => lessonId)
      )
    },
    clusters: clusters.slice(0, 100).map((cluster, clusterIndex) => ({
      id: cleanText(cluster.id, 80) || `cluster-${clusterIndex}`,
      name: cleanText(cluster.name, 80) || "Cụm chưa đặt tên",
      hint: cleanText(cluster.hint, 240),
      items: Array.isArray(cluster.items)
        ? cluster.items.slice(0, 100).map((item, itemIndex) => ({
            id: cleanText(item.id, 80) || `item-${itemIndex}`,
            hanzi: cleanText(item.hanzi, 24),
            pinyin: cleanText(item.pinyin, 80),
            meaning: cleanText(item.meaning, 160),
            note: cleanText(item.note, 240)
          })).filter(item => item.hanzi)
        : []
    }))
  };
}

async function writeState(state) {
  const normalized = normalizeState(state);
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp-${process.pid}`;
  await fs.writeFile(temporaryFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await fs.rename(temporaryFile, dataFile);
  return normalized;
}

async function readState() {
  try {
    const saved = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return normalizeState(saved);
  } catch (error) {
    if (error.code !== "ENOENT" && error.name !== "SyntaxError") throw error;
    return writeState(cloneDefaultState());
  }
}

function sendJson(response, statusCode, body) {
  const content = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(content),
    "Cache-Control": "no-store"
  });
  response.end(content);
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBodyBytes) {
      const error = new Error("Dữ liệu gửi lên vượt quá giới hạn.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function serveStatic(request, response, pathname) {
  let filePath;
  if (pathname === "/HSK.pdf") {
    filePath = path.join(rootDir, "materials", "HSK.pdf");
  } else {
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    filePath = path.resolve(publicDir, relativePath);
    if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${path.sep}`)) {
      sendJson(response, 403, { message: "Đường dẫn không được phép." });
      return;
    }
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw Object.assign(new Error("not file"), { code: "ENOENT" });
    const headers = {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": pathname === "/HSK.pdf" ? "private, max-age=3600" : "no-cache",
      "Accept-Ranges": "bytes"
    };

    if (pathname === "/HSK.pdf" && request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!match) {
        response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        response.end();
        return;
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        response.end();
        return;
      }
      response.writeHead(206, {
        ...headers,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      fsSync.createReadStream(filePath, { start, end }).pipe(response);
      return;
    }

    response.writeHead(200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(await fs.readFile(filePath));
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { message: "Không tìm thấy nội dung." });
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/api/state" && request.method === "GET") {
      sendJson(response, 200, await readState());
      return;
    }

    if (pathname === "/api/state" && request.method === "PUT") {
      sendJson(response, 200, await writeState(await readJsonBody(request)));
      return;
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      sendJson(response, 405, { message: "Phương thức không được hỗ trợ." });
      return;
    }

    await serveStatic(request, response, pathname);
  } catch (error) {
    const statusCode = error.statusCode || (error.name === "SyntaxError" ? 400 : 500);
    sendJson(response, statusCode, {
      message: statusCode === 500 ? "Máy chủ gặp lỗi khi xử lý dữ liệu." : error.message
    });
    if (statusCode === 500) console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`HSK đang chạy tại http://${host}:${port}`);
  console.log(`Dữ liệu được lưu tại ${dataFile}`);
});
