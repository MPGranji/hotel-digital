-- Listed prices use the NET weekday rates from
-- BẢNG GIÁ - A26 Hotel.xlsx, sheet "Giá bán", rows 65-68.
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @Prices TABLE (
    Code varchar(30) PRIMARY KEY,
    ListedPricePerNight decimal(19,2) NOT NULL
);

INSERT @Prices(Code,ListedPricePerNight) VALUES
    ('STD-PNL',900000),
    ('SUP-PNL',1000000),
    ('DELUXE-PNL',1400000),
    ('SUP-Q-PNL',1500000);

IF EXISTS (
    SELECT 1
    FROM @Prices prices
    WHERE NOT EXISTS (SELECT 1 FROM hotel.RoomType roomType WHERE roomType.Code = prices.Code)
)
    THROW 51004, N'Thiếu hạng phòng Phạm Ngũ Lão cần cập nhật giá.', 1;

UPDATE roomType
SET ListedPricePerNight = prices.ListedPricePerNight
FROM hotel.RoomType roomType
JOIN @Prices prices ON prices.Code = roomType.Code;

COMMIT;
