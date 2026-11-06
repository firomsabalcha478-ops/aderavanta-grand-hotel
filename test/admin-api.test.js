const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hotel-admin-'));
process.env.HOTEL_DATABASE_PATH = path.join(temporaryDirectory, 'hotel.db');
process.env.HOTEL_UPLOAD_DIRECTORY = path.join(temporaryDirectory, 'uploads');
delete process.env.ADMIN_API_TOKEN;
delete process.env.ADMIN_KEY;

const { app, database } = require('../server');

let server;
let baseUrl;
let sessionCookie;
let booking;
const adminPassword = 'strong-test-password-123';

async function request(url, options = {}, cookie = sessionCookie) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
  const result = response.status === 204 ? null : await response.json();
  return { response, result };
}

before(async function () {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async function () {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  database.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('administrator setup hashes passwords and protects management routes', async function () {
  const status = await request('/api/admin/status', {}, '');
  assert.equal(status.result.setupRequired, true);

  const protectedResponse = await request('/api/admin/rooms', {}, '');
  assert.equal(protectedResponse.response.status, 401);

  const weakPassword = await request('/api/admin/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'short' })
  }, '');
  assert.equal(weakPassword.response.status, 400);

  const setup = await request('/api/admin/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'hotel-admin', password: adminPassword })
  }, '');
  assert.equal(setup.response.status, 201);
  sessionCookie = setup.response.headers.get('set-cookie').split(';', 1)[0];
  assert.equal(database.prepare('SELECT username FROM administrators').get().username, 'hotel-admin');
  const savedHash = database.prepare('SELECT password_hash FROM administrators').get().password_hash;
  assert.notEqual(savedHash, 'strong-test-password-123');
  assert.match(savedHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
});

test('administrator can sign in with the stored hash and upload safe menu images', async function () {
  const invalidLogin = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'hotel-admin', password: 'wrong-password-123' })
  }, '');
  assert.equal(invalidLogin.response.status, 401);

  const login = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'hotel-admin', password: adminPassword })
  }, '');
  assert.equal(login.response.status, 200);
  sessionCookie = login.response.headers.get('set-cookie').split(';', 1)[0];

  const upload = await request('/api/admin/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pKcAAAAASUVORK5CYII='
    })
  });
  assert.equal(upload.response.status, 201);
  assert.ok(fs.existsSync(path.join(process.env.HOTEL_UPLOAD_DIRECTORY, path.basename(upload.result.image))));

  const unsafeUpload = await request('/api/admin/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: 'data:image/svg+xml;base64,PHN2Zy8+' })
  });
  assert.equal(unsafeUpload.response.status, 400);
});

