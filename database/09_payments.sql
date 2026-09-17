-- Payment transactions for deposits, in-stay collections and checkout settlement.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

DECLARE @CreatedPaymentTable bit = 0;

IF OBJECT_ID(N'hotel.Payment', N'U') IS NULL
BEGIN
    CREATE TABLE hotel.Payment (
        PaymentID bigint IDENTITY CONSTRAINT PK_Payment PRIMARY KEY,
        BookingID bigint NOT NULL CONSTRAINT FK_Payment_Booking REFERENCES hotel.Booking(BookingID),
        Amount decimal(19,2) NOT NULL,
        Method varchar(12) NOT NULL,
        PaidAt datetime2(0) NOT NULL,
        ReferenceCode nvarchar(100) NULL,
        Note nvarchar(300) NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Payment_CreatedAt DEFAULT SYSUTCDATETIME(),
        Version rowversion NOT NULL,
        CONSTRAINT CK_Payment_Amount CHECK (Amount > 0),
        CONSTRAINT CK_Payment_Method CHECK (Method IN ('CASH','CARD','TRANSFER'))
    );
    SET @CreatedPaymentTable = 1;
END;

IF @CreatedPaymentTable = 1
BEGIN
    INSERT INTO hotel.Payment (BookingID,Amount,Method,PaidAt,ReferenceCode,Note)
    SELECT booking.BookingID,payment.Amount,payment.Method,booking.CreatedAt,NULL,N'Chuyển từ dữ liệu thanh toán booking hiện có'
    FROM hotel.Booking booking
    CROSS APPLY (VALUES
        (booking.CashAmount,'CASH'),
        (booking.CardAmount,'CARD'),
        (booking.TransferAmount,'TRANSFER')
    ) payment(Amount,Method)
    WHERE payment.Amount > 0;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hotel.Payment') AND name = N'IX_Payment_Booking_PaidAt')
    CREATE INDEX IX_Payment_Booking_PaidAt ON hotel.Payment(BookingID,PaidAt DESC);
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
    GRANT SELECT,INSERT,UPDATE ON hotel.Payment TO hotel_app;
GO
