const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hotel-bookings-'));
process.env.HOTEL_DATABASE_PATH = path.join(temporaryDirectory, 'hotel.db');

const { app, database } = require('../server');

let server;
let baseUrl;
let checkIn;
let checkOut;

function futureDate(daysFromToday) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function bookingPayload(overrides = {}) {
  return {
    customerName: 'Abebe Mekonnen',
    phone: '+251911234567',
    email: 'abebe@example.com',
    roomType: 'Standard Room',
    floor: 'Second Floor',
    guests: 2,
    roomCount: 1,
    checkIn,
    checkOut,
    paymentMethod: 'Cash at hotel',
    specialRequests: 'Late arrival',
    ...overrides
  };
}

async function submitBooking(payload) {
  return fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

before(async function () {
  database.prepare(`
    UPDATE booking_room_types SET capacity = 3 WHERE room_type = 'Standard Room'
  `).run();
  const addRoom = database.prepare(`
    INSERT INTO rooms (room_number, room_type, floor, bed_capacity)
    VALUES (?, 'Standard Room', 'Second Floor', 2)
  `);
  ['201', '202', '203'].forEach((roomNumber) => addRoom.run(roomNumber));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  checkIn = futureDate(20);
  checkOut = futureDate(22);
});

after(async function () {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  database.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('booking rooms expose ETB nightly rates and inventory', async function () {
  const response = await fetch(`${baseUrl}/api/booking-rooms`);
  assert.equal(response.status, 200);
  const rooms = await response.json();
  const standardRoom = rooms.find((room) => room.roomType === 'Standard Room');

  assert.deepEqual(standardRoom, {
    roomType: 'Standard Room',
    nightlyRate: 1200,
    capacity: 3
  });
  assert.ok(rooms.some((room) => room.roomType === 'Family Room'));
});

test('room booking saves a server-priced reservation and rejects overlapping full inventory', async function () {
  const response = await submitBooking(bookingPayload({ roomCount: 2, totalPrice: 1 }));
  assert.equal(response.status, 201);
  const booking = await response.json();
  assert.equal(booking.status, 'pending');
  assert.match(booking.bookingReference, /^AGH-/);
  assert.equal(booking.nights, 2);
  assert.equal(booking.roomCount, 2);
  assert.equal(booking.nightlyRate, 1200);
  assert.equal(booking.totalPrice, 4800);
  assert.equal(booking.roomType, 'Standard Room');

  const unavailable = await submitBooking(bookingPayload({ roomCount: 2 }));
  assert.equal(unavailable.status, 409);
  assert.match((await unavailable.json()).error, /unavailable/i);

  const availability = await fetch(
    `${baseUrl}/api/booking-availability?roomType=Standard%20Room&checkIn=${checkIn}&checkOut=${checkOut}&roomCount=2`
  );
  assert.equal(availability.status, 200);
  assert.deepEqual(await availability.json(), {
    roomType: 'Standard Room',
    available: false,
    availableRooms: 1,
    requestedRooms: 2,
    nightlyRate: 1200,
    nights: 2
  });

  const statusResponse = await fetch(`${baseUrl}/api/bookings/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingReference: booking.bookingReference,
      phone: '+251911234567'
    })
  });
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.json()).status, 'pending');
});

test('bookings validate room type, date range, and guest count', async function () {
  const invalidRoom = await submitBooking(bookingPayload({ roomType: 'Penthouse' }));
  assert.equal(invalidRoom.status, 400);
  assert.match((await invalidRoom.json()).error, /room type/i);

  const invalidDates = await submitBooking(bookingPayload({ checkOut: checkIn }));
  assert.equal(invalidDates.status, 400);
  assert.match((await invalidDates.json()).error, /dates/i);

  const invalidGuests = await submitBooking(bookingPayload({ guests: 0 }));
  assert.equal(invalidGuests.status, 400);
  assert.match((await invalidGuests.json()).error, /guests/i);
});

test('date-adjacent bookings do not block each other', async function () {
  const adjacentBooking = await submitBooking(bookingPayload({
    checkIn: checkOut,
    checkOut: futureDate(24)
  }));
  assert.equal(adjacentBooking.status, 201);
});
