# Intercom Canvas Kit App — Welcome flow + WhatsApp handoff

Custom Messenger App cho Intercom, tái tạo đúng 4 bước trong thiết kế của bạn:

1. Khách thấy card app trên Messenger **Home**
2. Bấm vào → hiện **"Welcome! Are you an existing customer or new to us?"** với 2 lựa chọn
3. Chọn **New Customer** → hiện nút **"Continue on WhatsApp"**
4. Bấm nút đó → WhatsApp mở với tin nhắn được điền sẵn

App có sẵn cơ chế **xác thực chữ ký request** (`X-Body-Signature`) để đảm bảo
chỉ Intercom mới gọi được webhook của bạn — bật tự động khi bạn cấu hình
`INTERCOM_CLIENT_SECRET`.

> **Giới hạn cần biết:** Canvas Kit không có action "mở một cuộc hội thoại
> thật". Nhánh "Existing Customer" hiện chỉ hiện thông báo hướng dẫn khách
> bấm "Send us a message" mặc định. Xem mục **6. Nâng cấp thêm** nếu muốn tự
> động tạo hẳn một conversation thật.

---

## 1. Chuẩn bị

- Node.js >= 18
- Tài khoản [Vercel](https://vercel.com) (đã liên kết với GitHub)
- Tài khoản [Intercom Developer Hub](https://developers.intercom.com) (dùng chung tài khoản Intercom của workspace)
- Số WhatsApp Business đã kích hoạt

---

## 2. Chạy thử local

```bash
npm install
cp .env.example .env
# mở .env, điền WHATSAPP_NUMBER của bạn (bỏ trống INTERCOM_CLIENT_SECRET khi test local)

npm start
# server chạy tại http://localhost:3000
```

Test nhanh bằng curl (mở terminal thứ 2):

```bash
curl -X POST http://localhost:3000/initialize

curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d '{"component_id":"new_customer"}'

curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d '{"component_id":"existing_customer"}'
```

Mỗi lệnh phải trả về JSON dạng `{"canvas": {"content": {"components": [...]}}}`.

---

## 3. Đưa lên GitHub

```bash
git init
git add .
git commit -m "Initial commit: Intercom Canvas Kit welcome + WhatsApp handoff"
git branch -M main
git remote add origin https://github.com/<username>/<ten-repo>.git
git push -u origin main
```

`.gitignore` đã loại trừ sẵn `node_modules/` và `.env` — không lo commit nhầm secret.

---

## 4. Deploy lên Vercel (qua GitHub, tự động deploy mỗi lần push)

1. Vào [vercel.com/new](https://vercel.com/new), chọn **Import Git Repository**.
2. Chọn đúng repo bạn vừa push.
3. Vercel tự nhận diện `vercel.json` — không cần chỉnh Build/Output settings.
4. Trước khi bấm **Deploy**, mở mục **Environment Variables**, thêm:

   | Key | Value |
   |---|---|
   | `WHATSAPP_NUMBER` | Số WhatsApp Business, không dấu `+`, ví dụ `84901234567` |
   | `WHATSAPP_PREFILL_TEXT` | Nội dung tin nhắn điền sẵn (tùy chọn) |
   | `INTERCOM_CLIENT_SECRET` | Lấy ở bước 5 bên dưới — **có thể thêm sau**, quay lại đây để bổ sung rồi bấm **Redeploy** |

5. Bấm **Deploy**. Sau khi xong, bạn có 1 URL dạng:
   `https://<ten-project>.vercel.app`

Từ giờ, mỗi lần bạn `git push` lên nhánh `main`, Vercel tự động deploy bản mới — không cần làm lại các bước trên.

---

## 5. Đăng ký app trong Intercom Developer Hub

1. Vào **developers.intercom.com** → đăng nhập → **New app**.
2. Đặt tên (ví dụ "Welcome Flow") → chọn đúng workspace của bạn.
3. Vào **Basic Info**, copy giá trị **Client Secret** — dán vào biến
   `INTERCOM_CLIENT_SECRET` trên Vercel (bước 4) rồi **Redeploy**.
4. Vào **Configure → Canvas Kit**, mở dropdown **"For users, leads, and visitors"**.
5. Điền 2 webhook URL (thay bằng domain Vercel thật của bạn):
   - **Initialize flow webhook URL**: `https://<ten-project>.vercel.app/initialize`
   - **Submit flow webhook URL**: `https://<ten-project>.vercel.app/submit`
6. Tick nơi app được phép hiển thị → chọn **Messenger Home**.
7. Bấm **Save**, đảm bảo toggle chuyển sang **On**.

---

## 6. Gắn app vào Messenger Home

1. Trong Intercom: **Settings → Channels → Messenger → Widget**.
2. Kéo tới **"Customize Home with apps"** → bấm **"Add an app"** → chọn app vừa tạo.
3. (Tùy chọn) Ẩn card "New conversation" mặc định nếu muốn app này thay thế hoàn toàn.
4. Bấm **Save and set live**.

---

## 7. Test trên môi trường thật

- Mở website đã nhúng Messenger, bấm vào app.
- Thử cả 2 nhánh **Existing Customer** và **New Customer**.
- Với **New Customer**, bấm **"Continue on WhatsApp"**, xác nhận WhatsApp mở đúng số, đúng nội dung tin nhắn điền sẵn.
- Nếu `INTERCOM_CLIENT_SECRET` đã cấu hình đúng, mọi thao tác vẫn chạy bình thường (vì request thật từ Intercom luôn có chữ ký hợp lệ). Nếu app báo lỗi 401 ngay khi mở, kiểm tra lại giá trị secret đã copy đúng chưa.

---

## 8. Nâng cấp thêm (tùy chọn): tự động tạo conversation thật cho "Existing Customer"

Nếu muốn nhánh "Existing Customer" tự động tạo một conversation thật (hiện
trong Inbox, có thể assign cho team), bạn cần:

1. Tạo **Access Token** cho app trong Developer Hub (**Configure → Authentication**).
2. Trong `server.js`, ở nhánh xử lý `component_id === "existing_customer"`, gọi
   Intercom REST API `POST https://api.intercom.io/conversations` kèm token
   đó để tạo conversation mới gắn với contact hiện tại (Intercom gửi kèm
   thông tin contact trong request body `/submit` — dùng field đó để xác
   định người gửi).
3. Trả về canvas xác nhận, ví dụ: "Đã kết nối bạn với đội hỗ trợ, kiểm tra
   tab Messages nhé!"

Đây là phần backend engineering thật sự (không còn thuộc phạm vi no-code) —
tài liệu API:
https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/createconversation

---

## Cấu trúc project

```
.
├── server.js          # Toàn bộ logic: canvas cho từng bước + xác thực chữ ký
├── package.json
├── vercel.json         # Cấu hình deploy Express app dạng Vercel serverless function
├── .env.example
├── .gitignore
└── README.md
```
