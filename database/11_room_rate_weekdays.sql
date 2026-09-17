-- Expand rate schedules from two price groups to a full Monday-Sunday week.
SET XACT_ABORT ON;

BEGIN TRAN;

IF COL_LENGTH(N'hotel.RoomRate', N'MondayPrice') IS NULL
    ALTER TABLE hotel.RoomRate ADD MondayPrice decimal(19,2) NULL;
IF COL_LENGTH(N'hotel.RoomRate', N'TuesdayPrice') IS NULL
    ALTER TABLE hotel.RoomRate ADD TuesdayPrice decimal(19,2) NULL;
IF COL_LENGTH(N'hotel.RoomRate', N'WednesdayPrice') IS NULL
    ALTER TABLE hotel.RoomRate ADD WednesdayPrice decimal(19,2) NULL;
IF COL_LENGTH(N'hotel.RoomRate', N'ThursdayPrice') IS NULL
    ALTER TABLE hotel.RoomRate ADD ThursdayPrice decimal(19,2) NULL;
IF COL_LENGTH(N'hotel.RoomRate', N'FridayPrice') IS NULL
    ALTER TABLE hotel.RoomRate ADD FridayPrice decimal(19,2) NULL;
IF COL_LENGTH(N'hotel.RoomRate', N'SaturdayPrice') IS NULL
    ALTER TABLE hotel.RoomRate ADD SaturdayPrice decimal(19,2) NULL;
IF COL_LENGTH(N'hotel.RoomRate', N'SundayPrice') IS NULL
    ALTER TABLE hotel.RoomRate ADD SundayPrice decimal(19,2) NULL;

-- Compile the data backfill only after SQL Server can resolve the newly added columns.
GO

UPDATE hotel.RoomRate
SET MondayPrice = COALESCE(MondayPrice, WeekdayPrice),
    TuesdayPrice = COALESCE(TuesdayPrice, WeekdayPrice),
    WednesdayPrice = COALESCE(WednesdayPrice, WeekdayPrice),
    ThursdayPrice = COALESCE(ThursdayPrice, WeekdayPrice),
    FridayPrice = COALESCE(FridayPrice, WeekendPrice),
    SaturdayPrice = COALESCE(SaturdayPrice, WeekendPrice),
    SundayPrice = COALESCE(SundayPrice, WeekendPrice)
WHERE MondayPrice IS NULL OR TuesdayPrice IS NULL OR WednesdayPrice IS NULL OR ThursdayPrice IS NULL
   OR FridayPrice IS NULL OR SaturdayPrice IS NULL OR SundayPrice IS NULL;

ALTER TABLE hotel.RoomRate ALTER COLUMN MondayPrice decimal(19,2) NOT NULL;
ALTER TABLE hotel.RoomRate ALTER COLUMN TuesdayPrice decimal(19,2) NOT NULL;
ALTER TABLE hotel.RoomRate ALTER COLUMN WednesdayPrice decimal(19,2) NOT NULL;
ALTER TABLE hotel.RoomRate ALTER COLUMN ThursdayPrice decimal(19,2) NOT NULL;
ALTER TABLE hotel.RoomRate ALTER COLUMN FridayPrice decimal(19,2) NOT NULL;
ALTER TABLE hotel.RoomRate ALTER COLUMN SaturdayPrice decimal(19,2) NOT NULL;
ALTER TABLE hotel.RoomRate ALTER COLUMN SundayPrice decimal(19,2) NOT NULL;

IF OBJECT_ID(N'hotel.CK_RoomRate_DailyPrices', N'C') IS NULL
    ALTER TABLE hotel.RoomRate ADD CONSTRAINT CK_RoomRate_DailyPrices CHECK (
        MondayPrice >= 0 AND TuesdayPrice >= 0 AND WednesdayPrice >= 0 AND ThursdayPrice >= 0
        AND FridayPrice >= 0 AND SaturdayPrice >= 0 AND SundayPrice >= 0
    );

COMMIT;
GO
