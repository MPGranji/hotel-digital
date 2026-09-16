# Hotel Digital

Web vận hành chuyển đổi số khách sạn, được tổ chức thành hai ứng dụng triển khai độc lập:

- `frontend`: Next.js App Router, triển khai trên Vercel.
- `backend`: ASP.NET Core Web API, triển khai trên Azure App Service.

Azure SQL là nguồn dữ liệu duy nhất. Frontend không kết nối trực tiếp database và không giữ mật khẩu SQL.

## Cấu trúc

```text
hotel-digital/
├── frontend/                # Next.js, giao diện vận hành
├── backend/                 # ASP.NET Core, nghiệp vụ và Azure SQL
├── docs/                    # Kiến trúc và hướng dẫn phát triển
├── infra/                   # Ghi chú/cấu hình triển khai
├── .editorconfig
└── .gitignore
```

## Chạy frontend

```powershell
cd frontend
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Chạy API

Cần .NET 10 SDK. Sao chép `backend/src/HotelDigital.Api/appsettings.Local.example.json` thành `appsettings.Local.json`, điền chuỗi kết nối dành cho local rồi chạy:

```powershell
dotnet restore backend/HotelDigital.Api.slnx
dotnet run --project backend/src/HotelDigital.Api
```

Không commit mật khẩu, access token hoặc connection string thật.

## Chạy API bằng Docker

Docker chỉ đóng gói API; frontend tiếp tục chạy bằng Next.js hoặc được triển khai trực tiếp trên Vercel.

Sao chép `backend/.env.example` thành `backend/.env`, sau đó điền connection string của Azure SQL dành cho môi trường local/test:

```powershell
docker compose --env-file backend/.env up --build
```

API chạy tại `http://localhost:5080`. Endpoint `/health` kiểm tra tiến trình API; `/health/database` kiểm tra kết nối thật đến Azure SQL.

Connection string chỉ được truyền vào container lúc chạy, không được ghi vào image hoặc commit vào Git. Kết nối đã lưu trong DataGrip không tự động được ứng dụng hoặc container sử dụng.

## Phạm vi MVP

- Dashboard tổng quan và theo ngày.
- Đặt phòng/check-in/check-out.
- Sổ đặt phòng, nhập và xuất Excel.
- Phòng, khách hàng và kênh đặt phòng.
- Power BI Embedded.
- Microsoft Entra ID và audit ở mức MVP.

Xem [kiến trúc](docs/architecture.md) và [quy ước phát triển](docs/development.md) trước khi thêm module.
