-- Default walk-in/front-desk booking channel.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM hotel.Channel WHERE Code = 'OFFLINE')
BEGIN
    INSERT INTO hotel.Channel (Code,Name,Category,CommissionRate,IsActive,Note)
    VALUES ('OFFLINE',N'Tại quầy','OFFLINE',0,1,N'Kênh mặc định cho khách đặt trực tiếp tại khách sạn.');
END
ELSE
BEGIN
    UPDATE hotel.Channel
    SET Name = N'Tại quầy',
        IsActive = 1,
        Category = 'OFFLINE'
    WHERE Code = 'OFFLINE';
END;
GO
