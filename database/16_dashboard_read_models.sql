-- Dashboard read models aligned with room maintenance and payment transactions.
-- This migration keeps the existing view names for compatibility and adds
-- low-grain facts shared by the web dashboard and Power BI.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW hotel.vRoomStatus
AS
SELECT
    r.RoomID,
    r.RoomNumber,
    rt.Code AS RoomTypeCode,
    rt.Name AS RoomTypeName,
    rt.Capacity,
    r.FloorLabel,
    r.IsActive,
    r.CountsTowardOccupancy,
    CONVERT(bit, r.CountsTowardOccupancy) AS IsPhysicalRoom,
    CASE
        WHEN r.CountsTowardOccupancy = 0 THEN 'NON_OCCUPANCY'
        WHEN r.IsActive = 0 THEN 'INACTIVE'
        WHEN currentBlock.RoomBlockID IS NOT NULL THEN 'MAINTENANCE'
        WHEN currentBooking.Status = 'CHECKED_IN' THEN 'OCCUPIED'
        WHEN currentBooking.BookingID IS NOT NULL THEN 'RESERVED'
        ELSE 'AVAILABLE'
    END AS RoomStatus,
    currentBooking.BookingID AS CurrentBookingID,
    currentBooking.BookingCode AS CurrentBookingCode,
    currentBooking.FullName AS CurrentGuestName,
    currentBlock.RoomBlockID AS CurrentRoomBlockID,
    currentBlock.Reason AS CurrentRoomBlockReason,
    nextBooking.CheckInAt AS NextCheckInAt
