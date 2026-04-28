using Microsoft.AspNetCore.Mvc;
using Ecommerce.Services;
using Ecommerce.Models;

namespace Ecommerce.ViewComponents
{
    public class SiteHeaderViewComponent : ViewComponent
    {
        private readonly ContentService _content;

        public SiteHeaderViewComponent(ContentService content)
        {
            _content = content;
        }

        public async Task<IViewComponentResult> InvokeAsync()
        {
            // keys used in DB: HeaderHtml and HeroHtml
            var header = await _content.GetValueAsync("HeaderHtml") ?? string.Empty;
            var hero = await _content.GetValueAsync("HeroHtml") ?? string.Empty;

            return View(new SiteHeaderModel { HeaderHtml = header, HeroHtml = hero });
        }
    }
}
