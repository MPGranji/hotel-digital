# Hạ tầng

- Frontend: Vercel, root directory `frontend`.
- Backend: Azure App Service chạy .NET 10.
- Database: Azure SQL `hotel-db`.
- Production database access: Managed Identity; không dùng SQL password trong source code.
- Monitoring: Vercel Logs và Azure Application Insights.

Infrastructure-as-code sẽ được thêm sau khi tên App Service, Entra App Registration và Power BI workspace được chốt.