FROM hotel.Room r
JOIN hotel.RoomType rt ON rt.RoomTypeID = r.RoomTypeID
CROSS APPLY (
    SELECT CONVERT(datetime2(0),
        SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time') AS HotelNow
) hotelClock
OUTER APPLY (
    SELECT TOP (1)
        b.BookingID,
        b.BookingCode,
        b.Status,
        c.FullName
    FROM hotel.Booking b
    JOIN hotel.Customer c ON c.CustomerID = b.CustomerID
    WHERE b.RoomID = r.RoomID
      AND b.Status IN ('BOOKED', 'CHECKED_IN')
      AND b.CheckInAt <= hotelClock.HotelNow
      AND b.CheckOutAt > hotelClock.HotelNow
    ORDER BY CASE WHEN b.Status = 'CHECKED_IN' THEN 0 ELSE 1 END, b.CheckInAt
) currentBooking
OUTER APPLY (
    SELECT TOP (1)
        roomBlock.RoomBlockID,
        roomBlock.Reason
    FROM hotel.RoomBlock roomBlock
    WHERE roomBlock.RoomID = r.RoomID
      AND roomBlock.IsActive = 1
      AND roomBlock.StartAt <= hotelClock.HotelNow
      AND roomBlock.EndAt > hotelClock.HotelNow
    ORDER BY roomBlock.StartAt, roomBlock.RoomBlockID
) currentBlock
OUTER APPLY (
    SELECT TOP (1) b.CheckInAt
    FROM hotel.Booking b
    WHERE b.RoomID = r.RoomID
      AND b.Status = 'BOOKED'
      AND b.CheckInAt > hotelClock.HotelNow
    ORDER BY b.CheckInAt
) nextBooking;
GO

-- One row represents one calendar room-night. The checkout date is excluded.
-- BilledNights remains available for reconciliation but no longer drives the
-- generated StayDate rows.
CREATE OR ALTER VIEW hotel.vRoomNight
AS
SELECT
    b.BookingID,
    b.RoomID,
    r.RoomNumber,
    rt.RoomTypeID,
    rt.Code AS RoomTypeCode,
    rt.Name AS RoomTypeName,
    DATEADD(day, series.value, CONVERT(date, b.CheckInAt)) AS StayDate,
    DATEFROMPARTS(
        YEAR(DATEADD(day, series.value, CONVERT(date, b.CheckInAt))),
        MONTH(DATEADD(day, series.value, CONVERT(date, b.CheckInAt))),
        1
    ) AS MonthStart,
    CONVERT(tinyint, 1 + DATEDIFF(day, '19000101',
        DATEADD(day, series.value, CONVERT(date, b.CheckInAt))) % 7) AS WeekdayNumber,
    CASE 1 + DATEDIFF(day, '19000101',
        DATEADD(day, series.value, CONVERT(date, b.CheckInAt))) % 7
        WHEN 1 THEN N'Thứ 2'
        WHEN 2 THEN N'Thứ 3'
        WHEN 3 THEN N'Thứ 4'
        WHEN 4 THEN N'Thứ 5'
        WHEN 5 THEN N'Thứ 6'
        WHEN 6 THEN N'Thứ 7'
        WHEN 7 THEN N'Chủ Nhật'
    END AS WeekdayName,
    b.CheckInAt,
    b.CheckOutAt,
    b.BilledNights,
    CONVERT(int, DATEDIFF(day, CONVERT(date, b.CheckInAt), CONVERT(date, b.CheckOutAt))) AS CalendarNightCount,
    CONVERT(bit, CASE
        WHEN b.BilledNights = DATEDIFF(day, CONVERT(date, b.CheckInAt), CONVERT(date, b.CheckOutAt)) THEN 0
        ELSE 1
    END) AS HasNightCountMismatch,
    b.Status AS BookingStatus,
    r.IsActive AS RoomIsCurrentlyActive,
    r.CountsTowardOccupancy,
    CONVERT(bit, r.CountsTowardOccupancy) AS IsPhysicalRoom,
    ch.ChannelID,
    ch.Code AS ChannelCode,
    ch.Name AS ChannelName,
    ch.Category AS ChannelCategory
FROM hotel.Booking b
JOIN hotel.Room r ON r.RoomID = b.RoomID
JOIN hotel.RoomType rt ON rt.RoomTypeID = r.RoomTypeID
JOIN hotel.Channel ch ON ch.ChannelID = b.ChannelID
CROSS APPLY GENERATE_SERIES(
    CONVERT(int, 0),
    CONVERT(int, DATEDIFF(day, CONVERT(date, b.CheckInAt), CONVERT(date, b.CheckOutAt)) - 1),
    CONVERT(int, 1)
) series
WHERE b.Status NOT IN ('CANCELLED', 'NO_SHOW');
GO

-- One row per physical room and date. The range begins at the earliest source
-- fact and extends at least 24 months beyond the current hotel date. Room.IsActive
-- is current state because the schema does not yet retain room activation history.
CREATE OR ALTER VIEW hotel.vSellableRoomDay
AS
WITH hotelClock AS (
    SELECT CONVERT(date,
        SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time') AS HotelToday
), sourceBounds AS (
    SELECT MIN(sourceDate.StartDate) AS SourceStartDate,
           MAX(sourceDate.EndDateExclusive) AS SourceEndDateExclusive
    FROM (
        SELECT CONVERT(date, b.CheckInAt) AS StartDate,
               CONVERT(date, b.CheckOutAt) AS EndDateExclusive
        FROM hotel.Booking b
        WHERE b.Status NOT IN ('CANCELLED', 'NO_SHOW')

        UNION ALL

        SELECT CONVERT(date, roomBlock.StartAt),
               DATEADD(day,
                   CASE WHEN CONVERT(time, roomBlock.EndAt) = CONVERT(time, '00:00:00') THEN 0 ELSE 1 END,
                   CONVERT(date, roomBlock.EndAt))
        FROM hotel.RoomBlock roomBlock
        WHERE roomBlock.IsActive = 1
    ) sourceDate
), bounds AS (
    SELECT
        CASE
            WHEN sourceBounds.SourceStartDate IS NULL
              OR DATEFROMPARTS(YEAR(hotelClock.HotelToday), 1, 1) < sourceBounds.SourceStartDate
                THEN DATEFROMPARTS(YEAR(hotelClock.HotelToday), 1, 1)
            ELSE DATEFROMPARTS(YEAR(sourceBounds.SourceStartDate), MONTH(sourceBounds.SourceStartDate), 1)
        END AS StartDate,
        CASE
            WHEN sourceBounds.SourceEndDateExclusive IS NOT NULL
              AND DATEADD(day, 1, EOMONTH(DATEADD(day, -1, sourceBounds.SourceEndDateExclusive)))
                  > DATEADD(day, 1, EOMONTH(hotelClock.HotelToday, 24))
                THEN DATEADD(day, 1, EOMONTH(DATEADD(day, -1, sourceBounds.SourceEndDateExclusive)))
            ELSE DATEADD(day, 1, EOMONTH(hotelClock.HotelToday, 24))
        END AS EndDateExclusive
    FROM hotelClock
    CROSS JOIN sourceBounds
), stayDates AS (
    SELECT DATEADD(day, series.value, bounds.StartDate) AS StayDate
    FROM bounds
    CROSS APPLY GENERATE_SERIES(
        CONVERT(int, 0),
        CONVERT(int, DATEDIFF(day, bounds.StartDate, bounds.EndDateExclusive) - 1),
        CONVERT(int, 1)
    ) series
)
SELECT
    r.RoomID,
    r.RoomNumber,
    rt.RoomTypeID,
    rt.Code AS RoomTypeCode,
    rt.Name AS RoomTypeName,
    stayDates.StayDate,
    DATEFROMPARTS(YEAR(stayDates.StayDate), MONTH(stayDates.StayDate), 1) AS MonthStart,
    r.IsActive AS RoomIsCurrentlyActive,
    CONVERT(bit, CASE WHEN activeBlock.RoomBlockID IS NULL THEN 0 ELSE 1 END) AS IsMaintenanceBlocked,
    activeBlock.RoomBlockID,
    activeBlock.Reason AS RoomBlockReason,
    CONVERT(bit, CASE
        WHEN r.IsActive = 1 AND activeBlock.RoomBlockID IS NULL THEN 1
        ELSE 0
    END) AS IsSellable
FROM hotel.Room r
JOIN hotel.RoomType rt ON rt.RoomTypeID = r.RoomTypeID
CROSS JOIN stayDates
OUTER APPLY (
    SELECT TOP (1)
        roomBlock.RoomBlockID,
        roomBlock.Reason
    FROM hotel.RoomBlock roomBlock
    WHERE roomBlock.RoomID = r.RoomID
      AND roomBlock.IsActive = 1
      AND roomBlock.StartAt < DATEADD(day, 1, CONVERT(datetime2(0), stayDates.StayDate))
      AND roomBlock.EndAt > CONVERT(datetime2(0), stayDates.StayDate)
    ORDER BY roomBlock.StartAt, roomBlock.RoomBlockID
) activeBlock
WHERE r.CountsTowardOccupancy = 1;
GO

-- Shared calendar dimension for DirectQuery reports. It follows the same date
-- range as room capacity so every operational dashboard date has one row.
CREATE OR ALTER VIEW hotel.vDate
AS
SELECT DISTINCT
    roomDay.StayDate AS [Date],
    CONVERT(smallint, YEAR(roomDay.StayDate)) AS [Year],
    CONVERT(tinyint, MONTH(roomDay.StayDate)) AS MonthNumber,
    CONVERT(char(7), roomDay.StayDate, 126) AS YearMonth,
    roomDay.MonthStart,
    CONVERT(tinyint, DAY(roomDay.StayDate)) AS DayOfMonth,
    CONVERT(tinyint, 1 + DATEDIFF(day, '19000101', roomDay.StayDate) % 7) AS WeekdayNumber,
    CASE 1 + DATEDIFF(day, '19000101', roomDay.StayDate) % 7
        WHEN 1 THEN N'Thứ 2'
        WHEN 2 THEN N'Thứ 3'
        WHEN 3 THEN N'Thứ 4'
        WHEN 4 THEN N'Thứ 5'
        WHEN 5 THEN N'Thứ 6'
        WHEN 6 THEN N'Thứ 7'
        WHEN 7 THEN N'Chủ Nhật'
    END AS WeekdayName,
    CONVERT(bit, CASE
        WHEN 1 + DATEDIFF(day, '19000101', roomDay.StayDate) % 7 IN (6, 7) THEN 1
        ELSE 0
    END) AS IsWeekend
FROM hotel.vSellableRoomDay roomDay;
GO

CREATE OR ALTER VIEW hotel.vDimRoomType
AS
SELECT
    roomType.RoomTypeID,
    roomType.Code AS RoomTypeCode,
    roomType.Name AS RoomTypeName,
    roomType.Capacity,
    roomType.ListedPricePerNight,
    roomType.IsActive
FROM hotel.RoomType roomType;
GO

CREATE OR ALTER VIEW hotel.vDimChannel
AS
SELECT
    channel.ChannelID,
    channel.Code AS ChannelCode,
    channel.Name AS ChannelName,
    channel.Category AS ChannelCategory,
    channel.CommissionRate,
    channel.IsActive
FROM hotel.Channel channel;
GO

-- One row per booking without guest-identifying fields. This is the safe fact
-- used by Power BI for check-ins, booking value, ADR and receivable snapshots.
CREATE OR ALTER VIEW hotel.vBookingFact
AS
SELECT
    booking.BookingID,
    booking.BookingCode,
    booking.BookingMode,
    booking.GroupCode,
    booking.RoomID,
    room.RoomNumber,
    room.CountsTowardOccupancy,
    CONVERT(bit, room.CountsTowardOccupancy) AS IsPhysicalRoom,
    roomType.RoomTypeID,
    roomType.Code AS RoomTypeCode,
    roomType.Name AS RoomTypeName,
    booking.ChannelID,
    channel.Code AS ChannelCode,
    channel.Name AS ChannelName,
    channel.Category AS ChannelCategory,
    booking.CheckInAt,
    CONVERT(date, booking.CheckInAt) AS CheckInDate,
    DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1) AS CheckInMonthStart,
    booking.CheckOutAt,
    CONVERT(date, booking.CheckOutAt) AS CheckOutDate,
    booking.BilledNights,
    CONVERT(int, DATEDIFF(day, CONVERT(date, booking.CheckInAt), CONVERT(date, booking.CheckOutAt))) AS CalendarNightCount,
    CONVERT(bit, CASE
        WHEN booking.BilledNights = DATEDIFF(day, CONVERT(date, booking.CheckInAt), CONVERT(date, booking.CheckOutAt)) THEN 0
        ELSE 1
    END) AS HasNightCountMismatch,
    booking.Status AS BookingStatus,
    booking.RoomRevenue,
    booking.ServiceRevenue,
    booking.SurchargeAmount,
    booking.DiscountAmount,
    booking.GrossRevenue,
    booking.DebtAmount,
    booking.BalanceDue,
    booking.AverageRoomRate AS BookingAverageDailyRate,
    COALESCE(NULLIF(LTRIM(RTRIM(customer.Nationality)), N''), N'Chưa xác định') AS Nationality,
    booking.CreatedAt
FROM hotel.Booking booking
JOIN hotel.Room room ON room.RoomID = booking.RoomID
JOIN hotel.RoomType roomType ON roomType.RoomTypeID = room.RoomTypeID
JOIN hotel.Channel channel ON channel.ChannelID = booking.ChannelID
JOIN hotel.Customer customer ON customer.CustomerID = booking.CustomerID;
GO

CREATE OR ALTER VIEW hotel.vPaymentFact
AS
SELECT
    payment.PaymentID,
    payment.BookingID,
    booking.BookingCode,
    payment.PaidAt,
    CONVERT(date, payment.PaidAt) AS PaidDate,
    DATEFROMPARTS(YEAR(payment.PaidAt), MONTH(payment.PaidAt), 1) AS MonthStart,
    payment.Method,
    payment.Amount,
    payment.ReferenceCode,
    payment.Note,
    CONVERT(bit, CASE
        WHEN payment.Note = N'Chuyển từ dữ liệu thanh toán booking hiện có' THEN 1
        ELSE 0
    END) AS IsPaidAtEstimated,
    booking.CheckInAt,
    booking.CheckOutAt,
    booking.Status AS BookingStatus,
    room.RoomID,
    room.RoomNumber,
    room.CountsTowardOccupancy,
    roomType.RoomTypeID,
    roomType.Code AS RoomTypeCode,
    roomType.Name AS RoomTypeName,
    channel.ChannelID,
    channel.Code AS ChannelCode,
    channel.Name AS ChannelName,
    channel.Category AS ChannelCategory
FROM hotel.Payment payment
JOIN hotel.Booking booking ON booking.BookingID = payment.BookingID
JOIN hotel.Room room ON room.RoomID = booking.RoomID
JOIN hotel.RoomType roomType ON roomType.RoomTypeID = room.RoomTypeID
JOIN hotel.Channel channel ON channel.ChannelID = booking.ChannelID;
GO

-- Compatibility aggregate for month-level reporting. PaidAmount follows PaidAt;
-- booking value and receivable snapshots continue to follow CheckInAt.
CREATE OR ALTER VIEW hotel.vDashboardMonthly
AS
WITH bookingMonth AS (
    SELECT
        DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1) AS MonthStart,
        COUNT_BIG(*) AS BookingCount,
        SUM(booking.RoomRevenue) AS RoomRevenue,
        SUM(booking.ServiceRevenue) AS ServiceRevenue,
        SUM(booking.SurchargeAmount) AS SurchargeAmount,
        SUM(booking.DiscountAmount) AS DiscountAmount,
        SUM(booking.GrossRevenue) AS GrossRevenue,
        SUM(booking.DebtAmount) AS DebtAmount,
        SUM(booking.BalanceDue) AS BalanceDue,
        SUM(CASE WHEN room.CountsTowardOccupancy = 1 THEN booking.RoomRevenue ELSE 0 END) AS PhysicalRoomRevenue,
        SUM(CASE WHEN room.CountsTowardOccupancy = 1 THEN CONVERT(bigint, booking.BilledNights) ELSE 0 END) AS PhysicalBilledNights
    FROM hotel.Booking booking
    JOIN hotel.Room room ON room.RoomID = booking.RoomID
    WHERE booking.Status NOT IN ('CANCELLED', 'NO_SHOW')
    GROUP BY DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1)
), stayMonth AS (
    SELECT
        roomNight.MonthStart,
        COUNT_BIG(*) AS SoldRoomNights,
        SUM(CONVERT(bigint, CASE WHEN roomNight.BookingStatus IN ('CHECKED_IN', 'CHECKED_OUT') THEN 1 ELSE 0 END)) AS ActualRoomNights,
        SUM(CONVERT(bigint, CASE WHEN roomNight.BookingStatus = 'BOOKED' THEN 1 ELSE 0 END)) AS ForecastRoomNights,
        SUM(CONVERT(bigint, CASE WHEN roomNight.HasNightCountMismatch = 1 THEN 1 ELSE 0 END)) AS NightMismatchRows
    FROM hotel.vRoomNight roomNight
    WHERE roomNight.CountsTowardOccupancy = 1
    GROUP BY roomNight.MonthStart
), capacityMonth AS (
    SELECT
        roomDay.MonthStart,
        COUNT_BIG(*) AS PhysicalInventoryRoomNights,
        SUM(CONVERT(bigint, roomDay.IsSellable)) AS AvailableRoomNights,
        SUM(CONVERT(bigint, roomDay.IsMaintenanceBlocked)) AS MaintenanceRoomNights
    FROM hotel.vSellableRoomDay roomDay
    GROUP BY roomDay.MonthStart
), paymentMonth AS (
    SELECT
        payment.MonthStart,
        SUM(payment.Amount) AS PaidAmount,
        SUM(CASE WHEN payment.IsPaidAtEstimated = 1 THEN payment.Amount ELSE 0 END) AS EstimatedPaidAmount
    FROM hotel.vPaymentFact payment
    GROUP BY payment.MonthStart
), months AS (
    SELECT MonthStart FROM bookingMonth
    UNION
    SELECT MonthStart FROM stayMonth
    UNION
    SELECT MonthStart FROM capacityMonth
    UNION
    SELECT MonthStart FROM paymentMonth
)
SELECT
    months.MonthStart,
    COALESCE(booking.BookingCount, 0) AS BookingCount,
    COALESCE(stay.SoldRoomNights, 0) AS SoldRoomNights,
    COALESCE(stay.ActualRoomNights, 0) AS ActualRoomNights,
    COALESCE(stay.ForecastRoomNights, 0) AS ForecastRoomNights,
    COALESCE(capacity.PhysicalInventoryRoomNights, 0) AS PhysicalInventoryRoomNights,
    COALESCE(capacity.AvailableRoomNights, 0) AS AvailableRoomNights,
    COALESCE(capacity.MaintenanceRoomNights, 0) AS MaintenanceRoomNights,
    CONVERT(decimal(9, 4), COALESCE(stay.ActualRoomNights, 0)
        / NULLIF(CONVERT(decimal(19, 4), capacity.AvailableRoomNights), 0)) AS OccupancyRate,
    CONVERT(decimal(9, 4), COALESCE(stay.ForecastRoomNights, 0)
        / NULLIF(CONVERT(decimal(19, 4), capacity.AvailableRoomNights), 0)) AS ForecastOccupancyRate,
    COALESCE(booking.RoomRevenue, 0) AS RoomRevenue,
    COALESCE(booking.ServiceRevenue, 0) AS ServiceRevenue,
    COALESCE(booking.SurchargeAmount, 0) AS SurchargeAmount,
    COALESCE(booking.DiscountAmount, 0) AS DiscountAmount,
    COALESCE(booking.GrossRevenue, 0) AS GrossRevenue,
    COALESCE(payment.PaidAmount, 0) AS PaidAmount,
    COALESCE(payment.EstimatedPaidAmount, 0) AS EstimatedPaidAmount,
    COALESCE(booking.DebtAmount, 0) AS DebtAmount,
    COALESCE(booking.BalanceDue, 0) AS BalanceDue,
    CONVERT(decimal(19, 2), COALESCE(booking.PhysicalRoomRevenue, 0)
        / NULLIF(CONVERT(decimal(19, 4), booking.PhysicalBilledNights), 0)) AS BookingAverageDailyRate,
    COALESCE(stay.NightMismatchRows, 0) AS NightMismatchRows
