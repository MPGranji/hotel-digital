-- Remove invalid historical bookings assigned to the UNKNOWN channel.
-- Payments and invoices are dependent booking data. Customers are removed only
-- when every booking associated with them is part of this cleanup.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRAN;

DECLARE @ChannelID int;
DECLARE @BookingCount bigint = 0;
DECLARE @PaymentCount bigint = 0;
DECLARE @InvoiceCount bigint = 0;
DECLARE @CustomerCount bigint = 0;
DECLARE @DeletedCustomerCount bigint = 0;

SELECT @ChannelID = ChannelID
FROM hotel.Channel WITH (UPDLOCK, HOLDLOCK)
WHERE Code = 'UNKNOWN';

IF @ChannelID IS NOT NULL
BEGIN
    -- Prevent new operational bookings from selecting this channel while the
    -- cleanup transaction is in progress.
    UPDATE hotel.Channel
    SET IsActive = 0
    WHERE ChannelID = @ChannelID;

    SELECT BookingID, CustomerID
    INTO #UnknownBooking
    FROM hotel.Booking WITH (UPDLOCK, HOLDLOCK)
    WHERE ChannelID = @ChannelID;

    CREATE UNIQUE CLUSTERED INDEX IX_UnknownBooking_BookingID
        ON #UnknownBooking(BookingID);

    SELECT DISTINCT CustomerID
    INTO #CandidateCustomer
    FROM #UnknownBooking;

    CREATE UNIQUE CLUSTERED INDEX IX_CandidateCustomer_CustomerID
        ON #CandidateCustomer(CustomerID);

    SELECT @BookingCount = COUNT_BIG(*) FROM #UnknownBooking;
    SELECT @CustomerCount = COUNT_BIG(*) FROM #CandidateCustomer;
    SELECT @PaymentCount = COUNT_BIG(*)
    FROM hotel.Payment payment
    JOIN #UnknownBooking booking ON booking.BookingID = payment.BookingID;
    SELECT @InvoiceCount = COUNT_BIG(*)
    FROM hotel.Invoice invoice
    JOIN #UnknownBooking booking ON booking.BookingID = invoice.BookingID;

    DELETE invoice
    FROM hotel.Invoice invoice
    JOIN #UnknownBooking booking ON booking.BookingID = invoice.BookingID;

    DELETE payment
    FROM hotel.Payment payment
    JOIN #UnknownBooking booking ON booking.BookingID = payment.BookingID;

    DELETE booking
    FROM hotel.Booking booking
    JOIN #UnknownBooking invalidBooking ON invalidBooking.BookingID = booking.BookingID;

    IF @@ROWCOUNT <> @BookingCount
        THROW 52018, 'UNKNOWN booking cleanup count mismatch.', 1;

    DELETE customer
    FROM hotel.Customer customer
    JOIN #CandidateCustomer candidate ON candidate.CustomerID = customer.CustomerID
    WHERE NOT EXISTS (
        SELECT 1
        FROM hotel.Booking remainingBooking
        WHERE remainingBooking.CustomerID = customer.CustomerID
    );

    SET @DeletedCustomerCount = @@ROWCOUNT;

    DELETE FROM hotel.Channel
    WHERE ChannelID = @ChannelID
      AND Code = 'UNKNOWN';

    IF @@ROWCOUNT <> 1
        THROW 52018, 'UNKNOWN channel cleanup count mismatch.', 1;

    DECLARE @ChangesJson nvarchar(max) = (
        SELECT
            N'UNKNOWN' AS channelCode,
            @BookingCount AS deletedBookings,
            @PaymentCount AS deletedPayments,
            @InvoiceCount AS deletedInvoices,
            @DeletedCustomerCount AS deletedOrphanCustomers,
            @CustomerCount - @DeletedCustomerCount AS retainedSharedCustomers,
            N'Invalid source data removed at user request.' AS reason
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

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
        N'database-migration-18',
        N'UNKNOWN channel cleanup',
        'DELETE',
        'Channel',
        CONVERT(varchar(80), @ChannelID),
        @ChangesJson,
        CONCAT(N'remove-unknown-', CONVERT(nvarchar(36), NEWID()))
    );
END;

IF EXISTS (SELECT 1 FROM hotel.Channel WHERE Category = 'UNKNOWN')
    THROW 52018, 'Cannot remove UNKNOWN category while UNKNOWN channel rows still exist.', 1;

IF OBJECT_ID(N'hotel.CK_Channel_Category', N'C') IS NOT NULL
    ALTER TABLE hotel.Channel DROP CONSTRAINT CK_Channel_Category;

ALTER TABLE hotel.Channel WITH CHECK ADD CONSTRAINT CK_Channel_Category
    CHECK (Category IN (
        'DIRECT', 'OTA', 'PARTNER', 'INTERNAL',
        'OFFLINE', 'ONLINE', 'TRAVEL_AGENCY'
    ));
ALTER TABLE hotel.Channel CHECK CONSTRAINT CK_Channel_Category;

COMMIT;

SELECT
    @ChannelID AS RemovedChannelID,
    @BookingCount AS DeletedBookings,
    @PaymentCount AS DeletedPayments,
    @InvoiceCount AS DeletedInvoices,
    @DeletedCustomerCount AS DeletedOrphanCustomers,
    @CustomerCount - @DeletedCustomerCount AS RetainedSharedCustomers;
GO
