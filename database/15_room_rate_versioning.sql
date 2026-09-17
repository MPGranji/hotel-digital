-- Harden room-rate scheduling and retain every database-level change for reporting.
SET XACT_ABORT ON;

BEGIN TRAN;

IF COL_LENGTH(N'hotel.RoomRate', N'LastModifiedAtUtc') IS NULL
    ALTER TABLE hotel.RoomRate ADD LastModifiedAtUtc datetime2(0) NOT NULL
        CONSTRAINT DF_RoomRate_LastModifiedAtUtc DEFAULT SYSUTCDATETIME();

IF COL_LENGTH(N'hotel.RoomRate', N'LastModifiedByObjectId') IS NULL
    ALTER TABLE hotel.RoomRate ADD LastModifiedByObjectId nvarchar(80) NULL;

IF COL_LENGTH(N'hotel.RoomRate', N'LastModifiedByDisplayName') IS NULL
    ALTER TABLE hotel.RoomRate ADD LastModifiedByDisplayName nvarchar(150) NULL;

IF EXISTS (
    SELECT 1 FROM hotel.RoomRate
    WHERE WeekdayPrice <> MondayPrice OR WeekendPrice <> FridayPrice
)
    THROW 51011, N'Không thể bật versioning: cột giá tương thích đang lệch với giá Thứ 2/Thứ 6.', 1;

IF OBJECT_ID(N'hotel.CK_RoomRate_LegacyDailyPriceSync', N'C') IS NULL
    ALTER TABLE hotel.RoomRate WITH CHECK ADD CONSTRAINT CK_RoomRate_LegacyDailyPriceSync
        CHECK (WeekdayPrice = MondayPrice AND WeekendPrice = FridayPrice);

IF EXISTS (
    SELECT 1
    FROM hotel.RoomRate leftRate
    JOIN hotel.RoomRate rightRate
      ON leftRate.RoomRateID < rightRate.RoomRateID
     AND leftRate.RoomTypeID = rightRate.RoomTypeID
     AND leftRate.RateCode = rightRate.RateCode
     AND leftRate.IsActive = 1
     AND rightRate.IsActive = 1
     AND leftRate.EffectiveFrom <= ISNULL(rightRate.EffectiveTo, CONVERT(date, '99991231'))
     AND rightRate.EffectiveFrom <= ISNULL(leftRate.EffectiveTo, CONVERT(date, '99991231'))
)
    THROW 51010, N'Không thể bật versioning: bảng giá hiện có khoảng thời gian chồng nhau.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'hotel.RoomRate')
      AND name = N'UX_RoomRate_Active_Start'
)
    CREATE UNIQUE INDEX UX_RoomRate_Active_Start
        ON hotel.RoomRate(RoomTypeID, RateCode, EffectiveFrom)
        WHERE IsActive = 1;

IF NOT EXISTS (SELECT 1 FROM sys.periods WHERE object_id = OBJECT_ID(N'hotel.RoomRate'))
BEGIN
    IF COL_LENGTH(N'hotel.RoomRate', N'ValidFromUtc') IS NULL
       AND COL_LENGTH(N'hotel.RoomRate', N'ValidToUtc') IS NULL
        EXEC(N'
            ALTER TABLE hotel.RoomRate ADD
                ValidFromUtc datetime2(7) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL
                    CONSTRAINT DF_RoomRate_ValidFromUtc DEFAULT SYSUTCDATETIME(),
                ValidToUtc datetime2(7) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL
                    CONSTRAINT DF_RoomRate_ValidToUtc DEFAULT CONVERT(datetime2(7), ''9999-12-31 23:59:59.9999999''),
                PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc);');
    ELSE IF COL_LENGTH(N'hotel.RoomRate', N'ValidFromUtc') IS NULL
        EXEC(N'
            ALTER TABLE hotel.RoomRate ADD
                ValidFromUtc datetime2(7) GENERATED ALWAYS AS ROW START HIDDEN NOT NULL
                    CONSTRAINT DF_RoomRate_ValidFromUtc DEFAULT SYSUTCDATETIME(),
                PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc);');
    ELSE IF COL_LENGTH(N'hotel.RoomRate', N'ValidToUtc') IS NULL
        EXEC(N'
            ALTER TABLE hotel.RoomRate ADD
                ValidToUtc datetime2(7) GENERATED ALWAYS AS ROW END HIDDEN NOT NULL
                    CONSTRAINT DF_RoomRate_ValidToUtc DEFAULT CONVERT(datetime2(7), ''9999-12-31 23:59:59.9999999''),
                PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc);');
    ELSE
        EXEC(N'ALTER TABLE hotel.RoomRate ADD PERIOD FOR SYSTEM_TIME (ValidFromUtc, ValidToUtc);');
