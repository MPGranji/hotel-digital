# Hạ tầng

- Frontend: Vercel, root directory `frontend`.
- Backend: Azure App Service chạy .NET 10.
- Database: Azure SQL `hotel-db`.
- Production database access: Managed Identity; không dùng SQL password trong source code.
- Monitoring: Vercel Logs và Azure Application Insights.

Infrastructure-as-code sẽ được thêm sau khi tên App Service, Entra App Registration và Power BI workspace được chốt.

## Container API

Docker image chỉ chứa ASP.NET Core API. Frontend không nằm trong image này và được Vercel build từ thư mục `frontend`.

Build từ thư mục gốc repository:

```powershell
docker build -t hotel-digital-api:local backend/src/HotelDigital.Api
```

Chạy local với Azure SQL Test:

```powershell
Copy-Item backend/.env.example backend/.env
# Điền HOTEL_DATABASE_CONNECTION_STRING trong backend/.env
docker compose --env-file backend/.env up --build
```

Các biến runtime bắt buộc:

| Biến | Mục đích |
|---|---|
| `ConnectionStrings__HotelDatabase` | Kết nối Azure SQL; không đóng vào image |
| `Cors__AllowedOrigins__0` | Origin frontend Vercel hoặc local |
| `ASPNETCORE_ENVIRONMENT` | Tên môi trường chạy API |

Khi triển khai container lên Azure App Service:

1. Build và đẩy image lên Azure Container Registry hoặc registry được phê duyệt.
2. Cấu hình App Service chạy cổng `8080` và health check tại `/health`.
3. Bật Managed Identity cho App Service và cấp quyền vào Azure SQL.
4. Đặt `ConnectionStrings__HotelDatabase` bằng App Service Configuration. Với Managed Identity, dùng connection string không chứa mật khẩu, ví dụ:

```text
Server=tcp:<server>.database.windows.net,1433;Initial Catalog=<database>;Authentication=Active Directory Managed Identity;Encrypt=True;TrustServerCertificate=False;
```

5. Đặt `Cors__AllowedOrigins__0` thành domain Vercel Test/Production tương ứng.

Không sao chép connection string hoặc thông tin xác thực đã lưu trong DataGrip vào Dockerfile, image hay repository.
