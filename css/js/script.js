// =============================================
// ADERAVANTA GRAND HOTEL
// COMPLETE JAVASCRIPT FILE
// =============================================


// =============================================
// 1. MOBILE NAVIGATION MENU
// =============================================

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navlinks");

if (menuToggle && navLinks) {
    function setNavigationOpen(isOpen) {
        navLinks.classList.toggle("open", isOpen);
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        menuToggle.textContent = isOpen ? "×" : "☰";
    }

    menuToggle.addEventListener("click", function () {
        setNavigationOpen(!navLinks.classList.contains("open"));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            setNavigationOpen(false);
        });
    });

    document.addEventListener("click", function (event) {
        if (navLinks.classList.contains("open") &&
            !navLinks.contains(event.target) &&
            !menuToggle.contains(event.target)) {
            setNavigationOpen(false);
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && navLinks.classList.contains("open")) {
            setNavigationOpen(false);
            menuToggle.focus();
        }
    });
}

// =============================================
// 2. SCROLL PROGRESS, ACTIVE NAVIGATION & REVEALS
// =============================================

const scrollProgress = document.getElementById("scrollProgress");
const backToTop = document.getElementById("backToTop");
const header = document.querySelector(".header");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isAfaanOromo = function () {
    return document.documentElement.lang === "om";
};

document.querySelectorAll("img:not(.hero-image):not(#galleryViewerImage)").forEach(function (image) {
    if (!image.hasAttribute("loading")) {
        image.loading = "lazy";
    }
    image.decoding = "async";
});
const navTargets = navLinks
    ? Array.from(navLinks.querySelectorAll('a[href^="#"]'))
        .map(function (link) {
            return {
                link: link,
                section: document.getElementById(link.getAttribute("href").slice(1))
            };
        })
        .filter(function (item) {
            return item.section;
        })
    : [];

let revealObserver = null;
const revealSelector = [
    ".section-heading",
    ".about-image img",
    ".about-content",
    ".floor-card",
    ".room-card",
    ".booking-info",
    ".booking-form",
    ".booking-status-check",
    ".pool-content",
    ".pool-image img",
    ".dining-image img",
    ".dining-content",
    ".food-card",
    ".facility-card",
    ".gallery-grid img",
    ".contact-card",
    ".map-container",
    ".review-card"
].join(", ");

function observeRevealTargets(root) {
    const targets = root.querySelectorAll(revealSelector);
    const staggerGroups = new Map();

    targets.forEach(function (element) {
        if (element.dataset.revealObserved) {
            return;
        }

        element.dataset.revealObserved = "true";
        element.classList.add("scroll-reveal");

        if (element.matches("img")) {
            element.classList.add("reveal-image");
        }

        const group = element.parentElement;
        const groupIndex = staggerGroups.get(group) || 0;
        staggerGroups.set(group, groupIndex + 1);
        element.style.setProperty("--reveal-delay", `${Math.min(groupIndex * 75, 300)}ms`);
        if (revealObserver) {
            revealObserver.observe(element);
        } else {
            element.classList.add("is-visible");
        }
    });
}

if (!prefersReducedMotion && "IntersectionObserver" in window) {
    document.body.classList.add("scroll-effects-ready");
    revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.08) {
                entry.target.classList.add("is-visible");
            } else if (entry.intersectionRatio === 0) {
                entry.target.classList.remove("is-visible");
            }
        });
    }, {
        threshold: [0, 0.08],
        rootMargin: "0px 0px -24px 0px"
    });
}

observeRevealTargets(document);

let scrollUpdatePending = false;

function updateScrollUI() {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollableHeight > 0
        ? Math.min(100, Math.max(0, (window.scrollY / scrollableHeight) * 100))
        : 0;

    if (scrollProgress) {
        scrollProgress.style.width = `${scrollPercent}%`;
    }

    if (header) {
        header.classList.toggle("is-scrolled", window.scrollY > 8);
    }

    if (backToTop) {
        backToTop.classList.toggle("is-visible", window.scrollY > 500);
    }

    const activeTarget = navTargets
        .filter(function (item) {
            return item.section.getBoundingClientRect().top <= (header ? header.offsetHeight + 60 : 100);
        })
        .sort(function (first, second) {
            return first.section.getBoundingClientRect().top - second.section.getBoundingClientRect().top;
        })
        .pop();

    navTargets.forEach(function (item) {
        if (item === activeTarget) {
            item.link.setAttribute("aria-current", "location");
        } else {
            item.link.removeAttribute("aria-current");
        }
    });

    scrollUpdatePending = false;
}

window.addEventListener("scroll", function () {
    if (!scrollUpdatePending) {
        scrollUpdatePending = true;
        window.requestAnimationFrame(updateScrollUI);
    }
}, { passive: true });

window.addEventListener("resize", function () {
    if (window.innerWidth > 1200 && navLinks && menuToggle && navLinks.classList.contains("open")) {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation menu");
        menuToggle.textContent = "☰";
    }
    updateScrollUI();
});
updateScrollUI();

if (backToTop) {
    backToTop.addEventListener("click", function () {
        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion ? "auto" : "smooth"
        });
    });
}

// =============================================
// 3. ROOM SEARCH AND FILTERS
// =============================================

const roomSearch = document.getElementById("roomSearch");
const roomResults = document.getElementById("roomResults");
const roomCards = Array.from(document.querySelectorAll(".room-card"));
const roomFilterButtons = Array.from(document.querySelectorAll(".room-filter[data-filter]"));

if (roomSearch && roomResults && roomCards.length && roomFilterButtons.length) {
    let activeRoomFilter = "all";

    function updateRoomResults() {
        const searchTerm = roomSearch.value.trim().toLocaleLowerCase();
        let visibleCount = 0;

        roomCards.forEach(function (card) {
            const matchesCategory = activeRoomFilter === "all" ||
                card.dataset.roomCategory === activeRoomFilter;
            const matchesSearch = card.textContent.toLocaleLowerCase().includes(searchTerm);
            const isVisible = matchesCategory && matchesSearch;

            card.hidden = !isVisible;
            if (isVisible) {
                visibleCount += 1;
            }
        });

        roomResults.textContent = visibleCount === 0
            ? "No rooms match those filters. Try another search or choose All rooms."
            : `Showing ${visibleCount} ${visibleCount === 1 ? "room option" : "room options"}.`;
    }

    roomFilterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            activeRoomFilter = button.dataset.filter;

            roomFilterButtons.forEach(function (filterButton) {
                const isActive = filterButton === button;
                filterButton.classList.toggle("is-active", isActive);
                filterButton.setAttribute("aria-pressed", String(isActive));
            });

            updateRoomResults();
        });
    });

    roomSearch.addEventListener("input", updateRoomResults);
    updateRoomResults();
}

// =============================================
// 4. ROOM INVENTORY AND RESTAURANT MENU
// =============================================

const roomAvailabilityLabels = document.querySelectorAll("[data-room-availability]");
const bookingRates = new Map();