END;

IF (SELECT temporal_type FROM sys.tables WHERE object_id = OBJECT_ID(N'hotel.RoomRate')) = 0
    ALTER TABLE hotel.RoomRate SET (
        SYSTEM_VERSIONING = ON (
            HISTORY_TABLE = hotel.RoomRateHistory,
            DATA_CONSISTENCY_CHECK = ON
        )
    );

COMMIT;
GO

CREATE OR ALTER TRIGGER hotel.TR_RoomRate_PreventOverlap
ON hotel.RoomRate
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Serialize writes per room type. This also closes the race between overlap checks.
    DECLARE @LockedRoomTypeCount int;
    SELECT @LockedRoomTypeCount = COUNT(*)
    FROM hotel.RoomType roomType WITH (UPDLOCK, HOLDLOCK)
    JOIN (SELECT DISTINCT RoomTypeID FROM inserted) changed
      ON changed.RoomTypeID = roomType.RoomTypeID;

    IF EXISTS (
        SELECT 1
        FROM inserted candidate
        JOIN hotel.RoomRate existing WITH (UPDLOCK, HOLDLOCK)
          ON existing.RoomRateID <> candidate.RoomRateID
         AND existing.RoomTypeID = candidate.RoomTypeID
         AND existing.RateCode = candidate.RateCode
         AND existing.IsActive = 1
         AND candidate.IsActive = 1
         AND existing.EffectiveFrom <= ISNULL(candidate.EffectiveTo, CONVERT(date, '99991231'))
         AND candidate.EffectiveFrom <= ISNULL(existing.EffectiveTo, CONVERT(date, '99991231'))
    )
        THROW 51010, N'Hạng phòng đã có mức giá trùng thời gian.', 1;
END;
GO

CREATE OR ALTER VIEW hotel.vwRoomRateVersionTimeline
AS
SELECT
    rate.RoomRateID,
    rate.RoomTypeID,
    roomType.Code AS RoomTypeCode,
    roomType.Name AS RoomTypeName,
    rate.RateCode,
    rate.EffectiveFrom,
    rate.EffectiveTo,
    rate.MondayPrice,
    rate.TuesdayPrice,
    rate.WednesdayPrice,
    rate.ThursdayPrice,
    rate.FridayPrice,
    rate.SaturdayPrice,
    rate.SundayPrice,
    rate.IsActive,
    rate.Note,
    rate.CreatedAt,
    rate.LastModifiedAtUtc,
    rate.LastModifiedByObjectId,
    rate.LastModifiedByDisplayName,
    rate.ValidFromUtc AS RecordedFromUtc,
    rate.ValidToUtc AS RecordedToUtc,
    CONVERT(bit, CASE WHEN rate.ValidToUtc = CONVERT(datetime2(7), '9999-12-31 23:59:59.9999999') THEN 1 ELSE 0 END) AS IsCurrentVersion
FROM hotel.RoomRate FOR SYSTEM_TIME ALL AS rate
JOIN hotel.RoomType roomType ON roomType.RoomTypeID = rate.RoomTypeID;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'hotel.RoomRateHistory')
      AND name = N'IX_RoomRateHistory_RoomRateID_ValidFromUtc'
)
    CREATE INDEX IX_RoomRateHistory_RoomRateID_ValidFromUtc
        ON hotel.RoomRateHistory(RoomRateID, ValidFromUtc DESC);
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
BEGIN
    GRANT SELECT ON hotel.RoomRateHistory TO hotel_app;
    GRANT SELECT ON hotel.vwRoomRateVersionTimeline TO hotel_app;
END;
GO
