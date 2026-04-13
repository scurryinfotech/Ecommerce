using Ecommerce.Models;
using EcommerceAPI.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using System.Text;
using System.Text.Json;

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
        [HttpPost]
        public async Task<IActionResult> PlaceOrder([FromBody] OrderRequest order)
        {
            if (order == null || order.Items == null || !order.Items.Any())
                return BadRequest(new { message = "Invalid order data." });

            return await ProxyPost($"{ApiBase}/api/Categories/placeOrder", order);
        }

        // ─────────────────────────────────────────────────────────────
        // RAZORPAY
        // ─────────────────────────────────────────────────────────────


        // Step 1: Creates Razorpay order + logs payment attempt in DB
        [HttpPost]
        public async Task<IActionResult> CreateRazorpayOrder([FromBody] JsonElement body)
            => await ProxyPostRaw($"{ApiBase}/api/Razorpay/CreateOrder", body.GetRawText());

        // Step 2: Verifies HMAC signature + marks payment as Success/Failed in DB
        [HttpPost]
        public async Task<IActionResult> VerifyRazorpayPayment([FromBody] JsonElement body)
            => await ProxyPostRaw($"{ApiBase}/api/Razorpay/VerifyPayment", body.GetRawText());

        // Step 3: Logs payment failure from JS (Razorpay popup payment.failed event)
        [HttpPost]
        public async Task<IActionResult> RazorpayPaymentFailed([FromBody] JsonElement body)
            => await ProxyPostRaw($"{ApiBase}/api/Razorpay/PaymentFailed", body.GetRawText());

        // ─────────────────────────────────────────────────────────────
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
}