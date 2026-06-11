# Lab Manager

Web quản lý thành viên lab và REST API lưu dữ liệu CircuitTH trên PostgreSQL.

## Thành phần

- `apps/web`: React/Vite management web.
- `apps/api`: Node.js/Express REST API.
- `database/init.sql`: PostgreSQL schema.
- `docker-compose.yml`: chạy database, API và web trên một host.

## Chạy bằng Docker trên máy hoặc VPS

1. Tạo file môi trường:

```powershell
Copy-Item .env.example .env
```

2. Đổi toàn bộ password và `JWT_SECRET` trong `.env`.

3. Khởi động:

```powershell
docker compose up -d --build
```

4. Truy cập:

- Web quản lý: `http://localhost:8080`
- REST API: `http://localhost:4000/api`
- Health check: `http://localhost:4000/api/health`

Tài khoản admin đầu tiên được tạo từ `ADMIN_EMAIL` và `ADMIN_PASSWORD`.

## Chạy development

Cần PostgreSQL đang chạy và `DATABASE_URL` hợp lệ:

```powershell
npm.cmd install
npm.cmd run dev:api
npm.cmd run dev:web
```

## Triển khai host riêng

Cấu hình tối thiểu:

- Ubuntu VPS, 1-2 GB RAM.
- Docker Engine và Docker Compose.
- Domain, ví dụ `lab.example.com` và `api.lab.example.com`.
- Reverse proxy Caddy hoặc Nginx.
- HTTPS Let's Encrypt.

Không public cổng PostgreSQL `5432` ra Internet. Chỉ API được phép kết nối database trong Docker network.

## Tích hợp CircuitTH sau này

Luồng đề xuất:

1. User đăng nhập qua `POST /api/auth/login`.
2. CircuitTH lưu JWT vào browser.
3. Lấy danh sách file qua `GET /api/circuits`.
4. Tạo file qua `POST /api/circuits`.
5. Mở file qua `GET /api/circuits/:id`.
6. Autosave qua `PUT /api/circuits/:id`.
7. IndexedDB hiện tại tiếp tục dùng làm offline cache.

Payload tạo circuit:

```json
{
  "name": "RLC Circuit",
  "projectId": null,
  "schematic": {
    "components": [],
    "wires": []
  },
  "simConfig": {
    "mode": "op"
  }
}
```

Khi cập nhật, client phải gửi `version`. Nếu file đã được sửa trên máy khác, API trả `409 Conflict` để tránh ghi đè dữ liệu.

## CircuitTH cloud sync

CircuitTH đã có thể đăng nhập trực tiếp vào LabManager và đồng bộ file mạch.

Chạy API trước:

```powershell
docker compose up -d --build
```

Sau đó chạy CircuitTH tại cổng `5173`. CircuitTH mặc định gọi:

```text
http://localhost:4000/api
```

Khi triển khai production, đặt biến môi trường của CircuitTH:

```env
VITE_LAB_API_URL=https://api.example.com/api
```

Đồng thời thêm domain CircuitTH vào `CORS_ORIGIN` của LabManager.

## Bảo mật cần làm trước production

- Dùng password và JWT secret mạnh.
- Chỉ chạy API qua HTTPS.
- Giới hạn CORS đúng domain.
- Backup PostgreSQL định kỳ.
- Thêm rate limit cho endpoint đăng nhập.
- Thêm refresh token hoặc session rotation nếu cần đăng nhập dài hạn.
