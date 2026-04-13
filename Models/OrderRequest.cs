// ================================================================
// OrderRequest.cs  — update your existing model with these fields
// Location: EcommerceAPI/Models/OrderRequest.cs  (or wherever it is)
// ================================================================

namespace EcommerceAPI.Models
{
    public class OrderRequest
    {
        // ── Fields sent from JS ──────────────────────────────────
        public string OrderNumber { get; set; }   // e.g. ORD-1714xxx (generated in JS)
        public string Name { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string Pincode { get; set; }
        public decimal Total { get; set; }
        public string PaymentMode { get; set; }   // "razorpay" | "cod"
        public string Date { get; set; }
        public List<OrderItem> Items { get; set; }

        // ── Set by PlaceOrder service after DB insert ────────────
        // NOT sent from JS — used internally to pass orderId back to controller
        public int DbOrderId { get; set; }
    }

    public class OrderItem
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public decimal Price { get; set; }
        public string Color { get; set; }
        public string Size { get; set; }
        public decimal HeelHeight { get; set; }
        public int Quantity { get; set; }
        public string Image { get; set; }
    }
}