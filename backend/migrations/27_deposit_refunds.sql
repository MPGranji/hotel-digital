-- Refunds are negative, immutable payment-ledger entries. Apply before enabling the refund action.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'hotel.Payment', N'U') IS NULL
    THROW 53027, 'Apply the payment-ledger migration before deposit refunds.', 1;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'hotel.Payment') AND name = N'CK_Payment_Amount')
    ALTER TABLE hotel.Payment DROP CONSTRAINT CK_Payment_Amount;
ALTER TABLE hotel.Payment WITH CHECK ADD CONSTRAINT CK_Payment_Amount CHECK (Amount <> 0);
IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
    DENY UPDATE, DELETE ON OBJECT::hotel.Payment TO hotel_app;
COMMIT TRANSACTION;
GO
