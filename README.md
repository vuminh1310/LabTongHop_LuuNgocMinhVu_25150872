# Bookstore API (NestJS + TypeORM + MySQL)

Web bán sách gồm API (NestJS) và giao diện web (HTML + JS thuần, thư mục `public/`) chạy chung một cổng.

## Chạy dự án

1. Cài Node.js 18+ và MySQL, tạo database rỗng:
   ```sql
   CREATE DATABASE bookstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Cài thư viện và tạo file cấu hình:
   ```bash
   npm install
   cp .env.example .env     # Windows: copy .env.example .env
   ```
   Mở `.env` và sửa `DB_PASSWORD` (và `JWT_SECRET`).
3. Chạy:
   ```bash
   npm run start:dev
   ```
4. Mở trang web: http://localhost:3000/ — Swagger UI: http://localhost:3000/docs

Bảng sẽ tự được tạo nhờ `synchronize: true` trong `src/app.module.ts`.

## Thử nhanh (trên web hoặc Swagger)

1. `POST /api/auth/register` để tạo tài khoản, copy `accessToken`.
2. Bấm nút **Authorize** ở góc trên, dán token.
3. Để tạo tài khoản **admin**, đăng ký xong rồi sửa trong MySQL:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'email_cua_ban';
   ```
   Sau đó đăng nhập lại để lấy token mới.
4. Admin: `POST /api/categories`, `POST /api/books`.
5. Khách: `GET /api/books`, rồi `POST /api/orders`.

## Cấu trúc (đối chiếu với ABP)

| Thư mục | Vai trò | Tương đương ABP |
|---|---|---|
| `*.entity.ts` | Thực thể + ánh xạ DB | Domain / EntityFrameworkCore |
| `*.dto.ts` | Dữ liệu vào/ra, validate | Application.Contracts |
| `*.service.ts` | Nghiệp vụ | Application (AppService) |
| `*.controller.ts` | Endpoint HTTP | HttpApi |
| `*.module.ts` | Đóng gói module + DI | AbpModule |
| `public/` | Giao diện web (HTML/CSS/JS thuần) | Frontend (MVC/Angular) |
| `auth/guards.ts` | Xác thực + phân quyền theo role | Authorization / Permission |

## Endpoint chính

- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Categories: CRUD (ghi cần admin)
- Books: CRUD (ghi cần admin), `GET /api/books?search=&categoryId=&page=&limit=`
- Orders: `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders/:id`,
  admin: `GET /api/orders`, `PATCH /api/orders/:id/status`
