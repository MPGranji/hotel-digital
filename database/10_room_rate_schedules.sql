-- Editable counter room rates by effective date range.
SET XACT_ABORT ON;

BEGIN TRAN;

IF OBJECT_ID(N'hotel.RoomRate', N'U') IS NULL
BEGIN
    CREATE TABLE hotel.RoomRate (
        RoomRateID bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_RoomRate PRIMARY KEY,
        RoomTypeID int NOT NULL,
        RateCode varchar(20) NOT NULL,
        EffectiveFrom date NOT NULL,
        EffectiveTo date NULL,
        WeekdayPrice decimal(19,2) NOT NULL,
        WeekendPrice decimal(19,2) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_RoomRate_IsActive DEFAULT (1),
        Note nvarchar(300) NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_RoomRate_CreatedAt DEFAULT SYSUTCDATETIME(),
        Version rowversion NOT NULL,
        CONSTRAINT FK_RoomRate_RoomType FOREIGN KEY (RoomTypeID) REFERENCES hotel.RoomType(RoomTypeID),
        CONSTRAINT CK_RoomRate_Period CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
        CONSTRAINT CK_RoomRate_Prices CHECK (WeekdayPrice >= 0 AND WeekendPrice >= 0),
        CONSTRAINT CK_RoomRate_Code CHECK (RateCode = 'NET')
    );

    CREATE INDEX IX_RoomRate_RoomType_Code_Period
        ON hotel.RoomRate(RoomTypeID, RateCode, EffectiveFrom, EffectiveTo)
        INCLUDE (WeekdayPrice, WeekendPrice, IsActive);
END;

DECLARE @Rates TABLE (
    RoomTypeCode varchar(30) NOT NULL,
    RateCode varchar(20) NOT NULL,
    WeekdayPrice decimal(19,2) NOT NULL,
    WeekendPrice decimal(19,2) NOT NULL
);

INSERT @Rates(RoomTypeCode,RateCode,WeekdayPrice,WeekendPrice) VALUES
    ('STD-PNL','NET',900000,1100000),
    ('SUP-PNL','NET',1000000,1200000),
    ('DELUXE-PNL','NET',1400000,1600000),
    ('SUP-Q-PNL','NET',1500000,1700000);

INSERT hotel.RoomRate(RoomTypeID,RateCode,EffectiveFrom,EffectiveTo,WeekdayPrice,WeekendPrice,IsActive,Note)
SELECT roomType.RoomTypeID,rates.RateCode,CONVERT(date,'20000101'),NULL,rates.WeekdayPrice,rates.WeekendPrice,1,
       N'Khởi tạo từ bảng giá A26 Phạm Ngũ Lão.'
FROM @Rates rates
JOIN hotel.RoomType roomType ON roomType.Code = rates.RoomTypeCode
WHERE NOT EXISTS (
    SELECT 1 FROM hotel.RoomRate existing
    WHERE existing.RoomTypeID = roomType.RoomTypeID
      AND existing.RateCode = rates.RateCode
      AND existing.EffectiveFrom = CONVERT(date,'20000101')
);

COMMIT;
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
    GRANT SELECT,INSERT,UPDATE ON hotel.RoomRate TO hotel_app;
GO
