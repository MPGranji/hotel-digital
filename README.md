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

Áp dụng bảng giá phòng theo ngày thường/cuối tuần và thời gian hiệu lực:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/10_room_rate_schedules.sql --schema-only --commit
```

Mở rộng bảng giá thành từng ngày từ Thứ 2 đến Chủ nhật:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/11_room_rate_weekdays.sql --schema-only --commit
```

Chỉ giữ bảng giá tại quầy; booking từ OTA/đối tác nhập tiền phòng theo số tiền trên kênh:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/12_counter_rates_only.sql --schema-only --commit
```

Chuẩn hóa tên kênh trực tiếp thành “Tại quầy”:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/13_plain_counter_channel_name.sql --schema-only --commit
```

Điền quốc tịch còn thiếu cho dữ liệu khách hàng A26 lịch sử:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/14_backfill_customer_nationalities.sql --schema-only --commit
```

Bật lịch sử phiên bản bảng giá, khóa chống khoảng ngày chồng nhau và view phục vụ báo cáo:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/15_room_rate_versioning.sql --schema-only --commit
```

View `hotel.vwRoomRateVersionTimeline` cung cấp toàn bộ phiên bản hiện tại và lịch sử để dùng trực tiếp trong báo cáo/BI.

Cập nhật read model Dashboard để tính bảo trì, tách công suất thực tế/dự báo và gắn tiền thu theo `Payment.PaidAt`:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/16_dashboard_read_models.sql --schema-only --commit
```

Script tạo hoặc cập nhật `vRoomStatus`, `vRoomNight`, `vSellableRoomDay`, `vPaymentFact` và các view tổng hợp Dashboard. Thanh toán lịch sử không có ngày thu gốc được đánh dấu bằng `vPaymentFact.IsPaidAtEstimated`.

Loại bỏ kênh `UNKNOWN` cùng booking, thanh toán và hóa đơn lỗi liên quan; hồ sơ khách chỉ bị xóa khi không còn booking hợp lệ nào khác:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/18_remove_unknown_channel.sql --schema-only --commit
```

Chuẩn hóa nhóm kênh thành đúng ba loại `OFFLINE`, `ONLINE`, `TRAVEL_AGENCY` trong khi vẫn giữ các mã kênh chi tiết:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/19_channel_categories.sql --schema-only --commit
```

Xóa mã kênh `OFFLINE`/`Tại quầy` không sử dụng; nhóm `OFFLINE` và các mã trực tiếp thực tế vẫn được giữ:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/20_remove_unused_counter_channel.sql --schema-only --commit
```

Chuẩn hóa mã nguồn legacy thành mã vận hành ổn định, giữ nguyên `ChannelID` và quan hệ booking:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/21_canonical_channel_codes.sql --schema-only --commit
```

Gộp hai bucket online lịch sử vào một mã `ONLINE`, giữ nguyên toàn bộ booking và dữ liệu tài chính:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/22_merge_online_channels.sql --schema-only --commit
```

Sửa ngày thu ước tính của thanh toán lịch sử: workbook nguồn không có timestamp thanh toán, nên dùng ngày checkout thay cho ngày import database:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/23_correct_estimated_payment_dates.sql --schema-only --commit
```

Tách booking đặt trước/nhận phòng tại quầy, bổ sung chỉ mục cho màn hình vận hành và Power BI DirectQuery:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script database/24_booking_mode_invoice_performance.sql --schema-only --commit
```

Đối chiếu dấu vân tay dữ liệu (chỉ số lượng và tổng tiền, không in dữ liệu khách) trước và sau migration:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --verify-only
```

## Phạm vi triển khai hiện tại

### Cấu trúc dashboard đã chốt

- Báo cáo Power BI có đúng **2 sheet**: `Tổng quan kinh doanh` và `Phân tích chi tiết`.
- Trang web nội bộ `/operations` (`Khách & phòng`) được giữ riêng để hiển thị trạng thái từng phòng, khách hiện tại và booking kế tiếp.
- `Khách & phòng` không được tính là sheet Power BI và dữ liệu nhận diện khách không được đưa vào báo cáo Publish to web.

- Đặt phòng/check-in/check-out.
- Sổ đặt phòng.
- CRUD phòng/hạng phòng và kênh đặt phòng theo cơ chế ngừng hoạt động thay vì xóa lịch sử.
- Khách hàng có dò trùng, gộp hồ sơ và ngừng sử dụng.
- Một lượt có thể đặt nhiều phòng cùng mã nhóm.
- Quản lý hóa đơn nháp/đã phát hành/đã hủy, liên kết với booking.
- Sổ thu tiền chỉ ghi nhận khoản thu nội bộ (tiền mặt, thẻ, chuyển khoản); không kết nối cổng thanh toán hoặc ngân hàng. Trạng thái chưa thu/thu một phần/đã thu đủ được tự tính từ các khoản đã ghi.
- Đăng nhập quản trị nội bộ và audit ở mức MVP.

Dashboard Power BI hai trang và màn hình vận hành `Khách & phòng` đã được tích hợp vào web. Nhập/xuất Excel và Power BI Embedded có xác thực được thực hiện ở giai đoạn tiếp theo.

## Đăng nhập quản trị nội bộ

Web dùng màn hình đăng nhập đơn giản với tài khoản quản trị dùng chung. API không còn phụ thuộc Microsoft Entra ID và tin cậy danh tính quản trị nội bộ cho mọi request. Cơ chế này phù hợp bản demo nội bộ, không có phân quyền chi tiết và không nên dùng khi mở API trực tiếp ra Internet cho dữ liệu nhạy cảm.

## Database cho web

Sau các script schema và view nền, chạy migration audit:

```powershell
sqlcmd -S "<server>" -d "<database>" -E -I -b -i database/04_web_foundation.sql
```

API không tự chạy migration. SQL script đã duyệt vẫn là nguồn quản lý schema.

Các feature phải tuân theo ranh giới frontend/backend và Definition of Done trong kế hoạch triển khai đã được duyệt.
