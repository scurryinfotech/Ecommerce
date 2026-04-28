using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace Ecommerce.Services
{
    /// <summary>
    /// Small key/value content provider backed by a SiteContents table.
    /// Returns null on errors so views can fall back to defaults.
    /// </summary>
    public class ContentService
    {
        private readonly string? _conn;

        public ContentService(IConfiguration config)
        {
            _conn = config.GetConnectionString("DefaultConnection");
        }

        public async Task<string?> GetValueAsync(string key)
        {
            if (string.IsNullOrWhiteSpace(_conn) || string.IsNullOrWhiteSpace(key))
                return null;

            try
            {
                await using var conn = new SqlConnection(_conn);
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandType = CommandType.Text;
                cmd.CommandText = "SELECT [Value] FROM SiteContents WITH (NOLOCK) WHERE [Key] = @key";
                cmd.Parameters.AddWithValue("@key", key);
                var result = await cmd.ExecuteScalarAsync();
                return result == null || result == DBNull.Value ? null : result.ToString();
            }
            catch
            {
                return null;
            }
        }

        public async Task<Dictionary<string, string>> GetValuesAsync(IEnumerable<string> keys)
        {
            var dict = new Dictionary<string, string>();
            if (string.IsNullOrWhiteSpace(_conn))
                return dict;

            try
            {
                var keysList = keys.ToList();
                if (!keysList.Any()) return dict;
                var paramNames = string.Join(',', keysList.Select((k, i) => "@k" + i));
                await using var conn = new SqlConnection(_conn);
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandType = CommandType.Text;
                cmd.CommandText = $"SELECT [Key], [Value] FROM SiteContents WITH (NOLOCK) WHERE [Key] IN ({paramNames})";
                for (var i = 0; i < keysList.Count; i++)
                    cmd.Parameters.AddWithValue("@k" + i, keysList[i]);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var k = reader.GetString(0);
                    var v = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
                    dict[k] = v;
                }
            }
            catch
            {
                // ignore and return what we have
            }

            return dict;
        }
    }
}
