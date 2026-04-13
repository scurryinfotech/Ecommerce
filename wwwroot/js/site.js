$(function () {


    let products             = [];
    let categories           = [];
    let productSelections    = {};
    let productVariantsCache = {};
    let selectedCategory     = 'all';
    let cart                 = [];
    let searchTerm           = '';
    let currentPage          = 1;
    const itemsPerPage       = 3;

    // ─────────────────────────────────────────────────────────────
    // LOAD CATEGORIES
    // ─────────────────────────────────────────────────────────────
    function loadCategories() {
        $.ajax({
            url: '/home/GetCategories', method: 'GET', dataType: 'json',
            success: function (resp) {
                const arr    = Array.isArray(resp) ? resp : [];
                const mapped = arr.map(c => {
                    const name = c.name ?? c.Name ?? c.categoryName ?? String(c);
                    const id   = String(c.category_id ?? c.id ?? name).toLowerCase().replace(/\s+/g, '-');
                    return { id, name: String(name) };
                });
                const seen = new Set(), unique = [];
                mapped.forEach(m => { if (!seen.has(m.id)) { unique.push(m); seen.add(m.id); } });
                categories = [{ id: 'all', name: 'All Sandals' }, ...unique];
                renderFilters();
                loadProducts();
            },
            error: () => loadProducts(true)
        });
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER FILTERS
    // ─────────────────────────────────────────────────────────────
    function renderFilters() {
        const $f = $('#filters').empty();
        categories.forEach(cat => {
            $('<button>').addClass('filter-btn')
                .toggleClass('active', cat.id === selectedCategory)
                .text(cat.name)
                .click(() => { selectedCategory = cat.id; currentPage = 1; renderFilters(); renderProducts(); })
                .appendTo($f);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // LOAD PRODUCTS
    // ─────────────────────────────────────────────────────────────
    function loadProducts(fallbackOnly = false) {
        $.ajax({
            url: '/home/GetProducts', method: 'GET', dataType: 'json',
            success: function (resp) {
                const arr = Array.isArray(resp) ? resp : [];
                products  = arr.map(p => ({
                    id:       p.product_id,
                    name:     p.name ?? p.Name ?? '',
                    price:    Number(p.price ?? 0),
                    category: (p.category ?? p.categoryName ?? 'uncategorized').toLowerCase(),
                    image:    p.main_image ?? ''
                }));
                if (!categories.length || fallbackOnly) {
                    const unique = [...new Set(products.map(x => x.category))].map(c => ({
                        id: c, name: c.charAt(0).toUpperCase() + c.slice(1)
                    }));
                    categories = [{ id: 'all', name: 'All Sandals' }, ...unique];
                    renderFilters();
                }
                renderProducts();
            },
            error: (x, s, e) => console.error('Failed to load products', e)
        });
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER PRODUCTS + PAGINATION
    // ─────────────────────────────────────────────────────────────
    function renderProducts() {
        const $grid = $('#productsGrid').empty();
        const filtered = products.filter(p =>
            (selectedCategory === 'all' || p.category === selectedCategory) &&
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (!filtered.length) {
            $grid.html('<p style="text-align:center;color:#999;padding:40px;">No products found.</p>');
            renderPagination(0); return;
        }
        const totalPages       = Math.ceil(filtered.length / itemsPerPage);
        const paginated        = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        paginated.forEach(p   => {
            initSelection(p.id);
            const $card = $('<div>').addClass('product-card').attr('data-productid', p.id);
            $('<img>').attr('src', p.image).addClass('product-image').appendTo($card);
            const $info = $('<div>').addClass('product-info').appendTo($card);
            $('<div>').addClass('product-header')
                .append(`<div class="product-name">${p.name}</div>`)
                .append(`<div class="product-price">Rs${p.price.toFixed(2)}</div>`)
                .appendTo($info);
            loadVariants(p.id, $card, p);
            $card.appendTo($grid);
        });
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        const $pg = $('.pagination').empty();
        if (totalPages <= 1) return;
        $pg.append(mkPageBtn('Previous', currentPage > 1, () => { currentPage--; renderProducts(); }));
        for (let i = 1; i <= totalPages; i++) {
            const page = i;
            $('<li>').addClass('page-item').toggleClass('active', i === currentPage)
                .append($('<a>').addClass('page-link').attr('href','#').text(i)
                    .click(e => { e.preventDefault(); currentPage = page; renderProducts(); }))
                .appendTo($pg);
        }
        $pg.append(mkPageBtn('Next', currentPage < totalPages, () => { currentPage++; renderProducts(); }));
    }

    function mkPageBtn(label, enabled, fn) {
        return $('<li>').addClass('page-item').toggleClass('disabled', !enabled)
            .append($('<a>').addClass('page-link').attr('href','#').text(label)
                .click(e => { e.preventDefault(); if (enabled) fn(); }));
    }

    // ─────────────────────────────────────────────────────────────
    // VARIANTS
    // ─────────────────────────────────────────────────────────────
    function loadVariants(productId, $card, product) {
        if (productVariantsCache[productId]) {
            renderOptions(productId, $card, product, productVariantsCache[productId]); return;
        }
        $.ajax({
            url: '/home/GetProductsId', method: 'GET', data: { id: productId }, dataType: 'json',
            success: function (resp) {
                const arr = Array.isArray(resp) ? resp : (resp ? [resp] : []);
                if (!arr.length) { useDefaults(productId, $card, product); return; }
                const sizes = new Set(), colors = new Set(), heels = new Set();
                arr.forEach(v => {
                    if (v.size  || v.Size)                         sizes.add(String(v.size  ?? v.Size).trim());
                    if (v.color_name || v.Color || v.color)        colors.add(String(v.color_name ?? v.Color ?? v.color).trim());
                    const h = Number(v.heel_height ?? v.HeelHeight ?? 0);
                    if (!isNaN(h) && h > 0)                        heels.add(h);
                });
                const data = { sizes: [...sizes], colors: [...colors], heelHeights: [...heels] };
                productVariantsCache[productId] = data;
                renderOptions(productId, $card, product, data);
            },
            error: () => useDefaults(productId, $card, product)
        });
    }

    function useDefaults(productId, $card, product) {
        const def = { sizes: [5,6,7,8,9], colors: ['Red','Black','Beige'], heelHeights: [1,2,3,4] };
        productVariantsCache[productId] = def;
        renderOptions(productId, $card, product, def);
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER PRODUCT OPTIONS
    // ─────────────────────────────────────────────────────────────
    function renderOptions(productId, $card, product, v) {
        initSelection(productId);
        const sel = productSelections[productId];
        const $o  = $('<div>').addClass('options-section');

        // Size row
        appendOptionRow($o, 'Size:', v.sizes, sel.size,
            s => { sel.size = s; renderOptions(productId, $card, product, v); });

        // Color row
        const $cr = $('<div>').addClass('option-row').append('<span class="option-label">Color:</span>');
        const $cs = $('<div>').addClass('color-swatches');
        v.colors.forEach(c => {
            $('<button>').addClass('color-swatch').attr('title', c)
                .toggleClass('selected', sel.color === c)
                .css('background-color', colorCss(c))
                .click(() => { sel.color = c; renderOptions(productId, $card, product, v); })
                .appendTo($cs);
        });
        $cr.append($cs).appendTo($o);

        // Heel row
        appendOptionRow($o, 'Heel Height (inches):', v.heelHeights, sel.heelHeight,
            h => { sel.heelHeight = h; renderOptions(productId, $card, product, v); },
            val => val + '"');

        // Add to cart button
        const canAdd = sel.size && sel.color && sel.heelHeight;
        $('<button>').addClass('action-btn').prop('disabled', !canAdd).text('Add to Cart')
            .click(() => addToCart(productId, product, sel)).appendTo($o);

        $card.find('.options-section').remove();
        $card.find('.product-info').append($o);
    }

    function appendOptionRow($parent, label, values, selected, onSelect, format) {
        const $row = $('<div>').addClass('option-row').append(`<span class="option-label">${label}</span>`);
        const $g   = $('<div>').addClass('option-group');
        values.forEach(val => {
            $('<button>').addClass('option-btn')
                .toggleClass('selected', selected == val)
                .text(format ? format(val) : val)
                .click(() => onSelect(val))
                .appendTo($g);
        });
        $row.append($g).appendTo($parent);
    }

    function colorCss(c) {
        const m = { red:'#f44336', black:'#212121', beige:'#d4a574', white:'#ffffff',
                    blue:'#2196f3', brown:'#8d6e63', green:'#4caf50', pink:'#e91e63',
                    grey:'#9e9e9e', gray:'#9e9e9e', golden:'#DAA520', yellow:'#FFD700' };
        return m[c.toLowerCase()] || c;
    }

    function initSelection(productId) {
        if (!productSelections[productId])
            productSelections[productId] = { size: null, color: null, heelHeight: null };
    }

    // ─────────────────────────────────────────────────────────────
    // CART
    // ─────────────────────────────────────────────────────────────
    function addToCart(productId, product, sel) {
        if (!sel.size || !sel.color || !sel.heelHeight) { alert('Please select all options.'); return; }
        cart.push({ cartId: Date.now(), id: product.id, name: product.name, price: product.price,
                    image: product.image, size: sel.size, color: sel.color, heelHeight: sel.heelHeight, quantity: 1 });
        productSelections[productId] = { size: null, color: null, heelHeight: null };
        updateCart();
        renderProducts();
    }

    function updateCart() {
        const $items  = $('#cartItems').empty();
        const total   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
        const totItems = cart.reduce((s, i) => s + i.quantity, 0);
        totItems > 0 ? $('#cartBadge').text(totItems).css('display','flex') : $('#cartBadge').css('display','none');
        $('#cartTotal').text('Rs ' + total.toFixed(2));
        if (!cart.length) { $items.html('<div class="empty-cart">Your cart is empty</div>'); return; }

        cart.forEach(item => {
            const v = productVariantsCache[item.id] ?? { sizes:[item.size], colors:[item.color], heelHeights:[item.heelHeight] };
            const $ci = $('<div>').addClass('cart-item');
            $('<div>').addClass('cart-item-header')
                .append($('<img>').addClass('cart-item-image').attr('src', item.image || ''))
                .append($('<div>').addClass('cart-item-main')
                    .append(`<div class="cart-item-name">${item.name}</div>`)
                    .append(`<div class="cart-item-specs">Size: ${item.size} | Color: ${item.color} | Heel: ${item.heelHeight}"</div>`)
                    .append(`<div class="cart-item-price">Rs${item.price.toFixed(2)}</div>`))
                .appendTo($ci);

            // Mini option selectors inside cart
            const $opts = $('<div>').addClass('cart-options');
            appendCartOptionRow($opts, 'Change Size:', v.sizes, item.size, s => { item.size = s; updateCart(); });
            const $crow = $('<div>').addClass('cart-option-row').append('<span class="cart-option-label">Change Color:</span>');
            const $cswatches = $('<div>').addClass('cart-color-swatches');
            v.colors.forEach(c => {
                $('<button>').addClass('cart-color-swatch').attr('title',c)
                    .toggleClass('selected', item.color === c).css('background-color', colorCss(c))
                    .click(() => { item.color = c; updateCart(); }).appendTo($cswatches);
            });
            $crow.append($cswatches).appendTo($opts);
            appendCartOptionRow($opts, 'Change Heel:', v.heelHeights, item.heelHeight, h => { item.heelHeight = h; updateCart(); }, v => v + '"');

            // Qty + remove
            const $ctrl = $('<div>').addClass('cart-controls');
            const $qty  = $('<div>').addClass('quantity-controls')
                .append($('<button>').addClass('qty-btn').text('-').click(() => changeQty(item.cartId, -1)))
                .append($('<span>').addClass('qty-number').text(item.quantity))
                .append($('<button>').addClass('qty-btn').text('+').click(() => changeQty(item.cartId, 1)));
            $ctrl.append($qty, $('<button>').addClass('remove-btn').text('Remove').click(() => removeItem(item.cartId)));
            $ci.append($opts, $ctrl).appendTo($items);
        });
    }

    function appendCartOptionRow($parent, label, values, selected, onSelect, format) {
        const $row = $('<div>').addClass('cart-option-row').append(`<span class="cart-option-label">${label}</span>`);
        const $g   = $('<div>').addClass('option-group');
        values.forEach(val => {
            $('<button>').addClass('option-btn').toggleClass('selected', selected == val)
                .text(format ? format(val) : val).click(() => onSelect(val)).appendTo($g);
        });
        $row.append($g).appendTo($parent);
    }

    function changeQty(cartId, delta) {
        const item = cart.find(i => i.cartId === cartId);
        if (!item) return;
        item.quantity += delta;
        item.quantity <= 0 ? removeItem(cartId) : updateCart();
    }

    function removeItem(cartId) {
        cart = cart.filter(i => i.cartId !== cartId);
        updateCart();
    }

    // ─────────────────────────────────────────────────────────────
    // UI EVENTS
    // ─────────────────────────────────────────────────────────────
    $('#cartBtn').on('click',    () => $('#cartSidebar').addClass('open'));
    $('#closeCart').on('click',  () => $('#cartSidebar').removeClass('open'));
    $('#searchInput').on('input', function () { searchTerm = $(this).val(); currentPage = 1; renderProducts(); });

    // ─────────────────────────────────────────────────────────────
    // CHECKOUT ENTRY
    // ─────────────────────────────────────────────────────────────
    window.checkout = function () {
        if (!cart.length) { alert('Your cart is empty!'); return; }
        $('#cartSidebar').removeClass('open');
        showCheckoutModal();
    };

    window.closeCheckoutModal = function () {
        $('#checkoutModalOverlay').remove();
    };

    // ─────────────────────────────────────────────────────────────
    // CHECKOUT MODAL
    // ─────────────────────────────────────────────────────────────
    function showCheckoutModal() {
        const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

        $('body').append(`
        <div class="checkout-modal-overlay" id="checkoutModalOverlay">
          <div class="checkout-modal">
            <div id="checkoutForm">
              <div class="checkout-header">
                <h1>Complete Your Order</h1>
                <p>Fill in your details to proceed</p>
                <button class="modal-close-btn" id="closeCheckoutModal">✕</button>
              </div>

              <div class="order-summary">
                <h3>Order Summary</h3>
                <div id="orderSummaryItems"></div>
                <div class="order-total">
                  <span class="total-label">Total</span>
                  <span class="total-amount">Rs ${total.toFixed(2)}</span>
                </div>
              </div>

              <form id="orderForm">
                <div class="form-group">
                  <label>Full Name <span>*</span></label>
                  <input type="text" id="customerName" placeholder="Your full name" required>
                  <div class="error-message" id="nameError">Please enter your name</div>
                </div>
                <div class="form-group">
                  <label>Email <span>*</span></label>
                  <input type="email" id="customerEmail" placeholder="your@email.com" required>
                  <div class="error-message" id="emailError">Please enter a valid email</div>
                </div>
                <div class="form-group">
                  <label>Phone <span>*</span></label>
                  <input type="tel" id="customerPhone" placeholder="10-digit mobile number" maxlength="10" required>
                  <div class="error-message" id="phoneError">Please enter a valid 10-digit number</div>
                </div>
                <div class="form-group">
                  <label>Address <span>*</span></label>
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
                    <input type="text" id="customerPincode" placeholder="400001" maxlength="6" required>
                    <div class="error-message" id="pincodeError">Invalid pincode</div>
                  </div>
                </div>
                <div class="form-group">
                  <label>Payment Method <span>*</span></label>
                  <div class="payment-options">
                    <label><input type="radio" name="paymentMethod" value="razorpay" checked> Pay Online (Razorpay / UPI / Card)</label>
                    <label><input type="radio" name="paymentMethod" value="cod"> Cash on Delivery (COD)</label>
                  </div>
                </div>
                <button type="submit" class="btn-place-order" id="placeOrderBtn">Place Order</button>
              </form>
            </div>

            <div class="success-message" id="successMessage" style="display:none;">
              <div class="checkmark">
                <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </div>
              <h2>Order Placed Successfully!</h2>
              <p>Thank you for your purchase.</p>
              <div class="order-id">Order ID: <span id="orderIdDisplay"></span></div>
              <button class="btn-place-order" onclick="closeCheckoutModal()">Continue Shopping</button>
            </div>
          </div>
        </div>`);

        // Populate summary
        cart.forEach(item => {
            $('#orderSummaryItems').append(`
            <div class="order-item">
              <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-specs">Size: ${item.size} | Color: ${item.color} | Heel: ${item.heelHeight}" | Qty: ${item.quantity}</div>
              </div>
              <div class="item-price">Rs${(item.price * item.quantity).toFixed(2)}</div>
            </div>`);
        });

        $('#closeCheckoutModal').on('click', closeCheckoutModal);
        $('#checkoutModalOverlay').on('click', e => { if (e.target.id === 'checkoutModalOverlay') closeCheckoutModal(); });
        setupForm();
    }

    // ─────────────────────────────────────────────────────────────
    // FORM VALIDATION
    // ─────────────────────────────────────────────────────────────
    function setupForm() {
        $('#customerPhone').on('input', function () { $(this).val($(this).val().replace(/\D/g,'').substring(0,10)); });
        $('#customerPincode').on('input', function () { $(this).val($(this).val().replace(/\D/g,'').substring(0,6)); });

        const validEmail   = e  => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
        const validPhone   = p  => p.length === 10;
        const validPincode = pc => pc.length === 6;

        $('#customerName').on('blur',    function () { $(this).val().trim() ? $('#nameError').hide()    : $('#nameError').show(); });
        $('#customerEmail').on('blur',   function () { validEmail($(this).val())   ? $('#emailError').hide()   : $('#emailError').show(); });
        $('#customerPhone').on('blur',   function () { validPhone($(this).val())   ? $('#phoneError').hide()   : $('#phoneError').show(); });
        $('#customerAddress').on('blur', function () { $(this).val().trim() ? $('#addressError').hide()  : $('#addressError').show(); });
        $('#customerCity').on('blur',    function () { $(this).val().trim() ? $('#cityError').hide()     : $('#cityError').show(); });
        $('#customerPincode').on('blur', function () { validPincode($(this).val()) ? $('#pincodeError').hide() : $('#pincodeError').show(); });

        $('#orderForm').on('submit', function (e) {
            e.preventDefault();
            $('.error-message').hide();

            const name    = $('#customerName').val().trim();
            const email   = $('#customerEmail').val().trim();
            const phone   = $('#customerPhone').val().trim();
            const address = $('#customerAddress').val().trim();
            const city    = $('#customerCity').val().trim();
            const pincode = $('#customerPincode').val().trim();
            let ok        = true;

            if (!name)               { $('#nameError').show();    ok = false; }
            if (!validEmail(email))  { $('#emailError').show();   ok = false; }
            if (!validPhone(phone))  { $('#phoneError').show();   ok = false; }
            if (!address)            { $('#addressError').show();  ok = false; }
            if (!city)               { $('#cityError').show();     ok = false; }
            if (!validPincode(pincode)){ $('#pincodeError').show();ok = false; }
            if (!ok) return;

            const paymentMethod = $('input[name="paymentMethod"]:checked').val();
            const total         = cart.reduce((s, i) => s + i.price * i.quantity, 0);
            const orderNumber   = 'ORD-' + Date.now();

            $('#placeOrderBtn').prop('disabled', true).text('Processing...');

            const orderData = {
                orderNumber, name, email, phone, address, city, pincode,
                Items: cart.map(i => ({
                    id:         i.id,
                    name:       i.name,
                    price:      i.price,
                    color:      i.color,
                    size:       String(i.size),
                    heelHeight: Number(i.heelHeight),
                    quantity:   i.quantity,
                    image:      i.image
                })),
                total,
                paymentMode: paymentMethod
            };

            if (paymentMethod === 'cod') {
                placeCODOrder(orderData);
            } else {
                placeOrderThenRazorpay(orderData);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // COD FLOW
    // ─────────────────────────────────────────────────────────────
    function placeCODOrder(orderData) {
        $.ajax({
            url: '/home/PlaceOrder', type: 'POST', contentType: 'application/json',
            data: JSON.stringify(orderData),
            success: function (resp) {
                showSuccess(resp.orderNumber ?? orderData.orderNumber);
            },
            error: function () {
                alert('Error placing order. Please try again.');
                $('#placeOrderBtn').prop('disabled', false).text('Place Order');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // RAZORPAY FLOW
    // Step 1 → Save order in DB  →  Step 2 → Create Razorpay order
    // Step 3 → Open popup        →  Step 4 → Verify signature
    // ─────────────────────────────────────────────────────────────
    function placeOrderThenRazorpay(orderData) {
        // New flow: Create Razorpay order first, complete payment, then save order to API only if payment verified
        $.ajax({
            url: '/home/CreateRazorpayOrder', type: 'POST', contentType: 'application/json',
            data: JSON.stringify({ orderNumber: orderData.orderNumber, amount: orderData.total }),
            success: function (rzpResp) {
                if (!rzpResp || !rzpResp.razorpayOrderId) {
                    alert('Unable to initiate payment. Please try again.');
                    $('#placeOrderBtn').prop('disabled', false).text('Place Order');
                    return;
                }

                const rzp = new Razorpay({
                    key:         rzpResp.keyId || rzpResp.key || rzpResp.key_id,
                    amount:      (rzpResp.amount || orderData.total) * 100,
                    currency:    'INR',
                    name:        'Your Store Name',
                    description: 'Order Payment',
                    order_id:    rzpResp.razorpayOrderId,
                    prefill:     { name: orderData.name, email: orderData.email, contact: orderData.phone },
                    theme:       { color: '#d81b60' },
                    handler: function (rzpResponse) {
                        // Verify signature with backend
                        $.ajax({
                            url: '/home/VerifyRazorpayPayment', type: 'POST', contentType: 'application/json',
                            data: JSON.stringify({
                                razorpayOrderId:   rzpResponse.razorpay_order_id,
                                razorpayPaymentId: rzpResponse.razorpay_payment_id,
                                razorpaySignature: rzpResponse.razorpay_signature
                            }),
                            success: function (verifyResp) {
                                if (verifyResp && verifyResp.success) {
                                    // Payment verified — now save order to API including payment details
                                    const orderWithPayment = Object.assign({}, orderData, {
                                        paymentMode: 'razorpay',
                                        PaymentInfo: {
                                            razorpayOrderId: rzpResponse.razorpay_order_id,
                                            razorpayPaymentId: rzpResponse.razorpay_payment_id,
                                            razorpaySignature: rzpResponse.razorpay_signature
                                        }
                                    });

                                    $.ajax({
                                        url: '/home/PlaceOrder', type: 'POST', contentType: 'application/json',
                                        data: JSON.stringify(orderWithPayment),
                                        success: function (saveResp) {
                                            showSuccess(saveResp.orderNumber ?? orderData.orderNumber);
                                        },
                                        error: function () {
                                            alert('Error saving order after payment. Contact support.');
                                            $('#placeOrderBtn').prop('disabled', false).text('Place Order');
                                        }
                                    });
                                } else {
                                    alert('Payment verification failed. Please contact support.');
                                    $('#placeOrderBtn').prop('disabled', false).text('Place Order');
                                }
                            },
                            error: function () {
                                alert('Error verifying payment. Contact support.');
                                $('#placeOrderBtn').prop('disabled', false).text('Place Order');
                            }
                        });
                    },
                    modal: {
                        ondismiss: function () {
                            $('#placeOrderBtn').prop('disabled', false).text('Place Order');
                        }
                    }
                });

                rzp.on('payment.failed', function (fail) {
                    // Log failure to DB via API
                    $.ajax({
                        url: '/home/RazorpayPaymentFailed', type: 'POST', contentType: 'application/json',
                        data: JSON.stringify({
                            razorpayOrderId:   fail.error.metadata?.order_id,
                            razorpayPaymentId: fail.error.metadata?.payment_id,
                            failureReason:     fail.error.description,
                            failureCode:       fail.error.code
                        })
                    });
                    alert('Payment failed: ' + (fail.error && fail.error.description ? fail.error.description : 'Unknown error'));
                    $('#placeOrderBtn').prop('disabled', false).text('Place Order');
                });

                rzp.open();
            },
            error: function () {
                alert('Error initiating payment. Please try again.');
                $('#placeOrderBtn').prop('disabled', false).text('Place Order');
            }
        });
    }

    // Step 4: Verify HMAC signature on backend
    function verifyPayment(rzpResponse, orderNumber) {
        $.ajax({
            url: '/home/VerifyRazorpayPayment', type: 'POST', contentType: 'application/json',
            data: JSON.stringify({
                razorpayOrderId:   rzpResponse.razorpay_order_id,
                razorpayPaymentId: rzpResponse.razorpay_payment_id,
                razorpaySignature: rzpResponse.razorpay_signature
            }),
            success: function (resp) {
                if (resp && resp.success) {
                    showSuccess(orderNumber);
                } else {
                    alert('Payment verification failed. Please contact support with Order ID: ' + orderNumber);
                    $('#placeOrderBtn').prop('disabled', false).text('Place Order');
                }
            },
            error: function () {
                alert('Error verifying payment. Contact support with Order ID: ' + orderNumber);
                $('#placeOrderBtn').prop('disabled', false).text('Place Order');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // SUCCESS SCREEN
    // ─────────────────────────────────────────────────────────────
    function showSuccess(orderNumber) {
        cart = [];
        updateCart();
        $('#checkoutForm').fadeOut(300, function () {
            $('#orderIdDisplay').text(orderNumber);
            $('#successMessage').fadeIn(300);
        });
    }

    // ─────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────
    loadCategories();
});