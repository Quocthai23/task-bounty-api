<div align="center">
  <h1>🚀 Task Bounty API (Backend)</h1>
  <p><i>The intelligent backend powering the next generation of decentralized task management.</i></p>
</div>

---

## 📖 Tổng quan dự án (Project Overview)

**Task Bounty** không chỉ là một hệ thống quản lý công việc (Task Management System) thông thường. Đây là một nền tảng tiên phong kết hợp **sức mạnh của Web3 (Blockchain)** và **Trí tuệ nhân tạo (AI)** nhằm giải quyết hai vấn đề cốt lõi trong làm việc từ xa và làm việc nhóm: **Độ tin cậy trong thanh toán** và **Hiệu suất quản lý tiến độ**.

API này đóng vai trò là "trái tim" của hệ thống, cung cấp các endpoint bảo mật, xử lý logic nghiệp vụ phức tạp, tương tác với Smart Contract trên blockchain và giao tiếp với các mô hình AI để đưa ra dự đoán.

---

## ⭐ Các tính năng cốt lõi (Core Features)

### 1. 🔗 Thanh toán tự động qua Blockchain (Smart Contract Bounties)
Loại bỏ hoàn toàn rủi ro quỵt tiền hay chậm trễ thanh toán.
- **Ký quỹ (Escrow):** Khi một Task được tạo ra kèm theo một phần thưởng (bounty), số tiền Crypto (ETH, USDT, token riêng, v.v.) sẽ được khóa lại trong một Smart Contract.
- **Tự động giải ngân:** Ngay khi người quản lý (Project Manager/Client) xác nhận Task đã hoàn thành đạt yêu cầu, API sẽ kích hoạt giao dịch hoặc cung cấp chữ ký mã hóa để người nhận (Assignee) có thể rút tiền ngay lập tức về ví Web3 của họ.
- **Minh bạch 100%:** Mọi trạng thái tài chính của công việc đều có thể được theo dõi trên blockchain explorer thông qua `ethers.js`.

### 2. 🧠 AI phân tích và Cảnh báo rủi ro (AI Deadline & Risk Predictor)
Giúp người quản lý chủ động thay vì bị động trước các deadline.
- **Đánh giá độ phức tạp:** AI phân tích nội dung, mô tả (description) của Task để tự động chấm điểm độ phức tạp.
- **Dự đoán trễ hạn:** Dựa trên khối lượng công việc hiện tại của nhân sự (Assignee) và độ khó của task, AI sẽ đưa ra cảnh báo sớm (Ví dụ: *"Task này có nguy cơ trễ hạn 70% do nhân sự đang quá tải"*).
- **Gợi ý phân bổ:** Tự động đề xuất thời hạn (due date) hợp lý hoặc gợi ý nhân sự phù hợp nhất để thực hiện.

### 3. ⚡ Xử lý dữ liệu thời gian thực (Real-time Sync & Notifications)
- **WebSockets (Socket.io):** Bất cứ thay đổi nào về trạng thái Task (Từ `TODO` sang `IN_PROGRESS`, hoặc `DONE`) hay trạng thái thanh toán đều được push ngay lập tức đến Frontend mà không cần reload.
- **Thông báo đa kênh:** Hệ thống thông báo in-app realtime, kết hợp gửi Email cảnh báo khi một task do AI đánh giá là "Nguy cơ trễ hạn cao".

### 4. ⚙️ Kiến trúc Hàng đợi hiệu năng cao (Background Processing)
- Sử dụng **BullMQ + Redis** để xử lý các tác vụ nặng chạy ngầm (Background jobs).
- Nhờ đó, việc giao tiếp chậm trễ với mạng lưới Blockchain hay chờ phản hồi từ API của AI (như OpenAI) sẽ không làm chặn (block) luồng chính của ứng dụng. Người dùng luôn nhận được phản hồi API dưới 100ms.

### 5. 🔒 Bảo mật và Phân quyền (Auth & RBAC)
- Xác thực an toàn với **JWT (JSON Web Token)**.
- Phân quyền nhiều cấp độ: `Admin` (Toàn quyền hệ thống), `Client/Manager` (Người tạo task, cấp tiền, duyệt task), `Freelancer/Assignee` (Người nhận việc và nhận tiền).

---

## 🛠 Công nghệ sử dụng (Tech Stack)

API được xây dựng dựa trên kiến trúc Modular mạnh mẽ của NestJS, đảm bảo khả năng mở rộng (scalable) và dễ bảo trì (maintainable).

- **Core Framework:** [NestJS](https://nestjs.com/) (Node.js)
- **Cơ sở dữ liệu:** PostgreSQL với [Prisma ORM](https://www.prisma.io/)
- **Blockchain Integration:** [Ethers.js](https://docs.ethers.org/)
- **Message Queue & Caching:** [BullMQ](https://docs.bullmq.io/) & [Redis](https://redis.io/)
- **Real-time Communication:** [Socket.io](https://socket.io/)
- **Security:** Passport, JWT, bcrypt.
- **API Documentation:** Swagger / OpenAPI

---

## 📦 Hướng dẫn cài đặt & Chạy dự án (Getting Started)

### Yêu cầu hệ thống (Prerequisites)
- [Node.js](https://nodejs.org/en/) (v18 trở lên)
- [PostgreSQL](https://www.postgresql.org/) (Đang chạy local hoặc dùng cloud database như Supabase/Neon)
- [Redis](https://redis.io/) (Cần thiết cho BullMQ)

### Cài đặt (Installation)

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd task-bounty-api
   ```

2. **Cài đặt thư viện:**
   ```bash
   npm install
   ```

3. **Thiết lập biến môi trường:**
   Tạo file `.env` từ file mẫu:
   ```bash
   cp .env.example .env
   ```
   *Mở file `.env` và điền các thông tin quan trọng như `DATABASE_URL`, `REDIS_URL`, RPC Node cho mạng Blockchain, Private Key của ví vận hành (nếu có), và API Key của dịch vụ AI.*

4. **Khởi tạo cơ sở dữ liệu:**
   Chạy lệnh Prisma để tạo bảng trong PostgreSQL:
   ```bash
   npx prisma db push
   # hoặc npx prisma migrate dev
   ```

### Khởi chạy (Running the App)

```bash
# Chạy ở chế độ phát triển (Tự động reload khi có thay đổi)
npm run start:dev

# Chạy ở chế độ debug
npm run start:debug

# Build và chạy ở chế độ Production
npm run build
npm run start:prod
```

---

## 📖 Tài liệu API (API Documentation)

Dự án được tích hợp sẵn Swagger để test và xem tài liệu API một cách trực quan.
Sau khi khởi chạy ứng dụng thành công, vui lòng truy cập:
👉 `http://localhost:<PORT>/api/docs` (hoặc `/swagger`)

Tại đây, bạn có thể xem mô tả chi tiết của từng endpoint, các DTOs cần thiết và thực hiện test trực tiếp trên trình duyệt.
