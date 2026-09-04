# HSK Local Review: Hướng dẫn tiếp quản

Đây là webapp ôn HSK chạy hoàn toàn trên máy cục bộ. Không có framework, không có gói phụ thuộc và không gọi dịch vụ bên ngoài. Chạy bằng Node.js 18 trở lên:

```bash
npm start
```

Mở `http://127.0.0.1:4173`. Máy chủ chỉ lắng nghe trên máy cục bộ mặc định; đặt biến môi trường `HOST=0.0.0.0` để cho phép truy cập từ máy khác trong cùng mạng LAN (xem README.md).

## Trạng thái dự án

- Tài liệu nguồn là `materials/HSK.pdf` (131 trang, tệp toàn bộ notebook, được server phục vụ tại route `/HSK.pdf`). Thư mục `materials/` cũng có thể chứa các tệp PDF nhỏ hơn theo từng đợt cập nhật (ví dụ `materials/26_08_26.pdf`) — đây thường là bản scan mới nhất trước khi được gộp vào `HSK.pdf`, nên nội dung có thể trùng với phần đã thêm gần nhất; luôn đối chiếu ngày trong tệp với ngày bài học đã có trước khi coi là nội dung mới. Toàn bộ `materials/` bị Git bỏ qua.
- Có 26 ngày học, từ `27/05/2026` đến `26/08/2026`; lịch gốc bỏ ngày `22/05`.
- Giao diện có các tab: Bài học, Cấu trúc câu, Thẻ nhớ, Bài tập, Lượng từ, Chữ gần giống, Ghi chú và Bài cuối.
- Tab Ghi chú là một ô văn bản tự do toàn cục (không gắn với ngày học nào), lưu tại `data/user-data.json` field `notes`.
- Tab Lượng từ hiện có bảng lượng từ không lặp, phần số lớn (hàng trăm đến hàng triệu) và bài tập riêng cho cả hai phần.
- Tiến độ người dùng chỉ nằm trong `data/user-data.json`. Tệp này bị Git bỏ qua và tuyệt đối không được sửa, xóa hay commit khi làm thay đổi nội dung chương trình.

## Quy tắc nội dung bắt buộc

- Giải thích, nhãn giao diện, yêu cầu bài tập và đáp án giải thích dùng tiếng Việt; không viết nội dung học bằng tiếng Anh.
- Câu ví dụ, bài đọc, hội thoại và câu mẫu tiếng Trung không có phiên âm. Phiên âm chỉ được hiện ở nơi người học cần tra từ, ví dụ thẻ từ vựng, bảng từ vựng và bảng lượng từ.
- Chỉ dùng cách đọc Hán-Việt khi thông dụng và thật sự giúp giải thích; không thêm cho có.
- Khi thêm từ vựng, đối chiếu bảng màu vàng trong `HSK.pdf` trước. Mỗi từ phải có ít nhất một ví dụ tiếng Trung và nghĩa tiếng Việt.
- Mỗi bài tập ngày phải pha từ/cấu trúc mới với kiến thức các ngày trước, và có một đoạn văn cùng một hội thoại đọc hiểu.
- Bài tự viết của từng ngày cần có bốn dạng theo thứ tự: đặt câu với từ mới, đặt câu với cấu trúc mới, đặt câu hỏi từ câu trả lời, trả lời từ câu hỏi. Ngoài ra có đúng ba bài đặt câu với 2-3 từ cho sẵn.
- Trong cùng một ngày, không lặp đề, chủ đề hoặc cấu trúc ở các bài tự viết và ba bài từ cho sẵn.
- Dùng font sans-serif hiện tại, đặc biệt `PingFang SC`/system sans cho chữ Hán. Không thay bằng font viết tay, thư pháp hoặc serif khó đọc.
- Cột `Chữ / từ` của bảng Chữ gần giống đã được mở rộng để chứa từ 3-4 chữ Hán. Giữ tối thiểu 180px và không ép ngắt dòng nếu không có lý do rõ ràng.

