# Hệ Thống Gọi Món Qua Mã QR (Single Store)

## 1. Tổng quan hệ thống

Hệ thống cho phép khách hàng tại cửa hàng quét mã QR tại bàn để xem menu và đặt món. Hệ thống quản lý trạng thái bàn theo thời gian thực (Session-based) để gộp đơn hoặc khởi tạo đơn mới.

---

## 2. Luồng nghiệp vụ chính (Core Logic)

1. **Quét QR:** Khách quét QR (URL chứa `table_id`).
2. **Check-in:**
   - Nếu bàn đang **Trống (Inactive):** Hệ thống tạo một Order mới, gán vào bàn và đổi trạng thái bàn sang `Active`.
   - Nếu bàn đang **Hoạt động (Active):** Hệ thống lấy Order hiện tại của bàn đó để khách đặt thêm món.
3. **Gọi món:** Khách chọn món → Gửi đơn → CMS nhận thông báo Real-time → Bếp xử lý.
4. **Thanh toán:** Admin bấm thanh toán trên CMS → Hóa đơn đóng → Bàn chuyển về trạng thái **Trống (Inactive)**.

---

## 3. Cấu trúc Cơ sở dữ liệu (Database Schema)

Hệ thống sử dụng quan hệ (Relational Database) để đảm bảo tính nhất quán.

### 3.1. Bảng `tables` (Quản lý bàn)

| Column           | Type          | Description                                       |
| ---------------- | ------------- | ------------------------------------------------- |
| id               | UUID/Int (PK) | Định danh duy nhất của bàn                        |
| table_number     | String        | Tên/Số bàn (Ví dụ: Bàn 01, VIP 02)                |
| status           | Boolean       | `false`: Trống, `true`: Đang hoạt động            |
| current_order_id | UUID (FK)     | ID của đơn hàng hiện tại đang phục vụ tại bàn này |

### 3.2. Bảng `categories` (Danh mục)

| Column   | Type     | Description                                   |
| -------- | -------- | --------------------------------------------- |
| id       | Int (PK) |                                               |
| name     | String   | Tên danh mục (Khai vị, Món chính, Đồ uống...) |
| priority | Int      | Thứ tự hiển thị trên menu                     |

### 3.3. Bảng `products` (Món ăn)

| Column       | Type     | Description           |
| ------------ | -------- | --------------------- |
| id           | Int (PK) |                       |
| category_id  | Int (FK) | Thuộc danh mục nào    |
| name         | String   | Tên món               |
| price        | Decimal  | Giá bán hiện tại      |
| image_url    | String   | Link ảnh món ăn       |
| is_available | Boolean  | Còn hàng hay hết hàng |

### 3.4. Bảng `orders` (Hóa đơn)

| Column      | Type      | Description                                                      |
| ----------- | --------- | ---------------------------------------------------------------- |
| id          | UUID (PK) |                                                                  |
| table_id    | Int (FK)  | Bàn thực hiện đơn                                                |
| total_price | Decimal   | Tổng tiền (Sum of order_items)                                   |
| status      | Enum      | `pending` (đang gọi), `completed` (xong), `paid` (đã thanh toán) |
| created_at  | Timestamp | Thời điểm mở bàn                                                 |

### 3.5. Bảng `order_items` (Chi tiết món)

| Column        | Type      | Description                            |
| ------------- | --------- | -------------------------------------- |
| id            | Int (PK)  |                                        |
| order_id      | UUID (FK) | Thuộc hóa đơn nào                      |
| product_id    | Int (FK)  | Món ăn nào                             |
| quantity      | Int       | Số lượng đặt                           |
| price_at_time | Decimal   | Giá tại thời điểm đặt (để làm báo cáo) |
| note          | String    | Ghi chú của khách (ít hành, cay...)    |

---

## 4. Danh sách API cần thiết (Endpoints)

### Client Side (Khách hàng)

| Method | Endpoint             | Description                                        |
| ------ | -------------------- | -------------------------------------------------- |
| GET    | `/tables/:id`        | Lấy thông tin bàn và kiểm tra trạng thái (Scan QR) |
| POST   | `/tables/check-in`   | Khởi tạo đơn mới nếu bàn trống                     |
| GET    | `/menu`              | Lấy danh sách danh mục và món ăn                   |
| POST   | `/orders/add-item`   | Thêm món vào đơn hiện tại                          |
| POST   | `/tables/call-staff` | Gửi thông báo gọi nhân viên                        |

### Admin Side (CMS)

| Method | Endpoint             | Description                                    |
| ------ | -------------------- | ---------------------------------------------- |
| GET    | `/orders/active`     | Lấy danh sách các bàn đang có khách            |
| PATCH  | `/orders/:id/status` | Cập nhật trạng thái món (Đang nấu/Đã phục vụ)  |
| POST   | `/orders/:id/pay`    | Xác nhận thanh toán (Đóng đơn, giải phóng bàn) |
| CRUD   | `/products`          | Thêm/Xóa/Sửa món ăn và giá                     |

---

## 5. Yêu cầu kỹ thuật đặc biệt cho AI Code

| Yêu cầu         | Chi tiết                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Concurrency** | Khi thực hiện check-in tại bàn, hãy sử dụng Database Transaction để tránh việc 2 người cùng quét một lúc tạo ra 2 đơn hàng trùng lặp. |
| **Real-time**   | Sử dụng WebSockets (Socket.io hoặc SignalR) để đẩy thông báo `new_order` từ Client lên CMS ngay lập tức.                              |
| **Frontend**    | UI cho khách hàng phải tối ưu cho Mobile (Responsive), load nhanh.                                                                    |
| **Validation**  | Giá của `order_items` phải được lấy từ server tại thời điểm đặt món, không được tin cậy giá gửi lên từ Client.                        |
