# Aderavanta Grand Hotel

The existing hotel website is served by an Express backend with SQLite-backed room inventory, reservations, restaurant orders, payments, and administrator tools.

## Requirements

- Node.js 22.5 or later (the project uses Node's built-in `node:sqlite` module)
- npm

## Install and run locally

1. Open a terminal in this project folder.
2. Install the existing dependencies:

   ```powershell
   npm install
   ```

3. Optionally copy `.env.example` to `.env` and set `PORT` or `HOTEL_DATABASE_PATH`.
4. Start the website and REST API:

   ```powershell
   npm start
   ```

5. Open `http://localhost:3000`. The management dashboard is at `http://localhost:3000/admin`.
6. On the first visit to `/admin`, create the initial administrator with a unique username and a strong password of at least 12 characters. Passwords are stored as salted scrypt hashes.
7. In **Rooms**, enter the hotel's actual room numbers, types, floors, and bed capacities before accepting reservations. Availability is derived only from these active database records and existing overlapping reservations; no example rooms are seeded.

The database is stored in `hotel.db` unless `HOTEL_DATABASE_PATH` is set. Back up this file regularly. Do not expose the database file or `.env` over a public web server.

## Booking and payment behavior

Room bookings are saved as **pending** requests and consume inventory until rejected or cancelled. Guests can check status using the booking reference and phone number used on the reservation. The administrator confirms or rejects requests.

Payment selection records a preference only. No payment gateway is connected. Payment records start as **pending** and can be verified by an administrator only after an off-site/manual payment check. The site does not claim that a customer has paid.

Restaurant orders are independent of room reservations, use prices stored in the database, and receive a separate order reference. Menu images may use existing local images or be uploaded as JPEG, PNG, or WebP (up to 2 MB).

## Tests

Run the API and validation tests with:

```powershell
npm test
```
