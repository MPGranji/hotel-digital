# Đặc tả Power BI 2 sheet và trang Khách & phòng

Ngày ghi nhận: 22/09/2026.

## 1. Mục tiêu và phạm vi

Riêng báo cáo **Power BI có đúng 2 sheet**:

1. **Tổng quan kinh doanh** — theo dõi kết quả kinh doanh và hiệu quả khai thác phòng.
2. **Phân tích chi tiết** — phân tích xu hướng theo thời gian, hạng phòng và kênh đặt.

Ngoài Power BI, web có một trang nội bộ riêng là **Khách & phòng** để theo dõi từng phòng, khách đang lưu trú và booking kế tiếp. Trang này **không được tính là sheet Power BI**.

Hai ảnh dashboard đã cung cấp chỉ được dùng để tham khảo cách bố trí card, biểu đồ, sơ đồ phòng và bảng dữ liệu; không sao chép toàn bộ chỉ tiêu trong ảnh.

Yêu cầu đã chốt:

- Không hiển thị **số tiền còn thiếu**, **công nợ** hoặc biểu đồ công nợ.
- Không hiển thị trạng thái thanh toán như `Đã TT` trong sơ đồ phòng.
- Phần web đã được phép triển khai sau khi đặc tả được chốt.

## 2. Sheet 1 — Tổng quan kinh doanh

### 2.1. Câu hỏi cần trả lời

- Trong kỳ được chọn có bao nhiêu booking và bao nhiêu đêm phòng đã bán?
- Công suất phòng đạt bao nhiêu?
- Doanh thu phòng và tiền thu trong kỳ là bao nhiêu?
- Hạng phòng và kênh bán nào đóng góp nhiều nhất?
- Ngày nào trong tuần có nhu cầu cao?

### 2.2. Bộ lọc

- Thời gian: tháng hoặc khoảng ngày.
- Hạng phòng.
- Kênh đặt phòng khi cần phân tích kênh.

Kỳ mặc định phải nằm trong phạm vi có dữ liệu đầy đủ; không mặc định chọn toàn bộ các tháng tương lai hoặc tháng thiếu dữ liệu.

### 2.3. Các card KPI

| KPI | Ý nghĩa | Cơ sở thời gian |
| --- | --- | --- |
| Công suất phòng | Tỷ lệ đêm phòng thực tế trên đêm phòng có thể bán | Ngày lưu trú |
| Tổng số booking | Booking hợp lệ có ngày nhận phòng trong kỳ | Ngày nhận phòng |
| Doanh thu phòng | Tổng giá trị tiền phòng của booking hợp lệ | Ngày nhận phòng |
| Tiền thu trong kỳ | Tổng giao dịch thanh toán phát sinh trong kỳ | Ngày thanh toán |
| ADR | Doanh thu phòng bình quân trên một đêm tính tiền | Ngày nhận phòng |

Dòng phụ của card công suất có thể hiển thị số tuyệt đối, ví dụ `16/20 phòng có khách` khi xem một ngày hoặc `245/600 đêm phòng` khi xem một khoảng thời gian.

### 2.4. Biểu đồ chính

#### A. Doanh thu theo thời gian

- Loại biểu đồ: cột chồng.
- Trục X: tháng; khi chọn một kỳ ngắn có thể hiển thị theo ngày.
- Giá trị: doanh thu phòng và doanh thu dịch vụ.
- Mục đích: so sánh quy mô doanh thu giữa các kỳ và cơ cấu phòng/dịch vụ.

#### B. Công suất phòng theo thời gian

- Loại biểu đồ: đường hoặc cột.
- Trục X: ngày hoặc tháng.
- Giá trị: công suất `%`.
- Không ghép doanh thu và công suất vào hai trục tung trên cùng một biểu đồ.

#### C. Doanh thu theo hạng phòng

