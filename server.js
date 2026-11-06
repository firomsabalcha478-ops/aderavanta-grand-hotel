const crypto = require('crypto');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const dotenv = require('dotenv');
const { createHotelSystem } = require('./lib/hotel-system');

const root = __dirname;
dotenv.config({ path: path.join(root, '.env') });

const app = express();
const database = new DatabaseSync(
  process.env.HOTEL_DATABASE_PATH || path.join(root, 'hotel.db')
);

const foodItems = [
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast'],
    name: 'Firfir',
    description: 'Torn injera tossed with a bright, gently spiced berbere sauce.',
    price: 180,
    image: 'firfir.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast'],
    name: 'Chechebsa',
    description: 'Warm torn flatbread tossed in spiced clarified butter.',
    price: 200,
    image: 'chechebsa.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast'],
    name: 'Kinche',
    description: 'Cracked wheat simmered until tender and finished with seasoned butter.',
    price: 150,
    image: 'kinche.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast'],
    name: 'Boiled Eggs',
    description: 'Farm-fresh boiled eggs served with warm bread.',
    price: 120,
    image: 'boiled-eggs.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast', 'Vegetarian Food'],
    name: 'Special Omelette',
    description: 'Fluffy eggs folded with fresh vegetables and herbs.',
    price: 180,
    image: 'special-omelette.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast', 'Meat Dishes'],
    name: 'Meat Firfir',
    description: 'Injera tossed with tender seasoned meat and Ethiopian spices.',
    price: 350,
    image: 'meat-firfir.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast', 'Meat Dishes'],
    name: 'Special Ethiopian Breakfast',
    description: 'A generous morning plate of eggs, bread, meat and tea.',
    price: 450,
    image: 'special-ethiopian-breakfast.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast', 'Vegetarian Food'],
    name: 'Bread with Honey',
    description: 'Freshly baked bread served with golden honey.',
    price: 140,
    image: 'bread-with-honey.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast', 'Drinks and Juices'],
    name: 'Ethiopian Coffee',
    description: 'Traditional Ethiopian coffee, freshly brewed.',
    price: 80,
    image: 'ethiopian-coffee.jpg'
  },
  {
    category: 'Ethiopian Breakfast',
    tags: ['Ethiopian Breakfast', 'Drinks and Juices'],
    name: 'Tea',
    description: 'A comforting cup of freshly steeped tea.',
    price: 60,
    image: 'tea.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Dinner'],
    name: 'Doro Wot with Boiled Egg',
    description: 'Slow-cooked, spicy chicken stew served with a boiled egg and injera.',
    price: 550,
    image: 'doro-wot.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Dinner'],
    name: 'Siga Wot',
    description: 'Tender beef simmered in a rich, slow-cooked berbere sauce.',
    price: 450,
    image: 'siga-wot.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Dinner'],
    name: 'Beef Tibs',
    description: 'Sizzling beef sautéed with onions, peppers and fragrant spices.',
    price: 500,
    image: 'beef-tibs.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Dinner'],
    name: 'Special Tibs',
    description: 'A premium shareable platter of sautéed beef and house spices.',
    price: 650,
    image: 'special-tibs.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Dinner'],
    name: 'Kitfo',
    description: 'A traditional minced-beef delicacy seasoned with mitmita and spiced butter.',
    price: 550,
    image: 'kitfo.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Vegetarian Food', 'Lunch'],
    name: 'Shiro',
    description: 'Silky chickpea stew gently simmered with garlic and berbere.',
    price: 220,
    image: 'shiro.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Vegetarian Food', 'Lunch'],
    name: 'Beyaynet',
    description: 'A colorful assortment of vegetarian stews served over injera.',
    price: 300,
    image: 'beyaynet.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Vegetarian Food', 'Dinner'],
    name: 'Misir Wot',
    description: 'Red lentils slow-cooked with berbere, onion and garlic.',
    price: 220,
    image: 'misir-wot.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Vegetarian Food', 'Dinner'],
    name: 'Gomen',
    description: 'Tender collard greens cooked with garlic and mild Ethiopian spices.',
    price: 200,
    image: 'gomen.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Dinner'],
    name: 'Dulet',
    description: 'A richly seasoned traditional blend of minced meat and herbs.',
    price: 380,
    image: 'dulet.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Dinner'],
    name: 'Gored Gored',
    description: 'Bite-sized beef tossed in a bold Ethiopian spiced-butter sauce.',
    price: 600,
    image: 'gored-gored.jpg'
  },
  {
    category: 'Ethiopian Traditional Food',
    tags: ['Ethiopian Traditional Food', 'Meat Dishes', 'Lunch'],
    name: 'Tibs Firfir',
    description: 'Injera pieces folded through hot, spiced beef tibs.',
    price: 420,
    image: 'tibs-firfir.jpg'
  },
  {
    category: 'Fast Food',
    tags: ['Fast Food', 'Lunch', 'Meat Dishes'],
    name: 'Chicken Burger',
    description: 'A grilled chicken burger with crisp lettuce and house sauce.',
    price: 450,
    image: 'chicken-burger.jpg'
  },
  {
    category: 'Fast Food',
    tags: ['Fast Food', 'Lunch', 'Meat Dishes'],
    name: 'Beef Burger',
    description: 'A juicy beef burger layered with fresh salad and house sauce.',
    price: 550,
    image: 'beef-burger.jpg'
  },
  {
    category: 'Fast Food',
    tags: ['Fast Food', 'Lunch'],
    name: 'Pizza',
    description: 'Oven-baked pizza with a golden crust and savory toppings.',
    price: 600,
    image: 'pizza.jpg'
  },
  {
    category: 'Fast Food',
    tags: ['Fast Food', 'Vegetarian Food', 'Lunch'],
    name: 'French Fries',
    description: 'Crisp golden fries, lightly seasoned and served hot.',
    price: 180,
    image: 'french-fries.jpg'
  },
  {
    category: 'Dinner',
    tags: ['Dinner', 'Meat Dishes'],
    name: 'Grilled Chicken',
    description: 'Herb-marinated chicken grilled until tender and golden.',
    price: 650,
    image: 'grilled-chicken.jpg'
  },
  {
    category: 'Lunch',
    tags: ['Lunch', 'Vegetarian Food'],
    name: 'Pasta',
    description: 'Pasta tossed with a rich house-made sauce and fresh herbs.',
    price: 400,
    image: 'pasta.jpg'
  },
  {
    category: 'Lunch',
    tags: ['Lunch', 'Fast Food'],
    name: 'Sandwich',
    description: 'A freshly assembled toasted sandwich with crisp garden vegetables.',
    price: 300,
    image: 'sandwich.jpg'
  },
  {
    category: 'Lunch',
    tags: ['Lunch', 'Vegetarian Food'],
    name: 'Fried Rice',
    description: 'Wok-tossed rice with vegetables, egg and a light savory seasoning.',
    price: 350,
    image: 'fried-rice.jpg'
  },
  {
    category: 'Drinks and Juices',
    tags: ['Drinks and Juices'],
    name: 'Fresh Fruit Juice',
    description: 'Freshly pressed seasonal fruit juice.',
    price: 150,
    image: 'fruit-juice.jpg'
  },
  {
    category: 'Drinks and Juices',
    tags: ['Drinks and Juices'],
    name: 'Fresh Mango Juice',
    description: 'A chilled, freshly blended mango juice.',
    price: 180,
    image: 'fresh-mango-juice.jpg'
  }
];