FROM months
LEFT JOIN bookingMonth booking ON booking.MonthStart = months.MonthStart
LEFT JOIN stayMonth stay ON stay.MonthStart = months.MonthStart
LEFT JOIN capacityMonth capacity ON capacity.MonthStart = months.MonthStart
LEFT JOIN paymentMonth payment ON payment.MonthStart = months.MonthStart;
GO

-- Check-in cohort by channel. CollectedToDate is deliberately labelled as a
-- cohort snapshot; period cash flow must use vPaymentFact.PaidAt instead.
CREATE OR ALTER VIEW hotel.vDashboardChannel
AS
WITH nightCount AS (
    SELECT roomNight.BookingID, COUNT_BIG(*) AS CalendarRoomNights
    FROM hotel.vRoomNight roomNight
    WHERE roomNight.CountsTowardOccupancy = 1
    GROUP BY roomNight.BookingID
), paymentToDate AS (
    SELECT payment.BookingID, SUM(payment.Amount) AS CollectedToDate
    FROM hotel.Payment payment
    GROUP BY payment.BookingID
)
SELECT
    DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1) AS MonthStart,
    channel.ChannelID,
    channel.Code AS ChannelCode,
    channel.Name AS ChannelName,
    channel.Category AS ChannelCategory,
    COUNT_BIG(*) AS BookingCount,
    SUM(COALESCE(nightCount.CalendarRoomNights, 0)) AS CalendarRoomNights,
    SUM(CASE WHEN room.CountsTowardOccupancy = 1 THEN booking.RoomRevenue ELSE 0 END) AS PhysicalRoomRevenue,
    SUM(booking.GrossRevenue) AS GrossRevenue,
    SUM(COALESCE(paymentToDate.CollectedToDate, 0)) AS CollectedToDate,
    SUM(booking.DebtAmount) AS DebtAmount,
    SUM(booking.BalanceDue) AS BalanceDue,
    CONVERT(decimal(19, 2),
        SUM(CASE WHEN room.CountsTowardOccupancy = 1 THEN booking.RoomRevenue ELSE 0 END)
        / NULLIF(CONVERT(decimal(19, 4), SUM(COALESCE(nightCount.CalendarRoomNights, 0))), 0)) AS BookingAverageDailyRate
