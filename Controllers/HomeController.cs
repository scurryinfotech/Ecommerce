using Ecommerce.Models;
using EcommerceAPI.Models;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Ecommerce.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly IHttpClientFactory _httpClientFactory;

        public HomeController(ILogger<HomeController> logger, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        [HttpGet]
        public async Task<IActionResult> GetCategories()
        {
            var client = _httpClientFactory.CreateClient();
            var apiUrl = "https://localhost:7043/api/Categories/categories";
            
            try
            {
                var response = await client.GetAsync(apiUrl);
                response.EnsureSuccessStatusCode();
                var rawJson = await response.Content.ReadAsStringAsync();
                // Return the raw JSON from the API
                return Content(rawJson, "application/json");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling GetCategories API");
                return StatusCode(500, "Error calling GetCategories API");
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetProducts()
        {
            var client = _httpClientFactory.CreateClient();
            var apiUrl = "https://localhost:7043/api/Categories/products"; // Change to your actual products API

            try
            {
                var response = await client.GetAsync(apiUrl);
                response.EnsureSuccessStatusCode();
                var rawJson = await response.Content.ReadAsStringAsync();
                return Content(rawJson, "application/json");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling GetProducts API");
                return StatusCode(500, "Error calling GetProducts API");
            }
        }
        [HttpGet]
        public async Task<IActionResult> GetProductsId(int id)
        {
            var client = _httpClientFactory.CreateClient();
            var apiUrl = $"https://localhost:7043/api/Categories/productVariants?id={id}";

            try
            {
                var response = await client.GetAsync(apiUrl);
                response.EnsureSuccessStatusCode();
                var rawJson = await response.Content.ReadAsStringAsync();
                return Content(rawJson, "application/json");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling GetProductsVariants API");
                return StatusCode(500, "Error calling GetProductsVariants API");
            }
        }
        [HttpPost]
        public async Task<IActionResult> PlaceOrder([FromBody] OrderRequest order)
        {
            try
            {
                if (order == null || order.Items == null || !order.Items.Any())
                    return BadRequest(new { message = "Invalid order data." });

                var client = _httpClientFactory.CreateClient();
                var apiUrl = "https://localhost:7043/api/Categories/placeOrder";

                var jsonContent = new StringContent(
                    JsonSerializer.Serialize(order),
                    Encoding.UTF8,
                    "application/json"
                );

                var response = await client.PostAsync(apiUrl, jsonContent);

                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    return Content(responseBody, "application/json");
                }
                else
                {
                    return StatusCode((int)response.StatusCode, new { message = "API call failed" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while forwarding order to API");
                return StatusCode(500, new { message = "Internal error" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> InitiatePhonePePayment([FromBody] OrderRequest order)
        {
            try
            {
                if (order == null || order.Items == null || !order.Items.Any())
                    return BadRequest(new { message = "Invalid order data." });

             
                var apiUrl = "https://localhost:7043/api/Payment/InitiatePhonePePayments";

                var client = _httpClientFactory.CreateClient();
                var jsonContent = new StringContent(
                    JsonSerializer.Serialize(order),
                    Encoding.UTF8,
                    "application/json"
                );
              var response = await client.PostAsync(apiUrl, jsonContent);
                var body = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    return Content(body, "application/json");
                }
                else
                {
                    return StatusCode((int)response.StatusCode, new { message = "Payment initiation failed." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while initiating PhonePe payment");
                return StatusCode(500, new { message = "Internal error" });
            }
        }



    }
}
