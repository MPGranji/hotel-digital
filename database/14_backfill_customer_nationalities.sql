-- Backfill the nationality column for the historical A26 customer import.
-- Country names intentionally match the English labels stored by the web UI.
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

DECLARE @ForeignNationality TABLE (
    CustomerID bigint NOT NULL PRIMARY KEY,
    Nationality nvarchar(80) NOT NULL
);

INSERT @ForeignNationality(CustomerID, Nationality)
VALUES
    (3,N'South Korea'),(7,N'France'),(24,N'China'),(25,N'India'),(33,N'South Korea'),
    (41,N'South Korea'),(42,N'Japan'),(45,N'South Korea'),(47,N'Japan'),(55,N'Germany'),
    (65,N'France'),(78,N'Germany'),(91,N'South Korea'),(93,N'Greece'),(105,N'Japan'),
    (107,N'Hong Kong'),(108,N'Japan'),(116,N'Japan'),(126,N'Thailand'),(139,N'Singapore'),
    (149,N'United Kingdom'),(151,N'United Kingdom'),(153,N'Singapore'),(155,N'Japan'),
    (157,N'Bangladesh'),(158,N'Canada'),(175,N'Singapore'),(185,N'Japan'),
    (191,N'United Kingdom'),(194,N'Philippines'),(196,N'South Korea'),(198,N'India'),
    (200,N'South Korea'),(201,N'Saudi Arabia'),(208,N'South Korea'),(211,N'Singapore'),
    (216,N'United Kingdom'),(228,N'Malaysia'),(237,N'United Kingdom'),(239,N'Singapore'),
    (249,N'Singapore'),(255,N'China'),(266,N'United Kingdom'),(279,N'China'),(280,N'China'),
    (281,N'China'),(283,N'Taiwan'),(286,N'China'),(292,N'Taiwan'),(293,N'Uzbekistan'),
    (296,N'Japan'),(297,N'Australia'),(307,N'Australia'),(312,N'Japan'),
    (316,N'South Korea'),(324,N'Australia'),(326,N'South Korea'),(331,N'Philippines'),
    (340,N'Cambodia'),(361,N'Japan'),(373,N'Armenia'),(379,N'South Korea'),(382,N'China'),
    (390,N'United States'),(391,N'Australia'),(396,N'Philippines'),(406,N'Japan'),
    (412,N'India'),(418,N'Malaysia'),(422,N'Cambodia'),(426,N'China'),
    (427,N'South Korea'),(442,N'Japan'),(448,N'Australia'),(449,N'China'),(458,N'Taiwan'),
    (460,N'United States'),(465,N'Singapore'),(471,N'South Korea'),(481,N'India'),
    (487,N'Hungary'),(492,N'Japan'),(495,N'Bangladesh'),(499,N'Greece'),(513,N'India'),
    (515,N'Singapore'),(520,N'China'),(521,N'New Zealand'),(525,N'South Korea'),
    (526,N'South Korea'),(527,N'South Korea'),(528,N'United States'),(529,N'South Korea'),
    (530,N'South Korea'),(532,N'South Korea'),(534,N'China'),(536,N'South Korea'),
    (544,N'South Korea'),(549,N'China'),(550,N'China'),(552,N'China'),(553,N'China'),
    (556,N'South Korea'),(561,N'Japan'),(566,N'Thailand'),(581,N'Bangladesh'),
    (588,N'Indonesia'),(591,N'Malaysia'),(607,N'Australia'),(608,N'Australia'),
    (609,N'Australia'),(611,N'China'),(613,N'South Korea'),(620,N'Indonesia'),
    (628,N'China'),(638,N'China'),(639,N'Japan'),(641,N'South Korea'),(642,N'Italy'),
    (646,N'South Korea'),(647,N'South Korea'),(648,N'Japan'),(652,N'South Korea'),
    (654,N'South Korea'),(667,N'Australia'),(668,N'Australia'),(669,N'Australia'),
    (676,N'Australia'),(682,N'China'),(685,N'Spain'),(686,N'Japan'),(700,N'Myanmar'),
    (707,N'South Korea');

DECLARE @Changed TABLE (
    CustomerID bigint NOT NULL,
    Nationality nvarchar(80) NOT NULL
);

UPDATE customer
SET Nationality = COALESCE(foreignNationality.Nationality, N'Vietnam')
OUTPUT inserted.CustomerID, inserted.Nationality
INTO @Changed(CustomerID, Nationality)
FROM hotel.Customer AS customer
LEFT JOIN @ForeignNationality AS foreignNationality
    ON foreignNationality.CustomerID = customer.CustomerID
WHERE NULLIF(LTRIM(RTRIM(customer.Nationality)), N'') IS NULL
   OR LTRIM(RTRIM(customer.Nationality)) = N'Chưa xác định';

IF OBJECT_ID(N'hotel.AuditLog', N'U') IS NOT NULL
BEGIN
    DECLARE @CorrelationID nvarchar(100) = CONCAT(N'nationality-backfill-', CONVERT(nvarchar(36), NEWID()));

    INSERT hotel.AuditLog(
        ActorObjectID, ActorDisplayName, ActorEmail, ActorRole,
        Action, EntityType, EntityID, ChangesJson, CorrelationID)
    SELECT
        N'maintenance:nationality-backfill', N'Nationality backfill', NULL, N'System',
        'UPDATE', 'Customer', CONVERT(varchar(80), changed.CustomerID),
        N'{"fields":["Nationality"],"source":"nationality-backfill"}', @CorrelationID
    FROM @Changed AS changed;
END;

IF EXISTS (
    SELECT 1
    FROM hotel.Customer
    WHERE NULLIF(LTRIM(RTRIM(Nationality)), N'') IS NULL
       OR LTRIM(RTRIM(Nationality)) = N'Chưa xác định'
)
    THROW 51000, 'Nationality backfill left unresolved customers.', 1;

COMMIT TRANSACTION;
