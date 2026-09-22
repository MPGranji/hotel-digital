-- Distinguish advance reservations from walk-in stays and add indexes used by
-- the operational UI and Power BI DirectQuery. Existing rows are deliberately
-- classified as RESERVATION because historical walk-ins cannot be inferred
-- reliably from timestamps or channels.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRAN;

IF COL_LENGTH(N'hotel.Booking', N'BookingMode') IS NULL
BEGIN
    ALTER TABLE hotel.Booking
        ADD BookingMode varchar(12) NOT NULL
            CONSTRAINT DF_Booking_BookingMode DEFAULT 'RESERVATION' WITH VALUES;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'hotel.Booking')
      AND name = N'CK_Booking_BookingMode'
)
BEGIN
    ALTER TABLE hotel.Booking WITH CHECK
        ADD CONSTRAINT CK_Booking_BookingMode
        CHECK (BookingMode IN ('RESERVATION', 'WALK_IN'));
END;

-- Complete the one-booking/one-invoice lifecycle for historical rows. These
-- snapshots are derived only from persisted booking totals; no financial
-- amount is recalculated or changed on the booking itself.
INSERT INTO hotel.Invoice (
    BookingID, InvoiceNumber, IssuedAt, Status,
    GrossAmount, PaidAmount, DebtAmount, BalanceDue, Note)
SELECT
    booking.BookingID,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM hotel.Invoice existing
            WHERE existing.InvoiceNumber = CONCAT(N'INV-HIST-', booking.BookingID)
        ) THEN CONCAT(N'INV-HIST-', booking.BookingID, N'-', LEFT(CONVERT(varchar(36), NEWID()), 8))
        ELSE CONCAT(N'INV-HIST-', booking.BookingID)
    END,
    CASE WHEN booking.Status = 'CHECKED_OUT' THEN booking.CheckOutAt END,
    CASE
        WHEN booking.Status = 'CHECKED_OUT' THEN 'ISSUED'
        WHEN booking.Status IN ('CANCELLED', 'NO_SHOW') THEN 'VOID'
        ELSE 'DRAFT'
    END,
    booking.GrossRevenue,
    booking.PaidAmount,
    booking.DebtAmount,
    booking.BalanceDue,
    N'Hóa đơn được bổ sung khi chuẩn hóa vòng đời booking.'
FROM hotel.Booking booking
WHERE NOT EXISTS (
    SELECT 1 FROM hotel.Invoice invoice WHERE invoice.BookingID = booking.BookingID
);

UPDATE booking
SET InvoiceNumber = invoice.InvoiceNumber
FROM hotel.Booking booking
JOIN hotel.Invoice invoice ON invoice.BookingID = booking.BookingID
WHERE NULLIF(LTRIM(RTRIM(booking.InvoiceNumber)), N'') IS NULL
   OR booking.InvoiceNumber <> invoice.InvoiceNumber;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'hotel.Booking')
      AND name = N'IX_Booking_Room_Availability'
)
BEGIN
    CREATE INDEX IX_Booking_Room_Availability
        ON hotel.Booking(RoomID, CheckInAt, CheckOutAt)
        INCLUDE (Status, BookingMode, CustomerID, ChannelID);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'hotel.Booking')
      AND name = N'IX_Booking_Dashboard_Period'
)
BEGIN
    CREATE INDEX IX_Booking_Dashboard_Period
        ON hotel.Booking(CheckInAt, Status, RoomID)
        INCLUDE (CheckOutAt, BookingMode, ChannelID, BilledNights, RoomRevenue, ServiceRevenue);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'hotel.Payment')
      AND name = N'IX_Payment_PaidAt_Booking'
)
BEGIN
    CREATE INDEX IX_Payment_PaidAt_Booking
        ON hotel.Payment(PaidAt, BookingID)
        INCLUDE (Amount, Method);
END;

COMMIT;
GO

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

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
    GRANT SELECT ON hotel.vBookingFact TO hotel_app;
GO

-- Migration invariants. Any result row indicates a data error that must be
-- resolved before the application is deployed.
IF EXISTS (
    SELECT 1 FROM hotel.Booking
    WHERE BookingMode NOT IN ('RESERVATION', 'WALK_IN') OR BookingMode IS NULL
)
    THROW 52024, 'Invalid BookingMode values detected after migration.', 1;

IF EXISTS (
    SELECT BookingID FROM hotel.Invoice
    GROUP BY BookingID HAVING COUNT_BIG(*) > 1
)
    THROW 52024, 'More than one invoice exists for a booking.', 1;

IF EXISTS (
    SELECT 1
    FROM hotel.Invoice invoice
    LEFT JOIN hotel.Booking booking ON booking.BookingID = invoice.BookingID
    WHERE booking.BookingID IS NULL
)
    THROW 52024, 'Orphan invoices detected after migration.', 1;

IF EXISTS (
    SELECT 1
    FROM hotel.Booking booking
    LEFT JOIN hotel.Invoice invoice ON invoice.BookingID = booking.BookingID
    WHERE invoice.InvoiceID IS NULL
)
    THROW 52024, 'Bookings without invoices detected after migration.', 1;
GO

SELECT
    COUNT_BIG(*) AS BookingCount,
    SUM(CASE WHEN BookingMode = 'RESERVATION' THEN 1 ELSE 0 END) AS ReservationCount,
    SUM(CASE WHEN BookingMode = 'WALK_IN' THEN 1 ELSE 0 END) AS WalkInCount,
    (SELECT COUNT_BIG(*) FROM hotel.Invoice) AS InvoiceCount,
    (SELECT COUNT_BIG(*) FROM hotel.Payment) AS PaymentCount
FROM hotel.Booking;
GO
