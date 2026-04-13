using Ecommerce.Models;
using EcommerceAPI.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Security.Cryptography;


namespace Ecommerce.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private const string ApiBase = "https://localhost:7043"; 

        public HomeController(ILogger<HomeController> logger, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        // ─────────────────────────────────────────────────────────────
        // PAGES
        // ─────────────────────────────────────────────────────────────
        public IActionResult Index() => View();
        public IActionResult Privacy() => View();

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error() =>
            View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });

        // ─────────────────────────────────────────────────────────────
        // PRODUCTS (proxy to API — unchanged)
        // ─────────────────────────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetCategories()
            => await ProxyGet($"{ApiBase}/api/Categories/categories");

        [HttpGet]
        public async Task<IActionResult> GetProducts()
            => await ProxyGet($"{ApiBase}/api/Categories/products");

        [HttpGet]
        public async Task<IActionResult> GetProductsId(int id)
            => await ProxyGet($"{ApiBase}/api/Categories/productVariants?id={id}");

        // ─────────────────────────────────────────────────────────────
        // ORDERS
        // ─────────────────────────────────────────────────────────────

        // COD + first step of Razorpay — saves order, returns orderId + orderNumber
        // Existing COD order placement
        [HttpPost]
        public async Task<IActionResult> PlaceOrder([FromBody] OrderRequest order)
        {
            if (order == null || order.Items == null || !order.Items.Any())
                return BadRequest(new { message = "Invalid order data." });

            return await ProxyPost($"{ApiBase}/api/Categories/placeOrder", order);
        }

        // Razorpay Step 1 — Create Razorpay order (no DB save)
        [HttpPost]
        public async Task<IActionResult> CreateRazorpayOrder([FromBody] JsonElement body)
            => await ProxyPostRaw($"{ApiBase}/api/Razorpay/CreateOrder", body.GetRawText());

        // Razorpay Step 2 — Verify payment + save order to DB (only on success)
        [HttpPost]
        public async Task<IActionResult> VerifyAndPlaceOrder([FromBody] JsonElement body)
            => await ProxyPostRaw($"{ApiBase}/api/Razorpay/VerifyAndPlaceOrder", body.GetRawText());

        // Razorpay failure log
        [HttpPost]
        public async Task<IActionResult> RazorpayPaymentFailed([FromBody] JsonElement body)
            => await ProxyPostRaw($"{ApiBase}/api/Razorpay/PaymentFailed", body.GetRawText());
        //─────────────────────────────────────────────────────────────
        // SHARED PROXY HELPERS — keeps all action methods clean & short
        // ─────────────────────────────────────────────────────────────
        private async Task<IActionResult> ProxyGet(string url)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var response = await client.GetAsync(url);
                response.EnsureSuccessStatusCode();
                return Content(await response.Content.ReadAsStringAsync(), "application/json");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GET {Url} failed", url);
                return StatusCode(500, new { message = "API call failed." });
            }
        }

        private async Task<IActionResult> ProxyPost<T>(string url, T body)
            => await ProxyPostRaw(url, JsonSerializer.Serialize(body));

        private async Task<IActionResult> ProxyPostRaw(string url, string json)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await client.PostAsync(url, content);
                var respBody = await response.Content.ReadAsStringAsync();

                return response.IsSuccessStatusCode
                    ? Content(respBody, "application/json")
                    : StatusCode((int)response.StatusCode, respBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "POST {Url} failed", url);
                return StatusCode(500, new { message = "API call failed." });
            }
        }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class RazorpayController : ControllerBase
    {
        private readonly IConfiguration _config;
        public RazorpayController(IConfiguration config) => _config = config;

        // POST api/Razorpay/CreateOrder
        [HttpPost("CreateOrder")]
        public IActionResult CreateOrder([FromBody] JsonElement body)
        {
            // Validate input
            if (!body.TryGetProperty("orderNumber", out var on) || !body.TryGetProperty("amount", out var am))
                return BadRequest(new { message = "orderNumber and amount required" });

            // TODO: call Razorpay REST API to create an order with your key/secret and return the response.
            // For quick testing you can return a stubbed response:
            return Ok(new
            {
                razorpayOrderId = "order_test_" + DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                keyId = _config["Razorpay:KeyId"] ?? "rzp_test_key",
                amount = am.GetDecimal() // amount in rupees
            });
        }

        // POST api/Razorpay/VerifyPayment
        [HttpPost("VerifyPayment")]
        public IActionResult VerifyPayment([FromBody] JsonElement body)
        {
            if (!body.TryGetProperty("razorpayOrderId", out var oid) ||
                !body.TryGetProperty("razorpayPaymentId", out var pid) ||
                !body.TryGetProperty("razorpaySignature", out var sig))
                return BadRequest(new { success = false, message = "missing fields" });

            var secret = _config["Razorpay:Secret"] ?? "";
            var payload = $"{oid.GetString()}|{pid.GetString()}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var computed = BitConverter.ToString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).Replace("-", "").ToLower();
            var incoming = sig.GetString()?.Replace(" ", "").ToLower();

            if (computed == incoming)
            {
                // Mark payment success in DB as needed
                return Ok(new { success = true });
            }
            else
            {
                return Ok(new { success = false, message = "signature mismatch" });
            }
        }

        // POST api/Razorpay/PaymentFailed
        [HttpPost("PaymentFailed")]
        public IActionResult PaymentFailed([FromBody] JsonElement body)
        {
            // Log failure details
            // ... save to DB if needed
            return Ok(new { success = true });
        }
    }
}