const drinkItems = [
  {
    category: 'Hot Drinks',
    name: 'Ethiopian Coffee',
    description: 'Freshly roasted Ethiopian beans brewed strong, aromatic and smooth.',
    price: 100,
    image: 'photo-1495474472287-4d71bcdd2085'
  },
  {
    category: 'Hot Drinks',
    name: 'Macchiato',
    description: 'A rich espresso finished with a delicate layer of steamed milk.',
    price: 90,
    image: 'photo-1509042239860-f550ce710b93'
  },
  {
    category: 'Hot Drinks',
    name: 'Tea',
    description: 'A soothing cup of freshly steeped tea, served just the way you like it.',
    price: 60,
    image: 'photo-1544787219-7f47ccb76574'
  },
  {
    category: 'Hot Drinks',
    name: 'Milk',
    description: 'A comforting glass of fresh, gently warmed milk.',
    price: 70,
    image: 'photo-1563636619-e9143da7973b'
  },
  {
    category: 'Hot Drinks',
    name: 'Hot Chocolate',
    description: 'Velvety hot chocolate finished with a soft, creamy foam.',
    price: 140,
    image: 'photo-1511920170033-f8396924c348'
  },
  {
    category: 'Fresh Juices',
    name: 'Mango Juice',
    description: 'Sweet, sun-ripened mango blended fresh and served chilled.',
    price: 160,
    image: 'photo-1622597467836-f3285f2131b8'
  },
  {
    category: 'Fresh Juices',
    name: 'Avocado Juice',
    description: 'A creamy, freshly blended avocado drink with a touch of honey.',
    price: 180,
    image: 'photo-1600271886742-f049cd451bba'
  },
  {
    category: 'Fresh Juices',
    name: 'Papaya Juice',
    description: 'Ripe papaya blended to a silky finish for a naturally sweet refreshment.',
    price: 150,
    image: 'photo-1613478223719-2ab802602423'
  },
  {
    category: 'Fresh Juices',
    name: 'Pineapple Juice',
    description: 'Bright, tangy pineapple juice pressed fresh and served over ice.',
    price: 160,
    image: 'photo-1556679343-c7306c1976bc'
  },
  {
    category: 'Fresh Juices',
    name: 'Watermelon Juice',
    description: 'Cool watermelon blended fresh for a light, hydrating treat.',
    price: 150,
    image: 'photo-1546173159-315724a31696'
  },
  {
    category: 'Fresh Juices',
    name: 'Mixed Fruit Juice',
    description: 'A vibrant blend of seasonal fruits, freshly prepared to order.',
    price: 200,
    image: 'photo-1544145945-f90425340c7e'
  },
  {
    category: 'Cold Drinks',
    name: 'Soft Drinks',
    description: 'Your choice of chilled, sparkling soft drink.',
    price: 100,
    image: 'photo-1554866585-cd94860890b7'
  },
  {
    category: 'Cold Drinks',
    name: 'Mineral Water',
    description: 'Refreshing bottled mineral water, served cold.',
    price: 50,
    image: 'photo-1564419320461-6870880221ad'
  },
  {
    category: 'Cold Drinks',
    name: 'Fresh Lemonade',
    description: 'Freshly squeezed lemon, a hint of sweetness and plenty of ice.',
    price: 120,
    image: 'photo-1544145945-f90425340c7e'
  },
  {
    category: 'Cold Drinks',
    name: 'Iced Coffee',
    description: 'Bold chilled coffee poured over ice with a smooth finish.',
    price: 150,
    image: 'photo-1517701604599-bb29b565090c'
  },
  {
    category: 'Cold Drinks',
    name: 'Smoothies',
    description: 'A thick, refreshing smoothie blended with ripe seasonal fruit.',
    price: 220,
    image: 'photo-1577805947697-89e18249d767'
  },
  {
    category: 'Special Drinks',
    name: 'Special Ethiopian Coffee Ceremony',
    description: 'A memorable traditional coffee ceremony with freshly roasted beans and warm hospitality.',
    price: 450,
    image: 'photo-1511920170033-f8396924c348'
  },
  {
    category: 'Special Drinks',
    name: 'Fresh Fruit Cocktail',
    description: 'A colorful medley of fresh-cut seasonal fruit, layered and chilled.',
    price: 280,
    image: 'photo-1546173159-315724a31696'
  },
  {
    category: 'Special Drinks',
    name: 'Special Mixed Juice',
    description: 'Our signature layered mix of freshly prepared tropical fruit juices.',
    price: 250,
    image: 'photo-1547595628-c61a29f496f0'
  }
];

