namespace Ecommerce.Models
{
    public class CreateOrderRequest
    {
        public int OrderId { get; set; }
        public string OrderNumber { get; set; }
        public decimal Amount { get; set; }
    }
}
