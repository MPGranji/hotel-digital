-- Room maintenance periods used by availability checks and the room matrix.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'hotel.RoomBlock', N'U') IS NULL
BEGIN
    CREATE TABLE hotel.RoomBlock (
        RoomBlockID bigint IDENTITY CONSTRAINT PK_RoomBlock PRIMARY KEY,
        RoomID int NOT NULL CONSTRAINT FK_RoomBlock_Room REFERENCES hotel.Room(RoomID),
        StartAt datetime2(0) NOT NULL,
        EndAt datetime2(0) NOT NULL,
        Reason nvarchar(120) NOT NULL,
        Note nvarchar(500) NULL,
        IsActive bit NOT NULL CONSTRAINT DF_RoomBlock_IsActive DEFAULT 1,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_RoomBlock_CreatedAt DEFAULT SYSUTCDATETIME(),
        Version rowversion NOT NULL,
        CONSTRAINT CK_RoomBlock_Dates CHECK (EndAt > StartAt)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'hotel.RoomBlock') AND name = N'IX_RoomBlock_RoomCalendar')
    CREATE INDEX IX_RoomBlock_RoomCalendar ON hotel.RoomBlock(RoomID,StartAt,EndAt) INCLUDE (IsActive,Reason);
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
    GRANT SELECT,INSERT,UPDATE ON hotel.RoomBlock TO hotel_app;
GO

CREATE OR ALTER TRIGGER hotel.TR_Booking_PreventRoomBlockOverlap
ON hotel.Booking
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted booking
        JOIN hotel.RoomBlock roomBlock ON roomBlock.RoomID = booking.RoomID
            AND roomBlock.IsActive = 1
            AND roomBlock.StartAt < booking.CheckOutAt
            AND roomBlock.EndAt > booking.CheckInAt
        WHERE booking.Status NOT IN ('CANCELLED','NO_SHOW')
    )
        THROW 51004, N'Phòng có lịch bảo trì trong khoảng thời gian booking.', 1;
END;
GO

CREATE OR ALTER TRIGGER hotel.TR_RoomBlock_PreventOverlap
ON hotel.RoomBlock
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted roomBlock
        JOIN hotel.Booking booking ON booking.RoomID = roomBlock.RoomID
            AND booking.Status NOT IN ('CANCELLED','NO_SHOW')
            AND booking.CheckInAt < roomBlock.EndAt
            AND booking.CheckOutAt > roomBlock.StartAt
        WHERE roomBlock.IsActive = 1
    )
        THROW 51005, N'Phòng đã có booking trong khoảng thời gian bảo trì.', 1;

    IF EXISTS (
        SELECT 1
        FROM inserted roomBlock
        JOIN hotel.RoomBlock existingBlock ON existingBlock.RoomID = roomBlock.RoomID
            AND existingBlock.RoomBlockID <> roomBlock.RoomBlockID
            AND existingBlock.IsActive = 1
            AND existingBlock.StartAt < roomBlock.EndAt
            AND existingBlock.EndAt > roomBlock.StartAt
        WHERE roomBlock.IsActive = 1
    )
        THROW 51006, N'Phòng đã có lịch bảo trì trong khoảng thời gian này.', 1;
END;
GO
