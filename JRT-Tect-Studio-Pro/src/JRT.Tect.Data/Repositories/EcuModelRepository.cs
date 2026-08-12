using Microsoft.Data.Sqlite;
using JRT.Tect.Core.Models;

namespace JRT.Tect.Data.Repositories;

public interface IEcuModelRepository
{
    Task<List<EcuRecord>> SearchRecordsAsync(string filterText, CancellationToken ct = default);
    Task<EcuRecord?> GetByPartNumberAsync(string partNumber, CancellationToken ct = default);
    Task<bool> SaveRecordAsync(EcuRecord record, CancellationToken ct = default);
    Task<List<string>> GetAvailableModelsAsync(CancellationToken ct = default);
}

public class EcuModelRepository : IEcuModelRepository
{
    private readonly EcuDbContext _dbContext;

    public EcuModelRepository(EcuDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<EcuRecord>> SearchRecordsAsync(string filterText, CancellationToken ct = default)
    {
        var records = new List<EcuRecord>();
        await using var connection = _dbContext.CreateConnection();
        await connection.OpenAsync(ct);

        string sql = @"
            SELECT PartNumber, ModelName, CustomerName, LicensePlate, HardwareBrand, FuelGrade, RemapNotes, CreatedAt
            FROM EcuRecords";

        if (!string.IsNullOrWhiteSpace(filterText))
        {
            sql += " WHERE PartNumber LIKE @filter OR ModelName LIKE @filter OR CustomerName LIKE @filter OR LicensePlate LIKE @filter";
        }
        sql += " ORDER BY CreatedAt DESC LIMIT 50;";

        await using var command = new SqliteCommand(sql, connection);
        if (!string.IsNullOrWhiteSpace(filterText))
        {
            command.Parameters.AddWithValue("@filter", $"%{filterText}%");
        }

        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            records.Add(new EcuRecord
            {
                PartNumber = reader.GetString(0),
                ModelName = reader.GetString(1),
                CustomerName = reader.IsDBNull(2) ? "" : reader.GetString(2),
                LicensePlate = reader.IsDBNull(3) ? "" : reader.GetString(3),
                HardwareBrand = reader.IsDBNull(4) ? "" : reader.GetString(4),
                FuelGrade = reader.IsDBNull(5) ? "" : reader.GetString(5),
                RemapNotes = reader.IsDBNull(6) ? "" : reader.GetString(6),
                CreatedAt = reader.IsDBNull(7) ? DateTime.Now : DateTime.Parse(reader.GetString(7))
            });
        }

        return records;
    }

    public async Task<EcuRecord?> GetByPartNumberAsync(string partNumber, CancellationToken ct = default)
    {
        await using var connection = _dbContext.CreateConnection();
        await connection.OpenAsync(ct);

        string sql = "SELECT PartNumber, ModelName, CustomerName, LicensePlate, HardwareBrand, FuelGrade, RemapNotes, CreatedAt FROM EcuRecords WHERE PartNumber = @partNo LIMIT 1;";
        await using var command = new SqliteCommand(sql, connection);
        command.Parameters.AddWithValue("@partNo", partNumber);

        await using var reader = await command.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            return new EcuRecord
            {
                PartNumber = reader.GetString(0),
                ModelName = reader.GetString(1),
                CustomerName = reader.IsDBNull(2) ? "" : reader.GetString(2),
                LicensePlate = reader.IsDBNull(3) ? "" : reader.GetString(3),
                HardwareBrand = reader.IsDBNull(4) ? "" : reader.GetString(4),
                FuelGrade = reader.IsDBNull(5) ? "" : reader.GetString(5),
                RemapNotes = reader.IsDBNull(6) ? "" : reader.GetString(6),
                CreatedAt = reader.IsDBNull(7) ? DateTime.Now : DateTime.Parse(reader.GetString(7))
            };
        }

        return null;
    }

    public async Task<bool> SaveRecordAsync(EcuRecord record, CancellationToken ct = default)
    {
        await using var connection = _dbContext.CreateConnection();
        await connection.OpenAsync(ct);

        string sql = @"
            INSERT INTO EcuRecords (PartNumber, ModelName, CustomerName, LicensePlate, HardwareBrand, FuelGrade, RemapNotes, CreatedAt)
            VALUES (@PartNumber, @ModelName, @CustomerName, @LicensePlate, @HardwareBrand, @FuelGrade, @RemapNotes, @CreatedAt)
            ON CONFLICT(PartNumber) DO UPDATE SET
                ModelName=excluded.ModelName,
                CustomerName=excluded.CustomerName,
                LicensePlate=excluded.LicensePlate,
                HardwareBrand=excluded.HardwareBrand,
                FuelGrade=excluded.FuelGrade,
                RemapNotes=excluded.RemapNotes,
                CreatedAt=excluded.CreatedAt;";

        await using var command = new SqliteCommand(sql, connection);
        command.Parameters.AddWithValue("@PartNumber", record.PartNumber);
        command.Parameters.AddWithValue("@ModelName", record.ModelName);
        command.Parameters.AddWithValue("@CustomerName", record.CustomerName ?? "");
        command.Parameters.AddWithValue("@LicensePlate", record.LicensePlate ?? "");
        command.Parameters.AddWithValue("@HardwareBrand", record.HardwareBrand ?? "");
        command.Parameters.AddWithValue("@FuelGrade", record.FuelGrade ?? "");
        command.Parameters.AddWithValue("@RemapNotes", record.RemapNotes ?? "");
        command.Parameters.AddWithValue("@CreatedAt", record.CreatedAt.ToString("o"));

        int rows = await command.ExecuteNonQueryAsync(ct);
        return rows > 0;
    }

    public async Task<List<string>> GetAvailableModelsAsync(CancellationToken ct = default)
    {
        var models = new List<string>();
        await using var connection = _dbContext.CreateConnection();
        await connection.OpenAsync(ct);

        string sql = "SELECT PartNumber || ' - ' || ModelName FROM EcuModels ORDER BY ModelName;";
        await using var command = new SqliteCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            models.Add(reader.GetString(0));
        }

        return models;
    }
}
