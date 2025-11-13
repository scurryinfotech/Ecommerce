$(function () {
    // API endpoints
    const productsApiUrl = '/home/GetProducts';
    const productVariantsApiUrl = '/home/GetProductsId';
    const categoriesApiUrl = '/home/GetCategories';

    // State
    let products = [];
    let categories = [];
    let productSelections = {};
    let productVariantsCache = {};
    let selectedCategory = 'all';
    let cart = [];
    let favorites = [];
    let searchTerm = '';
    let currentPage = 1;
    let itemsPerPage = 3;


    // Load categories
    function loadCategories() {
        $.ajax({
            url: categoriesApiUrl,
            method: 'GET',
            dataType: 'json',
            success: function (resp) {
                const arr = Array.isArray(resp) ? resp : [];
                const mapped = arr.map(c => {
                    const name = c.name ?? c.categoryName ?? c.Name ?? c.Category ?? c;
                    let id = c.id ?? c.category_id ?? (typeof name === 'string' ? name.toString().toLowerCase().replace(/\s+/g, '-') : String(name));
                    id = String(id).toLowerCase();
                    return { id, name: String(name) };
                });

                const seen = new Set();
                const unique = [];
                mapped.forEach(m => {
                    if (!seen.has(m.id)) {
                        unique.push(m);
                        seen.add(m.id);
                    }
                });

                categories = [{ id: 'all', name: 'All Sandals' }, ...unique];
                renderFilters();
                loadProducts();
            },
            error: function (xhr, status, err) {
                console.error('Failed to load categories', err);
                loadProducts(true);
            }
        });
    }

    // Render category filters
    function renderFilters() {
        const $filters = $('#filters');
        $filters.empty();
        categories.forEach(cat => {
            const $btn = $('<button>')
                .addClass('filter-btn')
                .toggleClass('active', cat.id === selectedCategory)
                .text(cat.name)
                .data('catid', cat.id)
                .click(function () {
                    selectedCategory = cat.id;
                    renderFilters();
                    renderProducts();
                });
            $filters.append($btn);
        });
    }

    // Load products
    function loadProducts(fallbackOnly = false) {

        $.ajax({
            url: productsApiUrl,
            method: 'GET',
            dataType: 'json',
            success: function (resp) {
                const arr = Array.isArray(resp) ? resp : [];
                products = arr.map(p => ({
                    id: p.product_id,
                    name: p.name ?? p.productName ?? p.Name ?? '',
                    price: Number(p.price ?? p.Price ?? 0),
                    category: (p.category ?? p.Category ?? p.categoryName ?? 'uncategorized').toString().toLowerCase(),
                    image: p.main_image ?? p.imageUrl ?? p.ImageUrl ?? '',
                    raw: p
                }));

                // Derive categories from products if needed
                if (!categories.length || fallbackOnly) {
                    const unique = [...new Set(products.map(x => x.category))].map(cat => ({
                        id: cat,
                        name: cat.charAt(0).toUpperCase() + cat.slice(1)
                    }));
                    categories = [{ id: 'all', name: 'All Sandals' }, ...unique];
                    renderFilters();
                }

                renderProducts();
            },
            error: function (xhr, status, err) {
                console.error('Failed to load products', err);
            }
        });
    }

    // Render products
    function renderProducts() {

        const $grid = $('#productsGrid');
        $grid.empty();

        const filtered = products.filter(p => {
            const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            $grid.html('<p style="text-align:center;color:#999;padding:40px;">No products found.</p>');
            return;
        }

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedProducts = filtered.slice(startIndex, endIndex);

        // Render visible products
        paginatedProducts.forEach(product => {

            initializeSelection(product.product_id);
            const $card = $('<div>').addClass('product-card').attr('data-productid', product.id);
            const $img = $('<img>').attr('src', product.image || product.main).addClass('product-image');
            const $info = $('<div>').addClass('product-info');
            const $header = $('<div>').addClass('product-header')
                .append(`<div class="product-name">${product.name}</div>`)
                .append(`<div class="product-price">Rs${product.price.toFixed(2)}</div>`);

            $info.append($header);
            $card.append($img, $info);

            loadProductVariants(product.id, $card, product);

            $grid.append($card);
        });
        renderPagination(totalPages);

    }
    function renderPagination(totalPages) {
        const $pagination = $('.pagination');
        $pagination.empty();

        if (totalPages <= 1) return; // agar sirf ek hi page hai to pagination mat dikha

        // Previous Button
        const $prev = $('<li>').addClass('page-item')
            .toggleClass('disabled', currentPage === 1)
            .append($('<a>').addClass('page-link').attr('href', '#').text('Previous').click(function (e) {
                e.preventDefault();
                if (currentPage > 1) {
                    currentPage--;
                    renderProducts();
                }
            }));
        $pagination.append($prev);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const $page = $('<li>').addClass('page-item')
                .toggleClass('active', i === currentPage)
                .append($('<a>').addClass('page-link').attr('href', '#').text(i).click(function (e) {
                    e.preventDefault();
                    currentPage = i;
                    renderProducts();
                }));
            $pagination.append($page);
        }

        // Next Button
        const $next = $('<li>').addClass('page-item')
            .toggleClass('disabled', currentPage === totalPages)
            .append($('<a>').addClass('page-link').attr('href', '#').text('Next').click(function (e) {
                e.preventDefault();
                if (currentPage < totalPages) {
                    currentPage++;
                    renderProducts();
                }
            }));
        $pagination.append($next);
    }


    // Load variants
    function loadProductVariants(productId, $card, product) {
        // 🔹 Use cache if available
        if (productVariantsCache[productId]) {
            renderProductOptions(productId, $card, product, productVariantsCache[productId]);
            return;
        }

        $.ajax({
            url: productVariantsApiUrl,
            method: 'GET',
            data: { id: productId },
            dataType: 'json',
            success: function (resp) {
                console.log("Variant response for", productId, resp);

                // ✅ Always normalize API data as array
                const arr = Array.isArray(resp) ? resp : (resp ? [resp] : []);

                if (arr.length === 0) {
                    // ⚠️ No data came from API → use default
                    console.warn(`⚠️ No variants found for Product ${productId}, using defaults`);
                    const norm = {
                        sizes: [5, 6, 7, 8, 9],
                        colors: ['Red', 'Black', 'Beige'],
                        heelHeights: [1.5, 2, 3, 4]
                    };
                    productVariantsCache[productId] = norm;
                    renderProductOptions(productId, $card, product, norm);
                    return;
                }

                // ✅ API data present → collect actual values
                const sizesSet = new Set();
                const colorsSet = new Set();
                const heelsSet = new Set();

                arr.forEach(v => {

                    if (v.size || v.Size) sizesSet.add(String(v.size ?? v.Size).trim());
                    if (v.color_name || v.Color || v.color) colorsSet.add(String(v.color_name ?? v.Color ?? v.color).trim());
                    if (v.heel_height || v.HeelHeight || v.Heel) {
                        const val = Number(v.heel_height ?? v.HeelHeight ?? v.Heel);
                        if (!isNaN(val)) heelsSet.add(val);
                    }
                });

                const variantData = {
                    sizes: Array.from(sizesSet),
                    colors: Array.from(colorsSet),
                    heelHeights: Array.from(heelsSet)
                };

                // ✅ If API provided valid data, use only that
                console.log(`✅ Using actual variants for Product ${productId}`, variantData);

                productVariantsCache[productId] = variantData;
                renderProductOptions(productId, $card, product, variantData);
            },
            error: function (xhr, status, err) {
                console.error(`❌ API error for Product ${productId}:`, err);
                const norm = {
                    sizes: [5, 6, 7, 8, 9],
                    colors: ['Red', 'Black', 'Beige'],
                    heelHeights: [1.5, 2, 3, 4]
                };
                productVariantsCache[productId] = norm;
                renderProductOptions(productId, $card, product, norm);
            }
        });
    }




    function normalizeArray(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map(x => x.trim()).filter(Boolean);
        return [];
    }

    // Render options
    function renderProductOptions(productId, $card, product, variants) {
        initializeSelection(productId);
        const selection = productSelections[productId];
        const canAddToCart = selection.size && selection.color && selection.heelHeight;

        const $options = $('<div>').addClass('options-section');

        // Size
        const $sizeRow = $('<div>').addClass('option-row');
        $sizeRow.append('<span class="option-label">Size:</span>');
        const $sizeGroup = $('<div>').addClass('option-group');
        variants.sizes.forEach(size => {
            const $b = $('<button>').addClass('option-btn')
                .toggleClass('selected', selection.size == size)
                .text(size)
                .click(() => {
                    selection.size = size;
                    renderProductOptions(productId, $card, product, variants);
                });
            $sizeGroup.append($b);
        });
        $sizeRow.append($sizeGroup);

        // Color
        const $colorRow = $('<div>').addClass('option-row');
        $colorRow.append('<span class="option-label">Color:</span>');
        const $colorGroup = $('<div>').addClass('color-swatches');
        variants.colors.forEach(color => {
            const $b = $('<button>').addClass('color-swatch')
                .attr('title', color)
                .toggleClass('selected', selection.color === color)
                .css('background-color', mapColorToCss(color))
                .click(() => {
                    selection.color = color;
                    renderProductOptions(productId, $card, product, variants);
                });
            $colorGroup.append($b);
        });
        $colorRow.append($colorGroup);

        // Heel
        const $heelRow = $('<div>').addClass('option-row');
        $heelRow.append('<span class="option-label">Heel Height (inches):</span>');
        const $heelGroup = $('<div>').addClass('option-group');
        variants.heelHeights.forEach(h => {
            const $b = $('<button>').addClass('option-btn')
                .toggleClass('selected', selection.heelHeight == h)
                .text(h + '"')
                .click(() => {
                    selection.heelHeight = h;
                    renderProductOptions(productId, $card, product, variants);
                });
            $heelGroup.append($b);
        });
        $heelRow.append($heelGroup);

        $options.append($sizeRow, $colorRow, $heelRow);

        // Add button
        const $addBtn = $('<button>').addClass('action-btn')
            .prop('disabled', !canAddToCart)
            .text(canAddToCart ? 'Add to Cart' : 'Add to Cart')
            .click(() => addToCart(productId, product, selection));
        $options.append($addBtn);

        $card.find('.options-section').remove();
        $card.find('.product-info').append($options);
    }

    function mapColorToCss(color) {
        const map = {
            red: '#f44336',
            black: '#212121',
            beige: '#d4a574',
            white: '#ffffff',
            blue: '#2196f3',
            brown: '#8d6e63',
            green: '#4caf50',
            pink: '#e91e63',
            grey: '#9e9e9e',
            gray: '#9e9e9e'
        };
        return map[color.toLowerCase()] || color;
    }

    function initializeSelection(productId) {
        if (!productSelections[productId]) {
            productSelections[productId] = { size: null, color: null, heelHeight: null };
        }
    }

    // Cart functions
    function addToCart(productId, product, selection) {
        if (!selection.size || !selection.color || !selection.heelHeight) {
            alert('Please select all options');
            return;
        }

        const cartItem = {
            id: product.id,
            name: product.name,
            price: product.price,
            size: selection.size,
            color: selection.color,
            heelHeight: selection.heelHeight,
            quantity: 1
            //cartId: Date.now()
        };

        cart.push(cartItem);
        updateCart();
        productSelections[productId] = { size: null, color: null, heelHeight: null };
        renderProducts();
    }

    function updateCart() {
        const $cartItemsDiv = $('#cartItems');
        const $cartBadge = $('#cartBadge');
        const $cartTotal = $('#cartTotal');

        $cartItemsDiv.empty();

        const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

        if (totalItems > 0) {
            $cartBadge.text(totalItems).css('display', 'flex');
        } else {
            $cartBadge.css('display', 'none');
        }

        $cartTotal.text('Rs ' + total.toFixed(2));

        if (cart.length === 0) {
            $cartItemsDiv.html('<div class="empty-cart">Your cart is empty</div>');
            return;
        }

        cart.forEach(item => {
            const variants = productVariantsCache[item.id] ?? {
                sizes: [item.size],
                colors: [item.color],
                heelHeights: [item.heelHeight]
            };

            const $cartItem = $('<div>').addClass('cart-item');

            const $header = $('<div>').addClass('cart-item-header');
            const $img = $('<img>').addClass('cart-item-image').attr('src', item.main_image || item.image);
            const $main = $('<div>').addClass('cart-item-main');
            $main.append(`<div class="cart-item-name">${item.name}</div>`);
            $main.append(`<div class="cart-item-specs">Size: ${item.size}  Color: ${item.color}  Heel: ${item.heelHeight}"</div>`);
            $main.append(`<div class="cart-item-price">$${item.price.toFixed(2)}</div>`);
            $header.append($img, $main);

            const $options = $('<div>').addClass('cart-options');

            // Size
            const $sizeRow = $('<div>').addClass('cart-option-row');
            $sizeRow.append('<span class="cart-option-label">Change Size:</span>');
            const $sizeGroup = $('<div>').addClass('option-group');
            variants.sizes.forEach(s => {
                const $b = $('<button>').addClass('option-btn')
                    .toggleClass('selected', item.size == s)
                    .text(s)
                    .click(() => {
                        item.size = s;
                        updateCart();
                    });
                $sizeGroup.append($b);
            });
            $sizeRow.append($sizeGroup);

            // Color
            const $colorRow = $('<div>').addClass('cart-option-row');
            $colorRow.append('<span class="cart-option-label">Change Color:</span>');
            const $colorGroup = $('<div>').addClass('cart-color-swatches');
            variants.colors.forEach(c => {
                const $b = $('<button>').addClass('cart-color-swatch')
                    .attr('title', c)
                    .toggleClass('selected', item.color === c)
                    .css('background-color', mapColorToCss(c))
                    .click(() => {
                        item.color = c;
                        updateCart();
                    });
                $colorGroup.append($b);
            });
            $colorRow.append($colorGroup);

            // Heel
            const $heelRow = $('<div>').addClass('cart-option-row');
            $heelRow.append('<span class="cart-option-label">Change Heel Height:</span>');
            const $heelGroup = $('<div>').addClass('option-group');
            variants.heelHeights.forEach(h => {
                const $b = $('<button>').addClass('option-btn')
                    .toggleClass('selected', item.heelHeight == h)
                    .text(h + '"')
                    .click(() => {
                        item.heelHeight = h;
                        updateCart();
                    });
                $heelGroup.append($b);
            });
            $heelRow.append($heelGroup);

            $options.append($sizeRow, $colorRow, $heelRow);

            // Controls
            const $controls = $('<div>').addClass('cart-controls');
            const $qtyControls = $('<div>').addClass('quantity-controls');
            const $minus = $('<button>').addClass('qty-btn').text('-').click(() => updateQuantity(item.cartId, -1));
            const $qtyNum = $('<span>').addClass('qty-number').text(item.quantity);
            const $plus = $('<button>').addClass('qty-btn').text('+').click(() => updateQuantity(item.cartId, 1));
            $qtyControls.append($minus, $qtyNum, $plus);

            const $remove = $('<button>').addClass('remove-btn').text('Remove').click(() => removeFromCart(item.cartId));

            $controls.append($qtyControls, $remove);

            $cartItem.append($header, $options, $controls);
            $cartItemsDiv.append($cartItem);
        });
    }

    function updateQuantity(cartId, change) {
        const item = cart.find(i => i.cartId === cartId);
        if (!item) return;
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(cartId);
        } else {
            updateCart();
        }
    }

    function removeFromCart(cartId) {
        cart = cart.filter(i => i.cartId !== cartId);
        updateCart();
    }

    // UI Events
    $('#cartBtn').on('click', () => $('#cartSidebar').addClass('open'));
    $('#closeCart').on('click', () => $('#cartSidebar').removeClass('open'));
    $('#searchInput').on('input', function () {
        searchTerm = $(this).val();
        renderProducts();
    });

    // Checkout function
    // Checkout function

    function sendOtp() {
        const email = document.getElementById('customerEmail');
        const otpVerify = document.getElementById('otpSection')[0];

        Email.send({
            SecureToken: "C973D7AD-F097-4B95-91F4-40ABC5567812",
            To: 'them@website.com',
            From: "you@isp.com",
            Subject: "This is the subject",
            Body: "And this is the body"
        }).then(
            message => alert(message)
        );
    }


    window.checkout = function () {
        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        // Close cart sidebar
        $('#cartSidebar').removeClass('open');

        // Show checkout modal
        showCheckoutModal();
    };

    // Checkout Modal Function
    function showCheckoutModal() {
        // Create modal HTML
        const modalHtml = `
        <div class="checkout-modal-overlay" id="checkoutModalOverlay">
            <div class="checkout-modal">
                <div id="checkoutForm">
                    <div class="checkout-header">
                        <h1>Complete Your Order</h1>
                        <p>Please fill in your details to proceed</p>
                        <button class="modal-close-btn" id="closeCheckoutModal">✕</button>
                    </div>

                    <div class="order-summary">
                        <h3>Order Summary</h3>
                        <div id="orderSummaryItems"></div>
                        <div class="order-total">
                            <span class="total-label">Total</span>
                            <span class="total-amount" id="modalTotal">Rs 0.00</span>
                        </div>
                    </div>

                    <form id="orderForm">
                        <div class="form-group">
                            <label>Full Name <span>*</span></label>
                            <input type="text" id="customerName" placeholder="Enter your full name" required>
                            <div class="error-message" id="nameError">Please enter your name</div>
                        </div>

                        <div class="form-group">
                               <label>Email Address <span>*</span></label>
                               <input type="email" id="customerEmail" placeholder="Enter Email..." required>
                                          <div class="error-message" id="emailError">Please enter a valid email</div>

                                       <div class="otpverify" id="otpSection" style="display: none;">
                                         <input type="text" id="otpInput" placeholder="Enter the OTP sent to your Email..." maxlength="6">
                                         <button type="button" class="btn" id="verifyOtpBtn">Verify</button>
                                          </div>
              
                                           <button type="button" class="btn" id="sendOtpBtn">Send OTP</button>
                                </div>

                        <div class="form-group">
                            <label>Phone Number <span>*</span></label>
                            <input type="tel" id="customerPhone" placeholder="+91 98765 43210" required maxlength="15">
                            <div class="error-message" id="phoneError">Please enter a valid phone number</div>
                        </div>

                        <div class="form-group">
                            <label>Delivery Address <span>*</span></label>
                            <textarea id="customerAddress" placeholder="House No., Street, Landmark" required></textarea>
                            <div class="error-message" id="addressError">Please enter your address</div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>City <span>*</span></label>
                                <input type="text" id="customerCity" placeholder="City" required>
                                <div class="error-message" id="cityError">Required</div>
                            </div>

                            <div class="form-group">
                                <label>Pincode <span>*</span></label>
                                <input type="text" id="customerPincode" placeholder="400001" required maxlength="6">
                                <div class="error-message" id="pincodeError">Invalid pincode</div>
                            </div>
                        </div>
                        <div class="form-group">

  <label>Payment Method <span>*</span></label>
  <div class="payment-options">
    <label>
      <input type="radio" name="paymentMethod" value="phonepe" checked>
      Pay Online (PhonePe / UPI / Card)
    </label>
    <label>
      <input type="radio" name="paymentMethod" value="cod">
      Cash on Delivery (COD)
    </label>
  </div>
</div>


                        <button type="submit" class="btn-place-order">Place Order</button>
                    </form>
                </div>

                <div class="success-message" id="successMessage" style="display: none;">
                    <div class="checkmark">
                        <svg viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    </div>
                    <h2>Order Placed Successfully!</h2>
                    <p>Thank you for your purchase</p>
                    <div class="order-id">
                        Order ID: <span id="orderIdDisplay"></span>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        A confirmation email has been sent to your email address.
                    </p>
                    <button class="btn-place-order" onclick="closeCheckoutModal()">Continue Shopping</button>
                </div>
            </div>
        </div>
    `;

        // Append modal to body
        $('body').append(modalHtml);

        // Populate order summary
        const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        $('#modalTotal').text('Rs ' + total.toFixed(2));

        const $summaryItems = $('#orderSummaryItems');
        cart.forEach(item => {
            $summaryItems.append(`
            <div class="order-item">
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-specs">Size: ${item.size} | Color: ${item.color} | Heel: ${item.heelHeight}" | Qty: ${item.quantity}</div>
                </div>
                <div class="item-price">Rs${(item.price * item.quantity).toFixed(2)}</div>
            </div>
        `);
        });

        // Close button
        $('#closeCheckoutModal').on('click', closeCheckoutModal);
        $('#checkoutModalOverlay').on('click', function (e) {
            if (e.target.id === 'checkoutModalOverlay') {
                closeCheckoutModal();
            }
        });

        // Form validation and submission
        setupCheckoutForm();
    }

    function closeCheckoutModal() {
        $('#checkoutModalOverlay').remove();
    }

    function setupCheckoutForm() {
        // Phone number formatting
        $('#customerPhone').on('input', function () {
            let value = $(this).val().replace(/\D/g, '');
            if (value.length > 10) {
                value = value.substring(0, 10);
            }
            $(this).val(value);
        });

        // Pincode validation
        $('#customerPincode').on('input', function () {
            let value = $(this).val().replace(/\D/g, '');
            if (value.length > 6) {
                value = value.substring(0, 6);
            }
            $(this).val(value);
        });

        // Validation functions
        function validateEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }

        function validatePhone(phone) {
            return phone.length === 10;
        }

        function validatePincode(pincode) {
            return pincode.length === 6;
        }

        // Real-time validation
        $('#customerName').on('blur', function () {
            if ($(this).val().trim() === '') {
                $('#nameError').show();
            } else {
                $('#nameError').hide();
            }
        });

        $('#customerEmail').on('blur', function () {
            if (!validateEmail($(this).val())) {
                $('#emailError').show();
            } else {
                $('#emailError').hide();
            }
        });

        $('#customerPhone').on('blur', function () {
            if (!validatePhone($(this).val())) {
                $('#phoneError').show();
            } else {
                $('#phoneError').hide();
            }
        });

        $('#customerAddress').on('blur', function () {
            if ($(this).val().trim() === '') {
                $('#addressError').show();
            } else {
                $('#addressError').hide();
            }
        });

        $('#customerCity').on('blur', function () {
            if ($(this).val().trim() === '') {
                $('#cityError').show();
            } else {
                $('#cityError').hide();
            }
        });

        $('#customerPincode').on('blur', function () {
            if (!validatePincode($(this).val())) {
                $('#pincodeError').show();
            } else {
                $('#pincodeError').hide();
            }
        });

        // Form submission
        $('#orderForm').on('submit', function (e) {
            e.preventDefault();

            // Hide all errors
            $('.error-message').hide();

            // Get form values
            const name = $('#customerName').val().trim();
            const email = $('#customerEmail').val().trim();
            const phone = $('#customerPhone').val().trim();
            const address = $('#customerAddress').val().trim();
            const city = $('#customerCity').val().trim();
            const pincode = $('#customerPincode').val().trim();

            let isValid = true;

            // Validate all fields
            if (name === '') {
                $('#nameError').show();
                isValid = false;
            }

            if (!validateEmail(email)) {
                $('#emailError').show();
                isValid = false;
            }

            if (!validatePhone(phone)) {
                $('#phoneError').show();
                isValid = false;
            }

            if (address === '') {
                $('#addressError').show();
                isValid = false;
            }

            if (city === '') {
                $('#cityError').show();
                isValid = false;
            }

            if (!validatePincode(pincode)) {
                $('#pincodeError').show();
                isValid = false;
            }

            if (isValid) {
                $('.btn-place-order').prop('disabled', true).text('Processing...');

                const orderId = 'ORD' + Date.now();
                const paymentMethod = $('input[name="paymentMethod"]:checked').val();
                const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

                const orderData = {
                    orderId: orderId,
                    name: name,
                    email: email,
                    phone: phone,
                    address: address,
                    city: city,
                    pincode: pincode,
                    OrderItems: cart,
                    total: total,
                    paymentMode: paymentMethod,
                    date: new Date().toLocaleString()
                };

                if (paymentMethod === "cod") {
                    // ✅ COD — Directly place the order
                    placeOrder(orderData);
                } else {
                    // 💳 Online Payment — Call PhonePe first
                    initiatePhonePePayment(orderData);
                }
            }
        });
    }

    function initiatePhonePePayment(orderData) {
        
        
        const payload = {
            orderId: orderData.orderId,
            name: orderData.name,
            email: orderData.email,
            phone: orderData.phone,
            address: orderData.address,
            city: orderData.city,
            pincode: orderData.pincode,
            OrderItems: orderData.OrderItems || orderData.OrderItems === undefined ? orderData.OrderItems || orderData.OrderItems : orderData.OrderItems,
            total: orderData.total,
            paymentMode: orderData.paymentMode,
            date: orderData.date
        };

        
        payload.OrderItems = orderData.OrderItems || orderData.Items || [];

        $.ajax({
            url: '/home/InitiatePhonePePayment',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function (resp) {
                if (resp && resp.redirectUrl) {
                    window.location.href = resp.redirectUrl;
                } else {
                    alert("Unable to initiate payment. Please try again.");
                    $('.btn-place-order').prop('disabled', false).text('Place Order');
                }
            },
            error: function () {
                alert("Error initiating payment.");
                $('.btn-place-order').prop('disabled', false).text('Place Order');
            }
        });
    }

    function placeOrder(orderData) {
        $.ajax({
            url: '/home/PlaceOrder',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(orderData),
            success: function (response) {
                alert("Order has been Placed Successfully");
                cart = [];
                updateCart();
                $('#checkoutForm').fadeOut(300, function () {
                    $('#orderIdDisplay').text(orderData.orderId);
                    $('#successMessage').fadeIn(300);
                });
            },
            error: function () {
                alert("Error placing order!");
                $('.btn-place-order').prop('disabled', false).text('Place Order');
            }
        });
    }


    // Initialize
    loadCategories();
});