using Microsoft.Data.Sqlite;

namespace JRT.Tect.Data;

public class EcuDbContext
{
    private readonly string _connectionString;

    public EcuDbContext(string dbPath = "ecu_models.db")
    {
        _connectionString = $"Data Source={dbPath};";
        InitializeDatabase();
    }

    private void InitializeDatabase()
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        string createEcuModelsTable = @"
            CREATE TABLE IF NOT EXISTS EcuModels (
                PartNumber TEXT PRIMARY KEY,
                ModelName TEXT NOT NULL,
                Year INTEGER,
                DisplacementCC INTEGER,
                MapLayoutVersion TEXT
            );";

        string createEcuRecordsTable = @"
            CREATE TABLE IF NOT EXISTS EcuRecords (
                PartNumber TEXT PRIMARY KEY,
                ModelName TEXT NOT NULL,
                CustomerName TEXT,
                LicensePlate TEXT,
                HardwareBrand TEXT,
                FuelGrade TEXT,
                RemapNotes TEXT,
                CreatedAt TEXT
            );";

        using var command1 = new SqliteCommand(createEcuModelsTable, connection);
        command1.ExecuteNonQuery();

        using var command2 = new SqliteCommand(createEcuRecordsTable, connection);
        command2.ExecuteNonQuery();

        SeedDefaultData(connection);
    }

    private void SeedDefaultData(SqliteConnection connection)
    {
        string countQuery = "SELECT COUNT(*) FROM EcuModels;";
        using var countCmd = new SqliteCommand(countQuery, connection);
        long count = (long)(countCmd.ExecuteScalar() ?? 0);

        if (count == 0)
        {
            string insertSql = @"
                INSERT INTO EcuModels (PartNumber, ModelName, Year, DisplacementCC, MapLayoutVersion) VALUES
                ('38770-K60A-B01', 'Honda Vario 125 Old (K60A)', 2014, 125, '32x32_V1'),
                ('38770-K59-A11', 'Honda Vario 125 eSP (K59/K60)', 2018, 125, '32x32_V2'),
                ('38770-K25-901', 'Honda Beat FI (K25)', 2013, 110, '16x16_V1'),
                ('38770-K0W-N01', 'Honda ADV 150 (K0W)', 2020, 150, '32x32_V2'),
                ('38770-K97-N01', 'Honda PCX 150 (K97)', 2019, 150, '32x32_V2'),
                ('2DP-E5400-00', 'Yamaha NMAX 155 (2DP)', 2017, 155, '16x16_Y1');";

            using var insertCmd = new SqliteCommand(insertSql, connection);
            insertCmd.ExecuteNonQuery();
        }
    }

    public SqliteConnection CreateConnection()
    {
        return new SqliteConnection(_connectionString);
    }
}
