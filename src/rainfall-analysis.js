/*
 * Rainfall Analysis
 * Weather Alert Bot - Multi Location
 *
 * Responsibilities:
 * 1. Identify hourly forecasts with precipitation above 0 mm.
 * 2. Group consecutive rainy hours into rainfall periods.
 * 3. Calculate accumulated precipitation for each period.
 * 4. Format period times using Thailand timezone.
 *
 * Important:
 * - This node analyzes rainfall amount, not rain risk level.
 * - All forecast hours with precipitation > 0 are included.
 * - WATCH and HIGH alert periods are handled separately
 *   by the Time Grouping node.
 *
 * Timezone: Asia/Bangkok (UTC+7)
 */

// ==========================================
// 1. Get Input Data
// ==========================================

const items = $input.all();

if (items.length === 0) {
  throw new Error("No weather data received");
}

// ==========================================
// 2. Format Time in Thailand Timezone
// ==========================================

function formatTime(timestamp) {

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(timestamp));

}

// ==========================================
// 3. Process Each Location
// ==========================================

return items.map(item => {

  const data = item.json;
  const locationName =
    data.locationName || "Unknown location";

  // ----------------------------------------
  // 3.1 Validate Forecast Data
  // ----------------------------------------

  if (!Array.isArray(data.forecast)) {
    throw new Error(
      `Invalid forecast data for ${locationName}`
    );
  }

  // ----------------------------------------
  // 3.2 Identify Rainy Hours
  // ----------------------------------------

  const rainyHours = data.forecast
    .filter(hour => {

      if (
        !hour ||
        typeof hour.time !== "string" ||
        !Number.isFinite(Number(hour.precipitation))
      ) {
        throw new Error(
          `Invalid precipitation data for ${locationName}`
        );
      }

      return Number(hour.precipitation) > 0;

    })
    .sort((a, b) =>
      a.time.localeCompare(b.time)
    );

  // ========================================
  // 4. Group Consecutive Rainy Hours
  // ========================================

  const rainfallPeriods = [];
  let currentPeriod = null;

  for (const hour of rainyHours) {

    // Convert Thailand local time to timestamp
    const startMs = new Date(
      `${hour.time}:00+07:00`
    ).getTime();

    if (!Number.isFinite(startMs)) {
      throw new Error(
        `Invalid forecast time for ${locationName}: ${hour.time}`
      );
    }

    const endMs =
      startMs + 60 * 60 * 1000;

    const precipitation = Number(
      hour.precipitation
    );

    // Check whether the hour is consecutive
    const canMerge =
      currentPeriod !== null &&
      currentPeriod.endMs === startMs;

    if (canMerge) {

      // Extend the current rainfall period
      currentPeriod.endMs = endMs;

      currentPeriod.hoursCount++;

      currentPeriod.totalPrecipitation +=
        precipitation;

    } else {

      // Start a new rainfall period
      currentPeriod = {

        startMs,
        endMs,

        hoursCount: 1,

        totalPrecipitation: precipitation

      };

      rainfallPeriods.push(currentPeriod);

    }
  }

  // ========================================
  // 5. Prepare Rainfall Period Results
  // ========================================

  const periods = rainfallPeriods.map(period => ({

    startTime: formatTime(period.startMs),

    endTime: formatTime(period.endMs),

    hoursCount: period.hoursCount,

    totalPrecipitation: Number(
      period.totalPrecipitation.toFixed(1)
    )

  }));

  // ========================================
  // 6. Return Rainfall Analysis
  // ========================================

  return {
    json: {

      // Preserve original weather data
      ...data,

      // Rainfall analysis results
      totalRainfallPeriods: periods.length,

      rainfallPeriods: periods

    }
  };

});