- Loại biểu đồ: thanh ngang, sắp xếp giảm dần.
- Hạng phòng: Standard, Superior, Superior Quad, Deluxe và các hạng thực tế khác.
- Giá trị chính: doanh thu phòng.
- Tooltip có thể bổ sung số booking, số đêm phòng và ADR.
- Nếu cần thể hiện dịch vụ, dùng thanh chồng doanh thu phòng/doanh thu dịch vụ.

#### D. Cơ cấu theo kênh bán

- Loại biểu đồ:
  - Vành khuyên nếu chỉ hiển thị 3–5 nhóm kênh.
  - Thanh ngang nếu hiển thị nhiều kênh chi tiết.
- Nhóm chính: Direct, OTA và các nhóm khác có trong dữ liệu.
- Giá trị: giá trị booking hoặc doanh thu phòng; tiêu đề phải ghi rõ đang dùng chỉ tiêu nào.

#### E. Công suất trung bình theo ngày trong tuần

- Loại biểu đồ: cột.
- Trục X: Thứ 2 đến Chủ nhật theo đúng thứ tự.
- Giá trị: công suất trung bình `%`.
- Mục đích: nhận biết ngày thường/cuối tuần nào thường có nhu cầu cao.

Trang Tổng quan chỉ nên giữ tối đa bốn biểu đồ chính cùng lúc. Biểu đồ E có thể thay thế biểu đồ ít quan trọng hơn tùy kích thước màn hình.

## 3. Sheet 2 — Phân tích chi tiết

### 3.1. Câu hỏi cần trả lời

- Công suất và nhu cầu thay đổi thế nào theo ngày, thứ và tháng?
- Hạng phòng nào có công suất, số đêm bán và doanh thu tốt nhất?
- Kênh đặt nào mang lại nhiều booking, đêm phòng hoặc doanh thu nhất?
- Khách thường nhận/trả phòng vào khung giờ nào?

### 3.2. Bộ lọc

- Tháng hoặc khoảng ngày.
- Hạng phòng.
- Nhóm kênh và kênh đặt phòng.

### 3.3. Visual chính

- Công suất phòng theo ngày hoặc tháng.
- Công suất trung bình theo thứ trong tuần.
- Lượt nhận/trả phòng theo giờ khi còn đủ diện tích.
- Doanh thu hoặc đêm phòng theo hạng phòng.
- Doanh thu hoặc đêm phòng theo kênh đặt.
- Ma trận hạng phòng × kênh đặt khi cần phân tích chéo.

Sheet này chỉ dùng dữ liệu tổng hợp. Không đưa tên, số điện thoại, CCCD/Passport hoặc danh sách từng khách vào Power BI Publish to web.

## 4. Trang web riêng — Khách & phòng

### 4.1. Câu hỏi cần trả lời

- Hôm nay phòng nào trống, đã đặt, đang có khách hoặc bảo trì?
- Khách nào nhận phòng hoặc trả phòng trong ngày?
- Khách đang ở phòng nào và dự kiến trả phòng khi nào?
- Trong vài ngày tới phòng nào còn có thể bán?

### 4.2. Bộ lọc

- Ngày theo dõi.
- Hạng phòng.
- Tầng.
- Trạng thái phòng.
- Tìm kiếm theo tên khách, mã booking hoặc số phòng nếu giao diện được xây trực tiếp trong web nội bộ.

### 4.3. Các card trạng thái

- Công suất trong ngày.
- Phòng đang có khách.
- Phòng trống.
- Phòng đã đặt/chờ nhận phòng.
- Phòng bảo trì.
- Khách nhận phòng hôm nay.
- Khách trả phòng hôm nay.

Các card không chứa số tiền còn thiếu, công nợ hoặc trạng thái thanh toán.

### 4.4. Sơ đồ trạng thái phòng

Đây là thành phần chính của trang, không phải biểu đồ tài chính.

Mỗi ô phòng hiển thị tối thiểu:

