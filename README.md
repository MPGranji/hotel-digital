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

Web dùng màn hình đăng nhập nội bộ. Tài khoản local/test là `admin` / `admin`; API kiểm tra thông tin đăng nhập rồi cấp token có hạn 8 giờ. Khách hàng không cần tài khoản để nhân viên tạo hồ sơ hoặc đặt phòng cho họ. Production bắt buộc đặt `HOTEL_ADMIN_PASSWORD` khác `admin` và `HOTEL_AUTH_SIGNING_SECRET` (chuỗi bí mật tối thiểu 32 byte) trong `backend/.env` hoặc cấu hình tương đương trên host.

`/dashboard` lấy số liệu kinh doanh và hiện trạng phòng trực tiếp từ API/Azure SQL, rồi cập nhật qua SignalR khi nghiệp vụ thay đổi. Trang web không nhúng Power BI; link Power BI Publish to web được giữ riêng để nộp bài và vẫn dùng model Import, làm mới theo lịch.

## Chạy API

Cần .NET 10 SDK. Sao chép `backend/src/HotelDigital.Api/appsettings.Local.example.json` thành `appsettings.Local.json`, điền chuỗi kết nối dành cho local rồi chạy:

```powershell
dotnet restore backend/HotelDigital.Api.slnx
dotnet run --project backend/src/HotelDigital.Api
```

Không commit mật khẩu, access token hoặc connection string thật.

## Chạy toàn bộ bằng Docker

Docker Compose đóng gói và chạy cả frontend lẫn API. Frontend chờ container API được khởi động và cả hai container tự khởi động lại khi Docker restart.

Sao chép `backend/.env.example` thành `backend/.env`, sau đó điền connection string của Azure SQL, mật khẩu admin mới và bí mật ký token:

```powershell
docker compose --env-file backend/.env -f compose.yaml up -d --build
```

Frontend chạy tại `http://localhost:3000`; API chạy tại `http://localhost:5080`. Endpoint `/health` kiểm tra tiến trình API; `/health/database` yêu cầu nhân viên đăng nhập và kiểm tra kết nối thật đến Azure SQL. API từ chối khởi động nếu thiếu `HOTEL_AUTH_SIGNING_SECRET`.

## Cập nhật dữ liệu realtime

Sau khi một thao tác ghi vào Azure SQL hoàn tất, API gửi tín hiệu SignalR tới các phiên nhân viên. Các tab đang mở tự tải lại dữ liệu cho lịch phòng, khách, booking, hóa đơn, sổ thu và màn hình vận hành. Biểu mẫu booking đang sửa sẽ báo có phiên bản mới để nhân viên tự chọn tải lại; nội dung chưa lưu không bị thay thế. Khi mất kết nối, web tự nối lại và đối chiếu dữ liệu khi tab được mở lại hoặc sau mỗi 2 phút. Nếu gửi tín hiệu lỗi, thao tác ghi vẫn thành công; lần đối chiếu kế tiếp sẽ đồng bộ dữ liệu.

Chạy API một instance có thể dùng SignalR trực tiếp. Khi chạy nhiều instance hoặc cần dịch vụ quản lý kết nối, tạo Azure SignalR Service và cấu hình `Azure__SignalR__ConnectionString` (trong Compose: `HOTEL_SIGNALR_CONNECTION_STRING`) bằng secret của môi trường. Không đưa connection string vào image hay Git. Cấu hình origin frontend trong `Cors:AllowedOrigins` và bảo đảm proxy/App Service cho phép WebSocket. Hub `/hubs/updates` yêu cầu token đăng nhập như API.

Môi trường Azure hiện dùng App Service Linux F1 và Azure SQL free offer, chỉ phục vụ thử nghiệm với số ít phiên. F1 giới hạn 5 WebSocket; SQL được đặt tự tạm dừng khi dùng hết hạn mức miễn phí trong tháng. Vercel Hobby dành cho dự án cá nhân, phi thương mại. Trước khi dùng thật cho nhân viên, cần chốt gói hạ tầng phù hợp và thu hồi mã Power BI Publish to web đang công khai.

