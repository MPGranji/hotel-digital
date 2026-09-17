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

## Chạy toàn bộ bằng Docker

Docker Compose đóng gói và chạy cả frontend lẫn API. Frontend chờ container API được khởi động và cả hai container tự khởi động lại khi Docker restart.

Sao chép `backend/.env.example` thành `backend/.env`, sau đó điền connection string của Azure SQL dành cho môi trường local/test:

```powershell
docker compose --env-file backend/.env up -d --build
```

Frontend chạy tại `http://localhost:3000`; API chạy tại `http://localhost:5080`. Endpoint `/health` kiểm tra tiến trình API; `/health/database` kiểm tra kết nối thật đến Azure SQL.

Connection string chỉ được truyền vào container lúc chạy, không được ghi vào image hoặc commit vào Git. Kết nối đã lưu trong DataGrip không tự động được ứng dụng hoặc container sử dụng.

Để các container khởi động hoàn toàn tự động, connection string phải dùng cơ chế không cần đăng nhập tương tác, chẳng hạn tài khoản SQL hoặc service principal. `Active Directory Device Code Flow` vẫn yêu cầu đăng nhập lại sau khi container API được tạo mới.

### Nhập dữ liệu lịch sử A26

Importer chỉ đọc sheet `A26 Pham Ngu Lao`, chọn các dòng `CHECKOUT` có `Số hóa đơn` (mã chốt tiền), và mặc định chỉ chạy kiểm tra:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --file "<đường-dẫn-file-xlsx>"
```

Sau khi xem kết quả dry-run, thêm `--commit` để nhập các dòng hợp lệ. Dòng có tiền âm, ngày không hợp lệ hoặc trùng phòng được giữ ngoài database và liệt kê theo số dòng nguồn. Importer dùng `InvoiceNumber` để bỏ qua booking đã nhập, không ghi file Excel hoặc dữ liệu khách vào repository.

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --file "<đường-dẫn-file-xlsx>" --env-file backend/.env --commit
```

Nếu database chưa có migration web foundation, có thể áp dụng script đã duyệt trong cùng phiên đăng nhập rồi import:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --file "<đường-dẫn-file-xlsx>" --env-file backend/.env --schema-script database/04_web_foundation.sql --commit
```

Để chỉ áp dụng một SQL migration đã duyệt mà không chạy importer:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/05_pham_ngu_lao_prices.sql --schema-only --commit
```

Sau migration giá, áp dụng phần vòng đời khách hàng, booking nhóm và hóa đơn:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/06_customer_groups_invoices.sql --schema-only --commit
```

Áp dụng ma trận phòng và lịch bảo trì:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/07_room_maintenance.sql --schema-only --commit
```

Tạo kênh mặc định cho khách đặt trực tiếp tại quầy:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/08_offline_default_channel.sql --schema-only --commit
```

Thêm lịch sử giao dịch thanh toán và chuyển các khoản thu hiện có sang bảng mới:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/09_payments.sql --schema-only --commit
```

## Phạm vi triển khai hiện tại

- Đặt phòng/check-in/check-out.
- Sổ đặt phòng.
- CRUD phòng/hạng phòng và kênh đặt phòng theo cơ chế ngừng hoạt động thay vì xóa lịch sử.
- Khách hàng có dò trùng, gộp hồ sơ và ngừng sử dụng.
- Một lượt có thể đặt nhiều phòng cùng mã nhóm.
- Quản lý hóa đơn nháp/đã phát hành/đã hủy, liên kết với booking.
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