## Những tệp cần đọc trước khi sửa

Đọc đúng nhóm tệp liên quan trước, không sửa dữ liệu sinh hay dữ liệu nguồn một cách mù quáng.

| Mục tiêu | Đọc trước | Nguồn cần sửa |
| --- | --- | --- |
| Bài học, từ vựng, ví dụ, bài cuối | `public/content.js`, `public/example-supplements.js`, `test/content.test.js` | `public/content.js`, có thể cả `public/example-supplements.js` |
| Cấu trúc câu, bài đọc, ba bài từ cho sẵn | `STRUCTURE_PLAN.md`, `tools/build-structures.js`, `public/structures.js`, `public/practice-extensions.js` | Chỉ sửa `STRUCTURE_PLAN.md`, sau đó sinh hai tệp `.js` |
| Bốn bài tự viết mỗi ngày | `public/production.js`, `test/content.test.js` | `public/production.js` |
| Lượng từ hoặc số lớn | `public/measure-words.js`, phần lượng từ của `public/app.js`, kiểm thử lượng từ | `public/measure-words.js`, và `public/app.js`/`public/styles.css` nếu cần giao diện mới |
| Tab, chấm điểm, lưu tiến độ | `public/index.html`, `public/app.js`, `server.js`, `test/server.test.js` | Các tệp tương ứng |
| Bố cục và font | `public/styles.css`, HTML do hàm `render...` liên quan sinh ra trong `public/app.js` | `public/styles.css`, có thể `public/app.js` |
| Cập nhật PDF | `materials/HSK.pdf` (và các PDF khác trong `materials/`), `tools/extract_pdf.swift`, `tools/ocr_pdf.swift` | Dữ liệu bài học sau khi đối chiếu PDF |

## Kiến trúc chạy

- `server.js` phục vụ tệp trong `public/`, `materials/HSK.pdf` (tại route `/HSK.pdf`) và API `GET`/`PUT /api/state`.
- `server.js` chuẩn hóa trạng thái trước khi lưu. Nếu thêm một nhánh tiến độ mới trong giao diện, phải thêm giá trị mặc định và phần chuẩn hóa tương ứng ở đây.
- `public/index.html` tải các tệp dữ liệu theo thứ tự trước `public/app.js`. Khi tạo tệp dữ liệu mới, thêm thẻ `<script>` trước `app.js`.
- `public/app.js` là nơi duy nhất ghép dữ liệu với giao diện, xử lý tương tác và gọi API lưu tiến độ.
- `public/styles.css` là stylesheet duy nhất.
- `data/user-data.json` là dữ liệu cá nhân có thể thay đổi sau mỗi lần sử dụng; không dùng làm dữ liệu mẫu hoặc kiểm thử nội dung.

## Định dạng dữ liệu

### Bài học chính: `public/content.js`

Tệp gán một đối tượng cho `window.HSK_CONTENT`.

```js
{
  lessons: [{
    id: "l2705",             // l + ngày + tháng, phải khớp mọi tệp khác
    date: "27/05/2026",
    shortDate: "27/05",
    page: 1,
    pages: "trang 1-4",
    title: "...",
    focus: "...",
    notes: ["..."],
    patterns: [["Công thức", "Giải thích tiếng Việt"]],
    vocab: [["汉字", "pinyin", "nghĩa tiếng Việt"]],
    examples: [["Câu tiếng Trung。", "Nghĩa tiếng Việt."]],
    drills: [["Yêu cầu tiếng Việt", "Đáp án tiếng Trung。"]],
    practice: {
      cloze: [["Câu hỏi", ["A", "B", "C", "D"], 0, "Giải thích"]],
      orders: [[["các", "thẻ"], "Câu đã sắp xếp。"]]
    },
    numberGuide: { /* chỉ dùng khi ngày đó có phần số lớn */ }
  }],
  finalQuestions: [["Câu hỏi", ["A", "B", "C", "D"], 0, "Giải thích"]],
  finalWriting: [["Yêu cầu tiếng Việt", "Câu mẫu tiếng Trung。"]],
  finalReading: { title: "...", text: "...", questions: [["...", ["..."], 0, "..."]] },
  source: { file: "HSK.pdf", pages: 71, updated: "dd/mm/yyyy" }
}
```