Sau một thời gian không truy cập, Azure SQL serverless có thể cần khoảng một phút để tự hoạt động lại. API cho phép tối thiểu 60 giây để mở kết nối, còn web chờ tối đa 90 giây cho lệnh đọc; thao tác ghi không được web tự gửi lại. Nếu đã dùng hết hạn mức SQL miễn phí trong tháng, database tự tạm dừng và các màn hình dữ liệu sẽ không hoạt động cho đến khi hạn mức được làm mới.

Dashboard kinh doanh và hiện trạng phòng ở `/dashboard` tự cập nhật từ Azure SQL qua API và SignalR; màn hình ca trực `/operations` cũng tự đồng bộ. Báo cáo Power BI riêng dùng model Import và chỉ thay đổi sau khi semantic model refresh, nên không đại diện cho dữ liệu trực tiếp trên web.

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

Trước khi bật thao tác hoàn cọc, áp dụng migration cho dòng hoàn tiền âm trong sổ thu. Script chỉ đổi constraint của `hotel.Payment` và chặn cập nhật/xóa trực tiếp qua principal `hotel_app`:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --schema-script backend/migrations/27_deposit_refunds.sql --schema-only --commit
```

Đối chiếu dấu vân tay dữ liệu (chỉ số lượng và tổng tiền, không in dữ liệu khách) trước và sau migration:

```powershell
dotnet run --project backend/tools/HotelDigital.A26Importer -- --env-file backend/.env --verify-only
```

## Phạm vi triển khai hiện tại

### Cấu trúc dashboard đã chốt

- File Power BI hiện có **2 trang**: `Tổng quan kinh doanh` và `Theo dõi phòng`. Báo cáo native trên `/dashboard` tự cập nhật; `/operations` phục vụ theo dõi từng booking và phòng.
- Trang web nội bộ `/operations` (`Khách & phòng`) được giữ riêng để hiển thị trạng thái từng phòng, khách hiện tại và booking kế tiếp.
- `Khách & phòng` không được tính là trang Power BI. Dữ liệu nhận diện khách chỉ được xem trong web đã đăng nhập; file Power BI hiện tại vẫn chứa dữ liệu này và mã Publish to web của báo cáo cần được chủ sở hữu thu hồi.

- Đặt phòng/check-in/check-out.
- Sổ đặt phòng.
- CRUD phòng/hạng phòng và kênh đặt phòng theo cơ chế ngừng hoạt động thay vì xóa lịch sử.
- Khách hàng có dò trùng, gộp hồ sơ và ngừng sử dụng.
- Một lượt có thể đặt nhiều phòng cùng mã nhóm.
- Quản lý hóa đơn nháp/đã phát hành/đã hủy, liên kết với booking.
- Sổ thu tiền chỉ ghi nhận khoản thu nội bộ (tiền mặt, thẻ, chuyển khoản); không kết nối cổng thanh toán hoặc ngân hàng. Trạng thái chưa thu/thu một phần/đã thu đủ được tự tính từ các khoản đã ghi.
- Đăng nhập nhân viên bằng tài khoản web và ghi audit cho các thao tác dữ liệu.

Màn hình vận hành `Khách & phòng` đã được tích hợp vào web. Dashboard kinh doanh và theo dõi phòng trong web dùng dữ liệu trực tiếp từ API, không phụ thuộc vào lần refresh của Power BI.

## Đăng nhập quản trị nội bộ

Màn hình đăng nhập dùng được trong cả môi trường local và triển khai. API giới hạn 5 lần thử đăng nhập mỗi phút theo địa chỉ IP.

Production cần `Authentication:SigningSecret` tối thiểu 32 byte và `Authentication:AdminPassword` khác `admin` cho API. Thiếu hai giá trị này, API sẽ không khởi động.

## Database cho web

Sau các script schema và view nền, chạy migration audit:

```powershell
sqlcmd -S "<server>" -d "<database>" -E -I -b -i database/04_web_foundation.sql
```

API không tự chạy migration. SQL script đã duyệt vẫn là nguồn quản lý schema.

Các feature phải tuân theo ranh giới frontend/backend và Definition of Done trong kế hoạch triển khai đã được duyệt.
