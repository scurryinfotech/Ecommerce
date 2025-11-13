using System.Text.Json.Serialization;

namespace EcommerceAPI.Models
{
    public class OrderRequest
    {
        public string OrderId { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string Pincode { get; set; }

        [JsonPropertyName("OrderItems")] 
        public List<OrderItem> Items { get; set; }

        public decimal Total { get; set; }

        public string PaymentMode { get; set; }
        public string Date { get; set; }
    }

    public class OrderItem
    {
        public int Id { get; set; }            // product_id
        public string Name { get; set; }
        public string Color { get; set; }
        public string Size { get; set; }
        public decimal HeelHeight { get; set; }
        public int Quantity { get; set; }
        public decimal Price { get; set; }
    }
}
