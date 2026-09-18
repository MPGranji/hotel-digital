-- Replace raw A26 source codes with stable operational channel codes while
-- preserving ChannelID and all existing booking relationships.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRAN;

CREATE TABLE #DesiredChannel (
    LegacyCode varchar(40) NOT NULL PRIMARY KEY,
    CanonicalCode varchar(40) NOT NULL UNIQUE,
    CanonicalName nvarchar(100) NOT NULL,
    CanonicalCategory varchar(15) NOT NULL
);

INSERT #DesiredChannel (LegacyCode, CanonicalCode, CanonicalName, CanonicalCategory)
VALUES
    ('BOOKED_CTV', 'DIRECT', N'Đặt trực tiếp', 'OFFLINE'),
    ('ONLINE', 'ONLINE_UNSPECIFIED', N'Online chưa xác định', 'ONLINE'),
    ('OTA', 'OTA_UNSPECIFIED', N'OTA chưa xác định', 'ONLINE'),
    ('COMPANY', 'COMPANY', N'Công ty', 'TRAVEL_AGENCY'),
    ('BOOKED_TA', 'TRAVEL_AGENT', N'Đại lý du lịch', 'TRAVEL_AGENCY');

IF EXISTS (
    SELECT desired.CanonicalCode
    FROM #DesiredChannel desired
    JOIN hotel.Channel channel
      ON channel.Code IN (desired.LegacyCode, desired.CanonicalCode)
    GROUP BY desired.CanonicalCode
    HAVING COUNT(*) <> 1
)
    THROW 52021, 'Legacy and canonical channel codes conflict or are missing.', 1;

SELECT
    channel.ChannelID,
    channel.Code AS OldCode,
    channel.Name AS OldName,
    channel.Category AS OldCategory,
    channel.Note AS OldNote,
    desired.CanonicalCode AS NewCode,
    desired.CanonicalName AS NewName,
    desired.CanonicalCategory AS NewCategory
INTO #ChannelChange
FROM #DesiredChannel desired
JOIN hotel.Channel channel WITH (UPDLOCK, HOLDLOCK)
  ON channel.Code IN (desired.LegacyCode, desired.CanonicalCode)
WHERE channel.Code <> desired.CanonicalCode
   OR channel.Name <> desired.CanonicalName
   OR channel.Category <> desired.CanonicalCategory
   OR channel.Note IS NOT NULL;

CREATE UNIQUE CLUSTERED INDEX IX_ChannelChange_ChannelID
    ON #ChannelChange(ChannelID);

UPDATE channel
SET Code = change.NewCode,
    Name = change.NewName,
    Category = change.NewCategory,
    Note = NULL
FROM hotel.Channel channel
JOIN #ChannelChange change ON change.ChannelID = channel.ChannelID;

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
SELECT
    SYSUTCDATETIME(),
    N'database-migration-21',
    N'Canonical channel code normalization',
    'UPDATE',
    'Channel',
    CONVERT(varchar(80), change.ChannelID),
    (
        SELECT
            change.OldCode AS oldCode,
            change.NewCode AS newCode,
            change.OldName AS oldName,
            change.NewName AS newName,
            change.OldCategory AS oldCategory,
            change.NewCategory AS newCategory
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    ),
    CONCAT(N'canonical-channel-', CONVERT(nvarchar(36), NEWID()))
FROM #ChannelChange change;

DECLARE @ChangedChannelCount int = (SELECT COUNT(*) FROM #ChannelChange);

COMMIT;

SELECT @ChangedChannelCount AS ChangedChannelCount;
GO