if (roomAvailabilityLabels.length) {
    fetch("/api/booking-rooms")
        .then(function (response) {
            if (!response.ok) {
                throw new Error(`Room booking information request failed (${response.status}).`);
            }
            return response.json();
        })
        .then(function (rooms) {
            if (!Array.isArray(rooms)) {
                throw new Error("Room booking information response was invalid.");
            }

            rooms.forEach(function (room) {
                if (typeof room.roomType !== "string" ||
                    !Number.isSafeInteger(room.nightlyRate) ||
                    !Number.isSafeInteger(room.capacity)) {
                    throw new Error("Room booking information contains an invalid room.");
                }
                bookingRates.set(room.roomType, room.nightlyRate);
            });

            document.querySelectorAll("[data-room-rate]").forEach(function (label) {
                const rate = bookingRates.get(label.dataset.roomRate);
                label.textContent = Number.isSafeInteger(rate)
                    ? `${new Intl.NumberFormat("en").format(rate)} ETB / night`
                    : "Call us for rates";
            });
            const bookingRoomSelect = document.getElementById("room");
            if (bookingRoomSelect) {
                bookingRoomSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }

            roomAvailabilityLabels.forEach(function (label) {
                label.textContent = "Choose dates in the booking form to check availability.";
            });
        })
        .catch(function (error) {
            console.error("Unable to load room booking information:", error);
            roomAvailabilityLabels.forEach(function (label) {
                label.textContent = "Room availability could not be loaded.";
            });
            document.querySelectorAll("[data-room-rate]").forEach(function (label) {
                label.textContent = "Rates are temporarily unavailable.";
            });
        });
}

const foodMenuContainer = document.getElementById("foodMenu");

