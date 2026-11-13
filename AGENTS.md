# HSK Local Review: Hướng dẫn tiếp quản

Đây là webapp ôn HSK chạy hoàn toàn trên máy cục bộ. Không có framework, không có gói phụ thuộc và không gọi dịch vụ bên ngoài. Chạy bằng Node.js 18 trở lên:

```bash
npm start
```

Mở `http://127.0.0.1:4173`. Máy chủ chỉ lắng nghe trên máy cục bộ mặc định; đặt biến môi trường `HOST=0.0.0.0` để cho phép truy cập từ máy khác trong cùng mạng LAN (xem README.md).

## Trạng thái dự án

- Tài liệu nguồn là `materials/HSK.pdf` (131 trang, tệp toàn bộ notebook, được server phục vụ tại route `/HSK.pdf`). Thư mục `materials/` cũng có thể chứa các tệp PDF nhỏ hơn theo từng đợt cập nhật (ví dụ `materials/26_08_26.pdf`, `materials/4_11_09_26.pdf`) — có tệp là bản scan trùng với phần đã gộp vào `HSK.pdf` (luôn đối chiếu ngày trong tệp với ngày bài học đã có trước khi coi là nội dung mới), có tệp là nội dung thật sự mới chưa gộp vào `HSK.pdf`. Trường `pages` của mỗi bài học ghi số trang theo đúng tệp PDF gốc đã dùng để soạn bài đó, không phải luôn là `HSK.pdf` — khi tệp nhỏ chưa được gộp, số trang này tham chiếu tệp nhỏ đó. Toàn bộ `materials/` bị Git bỏ qua.
- Có 46 ngày học, từ `27/05/2026` đến `13/11/2026`; lịch gốc bỏ ngày `22/05`. Bảy ngày `23/10/2026`, `28/10/2026`, `02/11/2026`, `04/11/2026`, `06/11/2026`, `09/11/2026` và `13/11/2026` được soạn từ bộ slide lớp học trên `school.chineserd.com` (HSK 标准教程 3, bài 11, 12, 13, 14, 15, 16 và 17) chứ không phải từ PDF trong `materials/`, nên trường `pages` của bảy ngày này ghi theo số slide. Hai buổi ôn tập 复习课（三）ngày 30/10 và 复习课（四）ngày 11/11 chưa soạn.
- Một số ngày có bài nghe (field `listening` trên lesson trong `public/content.js`: mảng `{ title, url, note, dialogueLines, trueFalse }`; `url` là liên kết MP3 ngoài, lấy từ URI nhúng trong PDF gốc qua `PDFAnnotation.url`, không phải từ OCR; `dialogueLines` là các câu hội thoại thật trong PDF dùng cho bài tập sắp xếp câu; `trueFalse` là mảng `[câu nhận định, true/false, giải thích]` lấy từ bài tập đúng/sai thật trong PDF). Bài nghe **không** hiện ở tab Bài học — nó được `buildPracticeSections()` trong `public/app.js` ghép thành các câu hỏi dạng `order` (sắp xếp hội thoại) và `choice` (đúng/sai) ở cuối tab Bài tập, kèm thẻ `<audio controls>` (`section.audio`); bỏ trống `listening: []` nếu ngày đó không có bài nghe.
- Giao diện có các tab: Bài học, Lộ trình, Cấu trúc câu, Cấu trúc thông dụng, Thẻ nhớ, Bài tập, Lượng từ, Chữ gần giống, Tra ảnh và Ghi chú. Tab Bài cuối đã bị bỏ; dữ liệu `finalQuestions`, `finalWriting`, `finalReading` vẫn còn trong `public/content.js` nhưng không còn nơi hiển thị.
- Cột `Ý nghĩa` trong bảng cấu trúc của `STRUCTURE_PLAN.md` là nghĩa cốt lõi ngắn gọn (vài từ, kèm chú thích chức năng trong ngoặc), tách khỏi cột `Cách dùng` vốn là đoạn giải thích sắc thái/điều kiện dài. Parser đưa nó thành trường `sense`, tab Cấu trúc câu hiển thị dưới dạng nhãn ngay dưới công thức.
- Tab Cấu trúc thông dụng (`public/common-structures.js`, hàm `renderCommonStructures()`) là bảng tra nhanh theo từ khóa, không gắn với ngày học: mỗi mục gồm `phraseTable` (cụm từ ghép), `patternTable` (cấu trúc ngữ pháp), `tipList` (mẹo phân biệt) và `mnemonic` (câu tóm tắt). Thêm chữ mới chỉ cần thêm một object vào mảng `entries`.
- Tab Tra ảnh (`renderImageLookup()` trong `public/app.js`) nhận ảnh dán từ clipboard — sự kiện `paste` bắt ở cấp `document` nên dán ở tab nào cũng được, trang sẽ tự chuyển sang tab này. Ảnh gửi nguyên dạng tới `POST /api/ocr`; `server.js` biên dịch `tools/ocr_image.swift` một lần vào `tools/.build/ocr_image` rồi gọi lại nhiều lần. Công cụ chỉ bật mô hình chữ Hán (`recognitionLanguages = ["zh-Hans"]`): Vision đọc pinyin và tiếng Việt trong ảnh sai, mà app cũng không cần — pinyin, nghĩa và số bài lấy từ `public/content.js`. Phía trình duyệt lọc bỏ mọi ký tự không phải chữ Hán rồi tách từ theo kiểu khớp dài nhất trước, chỉ nhận từ có trong giáo trình, nên không cần thư viện phân từ. Tính năng này chỉ chạy trên macOS; máy khác nhận lỗi 501 có giải thích.
- Khóa tra của từ điển ngược là từng đoạn chữ Hán trong trường `vocab`, không phải nguyên văn ô: `没有 / 没` cho hai khóa, `太...了` cho `太` và `了`, còn phần trong ngoặc bị bỏ hẳn nên `聊天（儿）` chỉ cho khóa `聊天`. Nguyên văn vẫn được giữ để hiển thị. Nếu thêm dạng ghi mới trong `vocab`, kiểm tra lại hàm dựng `vocabIndex`.
- Tab Ghi chú là một ô văn bản tự do toàn cục (không gắn với ngày học nào), lưu tại `data/user-data.json` field `notes`.
- Tab Lộ trình (`renderRoadmap()` trong `public/app.js`) theo dõi tiến độ học thật của người dùng (có thể chậm hơn số ngày đã soạn trong `public/content.js`) và áp dụng active recall: field `roadmap` trong `data/user-data.json` gồm `currentLessonId` (id bài học gần nhất đã học thật, có thể chỉnh lại qua dropdown trên trang) và `reviewStage` (map `lessonId → { stage, lastReviewedAt, nextReviewDate }`, lịch ôn tăng dần theo `REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35]` ngày trong `public/app.js`). Trang hiển thị bài mới nên học hôm nay (bài ngay sau `currentLessonId`), các bài đến hạn ôn hôm nay (nút ôn dẫn tới tab Bài tập của bài đó, không phải tab Bài học, để ép làm lại thay vì đọc lại), và các bài sẽ đến hạn trong 7 ngày tới.
- Câu điền từ trong `practice.cloze` có thể kèm ảnh: phần tử thứ tư của mỗi câu là đường dẫn ảnh (`"images/l0411/pan-zi.png"`) hoặc mảng nhiều đường dẫn khi bài tập cần vài tranh. Ảnh nằm trong `public/images/<mã ngày>/`, được `questionImage()` trong `public/app.js` dựng thành `<figure class="question-image">` và tạo kiểu bằng lớp `.question-image` trong `public/styles.css`. Vì vậy `clozeQuestion()` phân loại câu theo KIỂU của phần tử thứ ba (chuỗi giải thích ⇒ câu điền từ, số ⇒ câu trắc nghiệm) chứ không theo độ dài mảng.
- Tab Lượng từ hiện có bảng lượng từ không lặp, phần số lớn (hàng trăm đến hàng triệu) và bài tập riêng cho cả hai phần.
- Thanh bên chia danh sách ngày học theo giáo trình: `hskLevel()` trong `public/app.js` so ngày với mốc trong `HSK_LEVEL_BOUNDARIES` (HSK 1 hết ngày 26/06/2026, HSK 2 hết ngày 11/09/2026, còn lại là HSK 3) rồi `renderShell()` chèn nhãn `.lesson-group-label` trước ngày đầu tiên của mỗi cấp. Khi thêm cấp mới, thêm mốc vào mảng này.
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
| Bài học, từ vựng, ví dụ | `public/content.js`, `public/example-supplements.js`, `test/content.test.js` | `public/content.js`, có thể cả `public/example-supplements.js` |
| Cấu trúc câu, bài đọc, ba bài từ cho sẵn | `STRUCTURE_PLAN.md`, `tools/build-structures.js`, `public/structures.js`, `public/practice-extensions.js` | Chỉ sửa `STRUCTURE_PLAN.md`, sau đó sinh hai tệp `.js` |
| Bốn bài tự viết mỗi ngày | `public/production.js`, `test/content.test.js` | `public/production.js` |
| Lượng từ hoặc số lớn | `public/measure-words.js`, phần lượng từ của `public/app.js`, kiểm thử lượng từ | `public/measure-words.js`, và `public/app.js`/`public/styles.css` nếu cần giao diện mới |
| Tab, chấm điểm, lưu tiến độ | `public/index.html`, `public/app.js`, `server.js`, `test/server.test.js` | Các tệp tương ứng |
| Bố cục và font | `public/styles.css`, HTML do hàm `render...` liên quan sinh ra trong `public/app.js` | `public/styles.css`, có thể `public/app.js` |
| Tra từ qua ảnh | `tools/ocr_image.swift`, phần `/api/ocr` của `server.js`, `renderImageLookup()` và `vocabIndex` trong `public/app.js` | Các tệp tương ứng |
| Cập nhật PDF | `materials/HSK.pdf` (và các PDF khác trong `materials/`), `tools/extract_pdf.swift`, `tools/ocr_pdf.swift` | Dữ liệu bài học sau khi đối chiếu PDF |

