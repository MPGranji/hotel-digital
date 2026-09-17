-- Customer lifecycle, grouped bookings and invoices.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'hotel.Customer', N'IsActive') IS NULL
BEGIN
    ALTER TABLE hotel.Customer ADD IsActive bit NOT NULL
        CONSTRAINT DF_Customer_IsActive DEFAULT 1 WITH VALUES;
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hotel.Customer') AND name = N'IX_Customer_IsActive_Name')
    CREATE INDEX IX_Customer_IsActive_Name ON hotel.Customer(IsActive,FullName);
GO

IF COL_LENGTH(N'hotel.Booking', N'GroupCode') IS NULL
BEGIN
    ALTER TABLE hotel.Booking ADD GroupCode varchar(40) NULL;
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hotel.Booking') AND name = N'IX_Booking_GroupCode')
    CREATE INDEX IX_Booking_GroupCode ON hotel.Booking(GroupCode) WHERE GroupCode IS NOT NULL;
GO

IF OBJECT_ID(N'hotel.Invoice', N'U') IS NULL
BEGIN
    CREATE TABLE hotel.Invoice (
        InvoiceID bigint IDENTITY CONSTRAINT PK_Invoice PRIMARY KEY,
        BookingID bigint NOT NULL CONSTRAINT FK_Invoice_Booking REFERENCES hotel.Booking(BookingID),
        InvoiceNumber nvarchar(50) NOT NULL,
        IssuedAt datetime2(0) NULL,
        Status varchar(12) NOT NULL CONSTRAINT DF_Invoice_Status DEFAULT 'DRAFT',
        GrossAmount decimal(19,2) NOT NULL,
        PaidAmount decimal(19,2) NOT NULL,
        DebtAmount decimal(19,2) NOT NULL,
        BalanceDue decimal(19,2) NOT NULL,
        Note nvarchar(500) NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Invoice_CreatedAt DEFAULT SYSUTCDATETIME(),
        Version rowversion NOT NULL,
        CONSTRAINT UQ_Invoice_Booking UNIQUE (BookingID),
        CONSTRAINT UQ_Invoice_Number UNIQUE (InvoiceNumber),
        CONSTRAINT CK_Invoice_Status CHECK (Status IN ('DRAFT','ISSUED','VOID')),
        CONSTRAINT CK_Invoice_Amounts CHECK (GrossAmount >= 0 AND PaidAmount >= 0 AND DebtAmount >= 0)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hotel.Invoice') AND name = N'IX_Invoice_Status_IssuedAt')
    CREATE INDEX IX_Invoice_Status_IssuedAt ON hotel.Invoice(Status,IssuedAt DESC);
GO

;WITH LegacyInvoices AS (
    SELECT *, COUNT(*) OVER (PARTITION BY InvoiceNumber) AS NumberCount
    FROM hotel.Booking
    WHERE NULLIF(LTRIM(RTRIM(InvoiceNumber)), N'') IS NOT NULL
)
INSERT INTO hotel.Invoice (BookingID,InvoiceNumber,IssuedAt,Status,GrossAmount,PaidAmount,DebtAmount,BalanceDue)
SELECT BookingID,
    LEFT(CASE WHEN NumberCount > 1 THEN CONCAT(InvoiceNumber, N'-', BookingID) ELSE InvoiceNumber END, 50),
    CreatedAt,'ISSUED',GrossRevenue,PaidAmount,DebtAmount,BalanceDue
FROM LegacyInvoices source
WHERE NOT EXISTS (SELECT 1 FROM hotel.Invoice invoice WHERE invoice.BookingID = source.BookingID);
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
BEGIN
    GRANT SELECT,INSERT,UPDATE ON hotel.Invoice TO hotel_app;
END;
GO
