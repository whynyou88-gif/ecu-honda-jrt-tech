namespace JRT.Tect.Core.Dyno;

public enum DynoRunState
{
    Initial = 0,
    WaitForSpeed = 1,
    Countdown = 2,
    Accelerating = 3,
    Losses = 4,
    Finished = 5,
    Canceled = 6
}
