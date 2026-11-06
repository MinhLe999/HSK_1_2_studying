# Webapp ôn HSK

## Cách chạy

Yêu cầu Node.js 18 trở lên. Tại thư mục dự án, chạy:

```bash
npm start
```

Sau đó mở `http://127.0.0.1:4173`.

Không cần cài gói phụ và không cần kết nối dịch vụ bên ngoài.

## Tra từ qua ảnh

Tab **Tra ảnh** cho phép dán ảnh (`⌘V`) chụp trang sách hay màn hình: chữ Hán trong ảnh được đọc rồi đối chiếu với từ vựng của cả 38 ngày, trả về nghĩa và số bài chứa từ đó. Bấm vào số bài để mở thẳng ngày học.

Chữ trong ảnh do Vision của macOS đọc, chạy ngay trên máy và không gửi ảnh đi đâu. Lần dùng đầu tiên máy chủ tự biên dịch `tools/ocr_image.swift`, nên cần Xcode Command Line Tools (`xcode-select --install`). Tính năng này chỉ chạy khi máy chủ đặt trên máy Mac; mở từ điện thoại trong cùng mạng LAN vẫn dùng được vì phần đọc ảnh nằm ở máy chủ.

## Dữ liệu được lưu

- Tiến độ bài tập, đáp án lượng từ và các cụm chữ tự thêm được lưu tại `data/user-data.json`.
- `materials/HSK.pdf` là tài liệu nguồn 131 trang (server phục vụ tại route `/HSK.pdf`). Thư mục `materials/` không nằm trong Git.
- Muốn dùng cổng khác, chạy ví dụ `PORT=5000 npm start`.
- Máy chủ mặc định chỉ nhận kết nối từ chính máy đang chạy chương trình.
- Muốn truy cập từ máy khác trong cùng mạng LAN, chạy `HOST=0.0.0.0 npm start`, sau đó ở máy kia mở `http://<địa-chỉ-IP-LAN-của-máy-chủ>:4173` (xem địa chỉ bằng `ipconfig getifaddr en0` trên máy Mac chạy máy chủ). Lưu ý: khi mở theo cách này, bất kỳ ai trong cùng mạng LAN cũng đọc/ghi được tiến độ, nên chỉ dùng trên mạng gia đình tin cậy; macOS có thể hỏi cho phép Node nhận kết nối đến, chọn "Allow".

## Cấu trúc

- `server.js`: mở trang web, đọc và ghi dữ liệu, phục vụ từng đoạn của PDF.
- `public/content.js`: từ vựng, ví dụ và các bài tập nền của 38 ngày; một số ngày có thêm bài nghe (liên kết MP3 ngoài).
- Bài 29/05 có bảng đếm từ hàng trăm đến hàng vạn và 62 câu luyện số lớn.
- `public/measure-words.js`: bảng 43 lượng từ, quy tắc số lớn và 595 câu luyện tập.
- `STRUCTURE_PLAN.md`: nội dung gốc cho cấu trúc câu, bài đọc và bài đặt câu mở rộng.
- `tools/build-structures.js`: kiểm tra kế hoạch và sinh dữ liệu cấu trúc cùng bài tập.
- `public/app.js`: điều khiển các tab, chấm bài, thẻ nhớ, cụm chữ gần giống và tra từ qua ảnh.
- `tools/ocr_image.swift`: đọc chữ Hán trong ảnh bằng Vision của macOS.
- `public/styles.css`: bố cục cho màn hình máy tính và điện thoại.
- `tools/`: công cụ trích chữ từ PDF để cập nhật nội dung sau này.

Sau khi sửa `STRUCTURE_PLAN.md`, đồng bộ dữ liệu bằng:

```bash
npm run build:plan
```

## Kiểm tra

```bash
npm run check
npm test
```
