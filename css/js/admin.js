const loginForm = document.getElementById("adminLoginForm");
const loginSection = document.getElementById("adminLoginSection");
const dashboard = document.getElementById("adminDashboard");
const loginTitle = document.getElementById("adminLoginTitle");
const loginDescription = document.getElementById("adminLoginDescription");
const loginMessage = document.getElementById("adminLoginMessage");
const loginButton = document.getElementById("adminLoginButton");
const usernameInput = document.getElementById("adminUsername");
const passwordInput = document.getElementById("adminPassword");
const dashboardMessage = document.getElementById("dashboardMessage");
const apiRoot = "/api/admin";
let setupRequired = false;
let currentAdmin = "";

function message(element, text, isError) {
    element.textContent = text;
    element.classList.toggle("is-error", Boolean(isError));
    element.classList.toggle("is-success", Boolean(text) && !isError);
}

async function request(path, options) {
    const response = await fetch(`${apiRoot}${path}`, {
        credentials: "same-origin",
        ...options,
        headers: {
            ...(options && options.headers),
            ...(options && options.body ? { "Content-Type": "application/json" } : {})
        }
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) {
        throw new Error(result && result.error ? result.error : "The request could not be completed.");
    }
    return result;
}

function etb(value) {
    return `${new Intl.NumberFormat("en").format(value)} ETB`;
}

async function uploadImage(file, imageInput) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        message(dashboardMessage, "Images must be no larger than 2 MB.", true);
        return;
    }
    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(reader.result));
            reader.addEventListener("error", () => reject(new Error("Unable to read the selected image.")));
            reader.readAsDataURL(file);
        });
        const result = await request("/upload", {
            method: "POST",
            body: JSON.stringify({ image: dataUrl })
        });
        imageInput.value = result.image;
        message(dashboardMessage, "Image uploaded. Save the menu item to publish it.", false);
    } catch (error) {
        console.error("Unable to upload menu image:", error);
        message(dashboardMessage, error.message, true);
    }
}

function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function setAuthenticated(username) {
    currentAdmin = username;
    loginSection.hidden = true;
    dashboard.hidden = false;
    document.getElementById("adminWelcome").textContent = `Signed in as ${username}`;
    loadOverview();
}

function configureLogin(isSetup) {
    setupRequired = isSetup;
    loginTitle.textContent = isSetup ? "Create your administrator account" : "Administrator sign in";
    loginDescription.textContent = isSetup
        ? "First run only: create a username and a strong password of at least 12 characters."
        : "Sign in with your administrator username and password.";
    passwordInput.autocomplete = isSetup ? "new-password" : "current-password";
    passwordInput.minLength = isSetup ? 12 : 1;
    const confirmGroup = document.getElementById("adminConfirmGroup");
    const confirmPassword = document.getElementById("adminConfirmPassword");
    confirmGroup.hidden = !isSetup;
    confirmPassword.required = isSetup;
    loginButton.textContent = isSetup ? "Create administrator" : "Sign in";
}

async function initialize() {
    try {
        const status = await fetch(`${apiRoot}/status`, { cache: "no-store" });
        if (!status.ok) throw new Error("Unable to load administrator status.");
        const info = await status.json();
        configureLogin(info.setupRequired);
        if (info.authenticated) {
            const session = await request("/session");
            setAuthenticated(session.username);
            return;
        }
        loginSection.hidden = false;
    } catch (error) {
        console.error("Unable to initialize dashboard:", error);
        message(loginMessage, error.message, true);
    }
}

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (setupRequired && password !== document.getElementById("adminConfirmPassword").value) {
        message(loginMessage, "The passwords do not match.", true);
        return;
    }

    loginButton.disabled = true;
    message(loginMessage, setupRequired ? "Creating administrator account…" : "Signing in…", false);
    try {
        const result = await request(setupRequired ? "/setup" : "/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
        passwordInput.value = "";
        document.getElementById("adminConfirmPassword").value = "";
        setAuthenticated(result.username);
    } catch (error) {
        console.error("Administrator authentication failed:", error);
        message(loginMessage, error.message, true);
    } finally {
        loginButton.disabled = false;
    }
});

