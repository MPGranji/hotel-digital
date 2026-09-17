-- Room rate schedules are for counter/direct sales only.
SET XACT_ABORT ON;

BEGIN TRAN;

DELETE FROM hotel.RoomRate WHERE RateCode <> 'NET';

IF OBJECT_ID(N'hotel.CK_RoomRate_Code', N'C') IS NOT NULL
    ALTER TABLE hotel.RoomRate DROP CONSTRAINT CK_RoomRate_Code;

ALTER TABLE hotel.RoomRate ADD CONSTRAINT CK_RoomRate_Code CHECK (RateCode = 'NET');

COMMIT;
GO