- Số phòng.
- Hạng phòng.
- Trạng thái hiện tại hoặc trạng thái tại ngày được chọn.
- Tên khách hiện tại nếu hệ thống nhúng được bảo vệ phù hợp.
- Thời điểm check-out dự kiến.
- Booking kế tiếp khi có.

Quy ước màu:

| Trạng thái | Màu |
| --- | --- |
| Trống | Xanh lá |
| Đã đặt/chờ nhận phòng | Xanh dương |
| Đang có khách | Vàng hoặc cam |
| Bảo trì | Đỏ nhạt |
| Ngừng hoạt động | Xám |

Màu phải biểu thị **trạng thái phòng**, không dùng màu để biểu thị hạng phòng trong sơ đồ này.

### 4.5. Ma trận lịch phòng

- Hàng: từng phòng.
- Cột: từng ngày.
- Khoảng xem: 7, 14, 21 hoặc 31 ngày.
- Ô dữ liệu: Trống, Đã đặt, Đang ở, Bảo trì hoặc Ngừng dùng.
- Cho phép lọc theo hạng phòng và tầng.

Ma trận dùng để trả lời nhu cầu phòng trống trong tương lai; không dùng trạng thái tại thời điểm hiện tại để suy diễn cho ngày tương lai.

### 4.6. Danh sách khách trong ngày

Giao diện có thể dùng các tab:

- Nhận phòng hôm nay.
- Trả phòng hôm nay.
- Đang lưu trú.

Các cột đề xuất:

| Trường | Ghi chú |
| --- | --- |
| Số phòng | Liên kết tới booking nếu ở trong web nội bộ |
| Khách hàng | Tên khách |
| Hạng phòng | Hạng của phòng được xếp |
| Kênh | Kênh đặt phòng |
| Check-in | Ngày giờ nhận phòng |
| Check-out | Ngày giờ trả phòng |
| Trạng thái | Đã đặt, đang ở hoặc đã trả |

Không có cột số tiền còn thiếu hoặc trạng thái thanh toán.

### 4.7. Biểu đồ nhận/trả phòng theo giờ — tùy chọn

- Loại biểu đồ: cột nhóm.
- Trục X: giờ trong ngày.
- Hai chuỗi: lượt nhận phòng và lượt trả phòng.
- Chỉ giữ khi còn đủ diện tích sau sơ đồ phòng và danh sách khách.

Trang này ưu tiên sơ đồ phòng, ma trận và bảng vận hành; không cần cố biến dữ liệu từng khách thành biểu đồ.

## 5. Nội dung tham khảo nhưng không đưa vào bản chốt

- Số tiền còn thiếu, công nợ và biểu đồ công nợ.
- Trạng thái hoặc tỷ lệ `Đã thanh toán`.
- Tỷ lệ thực thu nếu lấy tiền thu trong kỳ chia cho booking nhận phòng trong cùng kỳ.
- Hoa hồng khi chưa xác nhận quy tắc và dữ liệu hoa hồng thực tế.
- RevPAR khi chưa có doanh thu được phân bổ theo từng đêm lưu trú; dùng ADR thay thế.
- RFM/phân khúc khách hàng vì không trực tiếp phục vụ hai mục tiêu chính của dashboard.
- Biểu đồ khách nội địa/quốc tế khi quốc tịch còn thiếu hoặc chưa được xác minh.
- Biểu đồ phương thức thanh toán trên trang theo dõi phòng.

## 6. Quy ước dữ liệu

| Chỉ tiêu | Nguồn đề xuất | Quy ước |
| --- | --- | --- |
| Công suất, đêm phòng | `hotel.vRoomNight`, `hotel.vSellableRoomDay` | Chỉ tính phòng vật lý, trừ thời gian bảo trì |
| Booking, doanh thu phòng, ADR | `hotel.vBookingFact` | Gắn với ngày nhận phòng |
| Tiền thu trong kỳ | `hotel.vPaymentFact` | Gắn với `PaidAt`; ghi chú dữ liệu ước tính nếu có |
| Trạng thái phòng hiện tại | `hotel.vRoomStatus` | Chỉ phản ánh thời điểm truy vấn |
| Lịch phòng tương lai | API lịch phòng hoặc dữ liệu booking + phòng có thể bán | Tính theo ngày/khoảng ngày được chọn |
| Khách hàng và lịch sử lưu trú | API Customers/Bookings | Chỉ dùng trong giao diện nội bộ có phân quyền |

