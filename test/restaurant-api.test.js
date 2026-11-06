const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hotel-orders-'));
process.env.HOTEL_DATABASE_PATH = path.join(temporaryDirectory, 'hotel.db');
process.env.ADMIN_API_TOKEN = 'test-admin-token-with-more-than-32-characters';

const { app, database } = require('../server');

let server;
let baseUrl;
let savedOrderId;
let savedDrinkOrderId;
let selectedFoods;
let selectedDrink;

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

test('food menu returns local photos and all requested categories', async function () {
  const response = await fetch(`${baseUrl}/api/food`);
  assert.equal(response.status, 200);
  const foods = await response.json();

  assert.equal(foods.length, 32);
  assert.equal(new Set(foods.map((food) => food.image)).size, foods.length);
  const imageHashes = foods.map((food) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, '..', food.image.slice(1))))
    .digest('hex'));
  assert.equal(new Set(imageHashes).size, foods.length);
  assert.ok(foods.every((food) => food.image.startsWith('/public/images/food/')));
  assert.ok(foods.every((food) => fs.existsSync(path.join(
    __dirname,
    '..',
    food.image.slice(1)
  ))));
  const foodNames = new Set(foods.map((food) => food.name));
  [
    'Firfir',
    'Chechebsa',
    'Kinche',
    'Boiled Eggs',
    'Special Omelette',
    'Meat Firfir',
    'Special Ethiopian Breakfast',
    'Bread with Honey',
    'Ethiopian Coffee',
    'Tea',
    'Doro Wot with Boiled Egg',
    'Siga Wot',
    'Beef Tibs',
    'Special Tibs',
    'Kitfo',
    'Shiro',
    'Beyaynet',
    'Misir Wot',
    'Gomen',
    'Dulet',
    'Gored Gored',
    'Tibs Firfir',
    'Chicken Burger',
    'Beef Burger',
    'Pizza',
    'French Fries',
    'Grilled Chicken',
    'Pasta',
    'Sandwich',
    'Fried Rice'
  ].forEach((name) => assert.ok(foodNames.has(name), `${name} is on the menu`));
  assert.ok(foods.some((food) => food.categories.includes('Vegetarian Food')));
  assert.ok(foods.some((food) => food.categories.includes('Drinks and Juices')));
  const menuCategories = new Set(foods.flatMap((food) => food.categories));
  [
    'Ethiopian Breakfast',
    'Ethiopian Traditional Food',
    'Lunch',
    'Dinner',
    'Meat Dishes',
    'Vegetarian Food',
    'Fast Food',
    'Drinks and Juices'
  ].forEach((category) => assert.ok(menuCategories.has(category), `${category} is available`));

  selectedFoods = [foods.find((food) => food.name === 'Firfir'), foods.find((food) => food.name === 'Doro Wot with Boiled Egg')];
  assert.ok(selectedFoods.every(Boolean));
});

test('drinks menu returns all requested categories with descriptions, prices, and photos', async function () {
  const response = await fetch(`${baseUrl}/api/drinks`);
  assert.equal(response.status, 200);
  const drinks = await response.json();

  assert.equal(drinks.length, 19);
  assert.ok(drinks.every((drink) => drink.description.length > 0));
  assert.ok(drinks.every((drink) => Number.isSafeInteger(drink.price) && drink.price > 0));
  assert.ok(drinks.every((drink) => /^https:\/\/images\.unsplash\.com\/photo-/.test(drink.image)));

  const drinksByName = new Map(drinks.map((drink) => [drink.name, drink]));
  [
    'Ethiopian Coffee',
    'Macchiato',
    'Tea',
    'Milk',
    'Hot Chocolate',
    'Mango Juice',
    'Avocado Juice',
    'Papaya Juice',
    'Pineapple Juice',
    'Watermelon Juice',
    'Mixed Fruit Juice',
    'Soft Drinks',
    'Mineral Water',
    'Fresh Lemonade',
    'Iced Coffee',
    'Smoothies',
    'Special Ethiopian Coffee Ceremony',
    'Fresh Fruit Cocktail',
    'Special Mixed Juice'
  ].forEach((name) => assert.ok(drinksByName.has(name), `${name} is on the drinks menu`));

  const categories = new Set(drinks.map((drink) => drink.category));
  ['Hot Drinks', 'Fresh Juices', 'Cold Drinks', 'Special Drinks']
    .forEach((category) => assert.ok(categories.has(category), `${category} is available`));
  selectedDrink = drinksByName.get('Mango Juice');
});