if (foodMenuContainer) {
    const menuFilters = Array.from(document.querySelectorAll(".food-filter[data-menu-filter]"));
    const cartItemsContainer = document.getElementById("orderItems");
    const cartCount = document.getElementById("cartCount");
    const orderTotal = document.getElementById("orderTotal");
    const foodOrderForm = document.getElementById("foodOrderForm");
    const foodOrderNotice = document.getElementById("foodOrderNotice");
    const serviceTypeSelect = document.getElementById("foodServiceType");
    const roomNumberInput = document.getElementById("foodRoomNumber");
    const roomNumberGroup = document.getElementById("roomNumberGroup");
    const tableNumberInput = document.getElementById("foodTableNumber");
    const tableNumberGroup = document.getElementById("tableNumberGroup");
    const submitFoodOrder = document.getElementById("submitFoodOrder");
    const foodCart = new Map();
    let activeMenuFilter = "All";

    function formatEtb(amount) {
        return `${new Intl.NumberFormat("en").format(amount)} ETB`;
    }

    function setOrderNotice(message, isError) {
        if (!foodOrderNotice) {
            return;
        }

        foodOrderNotice.textContent = message;
        foodOrderNotice.classList.toggle("is-error", Boolean(isError));
        foodOrderNotice.classList.toggle("is-success", Boolean(message) && !isError);
    }

    function renderFoodCart() {
        if (!cartItemsContainer || !cartCount || !orderTotal || !submitFoodOrder) {
            return;
        }

        cartItemsContainer.replaceChildren();
        let quantityTotal = 0;
        let priceTotal = 0;

        foodCart.forEach(function (entry, foodId) {
            const row = document.createElement("div");
            row.className = "order-item";

            const itemDetails = document.createElement("div");
            itemDetails.className = "order-item-details";
            const name = document.createElement("h4");
            name.textContent = entry.food.name;
            const price = document.createElement("p");
            price.textContent = `${formatEtb(entry.food.price)} each · ${formatEtb(entry.food.price * entry.quantity)} total`;
            itemDetails.append(name, price);

            const controls = document.createElement("div");
            controls.className = "order-item-controls";

            const decrement = document.createElement("button");
            decrement.type = "button";
            decrement.className = "quantity-button";
            decrement.textContent = "−";
            decrement.setAttribute("aria-label", `Decrease ${entry.food.name} quantity`);
            decrement.dataset.cartAction = "decrease";
            decrement.dataset.foodId = String(foodId);

            const quantity = document.createElement("span");
            quantity.className = "cart-quantity";
            quantity.textContent = String(entry.quantity);
            quantity.setAttribute("aria-label", `Quantity ${entry.quantity}`);

            const increment = document.createElement("button");
            increment.type = "button";
            increment.className = "quantity-button";
            increment.textContent = "+";
            increment.setAttribute("aria-label", `Increase ${entry.food.name} quantity`);
            increment.dataset.cartAction = "increase";
            increment.dataset.foodId = String(foodId);
            increment.disabled = entry.quantity >= 20;

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "remove-order-item";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove ${entry.food.name} from your order`);
            remove.dataset.cartAction = "remove";
            remove.dataset.foodId = String(foodId);

            controls.append(decrement, quantity, increment, remove);
            row.append(itemDetails, controls);
            cartItemsContainer.appendChild(row);

            quantityTotal += entry.quantity;
            priceTotal += entry.food.price * entry.quantity;
        });

        if (foodCart.size === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "cart-empty";
            emptyMessage.textContent = "Your order is empty. Add a food or drink to get started.";
            cartItemsContainer.appendChild(emptyMessage);
        }

        cartCount.textContent = String(quantityTotal);
        cartCount.setAttribute("aria-label", `${quantityTotal} ${quantityTotal === 1 ? "item" : "items"}`);
        orderTotal.textContent = formatEtb(priceTotal);
        submitFoodOrder.disabled = foodCart.size === 0;
    }

    function normalizeCategories(item) {
        const categories = Array.isArray(item.categories) ? item.categories : [item.category];
        const normalized = new Set();
        categories.forEach(function (category) {
            if (category === "Lunch" || category === "Dinner") {
                normalized.add("Lunch & Dinner");
            } else if (category === "Drinks and Juices") {
                const name = item.name.toLocaleLowerCase();
                normalized.add(/coffee|tea|chocolate|macchiato|milk/.test(name)
                    ? "Hot Drinks"
                    : /juice|fruit|smoothie|lemonade/.test(name)
                        ? "Fresh Juices"
                        : "Cold Drinks");
            } else if ([
                "Ethiopian Breakfast",
                "Ethiopian Traditional Food",
                "Fast Food",
                "Hot Drinks",
                "Fresh Juices",
                "Cold Drinks",
                "Special Drinks"
            ].includes(category)) {
                normalized.add(category);
            }
        });
        return Array.from(normalized);
    }

    function renderMenuCards(items) {
        foodMenuContainer.replaceChildren();
        items.forEach(function (item) {
            const categories = normalizeCategories(item);
            const card = document.createElement("article");
            card.className = "food-card";
            card.dataset.categories = JSON.stringify(categories);
            card.foodItem = item;

            const imageFrame = document.createElement("div");
            imageFrame.className = "food-card-image";
            const image = document.createElement("img");
            image.src = item.image;
            image.alt = item.name;
            image.loading = "lazy";
            image.decoding = "async";
            image.loading = "lazy";
            image.addEventListener("error", function () {
                if (item.id >= 100000 && !image.dataset.fallback) {
                    image.dataset.fallback = "true";
                    image.src = "/public/images/food/fruit-juice.jpg";
                }
            });
            const categoryLabel = document.createElement("span");
            categoryLabel.className = "food-category-label";
            categoryLabel.textContent = item.category;
            imageFrame.append(image, categoryLabel);

            const content = document.createElement("div");
            content.className = "food-card-content";
            const title = document.createElement("h3");
            title.textContent = item.name;
            const description = document.createElement("p");
            description.textContent = item.description;
            const price = document.createElement("strong");
            price.className = "food-card-price";
            price.textContent = formatEtb(item.price);

            const actions = document.createElement("div");
            actions.className = "food-card-actions";
            const quantityLabel = document.createElement("label");
            quantityLabel.className = "food-quantity-label";
            quantityLabel.textContent = "Qty";
            const quantitySelect = document.createElement("select");
            quantitySelect.className = "food-quantity-select";
            quantitySelect.setAttribute("aria-label", `Quantity for ${item.name}`);
            for (let quantity = 1; quantity <= 10; quantity += 1) {
                const option = document.createElement("option");
                option.value = String(quantity);
                option.textContent = String(quantity);
                quantitySelect.appendChild(option);
            }
            quantityLabel.appendChild(quantitySelect);

            const addButton = document.createElement("button");
            addButton.type = "button";
            addButton.className = "btn btn-primary add-to-order";
            addButton.textContent = "Add to Order";
            addButton.dataset.addFoodId = String(item.id);
            actions.append(quantityLabel, addButton);
            content.append(title, description, price, actions);
            card.append(imageFrame, content);
            foodMenuContainer.appendChild(card);
        });
        observeRevealTargets(foodMenuContainer);
        updateMenuFilter();
    }

    function updateMenuFilter() {
        const cards = Array.from(foodMenuContainer.querySelectorAll(".food-card"));
        let visibleCount = 0;

        cards.forEach(function (card) {
            let categories = [];
            try {
                categories = JSON.parse(card.dataset.categories);
            } catch (error) {
                console.error("Unable to read food categories:", error);
            }
            const isVisible = activeMenuFilter === "All" ||
                categories.includes(activeMenuFilter);
            card.hidden = !isVisible;
            if (isVisible) {
                visibleCount += 1;
            }
        });

        const existingMessage = foodMenuContainer.querySelector(".food-empty");
        if (visibleCount === 0 && !existingMessage) {
            const message = document.createElement("p");
            message.className = "food-empty";
            message.textContent = "There are no dining items in this category yet.";
            foodMenuContainer.appendChild(message);
        } else if (visibleCount > 0 && existingMessage) {
            existingMessage.remove();
        }
    }

    menuFilters.forEach(function (button) {
        button.addEventListener("click", function () {
            activeMenuFilter = button.dataset.menuFilter;
            menuFilters.forEach(function (filterButton) {
                const isActive = filterButton === button;
                filterButton.classList.toggle("is-active", isActive);
                filterButton.setAttribute("aria-pressed", String(isActive));
            });
            updateMenuFilter();
        });
    });

    function addItemToOrder(event) {
        const button = event.target.closest("[data-add-food-id]");
        if (!button) {
            return;
        }

        const foodId = Number(button.dataset.addFoodId);
        const card = button.closest(".food-card");
        const food = card && card.foodItem;
        if (!food || !Number.isSafeInteger(foodId)) {
            return;
        }

        const quantity = Number(card.querySelector(".food-quantity-select").value);
        const currentQuantity = foodCart.has(foodId) ? foodCart.get(foodId).quantity : 0;
        if (currentQuantity + quantity > 20) {
            setOrderNotice("Each menu item is limited to 20 servings per order.", true);
            return;
        }

        foodCart.set(foodId, {
            food: food,
            quantity: currentQuantity + quantity
        });
        setOrderNotice(`${food.name} added to your order.`, false);
        renderFoodCart();
    }

    foodMenuContainer.addEventListener("click", addItemToOrder);

    if (cartItemsContainer) {
        cartItemsContainer.addEventListener("click", function (event) {
            const button = event.target.closest("[data-cart-action]");
            if (!button) {
                return;
            }

            const foodId = Number(button.dataset.foodId);
            const entry = foodCart.get(foodId);
            if (!entry) {
                return;
            }

            if (button.dataset.cartAction === "remove" || entry.quantity === 1 &&
                button.dataset.cartAction === "decrease") {
                foodCart.delete(foodId);
            } else if (button.dataset.cartAction === "decrease") {
                entry.quantity -= 1;
            } else if (button.dataset.cartAction === "increase" && entry.quantity < 20) {
                entry.quantity += 1;
            }

            setOrderNotice("", false);
            renderFoodCart();
        });
    }

    if (serviceTypeSelect && roomNumberInput && roomNumberGroup &&
        tableNumberInput && tableNumberGroup) {
        function updateServiceDetails() {
            const needsRoomNumber = serviceTypeSelect.value === "room-service";
            const needsTableNumber = serviceTypeSelect.value === "dine-in";
            roomNumberGroup.hidden = !needsRoomNumber;
            roomNumberInput.required = needsRoomNumber;
            tableNumberGroup.hidden = !needsTableNumber;
            tableNumberInput.required = needsTableNumber;
            if (!needsRoomNumber) {
                roomNumberInput.value = "";
            }
            if (!needsTableNumber) {
                tableNumberInput.value = "";
            }
        }

        serviceTypeSelect.addEventListener("change", updateServiceDetails);
        updateServiceDetails();
    }

    if (foodOrderForm && foodOrderNotice) {
        foodOrderForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (foodCart.size === 0) {
                setOrderNotice("Add at least one food to your order.", true);
                return;
            }

            const formData = new FormData(foodOrderForm);
            const payload = {
                customerName: formData.get("customerName").trim(),
                phone: formData.get("phone").trim(),
                roomNumber: formData.get("roomNumber").trim(),
                tableNumber: formData.get("tableNumber")
                    ? Number(formData.get("tableNumber"))
                    : null,
                serviceType: formData.get("serviceType"),
                items: Array.from(foodCart.entries()).map(function (entry) {
                    return {
                        foodId: entry[0],
                        quantity: entry[1].quantity
                    };
                })
            };

            submitFoodOrder.disabled = true;
            setOrderNotice("Submitting your order…", false);

            try {
                const response = await fetch("/api/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || "Your order could not be submitted.");
                }

                foodCart.clear();
                foodOrderForm.reset();
                if (serviceTypeSelect && roomNumberInput && roomNumberGroup &&
                    tableNumberInput && tableNumberGroup) {
                    roomNumberGroup.hidden = true;
                    roomNumberInput.required = false;
                    tableNumberGroup.hidden = true;
                    tableNumberInput.required = false;
                }
                renderFoodCart();
                setOrderNotice(
                    `Order ${result.orderNumber} received. Total: ${formatEtb(result.totalPrice)}. The hotel will confirm shortly.`,
                    false
                );
            } catch (error) {
                console.error("Unable to submit food order:", error);
                setOrderNotice(error.message || "Unable to submit your order. Please try again.", true);
            } finally {
                submitFoodOrder.disabled = foodCart.size === 0;
            }
        });
    }

    let foodsLoaded = false;
    let drinksLoaded = false;
    let foodItems = [];
    let drinkItems = [];
    const menuErrors = [];

    function renderCombinedMenu() {
        if (!foodsLoaded || !drinksLoaded) return;
        const items = foodItems.concat(drinkItems);
        renderMenuCards(items);
        if (menuErrors.length) {
            const errorMessage = document.createElement("p");
            errorMessage.className = "menu-status is-error";
            errorMessage.textContent = menuErrors.join(" ");
            foodMenuContainer.prepend(errorMessage);
        }
    }

    function validateMenuItems(items, label) {
        if (!Array.isArray(items)) throw new Error(`${label} menu response was invalid.`);
        items.forEach(function (item) {
            if (!Number.isSafeInteger(item.id) || typeof item.name !== "string" ||
                !Number.isSafeInteger(item.price) || typeof item.image !== "string" ||
                typeof item.description !== "string") {
                throw new Error(`${label} menu contains an invalid item.`);
            }
        });
        return items;
    }

    fetch("/api/food")
        .then(function (response) {
            if (!response.ok) throw new Error(`Food menu request failed (${response.status}).`);
            return response.json();
        })
        .then(function (items) {
            foodItems = validateMenuItems(items, "Food");
        })
        .catch(function (error) {
            console.error("Unable to load restaurant menu:", error);
            menuErrors.push("Some food items could not be loaded.");
        })
        .finally(function () {
            foodsLoaded = true;
            renderCombinedMenu();
        });

    fetch("/api/drinks")
        .then(function (response) {
            if (!response.ok) throw new Error(`Drinks menu request failed (${response.status}).`);
            return response.json();
        })
        .then(function (items) {
            drinkItems = validateMenuItems(items, "Drinks");
        })
        .catch(function (error) {
            console.error("Unable to load drinks menu:", error);
            menuErrors.push("Some drink items could not be loaded.");
        })
        .finally(function () {
            drinksLoaded = true;
            renderCombinedMenu();
        });

    renderFoodCart();
}

// =============================================
// 5. GALLERY PHOTO VIEWER
// =============================================

const galleryViewer = document.getElementById("galleryViewer");
const galleryViewerImage = document.getElementById("galleryViewerImage");
const galleryViewerClose = document.getElementById("galleryViewerClose");

if (galleryViewer && galleryViewerImage && galleryViewerClose) {
    const galleryImages = document.querySelectorAll(".gallery-grid img");

    galleryImages.forEach(function (image) {
        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute("aria-label", `View larger image: ${image.alt}`);

        function openViewer() {
            galleryViewerImage.src = image.currentSrc || image.src;
            galleryViewerImage.alt = image.alt;
            galleryViewer.showModal();
            galleryViewerClose.focus();
        }

        image.addEventListener("click", openViewer);
        image.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openViewer();
            }
        });
    });

    galleryViewerClose.addEventListener("click", function () {
        galleryViewer.close();
    });

    galleryViewer.addEventListener("click", function (event) {
        if (event.target === galleryViewer) {
            galleryViewer.close();
        }
    });

    galleryViewer.addEventListener("close", function () {
        galleryViewerImage.removeAttribute("src");
    });
}


// =============================================
// 5. DISPLAY CURRENT YEAR IN FOOTER
// =============================================

const currentYear = document.getElementById("currentYear");

if (currentYear) {

    currentYear.textContent = new Date().getFullYear();

}


// =============================================
// 6. BOOKING FORM
// =============================================

const bookingForm = document.getElementById("bookingForm");

if (bookingForm) {

    const arrivalInput = document.getElementById("arrival");

    const departureInput = document.getElementById("departure");

    const notice = document.getElementById("notice");
    const staySummary = document.getElementById("staySummary");
    const bookingAvailability = document.getElementById("bookingAvailability");
    const submitBookingButton = document.getElementById("submitBooking");
    const roomSelect = document.getElementById("room");
    const roomCountSelect = document.getElementById("roomCount");
    const floorSelect = document.getElementById("floor");
    let availabilityRequest;

    document.querySelectorAll(".floor-card a[data-floor]").forEach(function (link) {
        link.addEventListener("click", function () {
            if (floorSelect) {
                floorSelect.value = link.dataset.floor;
            }
        });
    });

    document.querySelectorAll(".room-link[data-room]").forEach(function (link) {
        link.addEventListener("click", function () {
            if (roomSelect) {
                roomSelect.value = link.dataset.room;
                roomSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });
    });


    // =========================================
    // 4. SET TODAY'S DATE
    // =========================================

    const today = new Date();

    const year = today.getFullYear();

    const month = String(today.getMonth() + 1).padStart(2, "0");

    const day = String(today.getDate()).padStart(2, "0");

    const todayDate = `${year}-${month}-${day}`;


    // Prevent customers from selecting past dates
    arrivalInput.min = todayDate;

    departureInput.min = todayDate;

    function getNextDate(dateValue) {
        const [dateYear, dateMonth, dateDay] = dateValue.split("-").map(Number);
        const nextDate = new Date(Date.UTC(dateYear, dateMonth - 1, dateDay + 1));
        return nextDate.toISOString().slice(0, 10);
    }

    function updateStaySummary() {
        if (!staySummary) {
            return 0;
        }

        if (!arrivalInput.value || !departureInput.value) {
            staySummary.textContent = isAfaanOromo()
                ? "Yeroo turtii keessanii ilaaluuf guyyaa seensaa fi ba'umsaa filadhaa."
                : "Choose check-in and check-out dates to see your stay length.";
            return 0;
        }

        const arrival = new Date(`${arrivalInput.value}T00:00:00Z`);
        const departure = new Date(`${departureInput.value}T00:00:00Z`);
        const nights = Math.round((departure - arrival) / 86400000);

        if (nights <= 0) {
            staySummary.textContent = isAfaanOromo()
                ? "Guyyaan ba'umsaa guyyaa seensaa booda yoo xiqqaate guyyaa tokko ta'uu qaba."
                : "Check-out must be at least one day after check-in.";
            return 0;
        }

        const nightlyRate = bookingRates.get(roomSelect.value);
        const roomCount = Number(roomCountSelect.value) || 0;
        const total = Number.isSafeInteger(nightlyRate) && roomCount
            ? nightlyRate * nights * roomCount
            : null;
        if (isAfaanOromo()) {
            staySummary.textContent = total === null
                ? `Turtii keessan: halkan ${nights}. Tilmaama ilaaluuf baay'ina kutaalee ykn sireewwanii filadhaa.`
                : `${roomSelect.value} · ${floorSelect.value || "Dabaala kamiyyuu"} · ${roomCount} · halkan ${nights} · Waliigala tilmaamaa: ${new Intl.NumberFormat("en").format(total)} ETB`;
        } else {
            staySummary.textContent = total === null
                ? `Your stay: ${nights} ${nights === 1 ? "night" : "nights"}. Select rooms or beds to see the estimate.`
                : `${roomSelect.value} · ${floorSelect.value || "Any floor"} · ${roomCount} ${roomSelect.value === "Shared Bed Space" ? (roomCount === 1 ? "bed" : "beds") : (roomCount === 1 ? "room" : "rooms")} · ${nights} ${nights === 1 ? "night" : "nights"} · Estimated total: ${new Intl.NumberFormat("en").format(total)} ETB`;
        }
        return nights;
    }

    async function checkBookingAvailability() {
        if (availabilityRequest) {
            availabilityRequest.abort();
        }
        availabilityRequest = new AbortController();

        const selectedRoom = roomSelect.value;
        const requestedRoomCount = Number(roomCountSelect.value) || 1;
        const selectedLabel = Array.from(roomAvailabilityLabels).find(function (label) {
            return label.dataset.roomAvailability === selectedRoom;
        });
        roomAvailabilityLabels.forEach(function (label) {
            label.textContent = "Choose dates in the booking form to check availability.";
        });

        if (!selectedRoom || !arrivalInput.value || !departureInput.value ||
            departureInput.value <= arrivalInput.value) {
            if (bookingAvailability) {
                bookingAvailability.textContent = isAfaanOromo()
                    ? "Argama ilaaluuf kutaa fi guyyaa sirrii filadhaa."
                    : "Choose a room and valid dates to check availability.";
            }
            return;
        }

        if (bookingAvailability) {
            bookingAvailability.textContent = isAfaanOromo()
                ? "Argama kutaa sakatta'aa jira…"
                : "Checking room availability…";
        }
        if (selectedLabel) {
            selectedLabel.textContent = isAfaanOromo()
                ? "Guyyaa keessaniif argama sakatta'aa jira…"
                : "Checking availability for your dates…";
        }

        const query = new URLSearchParams({
            roomType: selectedRoom,
            checkIn: arrivalInput.value,
            checkOut: departureInput.value,
            roomCount: String(requestedRoomCount),
            floor: floorSelect.value
        });
        const nights = Math.round(
            (new Date(`${departureInput.value}T00:00:00Z`) -
                new Date(`${arrivalInput.value}T00:00:00Z`)) / 86400000
        );

        try {
            const response = await fetch(`/api/booking-availability?${query}`, {
                signal: availabilityRequest.signal
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Unable to check room availability.");
            }

            if (selectedLabel) {
                selectedLabel.textContent = result.available
                    ? isAfaanOromo()
                        ? `Guyyaa keessaniif argama ${result.availableRooms} jira`
                        : `${result.availableRooms} available for your dates`
                    : isAfaanOromo()
                        ? "Guyyaa kanaaf kutaan hin jiru"
                        : "No availability for these dates";
            }
            if (bookingAvailability) {
                if (isAfaanOromo()) {
                    bookingAvailability.textContent = result.available
                        ? `Argama: ${result.availableRooms} · Filatame: ${requestedRoomCount} · Waliigala tilmaamaa: ${new Intl.NumberFormat("en").format(result.nightlyRate * nights * requestedRoomCount)} ETB`
                        : `Guyyaa kanaaf ${result.availableRooms} qofatu jira. Baay'ina hir'isaa yookaan guyyaa biraa filadhaa.`;
                } else {
                    bookingAvailability.textContent = result.available
                        ? `${result.availableRooms} available · ${requestedRoomCount} selected · ${new Intl.NumberFormat("en").format(result.nightlyRate * nights * requestedRoomCount)} ETB estimated total`
                        : `Only ${result.availableRooms} available for those dates. Reduce the number requested or select different dates.`;
                }
            }
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }
            console.error("Unable to check room availability:", error);
            if (bookingAvailability) {
                bookingAvailability.textContent = error.message || "Room availability could not be checked.";
            }
            if (selectedLabel) {
                selectedLabel.textContent = "Availability could not be checked.";
            }
        }
    }

    // =========================================
    // 5. CHECK-IN AND CHECK-OUT VALIDATION
    // =========================================

    arrivalInput.addEventListener("change", function () {

        departureInput.min = arrivalInput.value ? getNextDate(arrivalInput.value) : todayDate;

        if (
            departureInput.value &&
            departureInput.value < departureInput.min
        ) {

            departureInput.value = "";

        }

        updateStaySummary();
        checkBookingAvailability();
    });

    departureInput.addEventListener("change", function () {
        updateStaySummary();
        checkBookingAvailability();
    });
    roomSelect.addEventListener("change", function () {
        updateStaySummary();
        checkBookingAvailability();
    });
    [arrivalInput, departureInput, roomSelect, roomCountSelect, floorSelect].forEach(function (input) {
        input.addEventListener("change", function () {
            if (notice) {
                notice.classList.remove("show", "is-error");
                notice.textContent = "";
            }
        });
    });
    roomCountSelect.addEventListener("change", function () {
        updateStaySummary();
        checkBookingAvailability();
    });
    floorSelect.addEventListener("change", function () {
        updateStaySummary();
        checkBookingAvailability();
    });
    updateStaySummary();
    checkBookingAvailability();


    // =========================================
    // 6. BOOKING FORM SUBMISSION
    // =========================================

    bookingForm.addEventListener("submit", function (event) {

        // Stop the default form submission
        event.preventDefault();
        if (bookingForm.dataset.bookingApi === "true") {
            return;
        }


        // Collect all form information
        const formData = new FormData(bookingForm);


        // Customer information
        const fullName = formData.get("fullname").trim();

        const phone = formData.get("phone").trim();

        const email = formData.get("email").trim();


        // Booking information
        const room = formData.get("room");

        const floor = formData.get("floor");

        const guests = formData.get("guests");

        const arrival = formData.get("arrival");

        const departure = formData.get("departure");
        const nights = updateStaySummary();


        // Payment information
        const payment = formData.get("payment");


        // Special requests
        const requests = formData.get("requests").trim();


        // =====================================
        // 7. VALIDATE CUSTOMER NAME
        // =====================================

        const namePattern = /^[A-Za-zÀ-ÿ\s'-]+$/;

        if (!namePattern.test(fullName)) {

            alert("Please enter a valid name using letters only.");

            return;

        }


        // =====================================
        // 8. VALIDATE PHONE NUMBER
        // =====================================

        const phonePattern = /^[0-9+\-\s()]{7,20}$/;

        if (!phonePattern.test(phone)) {

            alert("Please enter a valid phone number.");

            return;

        }


        // =====================================
        // 9. VALIDATE EMAIL ADDRESS
        // =====================================

        if (email !== "") {

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(email)) {

                alert("Please enter a valid email address.");

                return;

            }

        }


        // =====================================
        // 10. VALIDATE ROOM TYPE
        // =====================================

        if (!room) {

            alert("Please select your room type.");

            return;

        }


        // =====================================
        // 11. VALIDATE NUMBER OF GUESTS
        // =====================================

        if (!guests) {

            alert("Please select the number of guests.");

            return;

        }


        // =====================================
        // 12. VALIDATE PAYMENT METHOD
        // =====================================

        if (!payment) {

            alert("Please select your payment method.");

            return;

        }


        // =====================================
        // 13. VALIDATE BOOKING DATES
        // =====================================

        if (!arrival || !departure) {

            alert("Please select your check-in and check-out dates.");

            return;

        }


        // Check that check-in is not in the past
        if (arrival < todayDate) {

            alert("Check-in date cannot be in the past.");

            return;

        }


        // Check that check-out is after check-in
        if (departure <= arrival || nights < 1) {

            alert("Check-out date must be after check-in date.");

            return;

        }


        // =====================================
        // 14. PREPARE EMAIL SUBJECT
        // =====================================

        const subject = encodeURIComponent(

            "New Booking Request - Aderavanta Grand Hotel"

        );


        // =====================================
        // 15. PREPARE BOOKING EMAIL MESSAGE
        // =====================================

        const message =

            "====================================\n" +

            "       ADERAVANTA GRAND HOTEL BOOKING\n" +

            "====================================\n\n" +


            "CUSTOMER INFORMATION\n" +

            "------------------------------------\n" +

            "Full Name: " + fullName + "\n" +

            "Phone Number: " + phone + "\n" +

            "Email Address: " + (email || "Not provided") + "\n\n" +


            "BOOKING INFORMATION\n" +

            "------------------------------------\n" +

            "Room Type: " + room + "\n" +

            "Preferred Floor: " + (floor || "No preference") + "\n" +

            "Number of Guests: " + guests + "\n" +

            "Check-in Date: " + arrival + "\n" +

            "Check-out Date: " + departure + "\n\n" +
            "Length of Stay: " + nights + (nights === 1 ? " night\n\n" : " nights\n\n") +


            "PAYMENT INFORMATION\n" +

            "------------------------------------\n" +

            "Payment Method: " + payment + "\n\n" +


            "SPECIAL REQUESTS\n" +

            "------------------------------------\n" +

            (requests || "No additional requests") + "\n\n" +


            "====================================\n" +

            "Thank you for choosing Aderavanta Grand Hotel.";


        // =====================================
        // 16. ENCODE EMAIL MESSAGE
        // =====================================

        const body = encodeURIComponent(message);


        // =====================================
        // 17. HOTEL EMAIL ADDRESS
        // =====================================

        const hotelEmail = "firomsabalcha478@gmail.com";


        // Create email link
        const emailLink =

            "mailto:" +

            hotelEmail +

            "?subject=" +

            subject +

            "&body=" +

            body;


        // =====================================
        // 18. SHOW BOOKING NOTICE
        // =====================================

        notice.textContent =

            "Your booking request is ready. Your email application will open. Please send the email to complete your request.";

        notice.classList.add("show");


        // =====================================
        // 19. OPEN EMAIL APPLICATION
        // =====================================

        window.location.href = emailLink;


        // =====================================
        // 20. SHOW CONFIRMATION MESSAGE
        // =====================================

        alert(

            "Your booking request has been prepared. Please send the email to complete your request."

        );

    });

    bookingForm.dataset.bookingApi = "true";
    bookingForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!bookingForm.reportValidity()) {
            return;
        }

        const formData = new FormData(bookingForm);
        const payload = {
            customerName: formData.get("fullname").trim(),
            phone: formData.get("phone").trim(),
            email: formData.get("email").trim(),
            roomType: formData.get("room"),
            floor: formData.get("floor"),
            guests: Number(formData.get("guests")),
            roomCount: Number(formData.get("roomCount")),
            checkIn: formData.get("arrival"),
            checkOut: formData.get("departure"),
            paymentMethod: formData.get("payment"),
            specialRequests: formData.get("requests").trim()
        };

        submitBookingButton.disabled = true;
        submitBookingButton.textContent = "Checking availability…";
        notice.classList.remove("is-error");
        notice.classList.add("show");
        notice.textContent = "Checking availability and saving your booking…";

        try {
            const response = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "Your booking could not be completed.");
            }

            const totalPrice = new Intl.NumberFormat("en").format(result.totalPrice);
            notice.textContent = isAfaanOromo()
                ? `Gaaffiin kireeffannaa fudhatame. Lakkoofsa ${result.bookingReference} · Mirkaneessa hoteelaa eegaa · ${result.roomType} · ${result.nights} · Waliigala ${totalPrice} ETB. Kaffaltiin eeggataa dha; kaffaltiin interneetii irratti hin raawwatamne.`
                : `Booking request received. Reference ${result.bookingReference} · Status: pending hotel confirmation · ${result.roomType} · ` +
                    `${result.floor || "Any floor"} · ${result.roomCount} ` +
                    `${result.roomType === "Shared Bed Space" ? (result.roomCount === 1 ? "bed" : "beds") : (result.roomCount === 1 ? "room" : "rooms")} · ` +
                    `${result.nights} ${result.nights === 1 ? "night" : "nights"} · Total ${totalPrice} ETB. Payment is pending; no online payment was taken.`;
            bookingForm.reset();
            departureInput.min = todayDate;
            updateStaySummary();
            await checkBookingAvailability();
        } catch (error) {
            console.error("Unable to submit room booking:", error);
            notice.classList.add("is-error");
            notice.textContent = error.message || "Unable to submit your booking. Please try again.";
        } finally {
            submitBookingButton.disabled = false;
            submitBookingButton.textContent = "Request Room Booking";
        }
    });

    function refreshAvailabilityWhenVisible() {
        if (!document.hidden && roomSelect.value && arrivalInput.value && departureInput.value) {
            checkBookingAvailability();
        }
    }

    window.setInterval(refreshAvailabilityWhenVisible, 60000);
    document.addEventListener("visibilitychange", refreshAvailabilityWhenVisible);

    const whatsappBookingButton = document.getElementById("whatsappBookingButton");
    if (whatsappBookingButton) {
        whatsappBookingButton.addEventListener("click", function () {
            if (!bookingForm.reportValidity()) return;

            const nights = updateStaySummary();
            if (nights < 1) {
                departureInput.reportValidity();
                return;
            }

            const guestCount = Number(document.getElementById("guests").value);
            const roomCount = Number(roomCountSelect.value);
            const nightlyRate = bookingRates.get(roomSelect.value);
            const estimatedTotal = Number.isSafeInteger(nightlyRate)
                ? `\nEstimated accommodation total: ${new Intl.NumberFormat("en").format(nightlyRate * nights * roomCount)} ETB`
                : "";
            const oromo = isAfaanOromo();
            const message = [
                oromo
                    ? "Aderavanta Grand Hotel, waa'ee turtii kana gaafachuu nan barbaada:"
                    : "Hello Aderavanta Grand Hotel, I would like to ask about this stay:",
                `${oromo ? "Maqaa" : "Name"}: ${document.getElementById("fullname").value.trim()}`,
                `${oromo ? "Bilbila" : "Phone"}: ${document.getElementById("phone").value.trim()}`,
                `${oromo ? "Kutaa" : "Room"}: ${roomSelect.value}`,
                `${oromo ? "Dabaala filatame" : "Preferred floor"}: ${floorSelect.value || (oromo ? "Filannoo hin jiru" : "No preference")}`,
                `${oromo ? "Keessummoota" : "Guests"}: ${guestCount}`,
                `${oromo ? "Baay'ina sireewwanii/kutaalee" : roomSelect.value === "Shared Bed Space" ? "Beds" : "Rooms"}: ${roomCount}`,
                `${oromo ? "Guyyaa seensaa" : "Check-in"}: ${arrivalInput.value}`,
                `${oromo ? "Guyyaa ba'umsaa" : "Check-out"}: ${departureInput.value}`,
                `${oromo ? "Halkan" : "Nights"}: ${nights}`,
                `${oromo ? "Mala kaffaltii filatame" : "Payment preference"}: ${document.getElementById("payment").value}`,
                `${oromo ? "Gaaffii addaa" : "Special requests"}: ${document.getElementById("requests").value.trim() || (oromo ? "Hin jiru" : "None")}`,
                estimatedTotal,
                "",
                oromo
                    ? "Maaloo argamaa fi gatii dhumaa mirkaneessaa. Gaaffiin kun kireeffannaa mirkanaa'e akka hin taane nan hubadha."
                    : "Please confirm availability and the final price. I understand this inquiry is not a confirmed reservation."
            ].filter(Boolean).join("\n");
            const whatsappUrl = `https://wa.me/251954278081?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        });
    }

}

const bookingStatusForm = document.getElementById("bookingStatusForm");
if (bookingStatusForm) {
    const statusResult = document.getElementById("bookingStatusResult");
    bookingStatusForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const values = new FormData(bookingStatusForm);
        statusResult.textContent = "Checking reservation…";
        statusResult.classList.remove("is-error", "is-success");
        try {
            const response = await fetch("/api/bookings/status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingReference: values.get("bookingReference").trim(),
                    phone: values.get("phone").trim()
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to check booking status.");
            statusResult.textContent = isAfaanOromo()
                ? `${result.bookingReference} · ${result.status} · ${result.roomType} · ${result.checkIn} hanga ${result.checkOut} · Halkan ${result.nights} · ${new Intl.NumberFormat("en").format(result.totalPrice)} ETB · Kaffaltii: ${result.paymentStatus}.`
                : `${result.bookingReference} · ${result.status} · ${result.roomType} · ` +
                    `${result.checkIn} to ${result.checkOut} · ${result.nights} nights · ` +
                    `${new Intl.NumberFormat("en").format(result.totalPrice)} ETB · ` +
                    `Payment: ${result.paymentStatus}.`;
            statusResult.classList.add("is-success");
        } catch (error) {
            console.error("Unable to check booking status:", error);
            statusResult.textContent = error.message || "Unable to check booking status.";
            statusResult.classList.add("is-error");
        }
    });
}

// =============================================
// 7. GUEST REVIEWS
// =============================================

const reviewList = document.getElementById("reviewList");
const reviewSummary = document.getElementById("reviewsSummary");
const reviewForm = document.getElementById("reviewForm");
const reviewNotice = document.getElementById("reviewNotice");

async function loadGuestReviews() {
    if (!reviewList || !reviewSummary) return;
    try {
        const response = await fetch("/api/reviews", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load guest reviews.");
        if (!Number.isSafeInteger(result.reviewCount) || !Array.isArray(result.reviews)) {
            throw new Error("Guest review response was invalid.");
        }

        reviewSummary.textContent = result.reviewCount
            ? `${result.averageRating.toFixed(1)} / 5 · ${result.reviewCount} ${result.reviewCount === 1 ? "published review" : "published reviews"}`
            : "No published guest reviews yet.";
        reviewList.replaceChildren();
        if (!result.reviews.length) {
            const empty = document.createElement("p");
            empty.className = "review-empty";
            empty.textContent = "Be one of the first guests to share your experience.";
            reviewList.appendChild(empty);
            return;
        }

        result.reviews.forEach(function (review) {
            const card = document.createElement("article");
            card.className = "review-card";
            const name = document.createElement("h3");
            name.textContent = review.guestName;
            const stars = document.createElement("p");
            stars.className = "review-stars";
            stars.setAttribute("aria-label", `${review.rating} out of 5 stars`);
            stars.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`;
            const text = document.createElement("p");
            text.textContent = review.reviewText;
            const date = document.createElement("time");
            date.className = "review-date";
            date.dateTime = review.createdAt;
            date.textContent = new Date(`${review.createdAt.replace(" ", "T")}Z`).toLocaleDateString();
            card.append(name, stars, text, date);
            reviewList.appendChild(card);
        });
        observeRevealTargets(reviewList);
    } catch (error) {
        console.error("Unable to load guest reviews:", error);
        reviewSummary.textContent = error.message || "Guest reviews could not be loaded.";
        reviewList.replaceChildren();
    }
}

