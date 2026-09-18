-- Historical payments were created from booking-level cash/card/transfer totals.
-- The source workbook has no payment timestamp, so use checkout as the closest
-- operational estimate instead of the database import timestamp.
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @UpdatedPayments int = 0;

UPDATE payment
SET payment.PaidAt = booking.CheckOutAt
FROM hotel.Payment payment
JOIN hotel.Booking booking ON booking.BookingID = payment.BookingID
WHERE payment.Note = N'Chuyển từ dữ liệu thanh toán booking hiện có'
  AND payment.PaidAt <> booking.CheckOutAt;

SET @UpdatedPayments = @@ROWCOUNT;

IF @UpdatedPayments > 0
BEGIN
    INSERT hotel.AuditLog (
        OccurredAtUtc,
        ActorObjectID,
        ActorDisplayName,
        Action,
        EntityType,
        EntityID,
        ChangesJson,
        CorrelationID
    )
    VALUES (
        SYSUTCDATETIME(),
        N'database-migration-23',
        N'Historical payment date correction',
        'UPDATE',
        'PaymentBatch',
        'historical-estimated-paid-at',
        (
            SELECT
                @UpdatedPayments AS updatedPayments,
                N'Booking.CheckOutAt' AS estimatedFrom,
                N'Nguồn lịch sử không có ngày thanh toán gốc; PaidAt vẫn là giá trị ước tính.' AS note
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ),
        CONCAT(N'payment-date-correction-', CONVERT(nvarchar(36), NEWID()))
    );
END;

COMMIT;
GO

IF EXISTS (
    SELECT 1
    FROM hotel.Payment payment
    JOIN hotel.Booking booking ON booking.BookingID = payment.BookingID
    WHERE payment.Note = N'Chuyển từ dữ liệu thanh toán booking hiện có'
      AND payment.PaidAt <> booking.CheckOutAt
)
    THROW 52023, 'Estimated payment dates were not aligned to booking checkout.', 1;
GO