document.getElementById("adminLogout").addEventListener("click", async function () {
    try {
        await request("/logout", { method: "POST" });
        dashboard.hidden = true;
        loginSection.hidden = false;
        loginForm.reset();
        message(loginMessage, "You have signed out.", false);
        currentAdmin = "";
    } catch (error) {
        console.error("Unable to sign out:", error);
        message(dashboardMessage, error.message, true);
    }
});

document.querySelector(".admin-tabs").addEventListener("click", function (event) {
    const tab = event.target.closest("[data-panel]");
    if (!tab) return;
    document.querySelectorAll(".admin-tab").forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
        const active = panel.id === `panel-${tab.dataset.panel}`;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
    });
    loadPanel(tab.dataset.panel);
});

async function loadPanel(name) {
    const loaders = {
        overview: loadOverview,
        rooms: loadRooms,
        bookings: loadBookings,
        restaurant: loadOrders,
        menu: loadMenu,
        customers: loadCustomers,
        reports: loadReports
    };
    if (loaders[name]) await loaders[name]();
}

async function loadOverview() {
    try {
        const [stats, bookings] = await Promise.all([
            request("/summary"),
            request("/bookings")
        ]);
        const metrics = [
            ["Total bookings", stats.totalBookings],
            ["Pending", stats.pendingBookings],
            ["Confirmed", stats.confirmedBookings],
            ["Cancelled", stats.cancelledBookings],
            ["Rejected", stats.rejectedBookings],
            ["Restaurant orders", stats.totalRestaurantOrders],
            ["Recorded revenue", etb(stats.revenue)]
        ];
        const container = document.getElementById("adminSummary");
        container.replaceChildren(...metrics.map(([label, value]) => {
            const card = node("div", "admin-summary-card");
            card.append(node("span", "", label), node("strong", "", String(value)));
            return card;
        }));

        const payments = document.getElementById("pendingPayments");
        payments.replaceChildren();
        const pending = bookings.filter((booking) =>
            booking.status === "confirmed" && booking.paymentStatus === "pending"
        );
        if (!pending.length) {
            payments.appendChild(node("p", "", "There are no payments waiting for verification."));
        }
        pending.forEach((booking) => {
            const row = node("article", "admin-card");
            row.append(
                node("h3", "", `${booking.bookingReference} · ${booking.customerName}`),
                node("p", "", `${booking.paymentPreference} · ${etb(booking.totalPrice)} · Payment pending verification`)
            );
            const actions = node("div", "admin-card-actions");
            ["verified", "rejected"].forEach((status) => {
                const button = node("button", status === "verified" ? "btn btn-primary" : "admin-reject",
                    status === "verified" ? "Verify payment" : "Reject payment");
                button.type = "button";
                button.addEventListener("click", () => updatePayment(booking.paymentId, status));
                actions.appendChild(button);
            });
            row.appendChild(actions);
            payments.appendChild(row);
        });
    } catch (error) {
        console.error("Unable to load dashboard overview:", error);
        message(dashboardMessage, error.message, true);
    }
}

async function updatePayment(paymentId, status) {
    try {
        await request(`/payments/${paymentId}`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });
        message(dashboardMessage, `Payment marked ${status}.`, false);
        await loadOverview();
    } catch (error) {
        console.error("Unable to verify payment:", error);
        message(dashboardMessage, error.message, true);
    }
}

