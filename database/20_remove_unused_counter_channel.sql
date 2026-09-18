-- Remove the unused OFFLINE/Tại quầy leaf channel. OFFLINE remains a valid
-- category; direct bookings continue to use their concrete channel codes.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRAN;

DECLARE @ChannelID int;
DECLARE @BookingCount bigint;

SELECT @ChannelID = ChannelID
FROM hotel.Channel WITH (UPDLOCK, HOLDLOCK)
WHERE Code = 'OFFLINE';

IF @ChannelID IS NOT NULL
BEGIN
    SELECT @BookingCount = COUNT_BIG(*)
    FROM hotel.Booking WITH (UPDLOCK, HOLDLOCK)
    WHERE ChannelID = @ChannelID;

    IF @BookingCount <> 0
        THROW 52020, 'Cannot remove OFFLINE channel because bookings reference it.', 1;

    DELETE FROM hotel.Channel
    WHERE ChannelID = @ChannelID
      AND Code = 'OFFLINE';

    IF @@ROWCOUNT <> 1
        THROW 52020, 'OFFLINE channel cleanup count mismatch.', 1;

    DECLARE @ChangesJson nvarchar(max) = (
        SELECT N'OFFLINE' AS channelCode,
               N'Tại quầy' AS channelName,
               @BookingCount AS deletedBookings,
               N'Unused duplicate direct-booking channel removed at user request.' AS reason
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
        N'database-migration-20',
        N'Unused counter channel cleanup',
        'DELETE',
        'Channel',
        CONVERT(varchar(80), @ChannelID),
        @ChangesJson,
        CONCAT(N'remove-offline-channel-', CONVERT(nvarchar(36), NEWID()))
    );
END;

COMMIT;

SELECT @ChannelID AS RemovedChannelID,
       COALESCE(@BookingCount, 0) AS DeletedBookings;
GO
