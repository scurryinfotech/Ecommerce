namespace Ecommerce.Models
{
    public class PaymentFailedRequest
    {
        public string RazorpayOrderId { get; set; }
        public string RazorpayPaymentId { get; set; }
        public string FailureReason { get; set; }
        public string FailureCode { get; set; }
    }
}