const bookingRoomTypes = [
  // Starter ETB rates and capacities; replace these with the hotel's actual inventory.
  { name: 'Standard Room', nightlyRate: 1200, capacity: 20 },
  { name: 'Deluxe Room', nightlyRate: 1800, capacity: 12 },
  { name: 'VIP Suite', nightlyRate: 3500, capacity: 5 },
  { name: 'Suite', nightlyRate: 3000, capacity: 6 },
  { name: 'Twin Room', nightlyRate: 2200, capacity: 10 },
  { name: 'Family Room', nightlyRate: 3200, capacity: 6 },
  { name: 'Shared Bed Space', nightlyRate: 500, capacity: 30 },
  { name: 'Conference / Event', nightlyRate: 5000, capacity: 2 }
];

database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS room_inventory (
    room_type TEXT PRIMARY KEY,
    available_rooms INTEGER
  );
  CREATE TABLE IF NOT EXISTS food_menu (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price_etb INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS food_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    room_number TEXT,
    service_type TEXT NOT NULL CHECK (service_type IN ('dine-in', 'room-service')),
    total_price INTEGER NOT NULL CHECK (total_price >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS food_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES food_orders(id) ON DELETE CASCADE,
    food_id INTEGER NOT NULL REFERENCES food_menu(id),
    food_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
    line_total INTEGER NOT NULL CHECK (line_total >= 0)
  );
  CREATE TABLE IF NOT EXISTS booking_room_types (
    room_type TEXT PRIMARY KEY,
    nightly_rate INTEGER NOT NULL CHECK (nightly_rate > 0),
    capacity INTEGER NOT NULL CHECK (capacity > 0)
  );
  CREATE TABLE IF NOT EXISTS room_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    room_type TEXT NOT NULL REFERENCES booking_room_types(room_type),
    floor TEXT,
    guests INTEGER NOT NULL CHECK (guests > 0),
    room_count INTEGER NOT NULL DEFAULT 1 CHECK (room_count > 0),
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    nights INTEGER NOT NULL CHECK (nights > 0),
    nightly_rate INTEGER NOT NULL CHECK (nightly_rate > 0),
    total_price INTEGER NOT NULL CHECK (total_price > 0),
    payment_method TEXT NOT NULL,
    special_requests TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed'
      CHECK (status IN ('confirmed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS room_bookings_dates
    ON room_bookings (room_type, check_in, check_out, status);
`);

const upsertBookingRoomType = database.prepare(`
  INSERT INTO booking_room_types (room_type, nightly_rate, capacity)
  VALUES (?, ?, ?)
  ON CONFLICT(room_type) DO UPDATE SET
    nightly_rate = excluded.nightly_rate,
    capacity = excluded.capacity
`);

bookingRoomTypes.forEach((room) => upsertBookingRoomType.run(
  room.name,
  room.nightlyRate,
  room.capacity
));

function ensureColumn(table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('food_menu', 'image_path', 'TEXT');
ensureColumn('food_menu', 'tags', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('food_menu', 'is_drink', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('food_menu', 'display_name', 'TEXT');
ensureColumn('room_bookings', 'room_count', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('food_orders', 'service_mode', 'TEXT');
ensureColumn('food_orders', 'table_number', 'INTEGER');

const insertFood = database.prepare(`
  INSERT INTO food_menu
    (category, name, description, price_etb, image_path, tags, is_drink, display_name)
  VALUES (?, ?, ?, ?, ?, ?, 0, NULL)
  ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    image_path = excluded.image_path,
    tags = excluded.tags,
    is_drink = 0,
    display_name = NULL
`);

for (const item of foodItems) {
  insertFood.run(
    item.category,
    item.name,
    item.description,
    item.price,
    `/public/images/food/${item.image}`,
    JSON.stringify(item.tags)
  );
}

const insertDrink = database.prepare(`
  INSERT INTO food_menu
    (category, name, description, price_etb, image_path, tags, is_drink, display_name)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    description = excluded.description,
    price_etb = excluded.price_etb,
    image_path = excluded.image_path,
    tags = excluded.tags,
    is_drink = 1,
    display_name = excluded.display_name
`);

for (const item of drinkItems) {
  const drinkKey = `drink:${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  insertDrink.run(
    item.category,
    drinkKey,
    item.description,
    item.price,
    `https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=800&q=85`,
    JSON.stringify([item.category]),
    item.name
  );
}

const roomInventory = database.prepare(
  'INSERT OR IGNORE INTO room_inventory (room_type, available_rooms) VALUES (?, ?)'
);

[
  ['Standard Room', 2000],
  ['VIP Suite', 200],
  ['Suite', 150],
  ['Deluxe Room', null],
  ['Twin Room', null],
  ['Family Room', null],
  ['Shared Bed Space', null]
].forEach((room) => roomInventory.run(...room));

app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));
app.use('/api', createHotelSystem(database));

function sendErrorPage(res, statusCode, title, message) {
  res.status(statusCode).type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusCode} | Aderavanta Grand Hotel</title>
</head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#233b35">
  <p style="color:#926b35;font-weight:bold;letter-spacing:.15em">ADERAVANTA GRAND HOTEL</p>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="/">Return to homepage</a>
</body>
</html>`);
}

function getAdminToken() {
  return process.env.ADMIN_API_TOKEN || process.env.ADMIN_KEY || '';
}

function requireAdmin(req, res, next) {
  const configuredToken = getAdminToken();
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/i);

  if (configuredToken.length < 32) {
    return res.status(503).json({
      error: 'Admin access is unavailable until a 32-character ADMIN_API_TOKEN is configured.'
    });
  }

  if (!match) {
    return res.status(401).json({ error: 'Admin authentication is required.' });
  }

  const supplied = Buffer.from(match[1]);
  const expected = Buffer.from(configuredToken);
  if (supplied.length !== expected.length ||
      !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Admin token is invalid.' });
  }

  next();
}

function readMenu(isDrink) {
  return database.prepare(`
    SELECT id, category, COALESCE(display_name, name) AS name,
           description, price_etb, image_path, tags
    FROM food_menu
    WHERE image_path IS NOT NULL AND is_drink = ?
    ORDER BY id
  `).all(isDrink ? 1 : 0).map((food) => ({
    id: food.id,
    category: food.category,
    categories: JSON.parse(food.tags),
    name: food.name,
    description: food.description,
    price: food.price_etb,
    price_etb: food.price_etb,
    image: food.image_path
  }));
}

app.get('/api/food', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store').json(readMenu(false));
  } catch (error) {
    console.error('Unable to load food menu:', error);
    res.status(500).json({ error: 'Unable to load the food menu.' });
  }
});

app.get('/api/food-menu', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store').json(readMenu(false));
  } catch (error) {
    console.error('Unable to load food menu:', error);
    res.status(500).json({ error: 'Unable to load the food menu.' });
  }
});

app.get('/api/drinks', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store').json(readMenu(true));
  } catch (error) {
    console.error('Unable to load drinks menu:', error);
    res.status(500).json({ error: 'Unable to load the drinks menu.' });
  }
});

app.get('/api/rooms', (req, res) => {
  try {
    res.json(database.prepare(
      'SELECT room_type, available_rooms FROM room_inventory ORDER BY room_type'
    ).all());
  } catch (error) {
    console.error('Unable to load room inventory:', error);
    res.status(500).json({ error: 'Unable to load room inventory.' });
  }
});

app.get('/api/booking-rooms', (req, res) => {
  try {
    const rooms = database.prepare(`
      SELECT room_type AS roomType, nightly_rate AS nightlyRate, capacity
      FROM booking_room_types
      ORDER BY room_type
    `).all();
    res.set('Cache-Control', 'no-store').json(rooms);
  } catch (error) {
    console.error('Unable to load booking room types:', error);
    res.status(500).json({ error: 'Unable to load room booking information.' });
  }
});

function parseBookingDates(checkIn, checkOut) {
  if (typeof checkIn !== 'string' || typeof checkOut !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return null;
  }

  const arrival = new Date(`${checkIn}T00:00:00.000Z`);
  const departure = new Date(`${checkOut}T00:00:00.000Z`);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime()) ||
      arrival.toISOString().slice(0, 10) !== checkIn ||
      departure.toISOString().slice(0, 10) !== checkOut) {
    return null;
  }

  const nights = Math.round((departure.getTime() - arrival.getTime()) / 86400000);
  const today = new Date().toISOString().slice(0, 10);
  if (checkIn < today || nights < 1 || nights > 365) {
    return null;
  }

  return { nights };
}

app.get('/api/booking-availability', (req, res) => {
  const roomType = typeof req.query.roomType === 'string' ? req.query.roomType : '';
  const dates = parseBookingDates(req.query.checkIn, req.query.checkOut);
  const roomCount = req.query.roomCount === undefined ? 1 : Number(req.query.roomCount);
  if (!dates) {
    return res.status(400).json({ error: 'Choose valid future check-in and check-out dates.' });
  }
  if (!Number.isSafeInteger(roomCount) || roomCount < 1 || roomCount > 10) {
    return res.status(400).json({ error: 'Choose between 1 and 10 rooms or beds.' });
  }

  try {
    const roomTypeInfo = database.prepare(`
      SELECT capacity, nightly_rate FROM booking_room_types WHERE room_type = ?
    `).get(roomType);
    if (!roomTypeInfo) {
      return res.status(400).json({ error: 'Choose a valid room type.' });
    }

    const bookedRooms = database.prepare(`
      SELECT COALESCE(SUM(room_count), 0) AS count
      FROM room_bookings
      WHERE room_type = ?
        AND status = 'confirmed'
        AND check_in < ?
        AND check_out > ?
    `).get(roomType, req.query.checkOut, req.query.checkIn).count;
    const availableRooms = Math.max(0, roomTypeInfo.capacity - bookedRooms);
    res.set('Cache-Control', 'no-store').json({
      roomType,
      available: availableRooms >= roomCount,
      availableRooms,
      requestedRooms: roomCount,
      nightlyRate: roomTypeInfo.nightly_rate,
      nights: dates.nights
    });
  } catch (error) {
    console.error('Unable to check room availability:', error);
    res.status(500).json({ error: 'Unable to check room availability.' });
  }
});

app.post('/api/bookings', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'A JSON booking is required.' });
  }

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const roomType = typeof body.roomType === 'string' ? body.roomType.trim() : '';
  const floor = typeof body.floor === 'string' ? body.floor.trim() : '';
  const paymentMethod = typeof body.paymentMethod === 'string'
    ? body.paymentMethod.trim()
    : '';
  const specialRequests = typeof body.specialRequests === 'string'
    ? body.specialRequests.trim()
    : '';
  const dates = parseBookingDates(body.checkIn, body.checkOut);

  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,79}$/u.test(customerName)) {
    return res.status(400).json({ error: 'Enter a valid full name (2-80 characters).' });
  }

  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[0-9\s()-]{7,20}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return res.status(400).json({ error: 'Enter a valid phone number.' });
  }

  if (email.length > 254 || email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  if (!dates) {
    return res.status(400).json({
      error: 'Choose valid future check-in and check-out dates, up to 365 nights.'
    });
  }

  if (!Number.isSafeInteger(body.guests) || body.guests < 1 || body.guests > 10) {
    return res.status(400).json({ error: 'Choose between 1 and 10 guests.' });
  }

  if (!Number.isSafeInteger(body.roomCount) || body.roomCount < 1 || body.roomCount > 10) {
    return res.status(400).json({ error: 'Choose between 1 and 10 rooms or beds.' });
  }

  if (!['', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'].includes(floor)) {
    return res.status(400).json({ error: 'Choose a valid preferred floor.' });
  }

  if (!['Cash at Hotel', 'Telebirr', 'Bank Transfer', 'Bank Card',
    'PayPal', 'Discuss with Hotel'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Choose a valid payment method.' });
  }

  if (specialRequests.length > 500) {
    return res.status(400).json({ error: 'Special requests must be 500 characters or fewer.' });
  }

  try {
    database.exec('BEGIN IMMEDIATE');
    try {
      const room = database.prepare(`
        SELECT nightly_rate, capacity
        FROM booking_room_types
        WHERE room_type = ?
      `).get(roomType);
      if (!room) {
        database.exec('ROLLBACK');
        return res.status(400).json({ error: 'Choose a valid room type.' });
      }

      const bookedRooms = database.prepare(`
        SELECT COALESCE(SUM(room_count), 0) AS count
        FROM room_bookings
        WHERE room_type = ?
          AND status = 'confirmed'
          AND check_in < ?
          AND check_out > ?
      `).get(roomType, body.checkOut, body.checkIn).count;
      if (bookedRooms + body.roomCount > room.capacity) {
        database.exec('ROLLBACK');
        return res.status(409).json({
          error: 'This room type is unavailable for those dates. Please choose different dates or a different room.'
        });
      }

      const totalPrice = room.nightly_rate * dates.nights * body.roomCount;
      const result = database.prepare(`
        INSERT INTO room_bookings (
          customer_name, phone, email, room_type, floor, guests, room_count,
          check_in, check_out, nights, nightly_rate, total_price,
          payment_method, special_requests
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerName,
        phone,
        email || null,
        roomType,
        floor || null,
        body.guests,
        body.roomCount,
        body.checkIn,
        body.checkOut,
        dates.nights,
        room.nightly_rate,
        totalPrice,
        paymentMethod,
        specialRequests || null
      );
      const bookingId = Number(result.lastInsertRowid);
      database.exec('COMMIT');

      return res.status(201).json({
        bookingId,
        status: 'confirmed',
        customerName,
        roomType,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        guests: body.guests,
        roomCount: body.roomCount,
        floor: floor || null,
        nights: dates.nights,
        nightlyRate: room.nightly_rate,
        totalPrice
      });
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Unable to save room booking:', error);
    return res.status(500).json({ error: 'Unable to save your booking. Please try again.' });
  }
});