Mỗi `patterns` và `vocab` là mảng theo đúng thứ tự để `patternEvidence` đối chiếu. Khi thêm ngày mới, cập nhật bài cuối và `source` nếu số trang PDF đổi.

### Ví dụ bổ sung: `public/example-supplements.js`

```js
window.HSK_EXAMPLE_SUPPLEMENTS = {
  l2705: {
    additions: [["Câu tiếng Trung。", "Nghĩa tiếng Việt."]],
    patternEvidence: ["Câu tiếng Trung khớp đúng một cấu trúc"]
  }
};
```

- `patternEvidence` phải có đúng một phần tử cho mỗi `patterns` của ngày đó.
- Một câu không được dùng làm bằng chứng cho hai cấu trúc trong cùng ngày.
- Tất cả từ trong `vocab` phải xuất hiện trong `examples` hoặc `additions`.

### Kế hoạch cấu trúc và bài tập: `STRUCTURE_PLAN.md`

Đây là nguồn chuẩn; không sửa trực tiếp `public/structures.js` hay `public/practice-extensions.js` vì chúng được sinh lại.

Mỗi ngày có hai phần bắt buộc:

```md
## l2705 · 27/05/2026 · Chủ đề
| Mã | Công thức | Cách dùng | Ví dụ | Nghĩa |
| --- | --- | --- | --- | --- |
| l2705-s1 | ... | ... | ... | ... |

### l2705 · 27/05/2026
#### Đoạn văn
> ...
#### Hội thoại
> A：...
#### Câu hỏi đọc hiểu
| l2705-r1 | Câu hỏi | A；B；C；D | Đáp án | Giải thích |
#### Đặt câu với từ cho sẵn
| l2705-w1 | Chủ đề | Cấu trúc | từ 1；từ 2 | Yêu cầu | Câu mẫu |
```

Ràng buộc do trình sinh kiểm tra:

- Mỗi ngày phải có ít nhất một cấu trúc.
- Đoạn văn có tối thiểu 6 câu; hội thoại tối thiểu 8 lượt; toàn bài đọc tối thiểu 120 chữ Hán.
- Có đúng 5 câu đọc hiểu, mỗi câu 4 lựa chọn.
- Có đúng 3 bài đặt câu với 2-3 từ bắt buộc; từ bắt buộc phải nằm trong câu mẫu.
- Mã `-s`, `-r`, `-w` không được trùng và phải cùng mã ngày.

Sau khi sửa, luôn chạy:

```bash
npm run build:plan
npm run check:plan
```

### Bài tự viết: `public/production.js`

```js
window.HSK_PRODUCTION = {
  l2705: [{
    kind: "sentence-vocab",
    topic: "chủ đề không trùng",
    structure: "cấu trúc không trùng",
    prompt: "Yêu cầu tiếng Việt",
    required: "từ hoặc cấu trúc phải dùng",
    sample: "Câu mẫu tiếng Trung。"
  }]
};
```

Mỗi ngày có chính xác bốn `kind` theo thứ tự: `sentence-vocab`, `sentence-pattern`, `question-from-answer`, `answer-from-question`.

### Lượng từ và số lớn: `public/measure-words.js`

Tệp gán `window.HSK_MEASURE_WORDS`.

