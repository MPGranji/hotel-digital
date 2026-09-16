# Features

Mỗi module đặt endpoint, contract, validation và service gần nhau:

```text
Features/
├── Bookings/
├── Rooms/
├── Customers/
└── Channels/
```

Chỉ tạo folder khi bắt đầu triển khai feature để tránh file và abstraction rỗng. DbContext database-first dùng chung nằm trong `Data`.

Dashboard, Excel import/export và Power BI được triển khai ở giai đoạn sau khi các feature vận hành ổn định.
