-- Normalize booking channels into the three reporting categories approved by
-- the hotel: OFFLINE, ONLINE and TRAVEL_AGENCY. Channel codes remain the leaf
-- level used to distinguish concrete sources within each category.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRAN;

IF OBJECT_ID(N'hotel.CK_Channel_Category', N'C') IS NOT NULL
    ALTER TABLE hotel.Channel DROP CONSTRAINT CK_Channel_Category;

SELECT
    ChannelID,
    Category AS OldCategory,
    CONVERT(varchar(15), CASE
        WHEN Category IN ('DIRECT', 'INTERNAL') THEN 'OFFLINE'
        WHEN Category = 'OTA' THEN 'ONLINE'
        WHEN Category = 'PARTNER' THEN 'TRAVEL_AGENCY'
    END) AS NewCategory
INTO #CategoryChange
FROM hotel.Channel
WHERE Category IN ('DIRECT', 'INTERNAL', 'OTA', 'PARTNER');

CREATE UNIQUE CLUSTERED INDEX IX_CategoryChange_ChannelID
    ON #CategoryChange(ChannelID);

UPDATE channel
SET Category = change.NewCategory
FROM hotel.Channel channel
JOIN #CategoryChange change ON change.ChannelID = channel.ChannelID;

IF EXISTS (
    SELECT 1
    FROM hotel.Channel
    WHERE Category NOT IN ('OFFLINE', 'ONLINE', 'TRAVEL_AGENCY')
)
    THROW 52019, 'Channel category normalization left unsupported values.', 1;

ALTER TABLE hotel.Channel WITH CHECK ADD CONSTRAINT CK_Channel_Category
    CHECK (Category IN ('OFFLINE', 'ONLINE', 'TRAVEL_AGENCY'));
ALTER TABLE hotel.Channel CHECK CONSTRAINT CK_Channel_Category;

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
    N'database-migration-19',
    N'Channel category normalization',
    'UPDATE',
    'Channel',
    CONVERT(varchar(80), change.ChannelID),
    (
        SELECT change.OldCategory AS oldCategory,
               change.NewCategory AS newCategory
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    ),
    CONCAT(N'channel-category-', CONVERT(nvarchar(36), NEWID()))
FROM #CategoryChange change;

DECLARE @ChangedChannelCount int = (SELECT COUNT(*) FROM #CategoryChange);

COMMIT;

SELECT @ChangedChannelCount AS ChangedChannelCount;
GO