async function loadRooms() {
    try {
        const [rooms, types] = await Promise.all([request("/rooms"), request("/room-types")]);
        const typesList = document.getElementById("roomTypesList");
        const typeSelect = document.getElementById("roomTypeSelect");
        typesList.replaceChildren();
        typeSelect.replaceChildren();
        types.forEach((type) => {
            const row = node("form", "admin-inline-form");
            row.dataset.roomType = type.name;
            const title = node("strong", "", `${type.name} · ${type.roomCount} rooms`);
            const rate = document.createElement("input");
            rate.type = "number";
            rate.name = "nightlyRate";
            rate.min = "1";
            rate.value = type.nightlyRate;
            rate.setAttribute("aria-label", `${type.name} nightly rate`);
            const capacity = document.createElement("input");
            capacity.type = "number";
            capacity.name = "maxGuests";
            capacity.min = "1";
            capacity.max = "20";
            capacity.value = type.maxGuests;
            capacity.setAttribute("aria-label", `${type.name} guest capacity`);
            const save = node("button", "btn btn-outline", "Save rate");
            save.type = "submit";
            row.append(title, rate, capacity, save);
            row.addEventListener("submit", updateRoomType);
            typesList.appendChild(row);

            const option = document.createElement("option");
            option.value = type.name;
            option.textContent = type.name;
            typeSelect.appendChild(option);
        });

        const table = document.getElementById("roomsTable");
        table.replaceChildren();
        rooms.forEach((room) => {
            const row = document.createElement("tr");
            [
                room.roomNumber,
                room.roomType,
                room.floor,
                String(room.bedCapacity),
                etb(room.nightlyRate),
                `${room.occupancy}${room.isActive ? "" : " · inactive"}`
            ].forEach((value) => row.appendChild(node("td", "", value)));
            const action = node("td");
            const edit = node("button", "admin-reject", "Edit");
            edit.type = "button";
            edit.addEventListener("click", () => editRoom(room));
            const remove = node("button", "admin-reject", "Remove");
            remove.type = "button";
            remove.disabled = !room.isActive;
            remove.addEventListener("click", () => deleteRoom(room.id));
            action.append(edit, remove);
            row.appendChild(action);
            table.appendChild(row);
        });
    } catch (error) {
        console.error("Unable to load rooms:", error);
        message(dashboardMessage, error.message, true);
    }
}

async function updateRoomType(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
        await request(`/room-types/${encodeURIComponent(form.dataset.roomType)}`, {
            method: "PATCH",
            body: JSON.stringify({
                nightlyRate: Number(form.elements.nightlyRate.value),
                maxGuests: Number(form.elements.maxGuests.value)
            })
        });
        message(dashboardMessage, "Room type updated.", false);
        await loadRooms();
    } catch (error) {
        console.error("Unable to update room type:", error);
        message(dashboardMessage, error.message, true);
    }
}

document.getElementById("roomForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
        await request("/rooms", {
            method: "POST",
            body: JSON.stringify({
                roomNumber: data.get("roomNumber").trim(),
                roomType: data.get("roomType"),
                floor: data.get("floor"),
                bedCapacity: Number(data.get("bedCapacity"))
            })
        });
        form.reset();
        message(dashboardMessage, "Room added to the verified inventory.", false);
        await loadRooms();
    } catch (error) {
        console.error("Unable to add room:", error);
        message(dashboardMessage, error.message, true);
    }
});

async function editRoom(room) {
    const roomNumber = window.prompt("Room number", room.roomNumber);
    if (roomNumber === null) return;
    const roomTypeNames = Array.from(document.getElementById("roomTypeSelect").options)
        .map((option) => option.value);
    const roomType = window.prompt(`Room type (${roomTypeNames.join(", ")})`, room.roomType);
    if (roomType === null) return;
    const bedCapacity = Number(window.prompt("Bed capacity", String(room.bedCapacity)));
    if (!Number.isSafeInteger(bedCapacity)) return;
    const floor = window.prompt("Floor (First Floor, Second Floor, Third Floor, Fourth Floor)", room.floor);
    if (floor === null) return;
    try {
        await request(`/rooms/${room.id}`, {
            method: "PUT",
            body: JSON.stringify({
                roomNumber: roomNumber.trim(),
                roomType,
                floor,
                bedCapacity,
                isActive: Boolean(room.isActive)
            })
        });
        message(dashboardMessage, "Room updated.", false);
        await loadRooms();
    } catch (error) {
        console.error("Unable to edit room:", error);
        message(dashboardMessage, error.message, true);
    }
}

