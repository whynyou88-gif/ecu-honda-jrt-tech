using System;
using Xunit;
using JRT.Tect.Core.Dyno;

namespace JRT.Tect.Tests;

public class DynoPhysicsEngineTests
{
    [Fact]
    public void KalmanFilter_ScalarPredictUpdate_ReturnsFilteredValues()
    {
        var filter = new KalmanFilter();
        filter.Init(0.2, 1.0, 1.0, 1.0, 0.25);
        filter.Reset(10.0);

        double v1 = filter.GetFiltered(12.0);
        double v2 = filter.GetFiltered(14.0);

        Assert.True(v1 > 10.0 && v1 < 14.0);
        Assert.True(v2 > v1);
    }

    [Fact]
    public void DynoRunResult_ConstantAcceleration_CalculatesForceAndPower()
    {
        var result = new DynoRunResult();
        result.SetParameters(20.0f, 1000, 8, 1.0, 4.0);

        // Sequence of increasing speed points (constant acceleration)
        for (int i = 0; i <= 20; i++)
        {
            double time = i * 0.25; // 4Hz
            double speed = i * 3.0; // 0, 3, 6, 9... km/h
            result.AddData(time, speed);
        }

        Assert.True(result.ItemsCount > 10);
        var lastItem = result.Item(result.ItemsCount - 1);
        Assert.NotNull(lastItem);
        Assert.True(lastItem!.Force > 0);
        Assert.True(lastItem.PowerKwFiltered >= 0);
    }

    [Fact]
    public void DynoRun_EndToEndSimulation_CalculatesPeakMetrics()
    {
        var run = new DynoRun { Name = "Test Run" };
        run.Result.SetParameters(20.0f, 1000, 8, 1.0, 4.0);
        run.StartRun(); // Transition state to WaitForSpeed

        // 1. Acceleration phase (0 to 12s)
        for (int i = 0; i <= 50; i++)
        {
            double time = i * 0.25;
            double speed = 110.0 * (1.0 - Math.Exp(-0.12 * i));
            run.OnNewData(time, speed);
        }

        // 2. Coast-down losses phase (12s to 32s)
        for (int i = 51; i <= 100; i++)
        {
            double time = i * 0.25;
            double speed = 100.0 * Math.Exp(-0.04 * (i - 50));
            run.OnNewData(time, speed);
        }

        Assert.True(run.Result.Items.Count > 0);
        Assert.True(run.SpeedMax > 0);
        Assert.True(run.RpmMax > 0);
    }

    [Fact]
    public void DynoRun_JsonSerialization_SavesAndLoadsData()
    {
        string tempFile = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "test_dyno_run.dynorun");
        try
        {
            var run = new DynoRun { Name = "Serialization Run" };
            run.Result.SetParameters(20.0f, 1000, 8, 1.0, 4.0);
            run.Result.AddData(0.0, 0.0);
            run.Result.AddData(0.25, 10.0);
            run.Result.AddData(0.50, 25.0);

            bool saved = run.SaveToJsonFile(tempFile);
            Assert.True(saved);

            var loadedRun = new DynoRun();
            bool loaded = loadedRun.LoadFromJsonFile(tempFile);
            Assert.True(loaded);
            Assert.Equal("Serialization Run", loadedRun.Name);
            Assert.Equal(3, loadedRun.Result.Items.Count);
        }
        finally
        {
            if (System.IO.File.Exists(tempFile))
            {
                System.IO.File.Delete(tempFile);
            }
        }
    }
}
