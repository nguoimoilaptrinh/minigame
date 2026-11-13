# 🌙 Hội Quán Ma Sói & Gián Điệp (v2.1)

Ứng dụng web chơi nhóm **5–10+ người** tại nhà — **tất cả mọi người đều là người chơi**, không ai phải đứng ngoài ra đề hay cầm trịch, không giới hạn thời gian tranh luận, **miễn phí 100%** khi đăng lên **GitHub Pages**.

---

## ✨ Điểm mới ở phiên bản v2.1
- **Giọng đọc AI Tiếng Việt tự nhiên hơn:** Ưu tiên dùng Google Cloud TTS (`vi-VN`), tự động tách câu ngắt nhịp mượt mà và dự phòng sang giọng trình duyệt nếu mất mạng.
- **Thẻ bài có ảnh minh họa riêng cho từng vai trò** (`assets/roles/*.png`).
- **Bỏ hoàn toàn đồng hồ đếm ngược:** Tranh luận ngoài đời thoải mái, vote xong mới chốt kết quả.
- **Bot luôn nắm rõ tình hình Vote theo thời gian thực:** Mọi người bấm Vote ngay trên điện thoại (hiển thị ai vote cho ai, ai dẫn đầu) hoặc biểu quyết miệng rồi ấn chốt trực tiếp trên máy chủ phòng.
- **Thợ Săn tự bấm trên điện thoại:** Khi Thợ Săn chết, hô bắn ở ngoài đời rồi tự chọn tên người bị bắn trên điện thoại để Bot phát tiếng súng, đọc tên và tiếp tục ván chơi.
- **Game 2: Gián Điệp có 3 chế độ cực mặn:**
  1. **Ai Là Gián Điệp:** 5 bộ chủ đề (Drama/Tình yêu, Ẩm thực/Ăn nhậu, Showbiz/Trend, Hack não, Đời sống) — 125+ cặp từ kèm gợi ý mô tả + tùy chọn **Mr. White**.
  2. **Điệp Viên Hỏi Xoáy (Câu Hỏi Lệch Pha):** Dân & Gián điệp nhận 2 câu hỏi khác nhau, trả lời xong mới lật câu hỏi thật!
  3. **Spyfall:** 30 địa điểm + 15 câu hỏi thẩm vấn mẫu + bảng chạm gạch loại trừ.

---

## 🚀 Hướng dẫn đưa lên GitHub Pages (Miễn phí 100%)

### Cách 1: Kéo-thả trực tiếp trên trình duyệt (Nhanh nhất, không cần gõ lệnh)
1. Đăng nhập [GitHub.com](https://github.com) → bấm dấu **`+`** góc trên bên phải → chọn **New repository**.
2. Đặt tên repository (ví dụ: `party-game`), chọn **Public** → bấm **Create repository**.
3. Ở trang vừa tạo, bấm dòng **uploading an existing file**.
4. Mở thư mục `d:\Project-for-antigravity\Game-Web-App` trên máy tính, chọn toàn bộ: `index.html`, `README.md`, thư mục `css`, thư mục `js`, thư mục `assets` rồi **kéo thả** vào trình duyệt (chú ý giữ nguyên cấu trúc thư mục `assets/roles/...`).
5. Đợi upload xong → bấm **Commit changes**.
6. Vào tab **Settings** (bánh răng) của repository → mục **Pages** ở cột trái:
   - Tại **Build and deployment → Source**: chọn **Deploy from a branch**.
   - Tại **Branch**: chọn **`main`** và **`/ (root)`** → bấm **Save**.
7. Đợi khoảng **1 phút** rồi F5 lại trang **Pages**, GitHub sẽ hiện đường dẫn chính thức dạng:
   `https://<ten-github-cua-ban>.github.io/party-game/`
8. Mở link đó trên Laptop/điện thoại, tạo phòng và đưa mã QR cho bạn bè quét để chơi!

### Cách 2: Đẩy bằng Git CLI (đã khởi tạo sẵn nhánh `main`)
Sau khi tạo repo trống trên GitHub (không tích README):
```sh
git remote add origin https://github.com/<ten-github-cua-ban>/<ten-repo>.git
git push -u origin main
```
Sau đó bật **Settings → Pages → Branch: `main` / `(root)`** như bước 6 ở trên.

---

## 💻 Chạy thử ngay trên máy tính (không cần GitHub)
```sh
npx serve -l 4173 .
```
Mở trình duyệt vào `http://localhost:4173`.