FROM hotel.Booking booking
JOIN hotel.Room room ON room.RoomID = booking.RoomID
JOIN hotel.Channel channel ON channel.ChannelID = booking.ChannelID
LEFT JOIN nightCount ON nightCount.BookingID = booking.BookingID
LEFT JOIN paymentToDate ON paymentToDate.BookingID = booking.BookingID
WHERE booking.Status NOT IN ('CANCELLED', 'NO_SHOW')
GROUP BY
    DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1),
    channel.ChannelID,
    channel.Code,
    channel.Name,
    channel.Category;
GO

CREATE OR ALTER VIEW hotel.vDashboardRoomType
AS
WITH bookingMonth AS (
    SELECT
        DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1) AS MonthStart,
        roomType.RoomTypeID,
        roomType.Code AS RoomTypeCode,
        roomType.Name AS RoomTypeName,
        COUNT_BIG(*) AS BookingCount,
        SUM(booking.RoomRevenue) AS RoomRevenue,
        SUM(booking.ServiceRevenue) AS ServiceRevenue,
        SUM(booking.SurchargeAmount) AS SurchargeAmount,
        SUM(booking.DiscountAmount) AS DiscountAmount,
        SUM(booking.GrossRevenue) AS GrossRevenue,
        SUM(CONVERT(bigint, booking.BilledNights)) AS BilledNights
    FROM hotel.Booking booking
    JOIN hotel.Room room ON room.RoomID = booking.RoomID
    JOIN hotel.RoomType roomType ON roomType.RoomTypeID = room.RoomTypeID
    WHERE booking.Status NOT IN ('CANCELLED', 'NO_SHOW')
      AND room.CountsTowardOccupancy = 1
    GROUP BY
        DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1),
        roomType.RoomTypeID,
        roomType.Code,
        roomType.Name
), stayMonth AS (
    SELECT
        roomNight.MonthStart,
        roomNight.RoomTypeID,
        roomNight.RoomTypeCode,
        roomNight.RoomTypeName,
        COUNT_BIG(*) AS CalendarRoomNights,
        SUM(CONVERT(bigint, CASE WHEN roomNight.BookingStatus IN ('CHECKED_IN', 'CHECKED_OUT') THEN 1 ELSE 0 END)) AS ActualRoomNights,
        SUM(CONVERT(bigint, CASE WHEN roomNight.BookingStatus = 'BOOKED' THEN 1 ELSE 0 END)) AS ForecastRoomNights
    FROM hotel.vRoomNight roomNight
    WHERE roomNight.CountsTowardOccupancy = 1
    GROUP BY roomNight.MonthStart, roomNight.RoomTypeID, roomNight.RoomTypeCode, roomNight.RoomTypeName
), capacityMonth AS (
    SELECT
        roomDay.MonthStart,
        roomDay.RoomTypeID,
        roomDay.RoomTypeCode,
        roomDay.RoomTypeName,
        SUM(CONVERT(bigint, roomDay.IsSellable)) AS AvailableRoomNights,
        SUM(CONVERT(bigint, roomDay.IsMaintenanceBlocked)) AS MaintenanceRoomNights
    FROM hotel.vSellableRoomDay roomDay
    GROUP BY roomDay.MonthStart, roomDay.RoomTypeID, roomDay.RoomTypeCode, roomDay.RoomTypeName
), keys AS (
    SELECT MonthStart, RoomTypeID, RoomTypeCode, RoomTypeName FROM bookingMonth
    UNION
    SELECT MonthStart, RoomTypeID, RoomTypeCode, RoomTypeName FROM stayMonth
    UNION
    SELECT MonthStart, RoomTypeID, RoomTypeCode, RoomTypeName FROM capacityMonth
)
SELECT
    keys.MonthStart,
    keys.RoomTypeID,
    keys.RoomTypeCode,
    keys.RoomTypeName,
    COALESCE(booking.BookingCount, 0) AS BookingCount,
    COALESCE(booking.BilledNights, 0) AS BilledNights,
    COALESCE(stay.CalendarRoomNights, 0) AS CalendarRoomNights,
    COALESCE(stay.ActualRoomNights, 0) AS ActualRoomNights,
    COALESCE(stay.ForecastRoomNights, 0) AS ForecastRoomNights,
    COALESCE(capacity.AvailableRoomNights, 0) AS AvailableRoomNights,
    COALESCE(capacity.MaintenanceRoomNights, 0) AS MaintenanceRoomNights,
    CONVERT(decimal(9, 4), COALESCE(stay.ActualRoomNights, 0)
        / NULLIF(CONVERT(decimal(19, 4), capacity.AvailableRoomNights), 0)) AS OccupancyRate,
    CONVERT(decimal(9, 4), COALESCE(stay.ForecastRoomNights, 0)
        / NULLIF(CONVERT(decimal(19, 4), capacity.AvailableRoomNights), 0)) AS ForecastOccupancyRate,
    COALESCE(booking.RoomRevenue, 0) AS RoomRevenue,
    COALESCE(booking.ServiceRevenue, 0) AS ServiceRevenue,
    COALESCE(booking.SurchargeAmount, 0) AS SurchargeAmount,
    COALESCE(booking.DiscountAmount, 0) AS DiscountAmount,
    COALESCE(booking.GrossRevenue, 0) AS GrossRevenue,
    CONVERT(decimal(19, 2), COALESCE(booking.RoomRevenue, 0)
        / NULLIF(CONVERT(decimal(19, 4), booking.BilledNights), 0)) AS BookingAverageDailyRate
