# Features

Mỗi module đặt endpoint, contract, validation và service gần nhau:

```text
Features/
├── Dashboard/
├── Bookings/
├── Rooms/
├── Customers/
├── Channels/
├── Imports/
└── PowerBi/
```

Chỉ tạo folder khi bắt đầu triển khai feature để tránh file và abstraction rỗng. DbContext database-first dùng chung nằm trong `Data`.