```js
{
  classifiers: [{ id, hanzi, pinyin, group, nouns, explanation, example }],
  pairs: [{ id, noun, target, sentence, classifier, accepted, explanation }],
  largeNumbers: {
    units: [{ hanzi, pinyin, value, meaning, example, result }],
    rules: [{ title, explanation, example }],
    values: [{ value, display, chinese, acceptedChinese }],
    exerciseCount: 0
  },
  exerciseCount: 0
}
```

- `classifiers` phải không lặp `hanzi`; mỗi lượng từ có giải thích và ví dụ.
- Mỗi `pair.sentence` dùng `___` cho chỗ cần điền; `classifier` và toàn bộ `accepted` phải xuất hiện trong `classifiers`.
- `exerciseCount` phải phản ánh tổng số câu do `public/app.js` sinh. Cập nhật hoặc thêm kiểm thử khi thay đổi công thức tính.
- Với số lớn, `acceptedChinese` dùng cho các cách đọc hợp lệ; không tự ý chấp nhận cách làm mất đơn vị `万` hoặc đọc sai vị trí `零`.

## Quy trình cập nhật nội dung

1. Đọc phần PDF liên quan, nhất là bảng màu vàng. Dùng công cụ trích/OCR trong `tools/` khi cần, rồi kiểm tra trực tiếp lại với PDF.
2. Lập hoặc cập nhật `STRUCTURE_PLAN.md` trước khi viết cấu trúc, bài đọc, bài tập đọc hiểu và bài đặt câu với từ cho sẵn.
3. Chạy `npm run build:plan` để sinh `public/structures.js` và `public/practice-extensions.js`.
4. Cập nhật `public/content.js`, `public/example-supplements.js`, `public/production.js` và bài cuối theo phạm vi thay đổi.
5. Nếu thay đổi lượng từ/số lớn, cập nhật `public/measure-words.js`, hàm liên quan trong `public/app.js` và CSS nếu cần.
6. Bổ sung kiểm thử có ý nghĩa trong `test/content.test.js` hoặc `test/server.test.js` cho hợp đồng dữ liệu hoặc trạng thái mới.
7. Chạy đầy đủ kiểm tra bên dưới. Với thay đổi giao diện, mở trang cục bộ và kiểm tra ít nhất desktop và điện thoại; sau khi kiểm tra xong, dừng máy chủ nếu người dùng yêu cầu tự khởi động bằng terminal.

## Kiểm tra bắt buộc

```bash
npm run check
npm test
```

`npm run check` kiểm tra đồng bộ Markdown sinh dữ liệu và cú pháp JavaScript. `npm test` chạy kiểm thử nội dung, hợp đồng dữ liệu, máy chủ, API lưu trạng thái và PDF Range request. Không bàn giao thay đổi khi một trong hai lệnh lỗi.

## Git và an toàn dữ liệu

- Luôn đọc `git status --short` trước và sau thay đổi. Không hoàn tác thay đổi không phải do mình tạo.
- Dùng Conventional Commits, ví dụ: `feat: add quantity word drills`, `fix: preserve measure progress`, `docs: document content workflow`.
- Không commit `data/user-data.json`, tệp tạm `data/*.tmp-*`, `.DS_Store`, `node_modules/` hoặc `materials/` (chứa `HSK.pdf` và các bản scan PDF cá nhân khác). `.gitignore` hiện đã bảo vệ các tệp này.
- Không dùng lệnh Git phá hủy như `git reset --hard` hoặc `git checkout --` trừ khi người dùng yêu cầu rõ.

## Thứ tự đọc nhanh cho agent mới

1. `AGENTS.md` này và `README.md`.
2. `package.json`, `server.js`, `public/index.html`, `public/app.js`.
3. Tệp dữ liệu liên quan trực tiếp đến yêu cầu.
4. `test/content.test.js` và `test/server.test.js` trước khi thiết kế định dạng mới.
5. `STRUCTURE_PLAN.md` trước mọi chỉnh sửa cấu trúc, bài đọc hoặc bài đặt câu với từ cho sẵn.