app.post('/api/orders', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'A JSON order is required.' });
  }

  const customerName = typeof body.customerName === 'string'
    ? body.customerName.trim()
    : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const roomNumber = typeof body.roomNumber === 'string'
    ? body.roomNumber.trim()
    : '';
  const rawTableNumber = body.tableNumber;
  const tableNumber = rawTableNumber === '' || rawTableNumber === undefined ||
      rawTableNumber === null
    ? null
    : Number(rawTableNumber);
  const serviceType = body.serviceType;
  const items = body.items;

  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,79}$/u.test(customerName)) {
    return res.status(400).json({ error: 'Enter a valid full name (2-80 characters).' });
  }

  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[0-9\s()-]{7,20}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return res.status(400).json({ error: 'Enter a valid phone number.' });
  }

  if (!['dine-in', 'takeaway', 'room-service'].includes(serviceType)) {
    return res.status(400).json({ error: 'Choose dine-in, takeaway, or room service.' });
  }

  if (serviceType === 'dine-in' &&
      (!Number.isSafeInteger(tableNumber) || tableNumber < 1 || tableNumber > 99)) {
    return res.status(400).json({ error: 'A valid table number (1-99) is required for dine-in.' });
  }

  if (serviceType === 'room-service' && !roomNumber) {
    return res.status(400).json({ error: 'A room number is required for room service.' });
  }

  if (roomNumber && !/^[A-Za-z0-9-]{1,12}$/.test(roomNumber)) {
    return res.status(400).json({ error: 'Enter a valid room number.' });
  }

  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    return res.status(400).json({ error: 'Add between 1 and 20 different menu items.' });
  }

  const seenFoodIds = new Set();
  for (const item of items) {
    if (!item || !Number.isSafeInteger(item.foodId) || item.foodId < 1 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return res.status(400).json({ error: 'Each menu item needs a valid item and quantity (1-20).' });
    }

    if (seenFoodIds.has(item.foodId)) {
      return res.status(400).json({ error: 'Each menu item can only appear once in the order.' });
    }
    seenFoodIds.add(item.foodId);
  }

  try {
    const placeholders = items.map(() => '?').join(', ');
    const foods = database.prepare(`
      SELECT id, COALESCE(display_name, name) AS name, price_etb
      FROM food_menu
      WHERE image_path IS NOT NULL AND id IN (${placeholders})
    `).all(...items.map((item) => item.foodId));

    if (foods.length !== items.length) {
      return res.status(400).json({ error: 'One or more selected menu items are unavailable.' });
    }

    const foodById = new Map(foods.map((food) => [food.id, food]));
    const orderItems = items.map((item) => {
      const food = foodById.get(item.foodId);
      return {
        foodId: food.id,
        name: food.name,
        quantity: item.quantity,
        unitPrice: food.price_etb,
        lineTotal: food.price_etb * item.quantity
      };
    });
    const totalPrice = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    database.exec('BEGIN IMMEDIATE');
    try {
      const result = database.prepare(`
        INSERT INTO food_orders
          (customer_name, phone, room_number, service_type, service_mode, table_number, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        customerName,
        phone,
        serviceType === 'room-service' ? roomNumber : null,
        serviceType === 'takeaway' ? 'dine-in' : serviceType,
        serviceType === 'takeaway' ? 'takeaway' : null,
        serviceType === 'dine-in' ? tableNumber : null,
        totalPrice
      );
      const orderId = Number(result.lastInsertRowid);
      const insertOrderItem = database.prepare(`
        INSERT INTO food_order_items
          (order_id, food_id, food_name, quantity, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      orderItems.forEach((item) => insertOrderItem.run(
        orderId,
        item.foodId,
        item.name,
        item.quantity,
        item.unitPrice,
        item.lineTotal
      ));

      database.exec('COMMIT');
      return res.status(201).json({
        orderId,
        status: 'pending',
        serviceType,
        tableNumber: serviceType === 'dine-in' ? tableNumber : null,
        totalPrice,
        items: orderItems
      });
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Unable to save food order:', error);
    return res.status(500).json({ error: 'Unable to save your order. Please try again.' });
  }
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  try {
    const orders = database.prepare(`
      SELECT id, customer_name, phone, room_number,
             COALESCE(service_mode, service_type) AS service_type,
             table_number, total_price, status,
             created_at, updated_at
      FROM food_orders
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 200
    `).all();

    if (orders.length === 0) {
      return res.set('Cache-Control', 'no-store').json([]);
    }

    const placeholders = orders.map(() => '?').join(', ');
    const orderItems = database.prepare(`
      SELECT order_id, food_id, food_name, quantity, unit_price, line_total
      FROM food_order_items
      WHERE order_id IN (${placeholders})
      ORDER BY id
    `).all(...orders.map((order) => order.id));
    const itemsByOrder = new Map();

    orderItems.forEach((item) => {
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }
      itemsByOrder.get(item.order_id).push({
        foodId: item.food_id,
        name: item.food_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total
      });
    });

    res.set('Cache-Control', 'no-store').json(orders.map((order) => ({
      id: order.id,
      customerName: order.customer_name,
      phone: order.phone,
      roomNumber: order.room_number,
      tableNumber: order.table_number,
      serviceType: order.service_type,
      totalPrice: order.total_price,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: itemsByOrder.get(order.id) || []
    })));
  } catch (error) {
    console.error('Unable to load food orders:', error);
    res.status(500).json({ error: 'Unable to load food orders.' });
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const orderId = Number(req.params.id);
  const status = req.body && req.body.status;

  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return res.status(400).json({ error: 'A valid order ID is required.' });
  }

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Order status must be accepted or rejected.' });
  }

  try {
    const result = database.prepare(`
      UPDATE food_orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, orderId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({ orderId, status });
  } catch (error) {
    console.error(`Unable to update order ${orderId}:`, error);
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(root, 'admin.html')));
app.use('/css', express.static(path.join(root, 'css'), { index: false }));
app.use('/images', express.static(path.join(root, 'images'), { index: false }));
app.use('/public', express.static(path.join(root, 'public'), { index: false }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }

  sendErrorPage(
    res,
    404,
    'We couldn’t find that page',
    'The page may have moved or the address may be incorrect.'
  );
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }

  console.error('Unhandled request error:', error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    const address = server.address();
    console.log(`Hotel Reservation running at http://localhost:${address.port}`);
  });
  server.on('close', () => database.close());
}

module.exports = { app, database, foodItems };
