const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const roomTypes = [
  ['Standard Room', 1200, 2],
  ['Deluxe Room', 1800, 3],
  ['VIP Suite', 3500, 2],
  ['Suite', 3000, 2],
  ['Twin Room', 2200, 2],
  ['Family Room', 3200, 6],
  ['Shared Bed Space', 500, 1]
];
const floors = ['First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'];
const paymentMethods = [
  'Cash at hotel', 'Telebirr', 'CBE Birr', 'Bank transfer', 'Card', 'PayPal'
];
const bookingStatuses = ['pending', 'confirmed', 'rejected', 'cancelled'];
const orderStatuses = ['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled', 'rejected'];
const sessions = new Map();
const loginFailures = new Map();
const sessionLifetime = 8 * 60 * 60 * 1000;

function createHotelSystem(database) {
  const router = express.Router();

  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS administrators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS customers_phone ON customers(phone);
    CREATE TABLE IF NOT EXISTS room_types (
      name TEXT PRIMARY KEY,
      nightly_rate INTEGER NOT NULL CHECK (nightly_rate > 0),
      max_guests INTEGER NOT NULL CHECK (max_guests > 0)
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL UNIQUE,
      room_type TEXT NOT NULL REFERENCES room_types(name),
      floor TEXT NOT NULL CHECK (floor IN ('First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor')),
      bed_capacity INTEGER NOT NULL CHECK (bed_capacity > 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_reference TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      room_type TEXT NOT NULL REFERENCES room_types(name),
      preferred_floor TEXT CHECK (preferred_floor IN ('First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor')),
      guests INTEGER NOT NULL CHECK (guests > 0),
      room_count INTEGER NOT NULL CHECK (room_count > 0),
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      nights INTEGER NOT NULL CHECK (nights > 0),
      nightly_rate INTEGER NOT NULL CHECK (nightly_rate > 0),
      total_price INTEGER NOT NULL CHECK (total_price > 0),
      payment_preference TEXT NOT NULL,
      special_requests TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS bookings_dates
      ON bookings(room_type, check_in, check_out, status);
    CREATE TABLE IF NOT EXISTS booking_room_assignments (
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      units INTEGER NOT NULL CHECK (units > 0),
      PRIMARY KEY (booking_id, room_id)
    );
    CREATE TABLE IF NOT EXISTS food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL CHECK (price > 0),
      image TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS drink_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL CHECK (price > 0),
      image TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS restaurant_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      service_type TEXT NOT NULL CHECK (service_type IN ('dine-in', 'takeaway', 'room-service')),
      table_number INTEGER,
      room_number TEXT,
      total_price INTEGER NOT NULL CHECK (total_price > 0),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS restaurant_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
      food_item_id INTEGER REFERENCES food_items(id),
      drink_item_id INTEGER REFERENCES drink_items(id),
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price INTEGER NOT NULL CHECK (unit_price > 0),
      line_total INTEGER NOT NULL CHECK (line_total > 0),
      CHECK ((food_item_id IS NOT NULL AND drink_item_id IS NULL) OR
             (food_item_id IS NULL AND drink_item_id IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      payment_method TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'verified', 'rejected')),
      verified_by INTEGER REFERENCES administrators(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS guest_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS guest_reviews_status_created
      ON guest_reviews(status, created_at DESC);
  `);

  for (const table of ['food_items', 'drink_items']) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((column) => column.name === 'tags')) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
    }
  }

  const insertRoomType = database.prepare(
    'INSERT OR IGNORE INTO room_types (name, nightly_rate, max_guests) VALUES (?, ?, ?)'
  );
  roomTypes.forEach((type) => insertRoomType.run(...type));

  const legacyFoods = database.prepare(`
    SELECT category, COALESCE(display_name, name) AS name,
      description, price_etb, image_path, is_drink, tags
    FROM food_menu WHERE image_path IS NOT NULL
  `).all();
  const insertFood = database.prepare(`
    INSERT OR IGNORE INTO food_items (category, name, description, price, image, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertDrink = database.prepare(`
    INSERT OR IGNORE INTO drink_items (category, name, description, price, image, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const item of legacyFoods) {
    const target = item.is_drink ? insertDrink : insertFood;
    target.run(
      item.category,
      item.name,
      item.description || '',
      item.price_etb,
      item.image_path,
      item.tags || '[]'
    );
  }

  function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  function verifyPassword(password, storedHash) {
    const [salt, expectedHex] = storedHash.split(':');
    if (!salt || !/^[a-f0-9]{128}$/i.test(expectedHex || '')) {
      return false;
    }
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return crypto.timingSafeEqual(actual, expected);
  }

  function cookieValue(req, name) {
    const cookies = (req.headers.cookie || '').split(';');
    for (const cookie of cookies) {
      const separator = cookie.indexOf('=');
      if (separator > 0 && cookie.slice(0, separator).trim() === name) {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      }
    }
    return '';
  }

  function setSessionCookie(res, value, maxAge) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.set('Set-Cookie',
      `hotel_admin=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
  }

  function getAdmin(req) {
    const id = cookieValue(req, 'hotel_admin');
    const session = sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      if (id) sessions.delete(id);
      return null;
    }
    session.expiresAt = Date.now() + sessionLifetime;
    return session;
  }

  function requireAdmin(req, res, next) {
    const session = getAdmin(req);
    if (session) {
      req.admin = session;
      return next();
    }
    const configuredToken = process.env.ADMIN_API_TOKEN || process.env.ADMIN_KEY || '';
    const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (configuredToken.length >= 32 && match) {
      const supplied = Buffer.from(match[1]);
      const expected = Buffer.from(configuredToken);
      if (supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)) {
        req.admin = { adminId: null, username: 'token-admin' };
        return next();
      }
    }
    return res.status(401).json({ error: 'Administrator sign in is required.' });
  }

  function safeText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  }

  function validName(value) {
    return /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,79}$/u.test(value);
  }

  function validPhone(value) {
    const digits = value.replace(/\D/g, '');
    return /^\+?[0-9\s()-]{7,20}$/.test(value) && digits.length >= 7 && digits.length <= 15;
  }

  function validDates(checkIn, checkOut) {
    if (typeof checkIn !== 'string' || typeof checkOut !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      return null;
    }
    const start = new Date(`${checkIn}T00:00:00.000Z`);
    const end = new Date(`${checkOut}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ||
        start.toISOString().slice(0, 10) !== checkIn ||
        end.toISOString().slice(0, 10) !== checkOut) {
      return null;
    }
    const nights = Math.round((end - start) / 86400000);
    if (checkIn < new Date().toISOString().slice(0, 10) || nights < 1 || nights > 365) {
      return null;
    }
    return { nights };
  }

  function availableUnits(roomType, checkIn, checkOut, floor = '', excludeBookingId = 0) {
    const type = database.prepare(
      'SELECT nightly_rate FROM room_types WHERE name = ?'
    ).get(roomType);
    if (!type) return null;
    const floorClause = floor ? ' AND floor = ?' : '';
    const inventory = database.prepare(`
      SELECT r.id,
        ${roomType === 'Shared Bed Space' ? 'r.bed_capacity' : '1'} AS capacity,
        COALESCE((
          SELECT SUM(a.units)
          FROM booking_room_assignments a
          JOIN bookings b ON b.id = a.booking_id
          WHERE a.room_id = r.id AND b.status IN ('pending', 'confirmed')
            AND b.check_in < ? AND b.check_out > ? AND b.id != ?
        ), 0) AS reserved
      FROM rooms r
      WHERE r.room_type = ? AND r.is_active = 1${floorClause}
      ORDER BY r.room_number
    `).all(checkOut, checkIn, excludeBookingId, roomType, ...(floor ? [floor] : []));
    const unassigned = database.prepare(`
      SELECT COALESCE(SUM(b.room_count), 0) AS units
      FROM bookings b
      WHERE b.room_type = ? AND b.status IN ('pending', 'confirmed')
        AND b.check_in < ? AND b.check_out > ? AND b.id != ?
        AND (? = '' OR b.preferred_floor = ? OR b.preferred_floor IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM booking_room_assignments a WHERE a.booking_id = b.id
        )
    `).get(roomType, checkOut, checkIn, excludeBookingId, floor, floor).units;
    let remainingUnassigned = unassigned;
    for (const room of inventory) {
      const reservedHere = Math.min(room.capacity - room.reserved, remainingUnassigned);
      room.reserved += reservedHere;
      remainingUnassigned -= reservedHere;
    }
    const roomCount = inventory.reduce((sum, room) => sum + room.capacity, 0);
    const overlap = inventory.reduce((sum, room) => sum + room.reserved, 0);
    return {
      availableRooms: Math.max(0, roomCount - overlap),
      nightlyRate: type.nightly_rate,
      rooms: inventory
    };
  }

  function assignBookingUnits(bookingId, units, inventory) {
    let remaining = units;
    const insert = database.prepare(`
      INSERT INTO booking_room_assignments (booking_id, room_id, units)
      VALUES (?, ?, ?)
    `);
    for (const room of inventory.rooms) {
      if (!remaining) break;
      const assigned = Math.min(room.capacity - room.reserved, remaining);
      if (assigned > 0) {
        insert.run(bookingId, room.id, assigned);
        remaining -= assigned;
      }
    }
    if (remaining > 0) throw new Error('Room inventory changed while assigning a booking.');
  }

  function upsertCustomer(fullName, phone, email) {
    const normalizedEmail = email || null;
    const existing = database.prepare(`
      SELECT id FROM customers
      WHERE phone = ? AND COALESCE(email, '') = COALESCE(?, '')
      ORDER BY id LIMIT 1
    `).get(phone, normalizedEmail);
    if (existing) {
      database.prepare('UPDATE customers SET full_name = ? WHERE id = ?')
        .run(fullName, existing.id);
      return existing.id;
    }
    return Number(database.prepare(`
      INSERT INTO customers (full_name, phone, email) VALUES (?, ?, ?)
    `).run(fullName, phone, normalizedEmail).lastInsertRowid);
  }

  function makeReference(prefix) {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  function migrateLegacyRecords() {
    const oldBookings = database.prepare('SELECT * FROM room_bookings').all();
    for (const old of oldBookings) {
      const reference = `AGH-LEGACY-${old.id}`;
      if (database.prepare('SELECT 1 FROM bookings WHERE booking_reference = ?').get(reference)) continue;
      const oldType = database.prepare(`
        SELECT nightly_rate FROM booking_room_types WHERE room_type = ?
      `).get(old.room_type);
      if (!oldType) continue;
      database.prepare(`
        INSERT OR IGNORE INTO room_types (name, nightly_rate, max_guests)
        VALUES (?, ?, ?)
      `).run(old.room_type, oldType.nightly_rate, Math.max(1, old.guests));
      const customerId = upsertCustomer(old.customer_name, old.phone, old.email || '');
      const status = bookingStatuses.includes(old.status) ? old.status : 'pending';
      const bookingId = Number(database.prepare(`
        INSERT INTO bookings (
          booking_reference, customer_id, room_type, preferred_floor, guests, room_count,
          check_in, check_out, nights, nightly_rate, total_price,
          payment_preference, special_requests, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reference, customerId, old.room_type, old.floor || null, old.guests,
        old.room_count || 1, old.check_in, old.check_out, old.nights,
        old.nightly_rate || oldType.nightly_rate, old.total_price,
        old.payment_method || 'Cash at hotel', old.special_requests || null, status
      ).lastInsertRowid);
      database.prepare(`
        INSERT INTO payments (booking_id, payment_method, amount, status)
        VALUES (?, ?, ?, 'pending')
      `).run(bookingId, old.payment_method || 'Cash at hotel', old.total_price);
    }

    const oldOrders = database.prepare('SELECT * FROM food_orders').all();
    const oldOrderItems = database.prepare('SELECT * FROM food_order_items ORDER BY id').all();
    for (const old of oldOrders) {
      const orderNumber = `LEGACY-ORDER-${old.id}`;
      if (database.prepare(
        'SELECT 1 FROM restaurant_orders WHERE order_number = ?'
      ).get(orderNumber)) continue;
      const customerId = upsertCustomer(old.customer_name, old.phone, '');
      const serviceType = old.service_mode || old.service_type || 'takeaway';
      const validService = ['dine-in', 'takeaway', 'room-service'].includes(serviceType)
        ? serviceType
        : 'takeaway';
      const status = orderStatuses.includes(old.status) ? old.status : 'pending';
      const orderId = Number(database.prepare(`
        INSERT INTO restaurant_orders
          (order_number, customer_id, service_type, table_number, room_number, total_price, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderNumber, customerId, validService, old.table_number || null,
        old.room_number || null, old.total_price, status, old.created_at
      ).lastInsertRowid);
      for (const oldItem of oldOrderItems.filter((item) => item.order_id === old.id)) {
        const source = database.prepare(`
          SELECT COALESCE(display_name, name) AS name, is_drink
          FROM food_menu WHERE id = ?
        `).get(oldItem.food_id);
        const table = source && source.is_drink ? 'drink_items' : 'food_items';
        const product = source && database.prepare(
          `SELECT id FROM ${table} WHERE name = ?`
        ).get(source.name);
        if (!product) continue;
        database.prepare(`
          INSERT INTO restaurant_order_items
            (order_id, food_item_id, drink_item_id, item_name, quantity, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          orderId,
          product && table === 'food_items' ? product.id : null,
          product && table === 'drink_items' ? product.id : null,
          oldItem.food_name,
          oldItem.quantity,
          oldItem.unit_price,
          oldItem.line_total
        );
      }
    }
  }

  migrateLegacyRecords();

  function withError(label, handler) {
    return (req, res) => {
      try {
        handler(req, res);
      } catch (error) {
        console.error(`${label}:`, error);
        if (!res.headersSent) res.status(500).json({ error: `Unable to ${label.toLowerCase()}.` });
      }
    };
  }

  router.get('/admin/status', (_req, res) => {
    const count = database.prepare('SELECT COUNT(*) AS count FROM administrators').get().count;
    res.set('Cache-Control', 'no-store').json({
      setupRequired: count === 0,
      authenticated: Boolean(getAdmin(_req))
    });
  });

  router.post('/admin/setup', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,40}$/.test(username) ||
        typeof password !== 'string' || password.length < 12 || password.length > 200) {
      return res.status(400).json({
        error: 'Use a 3-40 character username and a password of at least 12 characters.'
      });
    }
    try {
      database.exec('BEGIN IMMEDIATE');
      if (database.prepare('SELECT 1 FROM administrators LIMIT 1').get()) {
        database.exec('ROLLBACK');
        return res.status(409).json({ error: 'Administrator setup has already been completed.' });
      }
      const adminId = Number(database.prepare(
        'INSERT INTO administrators (username, password_hash) VALUES (?, ?)'
      ).run(username, hashPassword(password)).lastInsertRowid);
      database.exec('COMMIT');
      const sessionId = crypto.randomBytes(32).toString('hex');
      sessions.set(sessionId, { adminId, username, expiresAt: Date.now() + sessionLifetime });
      setSessionCookie(res, sessionId, sessionLifetime / 1000);
      res.status(201).json({ username });
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch { /* transaction already ended */ }
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'That administrator username is already in use.' });
      }
      console.error('Unable to set up administrator:', error);
      res.status(500).json({ error: 'Unable to set up administrator access.' });
    }
  });

  router.post('/admin/login', (req, res) => {
    const username = safeText(req.body && req.body.username, 40);
    const password = typeof (req.body && req.body.password) === 'string'
      ? req.body.password
      : '';
    const ip = req.ip || 'unknown';
    const failure = loginFailures.get(ip);
    if (failure && failure.until > Date.now() && failure.count >= 10) {
      return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' });
    }
    const admin = database.prepare(
      'SELECT id, username, password_hash FROM administrators WHERE username = ?'
    ).get(username);
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      const current = failure && failure.until > Date.now()
        ? failure
        : { count: 0, until: Date.now() + 15 * 60 * 1000 };
      current.count += 1;
      loginFailures.set(ip, current);
      return res.status(401).json({ error: 'Username or password is incorrect.' });
    }
    loginFailures.delete(ip);
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, {
      adminId: admin.id,
      username: admin.username,
      expiresAt: Date.now() + sessionLifetime
    });
    setSessionCookie(res, sessionId, sessionLifetime / 1000);
    res.set('Cache-Control', 'no-store').json({ username: admin.username });
  });

  router.post('/admin/logout', requireAdmin, (req, res) => {
    sessions.delete(cookieValue(req, 'hotel_admin'));
    setSessionCookie(res, '', 0);
    res.json({ success: true });
  });

  router.get('/admin/session', requireAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ username: req.admin.username });
  });

  router.get('/reviews', withError('load guest reviews', (_req, res) => {
    const summary = database.prepare(`
      SELECT COUNT(*) AS reviewCount, COALESCE(AVG(rating), 0) AS averageRating
      FROM guest_reviews WHERE status = 'approved'
    `).get();
    const reviews = database.prepare(`
      SELECT id, guest_name AS guestName, rating, review_text AS reviewText,
        created_at AS createdAt
      FROM guest_reviews WHERE status = 'approved'
      ORDER BY created_at DESC, id DESC LIMIT 20
    `).all();
    res.set('Cache-Control', 'no-store').json({
      reviewCount: summary.reviewCount,
      averageRating: Number(summary.averageRating.toFixed(1)),
      reviews
    });
  }));

  router.post('/reviews', (req, res) => {
    const guestName = safeText(req.body && req.body.guestName, 80);
    const reviewText = safeText(req.body && req.body.reviewText, 1000);
    const rating = req.body && req.body.rating;
    if (!validName(guestName)) {
      return res.status(400).json({ error: 'Enter a valid name (2-80 characters).' });
    }
    if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
    }
    if (reviewText.length < 10) {
      return res.status(400).json({ error: 'Please write at least 10 characters about your stay.' });
    }
    try {
      const id = Number(database.prepare(`
        INSERT INTO guest_reviews (guest_name, rating, review_text)
        VALUES (?, ?, ?)
      `).run(guestName, rating, reviewText).lastInsertRowid);
      res.status(201).json({ id, status: 'pending' });
    } catch (error) {
      console.error('Unable to save guest review:', error);
      res.status(500).json({ error: 'Unable to submit your review. Please try again.' });
    }
  });

  router.use('/admin', requireAdmin);

  router.post('/admin/upload', (req, res) => {
    const dataUrl = req.body && req.body.image;
    const match = typeof dataUrl === 'string'
      ? dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/)
      : null;
    if (!match) {
      return res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP image.' });
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 2 * 1024 * 1024 ||
        buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) {
      return res.status(400).json({ error: 'Images must be valid and no larger than 2 MB.' });
    }
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const validSignature = extension === 'jpg'
      ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : extension === 'png'
        ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!validSignature) return res.status(400).json({ error: 'The image file could not be validated.' });
    const directory = process.env.HOTEL_UPLOAD_DIRECTORY ||
      path.join(__dirname, '..', 'public', 'images', 'uploads');
    fs.mkdirSync(directory, { recursive: true });
    const filename = `${crypto.randomUUID()}.${extension}`;
    fs.writeFileSync(path.join(directory, filename), buffer, { flag: 'wx' });
    res.status(201).json({ image: `/public/images/uploads/${filename}` });
  });

  router.get('/booking-rooms', withError('load room inventory', (_req, res) => {
    const rooms = database.prepare(`
      SELECT t.name AS roomType, t.nightly_rate AS nightlyRate,
        COALESCE(SUM(CASE WHEN r.is_active = 1 THEN
          ${'CASE WHEN t.name = \'Shared Bed Space\' THEN r.bed_capacity ELSE 1 END'} ELSE 0 END), 0) AS capacity
      FROM room_types t LEFT JOIN rooms r ON r.room_type = t.name
      GROUP BY t.name ORDER BY t.name
    `).all();
    res.set('Cache-Control', 'no-store').json(rooms);
  }));

  router.get('/rooms', withError('load room inventory', (_req, res) => {
    const rooms = database.prepare(`
      SELECT t.name AS room_type,
        COALESCE(SUM(CASE WHEN r.is_active = 1 THEN
          CASE WHEN t.name = 'Shared Bed Space' THEN r.bed_capacity ELSE 1 END
          ELSE 0 END), 0) AS available_rooms
      FROM room_types t LEFT JOIN rooms r ON r.room_type = t.name
      GROUP BY t.name ORDER BY t.name
    `).all();
    res.set('Cache-Control', 'no-store').json(rooms);
  }));

  router.get('/booking-availability', (req, res) => {
    const dates = validDates(req.query.checkIn, req.query.checkOut);
    const roomType = safeText(req.query.roomType, 80);
    const floor = safeText(req.query.floor, 40);
    const roomCount = req.query.roomCount === undefined ? 1 : Number(req.query.roomCount);
    if (!dates) return res.status(400).json({ error: 'Choose valid future check-in and check-out dates.' });
    if (!Number.isSafeInteger(roomCount) || roomCount < 1 || roomCount > 10) {
      return res.status(400).json({ error: 'Choose between 1 and 10 rooms or beds.' });
    }
    if (floor && !floors.includes(floor)) return res.status(400).json({ error: 'Choose a valid floor.' });
    const inventory = availableUnits(roomType, req.query.checkIn, req.query.checkOut, floor);
    if (!inventory) return res.status(400).json({ error: 'Choose a valid room type.' });
    res.set('Cache-Control', 'no-store').json({
      roomType,
      available: inventory.availableRooms >= roomCount,
      availableRooms: inventory.availableRooms,
      requestedRooms: roomCount,
      nightlyRate: inventory.nightlyRate,
      nights: dates.nights
    });
  });

  router.post('/bookings', (req, res) => {
    const body = req.body || {};
    const customerName = safeText(body.customerName, 80);
    const phone = safeText(body.phone, 20);
    const email = safeText(body.email, 254);
    const roomType = safeText(body.roomType, 80);
    const floor = safeText(body.floor, 40);
    const paymentPreference = safeText(body.paymentMethod, 40);
    const specialRequests = safeText(body.specialRequests, 500);
    const dates = validDates(body.checkIn, body.checkOut);
    if (!validName(customerName)) return res.status(400).json({ error: 'Enter a valid full name (2-80 characters).' });
    if (!validPhone(phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (!dates) return res.status(400).json({ error: 'Choose valid future check-in and check-out dates, up to 365 nights.' });
    if (!Number.isSafeInteger(body.guests) || body.guests < 1 || body.guests > 20) {
      return res.status(400).json({ error: 'Choose between 1 and 20 guests.' });
    }
    if (!Number.isSafeInteger(body.roomCount) || body.roomCount < 1 || body.roomCount > 10) {
      return res.status(400).json({ error: 'Choose between 1 and 10 rooms or beds.' });
    }
    if (floor && !floors.includes(floor)) return res.status(400).json({ error: 'Choose a valid preferred floor.' });
    if (!paymentMethods.includes(paymentPreference)) {
      return res.status(400).json({ error: 'Choose a valid payment preference.' });
    }
    try {
      database.exec('BEGIN IMMEDIATE');
      const inventory = availableUnits(roomType, body.checkIn, body.checkOut, floor);
      const type = database.prepare(
        'SELECT max_guests FROM room_types WHERE name = ?'
      ).get(roomType);
      if (!inventory || !type) {
        database.exec('ROLLBACK');
        return res.status(400).json({ error: 'Choose a valid room type.' });
      }
      if (body.guests > type.max_guests * body.roomCount) {
        database.exec('ROLLBACK');
        return res.status(400).json({ error: `This selection supports up to ${type.max_guests * body.roomCount} guests.` });
      }
      if (inventory.availableRooms < body.roomCount) {
        database.exec('ROLLBACK');
        return res.status(409).json({
          error: 'This room type is unavailable for those dates. Please choose different dates or a different room.'
        });
      }
      const totalPrice = inventory.nightlyRate * dates.nights * body.roomCount;
      const customerId = upsertCustomer(customerName, phone, email);
      const reference = makeReference('AGH');
      const bookingId = Number(database.prepare(`
        INSERT INTO bookings (
          booking_reference, customer_id, room_type, preferred_floor, guests, room_count,
          check_in, check_out, nights, nightly_rate, total_price, payment_preference, special_requests
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reference, customerId, roomType, floor || null, body.guests, body.roomCount,
        body.checkIn, body.checkOut, dates.nights, inventory.nightlyRate, totalPrice,
        paymentPreference, specialRequests || null
      ).lastInsertRowid);
      assignBookingUnits(bookingId, body.roomCount, inventory);
      database.prepare(`
        INSERT INTO payments (booking_id, payment_method, amount, status)
        VALUES (?, ?, ?, 'pending')
      `).run(bookingId, paymentPreference, totalPrice);
      database.exec('COMMIT');
      return res.status(201).json({
        bookingId,
        bookingReference: reference,
        status: 'pending',
        customerName,
        roomType,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        guests: body.guests,
        roomCount: body.roomCount,
        floor: floor || null,
        nights: dates.nights,
        nightlyRate: inventory.nightlyRate,
        totalPrice,
        paymentStatus: 'pending'
      });
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch { /* transaction already ended */ }
      console.error('Unable to save room booking:', error);
      return res.status(500).json({ error: 'Unable to save your booking. Please try again.' });
    }
  });

  router.post('/bookings/status', (req, res) => {
    const reference = safeText(req.body && req.body.bookingReference, 50).toUpperCase();
    const phone = safeText(req.body && req.body.phone, 20);
    if (!reference || !validPhone(phone)) {
      return res.status(400).json({ error: 'Enter your booking reference and phone number.' });
    }
    const booking = database.prepare(`
      SELECT b.booking_reference, b.room_type, b.preferred_floor, b.guests, b.room_count,
        b.check_in, b.check_out, b.nights, b.total_price, b.payment_preference, b.status,
        p.status AS payment_status
      FROM bookings b JOIN customers c ON c.id = b.customer_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.booking_reference = ? AND c.phone = ?
    `).get(reference, phone);
    if (!booking) return res.status(404).json({ error: 'No booking matched those details.' });
    res.set('Cache-Control', 'no-store').json({
      bookingReference: booking.booking_reference,
      roomType: booking.room_type,
      floor: booking.preferred_floor,
      guests: booking.guests,
      roomCount: booking.room_count,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      totalPrice: booking.total_price,
      paymentPreference: booking.payment_preference,
      paymentStatus: booking.payment_status || 'pending',
      status: booking.status
    });
  });

  function menuFor(kind) {
    const table = kind === 'drinks' ? 'drink_items' : 'food_items';
    const items = database.prepare(`
      SELECT id, category, name, description, price, image, tags
      FROM ${table} WHERE is_available = 1 ORDER BY id
    `).all();
    return items.map((item) => ({
      ...item,
      id: kind === 'drinks' ? item.id + 100000 : item.id,
      categories: JSON.parse(item.tags || '[]').length
        ? JSON.parse(item.tags)
        : [item.category]
    }));
  }

  router.get('/food', withError('load food menu', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(menuFor('food'));
  }));
  router.get('/food-menu', withError('load food menu', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(menuFor('food'));
  }));
  router.get('/drinks', withError('load drinks menu', (_req, res) => {
    res.set('Cache-Control', 'no-store').json(menuFor('drinks'));
  }));

  router.post('/orders', (req, res) => {
    const body = req.body || {};
    const customerName = safeText(body.customerName, 80);
    const phone = safeText(body.phone, 20);
    const roomNumber = safeText(body.roomNumber, 12);
    const serviceType = body.serviceType;
    const tableNumber = body.tableNumber === '' || body.tableNumber == null
      ? null
      : Number(body.tableNumber);
    const items = body.items;
    if (!validName(customerName)) return res.status(400).json({ error: 'Enter a valid full name (2-80 characters).' });
    if (!validPhone(phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
    if (!['dine-in', 'takeaway', 'room-service'].includes(serviceType)) {
      return res.status(400).json({ error: 'Choose dine-in, takeaway, or room service.' });
    }
    if (serviceType === 'dine-in' &&
        (!Number.isSafeInteger(tableNumber) || tableNumber < 1 || tableNumber > 99)) {
      return res.status(400).json({ error: 'A valid table number (1-99) is required for dine-in.' });
    }
    if (serviceType === 'room-service' && !/^[A-Za-z0-9-]{1,12}$/.test(roomNumber)) {
      return res.status(400).json({ error: 'A valid room number is required for room service.' });
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 40) {
      return res.status(400).json({ error: 'Add between 1 and 40 different menu items.' });
    }
    const seen = new Set();
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.foodId) || item.foodId < 1 ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 ||
          seen.has(item.foodId)) {
        return res.status(400).json({ error: 'Each menu item needs a unique item and quantity (1-20).' });
      }
      seen.add(item.foodId);
    }
    try {
      const resolved = items.map((item) => {
        const isDrink = item.foodId >= 100000;
        const id = isDrink ? item.foodId - 100000 : item.foodId;
        const table = isDrink ? 'drink_items' : 'food_items';
        const product = database.prepare(
          `SELECT id, name, price FROM ${table} WHERE id = ? AND is_available = 1`
        ).get(id);
        if (!product) return null;
        return {
          ...product,
          quantity: item.quantity,
          lineTotal: product.price * item.quantity,
          foodItemId: isDrink ? null : id,
          drinkItemId: isDrink ? id : null
        };
      });
      if (resolved.some((item) => !item)) {
        return res.status(400).json({ error: 'One or more selected menu items are unavailable.' });
      }
      const totalPrice = resolved.reduce((total, item) => total + item.lineTotal, 0);
      database.exec('BEGIN IMMEDIATE');
      const customerId = upsertCustomer(customerName, phone, '');
      const orderNumber = makeReference('ORD');
      const orderId = Number(database.prepare(`
        INSERT INTO restaurant_orders
          (order_number, customer_id, service_type, table_number, room_number, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        orderNumber, customerId, serviceType,
        serviceType === 'dine-in' ? tableNumber : null,
        serviceType === 'room-service' ? roomNumber : null,
        totalPrice
      ).lastInsertRowid);
      const addItem = database.prepare(`
        INSERT INTO restaurant_order_items
          (order_id, food_item_id, drink_item_id, item_name, quantity, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of resolved) {
        addItem.run(
          orderId, item.foodItemId, item.drinkItemId, item.name,
          item.quantity, item.price, item.lineTotal
        );
      }
      database.exec('COMMIT');
      res.status(201).json({
        orderId,
        orderNumber,
        status: 'pending',
        serviceType,
        tableNumber: serviceType === 'dine-in' ? tableNumber : null,
        totalPrice,
        items: resolved.map((item) => ({
          foodId: item.foodItemId === null ? item.drinkItemId + 100000 : item.foodItemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          lineTotal: item.lineTotal
        }))
      });
    } catch (error) {
      try { database.exec('ROLLBACK'); } catch { /* transaction already ended */ }
      console.error('Unable to save restaurant order:', error);
      res.status(500).json({ error: 'Unable to save your order. Please try again.' });
    }
  });

  router.get('/admin/summary', withError('load dashboard summary', (_req, res) => {
    const bookingCounts = database.prepare(`
      SELECT status, COUNT(*) AS count FROM bookings GROUP BY status
    `).all();
    const bookingStats = Object.fromEntries(bookingCounts.map((row) => [row.status, row.count]));
    const orders = database.prepare(
      'SELECT COUNT(*) AS total FROM restaurant_orders'
    ).get().total;
    const revenue = database.prepare(`
      SELECT
        COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'verified'), 0) +
        COALESCE((SELECT SUM(total_price) FROM restaurant_orders WHERE status = 'completed'), 0)
        AS total
    `).get().total;
    res.set('Cache-Control', 'no-store').json({
      totalBookings: Object.values(bookingStats).reduce((sum, count) => sum + count, 0),
      pendingBookings: bookingStats.pending || 0,
      confirmedBookings: bookingStats.confirmed || 0,
      cancelledBookings: bookingStats.cancelled || 0,
      rejectedBookings: bookingStats.rejected || 0,
      totalRestaurantOrders: orders,
      revenue
    });
  }));

  router.get('/admin/rooms', withError('load rooms', (req, res) => {
    const rooms = database.prepare(`
      SELECT r.id, r.room_number AS roomNumber, r.room_type AS roomType,
        r.floor, r.bed_capacity AS bedCapacity, r.is_active AS isActive,
        t.nightly_rate AS nightlyRate,
        COALESCE((
          SELECT SUM(a.units)
          FROM booking_room_assignments a
          JOIN bookings b ON b.id = a.booking_id
          WHERE a.room_id = r.id AND b.status = 'confirmed'
            AND b.check_in <= date('now') AND b.check_out > date('now')
        ), 0) AS occupiedUnits
      FROM rooms r JOIN room_types t ON t.name = r.room_type
      ORDER BY r.floor, r.room_number
    `).all();
    res.set('Cache-Control', 'no-store').json(rooms.map((room) => ({
      ...room,
      occupancy: room.occupiedUnits > 0 ? 'occupied' : 'available'
    })));
  }));

  router.get('/admin/room-types', withError('load room types', (_req, res) => {
    res.json(database.prepare(`
      SELECT t.name, t.nightly_rate AS nightlyRate, t.max_guests AS maxGuests,
        COUNT(CASE WHEN r.is_active = 1 THEN 1 END) AS roomCount
      FROM room_types t LEFT JOIN rooms r ON r.room_type = t.name
      GROUP BY t.name ORDER BY t.name
    `).all());
  }));

  router.patch('/admin/room-types/:name', (req, res) => {
    const name = safeText(req.params.name, 80);
    const nightlyRate = req.body && req.body.nightlyRate;
    const maxGuests = req.body && req.body.maxGuests;
    if (!Number.isSafeInteger(nightlyRate) || nightlyRate < 1 ||
        !Number.isSafeInteger(maxGuests) || maxGuests < 1 || maxGuests > 20) {
      return res.status(400).json({ error: 'Enter a positive price and guest capacity.' });
    }
    const result = database.prepare(`
      UPDATE room_types SET nightly_rate = ?, max_guests = ? WHERE name = ?
    `).run(nightlyRate, maxGuests, name);
    if (!result.changes) return res.status(404).json({ error: 'Room type not found.' });
    res.json({ name, nightlyRate, maxGuests });
  });

  router.post('/admin/rooms', (req, res) => {
    const body = req.body || {};
    const roomNumber = safeText(body.roomNumber, 20);
    const roomType = safeText(body.roomType, 80);
    const floor = safeText(body.floor, 40);
    const bedCapacity = body.bedCapacity;
    if (!/^[A-Za-z0-9-]{1,20}$/.test(roomNumber) || !floors.includes(floor) ||
        !Number.isSafeInteger(bedCapacity) || bedCapacity < 1 || bedCapacity > 20 ||
        !database.prepare('SELECT 1 FROM room_types WHERE name = ?').get(roomType)) {
      return res.status(400).json({ error: 'Enter a valid room number, type, floor, and bed capacity.' });
    }
    try {
      const id = Number(database.prepare(`
        INSERT INTO rooms (room_number, room_type, floor, bed_capacity)
        VALUES (?, ?, ?, ?)
      `).run(roomNumber, roomType, floor, bedCapacity).lastInsertRowid);
      res.status(201).json({ id, roomNumber, roomType, floor, bedCapacity, isActive: 1 });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'That room number already exists.' });
      }
      throw error;
    }
  });

  router.put('/admin/rooms/:id', (req, res) => {
    const id = Number(req.params.id);
    const body = req.body || {};
    const roomNumber = safeText(body.roomNumber, 20);
    const roomType = safeText(body.roomType, 80);
    const floor = safeText(body.floor, 40);
    const bedCapacity = body.bedCapacity;
    const isActive = body.isActive === false ? 0 : 1;
    if (!Number.isSafeInteger(id) || id < 1 || !/^[A-Za-z0-9-]{1,20}$/.test(roomNumber) ||
        !floors.includes(floor) || !Number.isSafeInteger(bedCapacity) || bedCapacity < 1 ||
        bedCapacity > 20 || !database.prepare('SELECT 1 FROM room_types WHERE name = ?').get(roomType)) {
      return res.status(400).json({ error: 'Enter valid room details.' });
    }
    const current = database.prepare(`
      SELECT room_type, floor, bed_capacity FROM rooms WHERE id = ?
    `).get(id);
    if (!current) return res.status(404).json({ error: 'Room not found.' });
    const hasFutureBooking = database.prepare(`
      SELECT 1 FROM booking_room_assignments a
      JOIN bookings b ON b.id = a.booking_id
      WHERE a.room_id = ? AND b.status IN ('pending', 'confirmed')
        AND b.check_out > date('now') LIMIT 1
    `).get(id);
    if (hasFutureBooking && (
      current.room_type !== roomType || current.floor !== floor ||
      bedCapacity < current.bed_capacity || isActive === 0
    )) {
      return res.status(409).json({
        error: 'This room has a pending or confirmed future booking; its type, floor, capacity, and active state cannot be changed.'
      });
    }
    try {
      const result = database.prepare(`
        UPDATE rooms SET room_number = ?, room_type = ?, floor = ?, bed_capacity = ?, is_active = ?
        WHERE id = ?
      `).run(roomNumber, roomType, floor, bedCapacity, isActive, id);
      if (!result.changes) return res.status(404).json({ error: 'Room not found.' });
      res.json({ id, roomNumber, roomType, floor, bedCapacity, isActive });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'That room number already exists.' });
      }
      throw error;
    }
  });

  router.delete('/admin/rooms/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid room ID.' });
    const hasFutureBooking = database.prepare(`
      SELECT 1 FROM booking_room_assignments a
      JOIN bookings b ON b.id = a.booking_id
      WHERE a.room_id = ? AND b.status IN ('pending', 'confirmed')
        AND b.check_out > date('now') LIMIT 1
    `).get(id);
    if (hasFutureBooking) {
      return res.status(409).json({ error: 'This room has a pending or confirmed future booking.' });
    }
    const result = database.prepare(
      'UPDATE rooms SET is_active = 0 WHERE id = ?'
    ).run(id);
    if (!result.changes) return res.status(404).json({ error: 'Room not found.' });
    res.status(204).end();
  });

  router.get('/admin/bookings', withError('load bookings', (req, res) => {
    const search = safeText(req.query.search, 100);
    const status = safeText(req.query.status, 20);
    const rows = database.prepare(`
      SELECT b.id, b.booking_reference AS bookingReference, c.full_name AS customerName,
        c.phone, c.email, b.room_type AS roomType, b.preferred_floor AS floor,
        b.guests, b.room_count AS roomCount, b.check_in AS checkIn, b.check_out AS checkOut,
        b.nights, b.nightly_rate AS nightlyRate, b.total_price AS totalPrice,
        b.payment_preference AS paymentPreference, b.special_requests AS specialRequests,
        b.status, b.created_at AS createdAt, p.id AS paymentId, p.status AS paymentStatus
      FROM bookings b JOIN customers c ON c.id = b.customer_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE (? = '' OR b.status = ?)
        AND (? = '' OR b.booking_reference LIKE ? OR c.full_name LIKE ? OR
             c.phone LIKE ? OR c.email LIKE ?)
      ORDER BY b.id DESC LIMIT 500
    `).all(status, status, search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    res.set('Cache-Control', 'no-store').json(rows);
  }));

  router.patch('/admin/bookings/:id', (req, res) => {
    const id = Number(req.params.id);
    const status = req.body && req.body.status;
    if (!Number.isSafeInteger(id) || id < 1 || !bookingStatuses.includes(status)) {
      return res.status(400).json({ error: 'Choose a valid booking status.' });
    }
    const booking = database.prepare(`
      SELECT room_type, preferred_floor, room_count, check_in, check_out, status
      FROM bookings WHERE id = ?
    `).get(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (status === 'confirmed' && booking.status !== 'confirmed') {
      const inventory = availableUnits(
      booking.room_type, booking.check_in, booking.check_out, booking.preferred_floor || '', id
      );
      if (!inventory || inventory.availableRooms < booking.room_count) {
        return res.status(409).json({ error: 'There is not enough room inventory to confirm this booking.' });
      }
    }
    database.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
    res.json({ bookingId: id, status });
  });

  router.get('/admin/orders', withError('load restaurant orders', (_req, res) => {
    const orders = database.prepare(`
      SELECT o.id, o.order_number AS orderNumber, c.full_name AS customerName,
        c.phone, o.service_type AS serviceType, o.table_number AS tableNumber,
        o.room_number AS roomNumber, o.total_price AS totalPrice, o.status, o.created_at AS createdAt
      FROM restaurant_orders o JOIN customers c ON c.id = o.customer_id
      ORDER BY o.id DESC LIMIT 500
    `).all();
    const items = database.prepare(`
      SELECT order_id, item_name AS name, quantity, unit_price AS unitPrice, line_total AS lineTotal
      FROM restaurant_order_items ORDER BY id
    `).all();
    const itemsByOrder = new Map();
    for (const item of items) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id).push({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal
      });
    }
    res.set('Cache-Control', 'no-store').json(orders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) || []
    })));
  }));

  router.patch('/admin/orders/:id', (req, res) => {
    const id = Number(req.params.id);
    const status = req.body && req.body.status;
    if (!Number.isSafeInteger(id) || id < 1 || !orderStatuses.includes(status)) {
      return res.status(400).json({ error: 'Choose a valid order status.' });
    }
    const result = database.prepare(
      'UPDATE restaurant_orders SET status = ? WHERE id = ?'
    ).run(status, id);
    if (!result.changes) return res.status(404).json({ error: 'Order not found.' });
    res.json({ orderId: id, status });
  });

  router.get('/admin/menu/:kind', withError('load menu items', (req, res) => {
    const table = req.params.kind === 'drinks'
      ? 'drink_items'
      : req.params.kind === 'food' ? 'food_items' : null;
    if (!table) return res.status(404).json({ error: 'Menu category not found.' });
    const rows = database.prepare(`
      SELECT id, category, name, description, price, image, is_available AS isAvailable
      FROM ${table} ORDER BY id
    `).all();
    res.json(rows);
  }));

  router.post('/admin/menu/:kind', (req, res) => {
    const table = req.params.kind === 'drinks'
      ? 'drink_items'
      : req.params.kind === 'food' ? 'food_items' : null;
    if (!table) return res.status(404).json({ error: 'Menu category not found.' });
    const item = req.body || {};
    const category = safeText(item.category, 60);
    const name = safeText(item.name, 100);
    const description = safeText(item.description, 500);
    const image = safeText(item.image, 500);
    if (!category || !name || !Number.isSafeInteger(item.price) || item.price < 1 ||
        !image || !(image.startsWith('/public/images/') || /^https:\/\/[^\s]+$/i.test(image))) {
      return res.status(400).json({ error: 'Provide a category, name, valid price, and local or HTTPS image URL.' });
    }
    try {
      const id = Number(database.prepare(`
        INSERT INTO ${table} (category, name, description, price, image)
        VALUES (?, ?, ?, ?, ?)
      `).run(category, name, description, item.price, image).lastInsertRowid);
      res.status(201).json({ id, category, name, description, price: item.price, image, isAvailable: 1 });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'A menu item with that name already exists.' });
      }
      throw error;
    }
  });

  router.put('/admin/menu/:kind/:id', (req, res) => {
    const table = req.params.kind === 'drinks'
      ? 'drink_items'
      : req.params.kind === 'food' ? 'food_items' : null;
    if (!table) return res.status(404).json({ error: 'Menu category not found.' });
    const id = Number(req.params.id);
    const item = req.body || {};
    const category = safeText(item.category, 60);
    const name = safeText(item.name, 100);
    const description = safeText(item.description, 500);
    const image = safeText(item.image, 500);
    if (!Number.isSafeInteger(id) || id < 1 || !category || !name ||
        !Number.isSafeInteger(item.price) || item.price < 1 ||
        !image || !(image.startsWith('/public/images/') || /^https:\/\/[^\s]+$/i.test(image))) {
      return res.status(400).json({ error: 'Provide valid menu item details.' });
    }
    try {
      const result = database.prepare(`
        UPDATE ${table} SET category = ?, name = ?, description = ?, price = ?,
          image = ?, is_available = ?
        WHERE id = ?
      `).run(category, name, description, item.price, image, item.isAvailable === false ? 0 : 1, id);
      if (!result.changes) return res.status(404).json({ error: 'Menu item not found.' });
      res.json({ id, category, name, description, price: item.price, image, isAvailable: item.isAvailable !== false });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'A menu item with that name already exists.' });
      }
      throw error;
    }
  });

  router.delete('/admin/menu/:kind/:id', (req, res) => {
    const table = req.params.kind === 'drinks'
      ? 'drink_items'
      : req.params.kind === 'food' ? 'food_items' : null;
    const id = Number(req.params.id);
    if (!table) return res.status(404).json({ error: 'Menu category not found.' });
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid menu item ID.' });
    const result = database.prepare(`UPDATE ${table} SET is_available = 0 WHERE id = ?`).run(id);
    if (!result.changes) return res.status(404).json({ error: 'Menu item not found.' });
    res.status(204).end();
  });

  router.get('/admin/customers', withError('load customers', (req, res) => {
    const search = safeText(req.query.search, 100);
    const customers = database.prepare(`
      SELECT c.id, c.full_name AS fullName, c.phone, c.email,
        (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id) AS bookingCount
      FROM customers c
      WHERE ? = '' OR c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
      ORDER BY c.id DESC LIMIT 500
    `).all(search, `%${search}%`, `%${search}%`, `%${search}%`);
    res.json(customers);
  }));

  router.get('/admin/customers/:id/bookings', withError('load customer booking history', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid customer ID.' });
    }
    const bookings = database.prepare(`
      SELECT booking_reference AS bookingReference, room_type AS roomType,
        check_in AS checkIn, check_out AS checkOut, total_price AS totalPrice,
        status, created_at AS createdAt
      FROM bookings WHERE customer_id = ? ORDER BY id DESC
    `).all(id);
    res.set('Cache-Control', 'no-store').json(bookings);
  }));

  router.get('/admin/reviews', withError('load guest reviews', (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status)
      ? req.query.status
      : 'pending';
    const reviews = database.prepare(`
      SELECT id, guest_name AS guestName, rating, review_text AS reviewText,
        status, created_at AS createdAt
      FROM guest_reviews WHERE status = ?
      ORDER BY created_at DESC, id DESC LIMIT 500
    `).all(status);
    res.set('Cache-Control', 'no-store').json(reviews);
  }));

  router.patch('/admin/reviews/:id', (req, res) => {
    const id = Number(req.params.id);
    const status = req.body && req.body.status;
    if (!Number.isSafeInteger(id) || id < 1 ||
        !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Choose approved or rejected for this review.' });
    }
    const result = database.prepare(`
      UPDATE guest_reviews SET status = ? WHERE id = ? AND status = 'pending'
    `).run(status, id);
    if (!result.changes) {
      return res.status(404).json({ error: 'Pending review not found or already moderated.' });
    }
    res.json({ id, status });
  });

  router.get('/admin/reports', withError('load reports', (req, res) => {
    const period = req.query.period === 'monthly' ? 'monthly' : 'daily';
    const dateFormat = period === 'monthly' ? '%Y-%m' : '%Y-%m-%d';
    const bookingSales = database.prepare(`
      SELECT strftime('${dateFormat}', p.verified_at) AS period,
        COUNT(DISTINCT b.id) AS count, COALESCE(SUM(p.amount), 0) AS revenue
      FROM payments p JOIN bookings b ON b.id = p.booking_id
      WHERE p.status = 'verified'
      GROUP BY period ORDER BY period DESC LIMIT 12
    `).all();
    const restaurantSales = database.prepare(`
      SELECT strftime('${dateFormat}', created_at) AS period,
        COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS revenue
      FROM restaurant_orders WHERE status = 'completed'
      GROUP BY period ORDER BY period DESC LIMIT 12
    `).all();
    res.json({ period, bookingSales, restaurantSales });
  }));

  router.patch('/admin/payments/:id', (req, res) => {
    const id = Number(req.params.id);
    const status = req.body && req.body.status;
    if (!Number.isSafeInteger(id) || id < 1 || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Choose verified or rejected as the payment status.' });
    }
    const result = database.prepare(`
      UPDATE payments SET status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
        AND booking_id IN (SELECT id FROM bookings WHERE status = 'confirmed')
    `).run(status, req.admin.adminId, id);
    if (!result.changes) {
      return res.status(404).json({ error: 'Payment for a confirmed booking was not found or was already processed.' });
    }
    res.json({ paymentId: id, status });
  });

  return router;
}

module.exports = { createHotelSystem };
