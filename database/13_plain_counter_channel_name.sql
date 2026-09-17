-- Keep the user-facing channel name plain and free of technical terms.
UPDATE hotel.Channel
SET Name = N'Tại quầy'
WHERE Code = 'OFFLINE';
GO
