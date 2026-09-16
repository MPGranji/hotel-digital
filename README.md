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

## Phạm vi triển khai hiện tại

- Đặt phòng/check-in/check-out.
- Sổ đặt phòng.
- Phòng, khách hàng và kênh đặt phòng.
- Microsoft Entra ID và audit ở mức MVP.

Dashboard vận hành, nhập/xuất Excel và Power BI Embedded được để ở giai đoạn tiếp theo sau khi luồng vận hành ổn định.

## Microsoft Entra ID

Môi trường Development dùng danh tính local cố định để phát triển giao diện và API. Test/Production bắt buộc cấu hình:

- `AzureAd__TenantId` và `AzureAd__ClientId` cho API.
- `NEXT_PUBLIC_ENTRA_TENANT_ID`, `NEXT_PUBLIC_ENTRA_CLIENT_ID` và `NEXT_PUBLIC_ENTRA_API_SCOPE` cho frontend.

Không bật `Authentication__UseDevelopmentUser` ngoài môi trường Development.

## Database cho web

Sau các script schema và view nền, chạy migration audit:

```powershell
sqlcmd -S "<server>" -d "<database>" -E -I -b -i database/04_web_foundation.sql
```

API không tự chạy migration. SQL script đã duyệt vẫn là nguồn quản lý schema.

Các feature phải tuân theo ranh giới frontend/backend và Definition of Done trong kế hoạch triển khai đã được duyệt.
