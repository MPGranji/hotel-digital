-- Merge generic ONLINE and OTA legacy buckets into one operational ONLINE
-- channel. Existing bookings are reassigned; no booking or financial row is
-- deleted.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRAN;

DECLARE @OnlineChannelID int;
DECLARE @OnlineOldCode varchar(40);
DECLARE @OnlineOldName nvarchar(100);
DECLARE @OtaChannelID int;
DECLARE @MovedBookingCount bigint = 0;

IF (
    SELECT COUNT(*)
    FROM hotel.Channel
    WHERE Code IN ('ONLINE', 'ONLINE_UNSPECIFIED')
) <> 1
    THROW 52022, 'Expected exactly one ONLINE channel before merge.', 1;

SELECT
    @OnlineChannelID = ChannelID,
    @OnlineOldCode = Code,
    @OnlineOldName = Name
FROM hotel.Channel WITH (UPDLOCK, HOLDLOCK)
WHERE Code IN ('ONLINE', 'ONLINE_UNSPECIFIED');

SELECT @OtaChannelID = ChannelID
FROM hotel.Channel WITH (UPDLOCK, HOLDLOCK)
WHERE Code = 'OTA_UNSPECIFIED';

IF @OtaChannelID IS NOT NULL
BEGIN
    UPDATE hotel.Booking
    SET ChannelID = @OnlineChannelID
    WHERE ChannelID = @OtaChannelID;

    SET @MovedBookingCount = @@ROWCOUNT;

    DELETE FROM hotel.Channel
    WHERE ChannelID = @OtaChannelID
      AND Code = 'OTA_UNSPECIFIED';

    IF @@ROWCOUNT <> 1
        THROW 52022, 'OTA channel merge count mismatch.', 1;

    INSERT hotel.AuditLog (
        OccurredAtUtc, ActorObjectID, ActorDisplayName, Action,
        EntityType, EntityID, ChangesJson, CorrelationID
    )
    VALUES (
        SYSUTCDATETIME(), N'database-migration-22', N'Online channel merge', 'DELETE',
        'Channel', CONVERT(varchar(80), @OtaChannelID),
        (
            SELECT N'OTA_UNSPECIFIED' AS oldCode,
                   N'ONLINE' AS mergedIntoCode,
                   @OnlineChannelID AS mergedIntoChannelId,
                   @MovedBookingCount AS movedBookings
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ),
        CONCAT(N'merge-online-', CONVERT(nvarchar(36), NEWID()))
    );
END;

UPDATE hotel.Channel
SET Code = 'ONLINE',
    Name = N'Online',
    Category = 'ONLINE',
    Note = NULL
WHERE ChannelID = @OnlineChannelID;

IF @OnlineOldCode <> 'ONLINE'
   OR @OnlineOldName <> N'Online'
   OR @MovedBookingCount > 0
BEGIN
    INSERT hotel.AuditLog (
        OccurredAtUtc, ActorObjectID, ActorDisplayName, Action,
        EntityType, EntityID, ChangesJson, CorrelationID
    )
    VALUES (
        SYSUTCDATETIME(), N'database-migration-22', N'Online channel merge', 'UPDATE',
        'Channel', CONVERT(varchar(80), @OnlineChannelID),
        (
            SELECT @OnlineOldCode AS oldCode,
                   N'ONLINE' AS newCode,
                   @OnlineOldName AS oldName,
                   N'Online' AS newName,
                   @MovedBookingCount AS mergedBookings
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ),
        CONCAT(N'normalize-online-', CONVERT(nvarchar(36), NEWID()))
    );
END;

COMMIT;

SELECT @OnlineChannelID AS OnlineChannelID,
       @MovedBookingCount AS MovedBookingCount;
GO