async function deleteRoom(id) {
    if (!window.confirm("Remove this room from bookable inventory? Existing records will be retained.")) return;
    try {
        await request(`/rooms/${id}`, { method: "DELETE" });
        message(dashboardMessage, "Room removed from active inventory.", false);
        await loadRooms();
    } catch (error) {
        console.error("Unable to remove room:", error);
        message(dashboardMessage, error.message, true);
    }
}

const bookingSearch = document.getElementById("bookingSearch");
let bookingSearchTimer;
bookingSearch.addEventListener("input", function () {
    window.clearTimeout(bookingSearchTimer);
    bookingSearchTimer = window.setTimeout(loadBookings, 250);
});

async function loadBookings() {
    try {
        const query = new URLSearchParams({ search: bookingSearch.value.trim() });
        const bookings = await request(`/bookings?${query}`);
        const list = document.getElementById("bookingsList");
        list.replaceChildren();
        if (!bookings.length) list.appendChild(node("p", "", "No reservations found."));
        bookings.forEach((booking) => {
            const card = node("article", "admin-card");
            card.append(
                node("h3", "", `${booking.bookingReference} · ${booking.customerName}`),
                node("p", "", `${booking.phone} · ${booking.email || "No email"}`),
                node("p", "", `${booking.roomType} · ${booking.floor || "Any floor"} · ${booking.roomCount} rooms/beds · ${booking.guests} guests`),
                node("p", "", `${booking.checkIn} to ${booking.checkOut} · ${booking.nights} nights · ${etb(booking.totalPrice)}`),
                node("p", "", `Payment: ${booking.paymentPreference} (${booking.paymentStatus || "pending"}) · Booking: ${booking.status}`),
                node("p", "", booking.specialRequests || "No special requests")
            );
            const actions = node("div", "admin-card-actions");
            const select = document.createElement("select");
            ["pending", "confirmed", "rejected", "cancelled"].forEach((value) => {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = value;
                option.selected = value === booking.status;
                select.appendChild(option);
            });
            const save = node("button", "btn btn-outline", "Update status");
            save.type = "button";
            save.addEventListener("click", () => updateBooking(booking.id, select.value));
            actions.append(select, save);
            card.appendChild(actions);
            list.appendChild(card);
        });
    } catch (error) {
        console.error("Unable to load bookings:", error);
        message(dashboardMessage, error.message, true);
    }
}

