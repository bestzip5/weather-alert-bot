/*
 * Analyze Daily Weather
 * Weather Alert Bot - Multi Location
 *
 * Data Source: Open-Meteo API
 *
 * Responsibilities:
 * 1. Validate hourly temperature data.
 * 2. Identify daily maximum temperature.
 * 3. Identify daily minimum temperature.
 * 4. Retrieve maximum apparent temperature (Feels Like).
 * 5. Compare hourly maximum with Daily API maximum.
 */

// ==========================================
// 1. Get Input Data
// ==========================================

const items = $input.all();

if (items.length === 0) {
  throw new Error("No weather data received");
}

// ==========================================
// 2. Process Each Location
// ==========================================

return items.map(item => {

  const data = item.json;
  const forecast = data.forecast;

  // ----------------------------------------
  // 2.1 Validate Forecast
  // ----------------------------------------

  if (!Array.isArray(forecast)) {
    throw new Error(
      `Invalid forecast data for ${data.locationName}`
    );
  }

  const validHours = forecast.filter(hour =>
    hour &&
    typeof hour.time === "string" &&
    hour.time.length >= 16 &&
    hour.temperature !== null &&
    hour.temperature !== undefined &&
    Number.isFinite(Number(hour.temperature))
  );

  if (validHours.length === 0) {
    throw new Error(
      `No valid temperature data for ${data.locationName}`
    );
  }

  // ----------------------------------------
  // 2.2 Find Maximum Temperature
  // ----------------------------------------

  const maxHour = validHours.reduce((max, hour) =>
    Number(hour.temperature) > Number(max.temperature)
      ? hour
      : max
  );

  // ----------------------------------------
  // 2.3 Find Minimum Temperature
  // ----------------------------------------

  const minHour = validHours.reduce((min, hour) =>
    Number(hour.temperature) < Number(min.temperature)
      ? hour
      : min
  );

  // ----------------------------------------
  // 2.4 Prepare Daily API Data
  // ----------------------------------------

  const daily = data.dailyWeather || {};

  const maxFeelsLike = daily.maxFeelsLike ?? null;

  const dailyMaxFromApi =
    daily.maxTemperature ?? null;

  const dailyMinFromApi =
    daily.minTemperature ?? null;

  // ----------------------------------------
  // 2.5 Calculate Temperature Difference
  // ----------------------------------------

  const dailyMaxNumber = Number(dailyMaxFromApi);

  const maxDifference =
    dailyMaxFromApi !== null &&
    Number.isFinite(dailyMaxNumber)
      ? Number(
          (
            Number(maxHour.temperature) -
            dailyMaxNumber
          ).toFixed(1)
        )
      : null;

  // ========================================
  // 3. Return Daily Weather Analysis
  // ========================================

  return {
    json: {

      // Preserve original weather data
      ...data,

      // Daily temperature analysis
      dailyAnalysis: {

        maxTemperature:
          Number(maxHour.temperature),

        maxTemperatureTime:
          maxHour.time.slice(11, 16),

        minTemperature:
          Number(minHour.temperature),

        minTemperatureTime:
          minHour.time.slice(11, 16),

        maxFeelsLike:
          maxFeelsLike !== null &&
          Number.isFinite(Number(maxFeelsLike))
            ? Number(maxFeelsLike)
            : null,

        // Original values from Open-Meteo Daily API
        dailyApiMaxTemperature:
          dailyMaxFromApi,

        dailyApiMinTemperature:
          dailyMinFromApi,

        // Difference between hourly and daily maximum
        hourlyVsDailyDifference:
          maxDifference

      }

    }
  };

});
