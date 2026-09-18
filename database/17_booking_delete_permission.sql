-- Allow the web application to delete eligible bookings.
-- BookingCommandService blocks deletion when a stay or financial history exists.
SET XACT_ABORT ON;
GO

IF DATABASE_PRINCIPAL_ID(N'hotel_app') IS NOT NULL
    GRANT DELETE ON hotel.Booking TO hotel_app;
GO