async function updateBooking(id, status) {
    try {
        await request(`/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
        message(dashboardMessage, `Booking status updated to ${status}.`, false);
        await loadBookings();
        await loadOverview();
    } catch (error) {
        console.error("Unable to update booking:", error);
        message(dashboardMessage, error.message, true);
    }
}

document.getElementById("refreshOrders").addEventListener("click", loadOrders);

async function loadOrders() {
    try {
        const orders = await request("/orders");
        const list = document.getElementById("adminOrderList");
        list.replaceChildren();
        if (!orders.length) list.appendChild(node("p", "", "There are no restaurant orders yet."));
        orders.forEach((order) => {
            const card = node("article", "admin-card");
            card.append(
                node("h3", "", `${order.orderNumber} · ${order.customerName}`),
                node("p", "", `${order.phone} · ${order.serviceType}${order.tableNumber ? ` · Table ${order.tableNumber}` : ""}${order.roomNumber ? ` · Room ${order.roomNumber}` : ""}`),
                node("p", "", `${order.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")} · ${etb(order.totalPrice)}`),
                node("p", "", `Status: ${order.status}`)
            );
            const actions = node("div", "admin-card-actions");
            const select = document.createElement("select");
            ["pending", "accepted", "preparing", "ready", "completed", "cancelled", "rejected"]
                .forEach((value) => {
                    const option = document.createElement("option");
                    option.value = value;
                    option.textContent = value;
                    option.selected = value === order.status;
                    select.appendChild(option);
                });
            const save = node("button", "btn btn-outline", "Update status");
            save.type = "button";
            save.addEventListener("click", async () => {
                try {
                    await request(`/orders/${order.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ status: select.value })
                    });
                    message(dashboardMessage, "Restaurant order updated.", false);
                    await loadOrders();
                } catch (error) {
                    console.error("Unable to update restaurant order:", error);
                    message(dashboardMessage, error.message, true);
                }
            });
            actions.append(select, save);
            card.appendChild(actions);
            list.appendChild(card);
        });
    } catch (error) {
        console.error("Unable to load restaurant orders:", error);
        message(dashboardMessage, error.message, true);
    }
}

const menuKindFilter = document.getElementById("menuKindFilter");
menuKindFilter.addEventListener("change", loadMenu);

async function loadMenu() {
    try {
        const kind = menuKindFilter.value;
        const items = await request(`/menu/${kind}`);
        const list = document.getElementById("menuList");
        list.replaceChildren();
        items.forEach((item) => {
            const card = node("form", "admin-card admin-form-grid");
            card.dataset.id = String(item.id);
            card.append(node("h3", "", item.name));
            const fields = [
                ["category", item.category],
                ["name", item.name],
                ["price", String(item.price)],
                ["image", item.image],
                ["description", item.description]
            ];
            fields.forEach(([name, value]) => {
                const label = node("label", "", name === "price" ? "Price (ETB)" : name);
                const input = name === "description" ? document.createElement("textarea") : document.createElement("input");
                input.name = name;
                input.value = value;
                input.maxLength = name === "description" ? 500 : 500;
                if (name === "price") {
                    input.type = "number";
                    input.min = "1";
                }
                label.appendChild(input);
                card.appendChild(label);
            });
            const availability = document.createElement("select");
            availability.name = "isAvailable";
            [["true", "Available"], ["false", "Hidden from menu"]].forEach(([value, label]) => {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = label;
                option.selected = String(item.isAvailable) === value;
                availability.appendChild(option);
            });
            const availabilityLabel = node("label", "", "Availability");
            availabilityLabel.appendChild(availability);
            card.appendChild(availabilityLabel);
            const save = node("button", "btn btn-outline", "Save changes");
            save.type = "submit";
            const remove = node("button", "admin-reject", "Delete item");
            remove.type = "button";
            remove.addEventListener("click", () => deleteMenuItem(kind, item.id));
            const imageUploadLabel = node("label", "", "Upload replacement image");
            const imageUpload = document.createElement("input");
            imageUpload.type = "file";
            imageUpload.accept = "image/jpeg,image/png,image/webp";
            imageUpload.addEventListener("change", () => uploadImage(imageUpload.files[0], card.elements.image));
            imageUploadLabel.appendChild(imageUpload);
            card.append(imageUploadLabel, save, remove);
            card.addEventListener("submit", saveMenuItem);
            list.appendChild(card);
        });
        if (!items.length) list.appendChild(node("p", "", "No menu items found."));
    } catch (error) {
        console.error("Unable to load menu:", error);
        message(dashboardMessage, error.message, true);
    }
}

async function saveMenuItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const kind = menuKindFilter.value;
    try {
        await request(`/menu/${kind}/${form.dataset.id}`, {
            method: "PUT",
            body: JSON.stringify({
                category: data.get("category").trim(),
                name: data.get("name").trim(),
                price: Number(data.get("price")),
                image: data.get("image").trim(),
                description: data.get("description").trim(),
                isAvailable: data.get("isAvailable") === "true"
            })
        });
        message(dashboardMessage, "Menu item updated.", false);
        await loadMenu();
    } catch (error) {
        console.error("Unable to update menu item:", error);
        message(dashboardMessage, error.message, true);
    }
}

document.getElementById("menuForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
        await request(`/menu/${data.get("kind")}`, {
            method: "POST",
            body: JSON.stringify({
                category: data.get("category").trim(),
                name: data.get("name").trim(),
                price: Number(data.get("price")),
                image: data.get("image").trim(),
                description: data.get("description").trim()
            })
        });

        document.querySelector('#menuForm input[name="imageFile"]').addEventListener("change", function () {
            uploadImage(this.files[0], document.querySelector('#menuForm input[name="image"]'));
        });
        event.currentTarget.reset();
        menuKindFilter.value = data.get("kind");
        message(dashboardMessage, "Menu item added.", false);
        await loadMenu();
    } catch (error) {
        console.error("Unable to add menu item:", error);
        message(dashboardMessage, error.message, true);
    }
});

async function deleteMenuItem(kind, id) {
    if (!window.confirm("Hide this item from the customer menu? Existing order history is preserved.")) return;
    try {
        await request(`/menu/${kind}/${id}`, { method: "DELETE" });
        message(dashboardMessage, "Menu item removed from the customer menu.", false);
        await loadMenu();
    } catch (error) {
        console.error("Unable to remove menu item:", error);
        message(dashboardMessage, error.message, true);
    }
}

const customerSearch = document.getElementById("customerSearch");
let customerSearchTimer;
customerSearch.addEventListener("input", function () {
    window.clearTimeout(customerSearchTimer);
    customerSearchTimer = window.setTimeout(loadCustomers, 250);
});

async function loadCustomers() {
    try {
        const query = new URLSearchParams({ search: customerSearch.value.trim() });
        const customers = await request(`/customers?${query}`);
        const list = document.getElementById("customersList");
        list.replaceChildren();
        if (!customers.length) list.appendChild(node("p", "", "No customers found."));
        customers.forEach((customer) => {
            const card = node("article", "admin-card");
            card.append(
                node("h3", "", customer.fullName),
                node("p", "", `${customer.phone} · ${customer.email || "No email"}`),
                node("p", "", `Booking history: ${customer.bookingCount} reservation(s)`)
            );
            const history = node("div", "customer-booking-history");
            const button = node("button", "btn btn-outline", "View booking history");
            button.type = "button";
            button.addEventListener("click", async () => {
                try {
                    const bookings = await request(`/customers/${customer.id}/bookings`);
                    history.replaceChildren();
                    if (!bookings.length) history.appendChild(node("p", "", "No reservations found."));
                    bookings.forEach((booking) => {
                        history.appendChild(node(
                            "p",
                            "",
                            `${booking.bookingReference} · ${booking.roomType} · ${booking.checkIn} to ${booking.checkOut} · ${booking.status} · ${etb(booking.totalPrice)}`
                        ));
                    });
                    if (history.hidden) history.hidden = false;
                    else history.hidden = true;
                } catch (error) {
                    console.error("Unable to load customer booking history:", error);
                    message(dashboardMessage, error.message, true);
                }
            });
            history.hidden = true;
            card.append(button, history);
            list.appendChild(card);
        });
    } catch (error) {
        console.error("Unable to load customers:", error);
        message(dashboardMessage, error.message, true);
    }
}

document.getElementById("reportPeriod").addEventListener("change", loadReports);

async function loadReports() {
    try {
        const period = document.getElementById("reportPeriod").value;
        const report = await request(`/reports?period=${period}`);
        const list = document.getElementById("reportsList");
        list.replaceChildren();
        [
            ["Room bookings", report.bookingSales],
            ["Restaurant sales", report.restaurantSales]
        ].forEach(([title, rows]) => {
            const section = node("section", "admin-card");
            section.appendChild(node("h3", "", title));
            if (!rows.length) section.appendChild(node("p", "", "No recorded sales for this period."));
            rows.forEach((row) => {
                section.appendChild(node("p", "", `${row.period}: ${row.count} · ${etb(row.revenue)}`));
            });
            list.appendChild(section);
        });
    } catch (error) {
        console.error("Unable to load reports:", error);
        message(dashboardMessage, error.message, true);
    }
}

initialize();