if (reviewForm && reviewNotice) {
    reviewForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!reviewForm.reportValidity()) return;
        const values = new FormData(reviewForm);
        const submitButton = reviewForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        reviewNotice.className = "review-notice";
        reviewNotice.textContent = "Submitting your review for moderation…";
        try {
            const response = await fetch("/api/reviews", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    guestName: values.get("guestName").trim(),
                    rating: Number(values.get("rating")),
                    reviewText: values.get("reviewText").trim()
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Your review could not be submitted.");
            if (result.status !== "pending") throw new Error("Review moderation status was invalid.");
            reviewForm.reset();
            reviewNotice.textContent = "Thank you. Your review was received and will appear after hotel moderation.";
            reviewNotice.classList.add("is-success");
        } catch (error) {
            console.error("Unable to submit guest review:", error);
            reviewNotice.textContent = error.message || "Unable to submit your review.";
            reviewNotice.classList.add("is-error");
        } finally {
            submitButton.disabled = false;
        }
    });
    loadGuestReviews();
}

// =============================================
// 8. ENGLISH AND AFAAN OROMO
// =============================================

const languageToggle = document.getElementById("languageToggle");
const originalSiteText = new WeakMap();
const afaanOromoTranslations = [
    ['#navlinks a[href="#home"]', "Fuula Jalqabaa"],
    ['#navlinks a[href="#about"]', "Waa'ee Keenya"],
    ['#navlinks a[href="#floors"]', "Dabaalee Hoteelichaa"],
    ['#navlinks a[href="#rooms"]', "Kutaa fi Bakka Ciisichaa"],
    ['#navlinks a[href="#booking"]', "Kutaa Kireeffadhu"],
    ['#navlinks a[href="#pool"]', "Boolii"],
    ['#navlinks a[href="#dining"]', "Nyaataa fi Dhugaatii"],
    ['#navlinks a[href="#restaurant-order"]', "Ajaja Nyaataa"],
    ['#navlinks a[href="#services"]', "Tajaajiloota"],
    ['#navlinks a[href="#gallery"]', "Suuraalee"],
    ['#navlinks a[href="#contact"]', "Nu Quunnamaa"],
    ['#navlinks a[href="#location"]', "Bakka Keenya"],
    ['#navlinks .language-toggle', "English"],
    ['.hero-subtitle', "Bakka Qananiin Keessummeessummaa Olaanaa Itti Argamu"],
    ['.hero h1', "Mana Keessanitti Dhaga'aa, Yeroo Hundaa Gammadaa"],
    ['.hero-description', "Daldalaaf yoo imaltan, maatii keessan wajjin boqottan, yookaan Adaamaa daawwattan, turtii keessan yaadatamaa akka ta'uuf isin gargaarra."],
    ['.hero-buttons .btn-primary', "Turtii Keessan Kireeffadhaa"],
    ['.hero-buttons .btn-outline', "Kutaa Keenya Ilaalaa"],
    ['#about .section-label', "WAA'EE HOTEELLA KEENYAA"],
    ['#about h2', "Aderavanta Grand Hotel Baga Nagaan Dhuftan"],
    ['#floors .section-heading .section-label', "GAMOO HOTEELICHAA"],
    ['#floors .section-heading h2', "Dabaalee Hoteelichaa Daawwadhaa"],
    ['#rooms .section-heading .section-label', "BAKKA TURTII"],
    ['#rooms .section-heading h2', "Kutaa Isiniif Ta'u Filadhaa"],
    ['#rooms .section-heading p:not(.section-label)', "Kutaa namoota dhuunfaa, hiriyoota, maatii fi gareewwaniif mijatu filadhaa. Guyyoota keessan filachuun argama kutaa fi gatii waliigalaa ilaalaa."],
    ['#booking .booking-info .section-label', "TURTII KEESSAN KIREESSADHAA"],
    ['#booking .booking-info h2', "Kutaa Keessan Har'a Kireeffadhaa"],
    ['#booking .booking-info > p:not(.section-label)', "Guyyoota turtii fi gosa kutaa filadhaa. Argamni kutaa fi waliigalli kaffaltii yeroo gaafata kireeffannaa ergitan mirkanaa'a."],
    ['#booking .booking-contact h3', "Gargaarsa Barbaadduu?"],
    ['#bookingForm h3', "Odeeffannoo Kireeffannaa"],
    ['label[for="roomSearch"]', "Kutaalee barbaadaa"],
    ['.whatsapp-booking-btn + .form-note', "WhatsApp gaaffii kireeffannaa qofa bana. Kutaa hin qabsiisu; mirkaneessa hoteelaa eegaa."],
    ['#notice + .form-note', "Gaaffiin kireeffannaa keessanii argama kutaa irratti hundaa'uun mirkanaa'ee kuufama. Kaffaltiin interneetii irratti hin raawwatamu; hoteelli kaffaltii harkaan mirkaneessa."],
    ['label[for="fullname"]', "Maqaa Guutuu *"],
    ['label[for="phone"]', "Lakkoofsa Bilbilaa *"],
    ['label[for="email"]', "Teessoo Imeelii *"],
    ['label[for="room"]', "Gosa Kutaa *"],
    ['label[for="floor"]', "Dabaala Filatame"],
    ['label[for="guests"]', "Baay'ina Keessummootaa *"],
    ['label[for="payment"]', "Mala Kaffaltii Filatame *"],
    ['label[for="roomCount"]', "Baay'ina Kutaalee ykn Sireewwanii *"],
    ['label[for="arrival"]', "Guyyaa Seensaa *"],
    ['label[for="departure"]', "Guyyaa Ba'umsaa *"],
    ['label[for="requests"]', "Gaaffii Addaa"],
    ['#submitBooking', "Gaaffii Kireeffannaa Ergaa"],
    ['#whatsappBookingButton', "Waa'ee turtii kana WhatsApp irratti gaafadhaa"],
    ['#bookingStatusTitle', "Haala Kireeffannaa Keessanii Ilaalaa"],
    ['#bookingStatusTitle + p', "Lakkoofsa kireeffannaa fi lakkoofsa bilbilaa galchaa."],
    ['label[for="statusBookingReference"]', "Lakkoofsa kireeffannaa"],
    ['label[for="statusBookingPhone"]', "Lakkoofsa bilbilaa"],
    ['#pool .pool-content h2', "Boolii"],
    ['#dining .section-heading h2', "Nyaataa fi Dhugaatii"],
    ['#reviewsTitle', "Yaada fi Madaallii Keessummootaa"],
    ['#reviewForm h3', "Muuxannoo Turtii Keessanii Qoodaa"],
    ['label[for="reviewGuestName"]', "Maqaa Keessanii"],
    ['label[for="reviewRating"]', "Madaallii Keessanii"],
    ['label[for="reviewText"]', "Waa'ee turtii keessanii nuuf barreessaa"],
    ['#reviewForm button[type="submit"]', "Yaada Ergaa"],
    ['#gallery .section-heading h2', "Suuraalee Hoteelichaa Ilaalaa"],
    ['#contact h2', "Isin Simachuuf As Jirra"],
    ['#contact .contact-content > p:not(.section-label)', "Tajaajila keessummaa, kireeffannaa fi gaaffii turtii keessanii irratti gareen keenya isin gargaaruuf qophaa'a."],
    ['#contact .contact-card:nth-child(1) h3', "Bilbila"],
    ['#contact .contact-card:nth-child(2) h3', "Imeelii"],
    ['#contact .contact-card:nth-child(3) h3', "Telegram"],
    ['#contact .contact-card:nth-child(4) h3', "WhatsApp"],
    ['#contact .contact-card:nth-child(4) a', "Garee keenya waliin haasa'aa"],
    ['#contact .contact-card:nth-child(5) h3', "Bakka"],
    ['#contact .contact-card:nth-child(5) p', "Adaamaa, Itoophiyaa"],
    ['#location .section-heading h2', "Bakka Keenya"],
    ['#location .section-heading p:not(.section-label)', "Aderavanta Grand Hotel Adaamaa, Itoophiyaa keessatti argama."],
    ['#location .map-link a', "Google Maps Banadhaa"]
];