FROM keys
LEFT JOIN bookingMonth booking
    ON booking.MonthStart = keys.MonthStart AND booking.RoomTypeID = keys.RoomTypeID
LEFT JOIN stayMonth stay
    ON stay.MonthStart = keys.MonthStart AND stay.RoomTypeID = keys.RoomTypeID
LEFT JOIN capacityMonth capacity
    ON capacity.MonthStart = keys.MonthStart AND capacity.RoomTypeID = keys.RoomTypeID;
GO

CREATE OR ALTER VIEW hotel.vDashboardNationality
AS
SELECT
    DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1) AS MonthStart,
    COALESCE(NULLIF(LTRIM(RTRIM(customer.Nationality)), N''), N'Chưa xác định') AS Nationality,
    COUNT_BIG(*) AS BookingCount,
    SUM(booking.GrossRevenue) AS GrossRevenue
FROM hotel.Booking booking
JOIN hotel.Customer customer ON customer.CustomerID = booking.CustomerID
JOIN hotel.Room room ON room.RoomID = booking.RoomID
WHERE booking.Status NOT IN ('CANCELLED', 'NO_SHOW')
  AND room.CountsTowardOccupancy = 1
GROUP BY
    DATEFROMPARTS(YEAR(booking.CheckInAt), MONTH(booking.CheckInAt), 1),
    COALESCE(NULLIF(LTRIM(RTRIM(customer.Nationality)), N''), N'Chưa xác định');
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
BEGIN
    GRANT SELECT ON hotel.vRoomStatus TO hotel_app;
    GRANT SELECT ON hotel.vRoomNight TO hotel_app;
    GRANT SELECT ON hotel.vSellableRoomDay TO hotel_app;
    GRANT SELECT ON hotel.vDate TO hotel_app;
    GRANT SELECT ON hotel.vDimRoomType TO hotel_app;
    GRANT SELECT ON hotel.vDimChannel TO hotel_app;
    GRANT SELECT ON hotel.vBookingFact TO hotel_app;
    GRANT SELECT ON hotel.vPaymentFact TO hotel_app;
    GRANT SELECT ON hotel.vDashboardMonthly TO hotel_app;
    GRANT SELECT ON hotel.vDashboardChannel TO hotel_app;
    GRANT SELECT ON hotel.vDashboardRoomType TO hotel_app;
    GRANT SELECT ON hotel.vDashboardNationality TO hotel_app;
END;
GO