test('drink orders use the shared order API and are saved with server-calculated prices', async function () {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Abebe Mekonnen',
      phone: '+251911234567',
      roomNumber: '204',
      serviceType: 'room-service',
      items: [{ foodId: selectedDrink.id, quantity: 2 }]
    })
  });

  assert.equal(response.status, 201);
  const order = await response.json();
  savedDrinkOrderId = order.orderId;
  assert.equal(order.totalPrice, selectedDrink.price * 2);
  assert.equal(order.items[0].name, 'Mango Juice');
  assert.equal(order.items[0].unitPrice, selectedDrink.price);
});

test('order validates room service details and calculates total from database prices', async function () {
  const invalidResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Abebe Mekonnen',
      phone: '+251911234567',
      serviceType: 'room-service',
      items: [{ foodId: selectedFoods[0].id, quantity: 1 }]
    })
  });
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).error, /room number/i);

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Abebe Mekonnen',
      phone: '+251911234567',
      roomNumber: '204',
      serviceType: 'room-service',
      totalPrice: 1,
      items: [
        { foodId: selectedFoods[0].id, quantity: 2, price: 1 },
        { foodId: selectedFoods[1].id, quantity: 1, price: 1 }
      ]
    })
  });

  assert.equal(response.status, 201);
  const order = await response.json();
  savedOrderId = order.orderId;
  assert.equal(order.status, 'pending');
  assert.equal(
    order.totalPrice,
    selectedFoods[0].price * 2 + selectedFoods[1].price
  );
  assert.equal(order.items[0].unitPrice, selectedFoods[0].price);
});

test('dine-in requires a table and takeaway is saved distinctly', async function () {
  const missingTable = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Abebe Mekonnen',
      phone: '+251911234567',
      serviceType: 'dine-in',
      items: [{ foodId: selectedFoods[0].id, quantity: 1 }]
    })
  });
  assert.equal(missingTable.status, 400);
  assert.match((await missingTable.json()).error, /table number/i);

  const takeaway = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Abebe Mekonnen',
      phone: '+251911234567',
      serviceType: 'takeaway',
      items: [{ foodId: selectedFoods[0].id, quantity: 1 }]
    })
  });
  assert.equal(takeaway.status, 201);
  const takeawayOrder = await takeaway.json();
  assert.equal(takeawayOrder.serviceType, 'takeaway');

  const dineIn = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Abebe Mekonnen',
      phone: '+251911234567',
      serviceType: 'dine-in',
      tableNumber: 12,
      items: [{ foodId: selectedFoods[0].id, quantity: 1 }]
    })
  });
  assert.equal(dineIn.status, 201);
  assert.equal((await dineIn.json()).tableNumber, 12);
});

test('admin orders require authentication, return order details, and update status', async function () {
  const unauthorized = await fetch(`${baseUrl}/api/admin/orders`);
  assert.equal(unauthorized.status, 401);

  const headers = { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` };
  const response = await fetch(`${baseUrl}/api/admin/orders`, { headers });
  assert.equal(response.status, 200);
  const orders = await response.json();
  const order = orders.find((entry) => entry.id === savedOrderId);
  const takeawayOrder = orders.find((entry) => entry.serviceType === 'takeaway');

  assert.ok(order);
  assert.ok(takeawayOrder);
  assert.equal(takeawayOrder.tableNumber, null);
  assert.equal(order.customerName, 'Abebe Mekonnen');
  assert.equal(order.roomNumber, '204');
  assert.equal(order.items.length, 2);

  const invalidStatus = await fetch(`${baseUrl}/api/admin/orders/${savedOrderId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'paid' })
  });
  assert.equal(invalidStatus.status, 400);

  const updated = await fetch(`${baseUrl}/api/admin/orders/${savedOrderId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'accepted' })
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), { orderId: savedOrderId, status: 'accepted' });

  const rejected = await fetch(`${baseUrl}/api/admin/orders/${savedOrderId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'rejected' })
  });
  assert.equal(rejected.status, 200);
  assert.deepEqual(await rejected.json(), { orderId: savedOrderId, status: 'rejected' });
});

test('static serving protects environment and database files', async function () {
  assert.equal((await fetch(`${baseUrl}/`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/admin`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/.env`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/hotel.db`)).status, 404);
});