Các booking `CANCELLED` và `NO_SHOW` không được tính vào công suất và doanh thu vận hành phù hợp. Phòng ảo/nội bộ có `CountsTowardOccupancy = 0` không được tính vào mẫu số công suất.

## 7. Quan hệ với web hiện tại

Web hiện có các chức năng sau:

- `/dashboard`: có khu vực Power BI và trang nội bộ `Khách & phòng`.
- `/rooms`: danh sách phòng, trạng thái hiện tại, ma trận lịch phòng theo ngày/giờ và bảo trì.
- `/customers`: tra cứu khách, thông tin hồ sơ, lần check-in gần nhất và lịch sử lưu trú.
- `/bookings`: tạo và xử lý booking/check-in/check-out.

Trang `Khách & phòng` trùng một phần với `/rooms` và `/customers`, nên ưu tiên tái sử dụng dữ liệu, component hoặc liên kết tới màn hình nghiệp vụ; không tạo một hệ thống quản lý phòng/khách thứ hai.

## 8. Bảo mật khi nhúng Power BI

Link hiện tại dùng cơ chế **Publish to web**. Không đưa các dữ liệu sau vào báo cáo công khai:

- Tên khách.
- Số điện thoại, email.
- CCCD/Passport.
- Chi tiết booking có thể nhận diện cá nhân.

Nếu trang `Khách & phòng` cần hiển thị khách cụ thể, phải dùng một trong hai hướng:

- Giao diện Next.js/API nội bộ đã đăng nhập; hoặc
- Power BI **Embed for your organization** với quyền truy cập phù hợp.

## 9. Trạng thái triển khai

- Báo cáo Power BI đang nhúng có 3 sheet: `Tổng quan kinh doanh`, `Nhu cầu theo thời gian`, `Phòng và kênh bán`.
- Yêu cầu chốt là gộp báo cáo Power BI còn đúng 2 sheet: `Tổng quan kinh doanh` và `Phân tích chi tiết`.
- Web hiện có hai tab `Tổng quan` và `Khách & phòng`; đây là điều hướng của web, **không phải hai sheet Power BI**.
- Trang `Khách & phòng` hiện tại được giữ lại như một trang nội bộ riêng.
- Khung Power BI trong web đã tăng theo chiều cao màn hình, tối thiểu 820 px để các biểu đồ dễ đọc hơn.
- Trang `Khách & phòng` hiển thị các card trạng thái và từng ô phòng với khách/booking hiện tại hoặc booking kế tiếp; dữ liệu nhận diện khách không đi qua Publish to web.
- Database có migration bổ sung chỉ mục cho truy vấn phòng trống, booking theo kỳ và thanh toán theo ngày; đây là lớp tối ưu an toàn cho DirectQuery.
- Màn hình booking đã tách rõ `Đặt trước`, `Nhận phòng tại quầy` và `Booking online`; kênh bán vẫn được lưu độc lập với hình thức tiếp nhận.
- Booking mới tự tạo hóa đơn nháp, thanh toán cập nhật số liệu hóa đơn và checkout phát hành hóa đơn.
- Sổ đặt phòng hiển thị khách, nguồn đặt, trạng thái thanh toán và liên kết hóa đơn; không hiển thị cột số tiền còn thiếu.
- Frontend đã build, lint và type-check thành công; backend vượt toàn bộ test tự động.
- File Power BI nguồn vẫn cần chuyển storage mode từ DirectQuery sang Import hoặc mô hình tổng hợp/composite trong Power BI Desktop rồi publish lại; chỉ mục SQL không thể thay đổi storage mode của semantic model.
