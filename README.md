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

## Phạm vi MVP

- Dashboard tổng quan và theo ngày.
- Đặt phòng/check-in/check-out.
- Sổ đặt phòng, nhập và xuất Excel.
- Phòng, khách hàng và kênh đặt phòng.
- Power BI Embedded.
- Microsoft Entra ID và audit ở mức MVP.

Xem [kiến trúc](docs/architecture.md) và [quy ước phát triển](docs/development.md) trước khi thêm module.
