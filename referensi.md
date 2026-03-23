Karena Anda sudah memiliki **GenieACS** yang berjalan, fokus utama Anda sekarang adalah membangun **Middleware** (jembatan data) dan **Frontend** (tampilan user).

Berikut adalah daftar persiapan teknis agar aplikasi monitoring WiFi Anda bisa berjalan dengan fitur Map animasi dan integrasi multi-vendor:

---

## 1. Kebutuhan Server (Backend)
Backend berfungsi menarik data dari GenieACS API (port 7557) dan mengolahnya sebelum dikirim ke dashboard.
* **Runtime:** Node.js (v18+) atau Python (FastAPI/Flask). Node.js sangat direkomendasikan karena bersifat *asynchronous*, cocok untuk menangani banyak perangkat ONT sekaligus.
* **Database (Sidecar):** PostgreSQL atau MongoDB.
    * *Penting:* GenieACS tidak menyimpan koordinat GPS ODP/Pelanggan. Anda butuh database ini untuk menyimpan data **Latitude/Longitude** setiap perangkat agar bisa muncul di Map.
* **Websocket (Socket.io):** Dibutuhkan agar dashboard bisa mengupdate status "Online/Offline" secara *real-time* tanpa perlu user menekan tombol refresh.

## 2. Kebutuhan Tampilan (Frontend)
Untuk menangani dashboard statistik dan peta yang kompleks.
* **Framework:** React.js, Vue.js, atau Next.js.
* **Library Peta (Map Engine):** * **Leaflet.js:** Paling ringan dan gratis.
    * **Leaflet Ant Path:** Plugin khusus untuk membuat **animasi kabel berjalan** (hijau/biru) yang Anda inginkan.
* **UI Kit:** Tailwind CSS atau Ant Design (untuk tabel ONT yang rapi dan ikon-ikon action).

## 3. Persiapan Data (Inventory & Koordinat)
Agar fitur Map (Nomor 3 di permintaan Anda) bisa berjalan, Anda harus menyiapkan data berikut dalam format Excel atau JSON untuk diimpor ke database aplikasi:
* **Data ODC & ODP:** Nama ODP, Koordinat (Lat, Long), dan ODC induknya.
* **Data Pelanggan:** Nama, Serial Number ONT (untuk sinkronisasi ke GenieACS), dan Koordinat lokasinya.
* **Relasi Jalur:** List yang menghubungkan `OLT -> ODC -> ODP -> Pelanggan`.

## 4. Konfigurasi GenieACS (NBI Access)
Pastikan API GenieACS Anda bisa diakses oleh aplikasi baru ini:
* **IP Whitelist:** Jika aplikasi berada di server berbeda, pastikan port `7557` terbuka untuk IP aplikasi tersebut.
* **Environment Variables:** Siapkan file `.env` di aplikasi Anda berisi:
    ```env
    GENIEACS_API_URL=http://your-genieacs-ip:7557
    GENIEACS_USER=admin_user
    GENIEACS_PASS=admin_password
    ```

## 5. Script Pendukung (Sudah kita bahas sebelumnya)
Pastikan **Virtual Parameters** yang saya buatkan sebelumnya sudah terpasang di GenieACS. Tanpa ini, aplikasi Anda akan kesulitan mengenali parameter redaman dari vendor yang berbeda (Huawei/ZTE/FH) dalam satu perintah API.

---

### Alur Kerja Pengembangan:
1.  **Minggu 1:** Buat API Backend untuk narik data dasar dari GenieACS.
2.  **Minggu 2:** Buat database koordinat ODP & Pelanggan.
3.  **Minggu 3:** Integrasi Leaflet.js untuk menampilkan titik-titik tersebut di peta.
4.  **Minggu 4:** Implementasi animasi kabel (Blue untuk backbone, Green untuk client).

**Bagaimana menurut Anda? Apakah Anda ingin saya buatkan struktur folder project awal (Boilerplate) menggunakan Node.js dan React untuk memulai?**