test('guest reviews are moderated before publication and moderation requires an administrator', async function () {
  const invalid = await request('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestName: 'Hana Bekele', rating: 6, reviewText: 'A pleasant stay.' })
  }, '');
  assert.equal(invalid.response.status, 400);

  const submit = await request('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guestName: 'Hana Bekele',
      rating: 5,
      reviewText: 'The room was comfortable and the team was welcoming.'
    })
  }, '');
  assert.equal(submit.response.status, 201);
  assert.equal(submit.result.status, 'pending');

  const publicBeforeModeration = await request('/api/reviews', {}, '');
  assert.equal(publicBeforeModeration.result.reviewCount, 0);
  assert.equal(publicBeforeModeration.result.reviews.length, 0);

  const protectedList = await request('/api/admin/reviews', {}, '');
  assert.equal(protectedList.response.status, 401);

  const pendingList = await request('/api/admin/reviews?status=pending');
  assert.equal(pendingList.response.status, 200);
  assert.equal(pendingList.result[0].id, submit.result.id);

  const approve = await request(`/api/admin/reviews/${submit.result.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'approved' })
  });
  assert.equal(approve.response.status, 200);

  const publicAfterModeration = await request('/api/reviews', {}, '');
  assert.equal(publicAfterModeration.result.reviewCount, 1);
  assert.equal(publicAfterModeration.result.averageRating, 5);
  assert.equal(publicAfterModeration.result.reviews[0].guestName, 'Hana Bekele');
});

test('room inventory is real, floor-aware, and prevents overlapping bookings', async function () {
  const addRoom = await request('/api/admin/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomNumber: '401',
      roomType: 'Standard Room',
      floor: 'Fourth Floor',
      bedCapacity: 2
    })
  });
  assert.equal(addRoom.response.status, 201);

  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 40);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);
  const dates = {
    checkIn: checkIn.toISOString().slice(0, 10),
    checkOut: checkOut.toISOString().slice(0, 10)
  };
  const noInventory = await request(
    `/api/booking-availability?roomType=Standard%20Room&checkIn=${dates.checkIn}&checkOut=${dates.checkOut}&roomCount=1`,
    {},
    ''
  );
  assert.equal(noInventory.result.available, true);
  assert.equal(noInventory.result.availableRooms, 1);

  const save = await request('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Hana Bekele',
      phone: '+251911111111',
      email: 'hana@example.com',
      roomType: 'Standard Room',
      floor: 'Fourth Floor',
      guests: 2,
      roomCount: 1,
      ...dates,
      paymentMethod: 'Telebirr',
      specialRequests: ''
    })
  }, '');
  assert.equal(save.response.status, 201);
  booking = save.result;
  assert.equal(booking.status, 'pending');
  assert.equal(booking.nights, 2);
  assert.equal(booking.totalPrice, 2400);
  assert.match(booking.bookingReference, /^AGH-/);

  const unavailable = await request(
    `/api/booking-availability?roomType=Standard%20Room&checkIn=${dates.checkIn}&checkOut=${dates.checkOut}&roomCount=1&floor=Fourth%20Floor`,
    {},
    ''
  );
  assert.equal(unavailable.result.available, false);
  assert.equal(unavailable.result.availableRooms, 0);

  const matchingStatus = await request('/api/bookings/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingReference: booking.bookingReference, phone: '+251911111111' })
  }, '');
  assert.equal(matchingStatus.result.status, 'pending');

  const wrongPhone = await request('/api/bookings/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingReference: booking.bookingReference, phone: '+251922222222' })
  }, '');
  assert.equal(wrongPhone.response.status, 404);
});

test('admin can manage bookings, verify payments, and report only verified revenue', async function () {
  const list = await request('/api/admin/bookings?search=Hana');
  assert.equal(list.response.status, 200);
  assert.equal(list.result[0].bookingReference, booking.bookingReference);

  const confirm = await request(`/api/admin/bookings/${booking.bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'confirmed' })
  });
  assert.equal(confirm.response.status, 200);

  const paymentId = list.result[0].paymentId;
  const verified = await request(`/api/admin/payments/${paymentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'verified' })
  });
  assert.equal(verified.response.status, 200);

  const summary = await request('/api/admin/summary');
  assert.equal(summary.result.confirmedBookings, 1);
  assert.equal(summary.result.revenue, 2400);

  const rooms = await request('/api/admin/rooms');
  assert.equal(rooms.result[0].occupancy, 'available');
});

test('restaurant orders are separately numbered and manageable', async function () {
  const foods = await request('/api/food', {}, '');
  const drinks = await request('/api/drinks', {}, '');
  const food = foods.result[0];
  const drink = drinks.result[0];
  const orderResponse = await request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Hana Bekele',
      phone: '+251911111111',
      serviceType: 'dine-in',
      tableNumber: 8,
      items: [
        { foodId: food.id, quantity: 1 },
        { foodId: drink.id, quantity: 2 }
      ]
    })
  }, '');
  assert.equal(orderResponse.response.status, 201);
  assert.match(orderResponse.result.orderNumber, /^ORD-/);
  assert.equal(
    orderResponse.result.totalPrice,
    food.price + drink.price * 2
  );

  const adminOrders = await request('/api/admin/orders');
  const saved = adminOrders.result.find((order) => order.orderNumber === orderResponse.result.orderNumber);
  assert.ok(saved);
  assert.equal(saved.items.length, 2);
  const updated = await request(`/api/admin/orders/${saved.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'preparing' })
  });
  assert.equal(updated.result.status, 'preparing');
});