function setSiteLanguage(language) {
    const useOromo = language === "om";
    afaanOromoTranslations.forEach(function ([selector, oromoText]) {
        document.querySelectorAll(selector).forEach(function (element) {
            if (!originalSiteText.has(element)) {
                originalSiteText.set(element, element.textContent);
            }
            element.textContent = useOromo ? oromoText : originalSiteText.get(element);
        });
    });

    const optionTranslations = [
        ['#room option[value=""]', "Gosa kutaa filadhaa"],
        ['#floor option[value=""]', "Filannoo hin jiru"],
        ['#guests option[value=""]', "Baay'ina keessummootaa filadhaa"],
        ['#payment option[value=""]', "Mala kaffaltii filadhaa"],
        ['#roomCount option[value=""]', "Baay'ina kutaalee ykn sireewwanii filadhaa"],
        ['#bookingStatusForm button[type="submit"]', "Kireeffannaa Ilaalaa"],
        ['#floor option[value="First Floor"]', "Dabaala Tokkoffaa"],
        ['#floor option[value="Second Floor"]', "Dabaala Lammaffaa"],
        ['#floor option[value="Third Floor"]', "Dabaala Sadaffaa"],
        ['#floor option[value="Fourth Floor"]', "Dabaala Afraffaa"]
    ];
    optionTranslations.forEach(function ([selector, oromoText]) {
        document.querySelectorAll(selector).forEach(function (element) {
            if (!originalSiteText.has(element)) {
                originalSiteText.set(element, element.textContent);
            }
            element.textContent = useOromo ? oromoText : originalSiteText.get(element);
        });
    });

    const placeholders = [
        [document.getElementById("fullname"), "Maqaa keessan guutuu galchaa."],
        [document.getElementById("phone"), "09XXXXXXXX"],
        [document.getElementById("email"), "example@gmail.com"],
        [document.getElementById("requests"), "Gaaffii dabalataa asitti barreessaa…"],
        [document.getElementById("roomSearch"), "“Maatii” ykn “Deluxe” yaalaa"]
    ];
    placeholders.forEach(function ([element, oromoText]) {
        if (!element) return;
        if (!element.dataset.englishPlaceholder) {
            element.dataset.englishPlaceholder = element.placeholder;
        }
        element.placeholder = useOromo ? oromoText : element.dataset.englishPlaceholder;
    });

    document.documentElement.lang = useOromo ? "om" : "en";
    languageToggle.textContent = useOromo ? "English" : "Afaan Oromo";
    languageToggle.setAttribute(
        "aria-label",
        useOromo ? "Switch language to English" : "Switch language to Afaan Oromo"
    );
    languageToggle.dataset.language = useOromo ? "om" : "en";
    const arrivalInput = document.getElementById("arrival");
    if (arrivalInput) {
        arrivalInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
}

if (languageToggle) {
    languageToggle.addEventListener("click", function () {
        setSiteLanguage(languageToggle.dataset.language === "om" ? "en" : "om");
    });
    setSiteLanguage("en");
}


// =============================================
// END OF ADERAVANTA GRAND HOTEL JAVASCRIPT
// =============================================