## Kiến trúc chạy

- `server.js` phục vụ tệp trong `public/`, `materials/HSK.pdf` (tại route `/HSK.pdf`), API `GET`/`PUT /api/state` và `POST /api/ocr` (nhận ảnh thô, tối đa 16 MB, trả về chữ đọc được).
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
    numberGuide: { /* chỉ dùng khi ngày đó có phần số lớn */ },
    listening: [{ title: "...", url: "https://...mp3", note: "...", dialogueLines: ["..."], trueFalse: [["Câu nhận định", true, "Giải thích"]] }] /* chỉ dùng khi ngày đó có bài nghe; bỏ trống [] nếu không có; render trong tab Bài tập, không phải tab Bài học */
  }],
  /* ba trường dưới đây thuộc tab Bài cuối đã bỏ, giữ lại nhưng không còn render */
  finalQuestions: [["Câu hỏi", ["A", "B", "C", "D"], 0, "Giải thích"]],
  finalWriting: [["Yêu cầu tiếng Việt", "Câu mẫu tiếng Trung。"]],
  finalReading: { title: "...", text: "...", questions: [["...", ["..."], 0, "..."]] },
  source: { file: "HSK.pdf", pages: 71, updated: "dd/mm/yyyy" }
}
```

Mỗi `patterns` và `vocab` là mảng theo đúng thứ tự để `patternEvidence` đối chiếu. Khi thêm ngày mới, cập nhật `source` nếu số trang PDF đổi.

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
| Mã | Công thức | Ý nghĩa | Cách dùng | Ví dụ | Nghĩa |
| --- | --- | --- | --- | --- | --- |
| l2705-s1 | ... | ... | ... | ... | ... |

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

Cột `Ví dụ` và `Nghĩa` của bảng cấu trúc có thể chứa nhiều câu, phân tách bằng `；` (ví dụ `câu 1；câu 2；câu 3`); số câu ví dụ và số nghĩa phải khớp nhau theo đúng thứ tự. Ưu tiên đúng ba ví dụ cho mỗi cấu trúc mới — phần ngữ pháp cần giải thích chi tiết, không dừng ở một ví dụ hời hợt; một cấu trúc chỉ có một ví dụ (không có `；`) vẫn hợp lệ với các ngày cũ nhưng không phải mục tiêu cho ngày mới.

Cột `Cách dùng` cũng dùng `；` để tách thành nhiều dòng khi một cấu trúc có nhiều dạng con cần liệt kê riêng (ví dụ khẳng định／phủ định／nghi vấn) — trình sinh nối các đoạn bằng xuống dòng thật (`\n`) và giao diện hiển thị bằng `white-space: pre-line` (lớp `.structure-usage` ở tab Cấu trúc câu, `.pattern-note` ở phần Mẫu câu); không nhồi cả ba dạng vào một câu dài dùng dấu `;` thường, rất khó đọc. Khi tự viết `patterns` trong `public/content.js` (không qua trình sinh), chèn trực tiếp ký tự xuống dòng `\n` trong chuỗi để được hiệu ứng tương tự.

Khi một điểm ngữ pháp trong PDF gốc thực sự có 2-3 dạng nhỏ khác nhau (PDF tự đánh số "(1)/(2)", hoặc liệt kê riêng dạng khẳng định/phủ định/nghi vấn, hoặc một từ vừa là danh từ vừa là động từ, hoặc vài công thức khác nhau gộp dưới một tiêu đề), không gộp chúng vào một hàng cấu trúc duy nhất — tách mỗi dạng nhỏ thành một hàng `-sN` riêng, mỗi hàng vẫn có đủ ba ví dụ. Đánh nhãn dạng nhỏ ngay trong cột Công thức bằng tiền tố `x.1`, `x.2`, `x.3` (x là số thứ tự điểm ngữ pháp cha) để người học vẫn thấy được mối liên hệ, dù mỗi dạng hiện thành một thẻ riêng trong tab Cấu trúc câu.

Ràng buộc do trình sinh kiểm tra:

- Mỗi ngày phải có ít nhất một cấu trúc.
- Số câu ví dụ và số nghĩa trong mỗi cấu trúc phải khớp nhau; không được lặp câu ví dụ trong cùng một cấu trúc.
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
4. Cập nhật `public/content.js`, `public/example-supplements.js` và `public/production.js` theo phạm vi thay đổi.
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
