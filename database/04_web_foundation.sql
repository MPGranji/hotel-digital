-- Apply after the existing database/01_schema.sql and database/02_rules_and_views.sql scripts.
-- This migration adds identity-aware audit storage required by the web MVP.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'hotel.AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE hotel.AuditLog (
        AuditLogID bigint IDENTITY CONSTRAINT PK_AuditLog PRIMARY KEY,
        OccurredAtUtc datetime2(0) NOT NULL CONSTRAINT DF_AuditLog_OccurredAtUtc DEFAULT SYSUTCDATETIME(),
        ActorObjectID nvarchar(80) NOT NULL,
        ActorDisplayName nvarchar(150) NULL,
        ActorEmail nvarchar(254) NULL,
        ActorRole nvarchar(100) NULL,
        Action varchar(30) NOT NULL,
        EntityType varchar(60) NOT NULL,
        EntityID varchar(80) NOT NULL,
        ChangesJson nvarchar(max) NOT NULL,
        CorrelationID nvarchar(100) NOT NULL,
        CONSTRAINT CK_AuditLog_ChangesJson CHECK (ISJSON(ChangesJson) = 1)
    );

    CREATE INDEX IX_AuditLog_OccurredAtUtc ON hotel.AuditLog(OccurredAtUtc DESC);
    CREATE INDEX IX_AuditLog_Actor ON hotel.AuditLog(ActorObjectID,OccurredAtUtc DESC);
    CREATE INDEX IX_AuditLog_Entity ON hotel.AuditLog(EntityType,EntityID,OccurredAtUtc DESC);
END;
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
BEGIN
    GRANT SELECT,INSERT,UPDATE ON hotel.Channel TO hotel_app;
    GRANT SELECT,INSERT ON hotel.AuditLog TO hotel_app;
    DENY UPDATE,DELETE ON hotel.AuditLog TO hotel_app;
END;
GO
