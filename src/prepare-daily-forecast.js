/*
 * Prepare Daily Forecast
 * Weather Alert Bot - Multi Location
 *
 * Data Source: Open-Meteo API
 * Timezone: Asia/Bangkok
 *
 * Responsibilities:
 * 1. Map API responses to configured locations.
 * 2. Validate location and weather data.
 * 3. Prepare hourly, current, and daily weather.
 * 4. Filter hourly forecasts for the current Thai date.
 */

// ==========================================
// 1. Get Input Data
// ==========================================

const weatherItems = $input.all();
const locationItems = $("Locations").all();

const locations = locationItems.map(
  item => item.json
);

// ==========================================
// 2. Validate Input Counts
// ==========================================

if (weatherItems.length === 0) {
  throw new Error(
    "No weather data received from HTTP Request"
  );
}

if (locations.length === 0) {
  throw new Error(
    "No location data received from Locations node"
  );
}

if (weatherItems.length !== locations.length) {
  throw new Error(
    `Weather/location count mismatch: ${weatherItems.length} weather items, ${locations.length} locations`
  );
}

// ==========================================
// 3. Validate Location Data
// ==========================================

const locationIds = locations.map(
  location => location.locationId
);

if (locationIds.some(id => !id)) {
  throw new Error(
    "Missing locationId in Locations node"
  );
}

if (new Set(locationIds).size !== locationIds.length) {
  throw new Error(
    "Duplicate locationId detected"
  );
}

for (const location of locations) {

  if (
    !location.locationName ||
    !Number.isFinite(Number(location.latitude)) ||
    !Number.isFinite(Number(location.longitude))
  ) {
    throw new Error(
      `Invalid location configuration: ${location.locationId}`
    );
  }
}

// ==========================================
// 4. Get Current Date in Thailand
// ==========================================

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

// ==========================================
// 5. Prepare Weather Data Per Location
// ==========================================

return weatherItems.map((item, index) => {

  const data = item.json;
  const location = locations[index];

  // ----------------------------------------
  // 5.1 Validate Location Mapping
  // ----------------------------------------

  if (!location) {
    throw new Error(
      `Missing location for item ${index}`
    );
  }

  // ----------------------------------------
  // 5.2 Validate API Response
  // ----------------------------------------

  if (!data || typeof data !== "object") {
    throw new Error(
      `Invalid API response for ${location.locationName}`
    );
  }

  if (data.timezone !== "Asia/Bangkok") {
    throw new Error(
      `Incorrect timezone for ${location.locationName}: ${data.timezone}`
    );
  }

  // ----------------------------------------
  // 5.3 Validate Hourly Forecast
  // ----------------------------------------

  const hourly = data.hourly;

  if (!hourly || !Array.isArray(hourly.time)) {
    throw new Error(
      `Invalid hourly forecast for ${location.locationName}`
    );
  }

  const requiredFields = [
    "temperature_2m",
    "precipitation_probability",
    "precipitation"
  ];

  for (const field of requiredFields) {

    if (
      !Array.isArray(hourly[field]) ||
      hourly[field].length !== hourly.time.length
    ) {
      throw new Error(
        `Invalid hourly field "${field}" for ${location.locationName}`
      );
    }
  }

  // ----------------------------------------
  // 5.4 Prepare Today's Hourly Forecast
  // ----------------------------------------

  const todayForecast = [];

  for (let i = 0; i < hourly.time.length; i++) {

    const time = hourly.time[i];

    if (typeof time !== "string") {
      throw new Error(
        `Invalid forecast time for ${location.locationName}`
      );
    }

    // Keep only today's forecast in Thailand
    if (!time.startsWith(today)) {
      continue;
    }

    const temperature = hourly.temperature_2m[i];

    const rainProbability =
      hourly.precipitation_probability[i];

    const precipitation = hourly.precipitation[i];

    // Validate numeric values
    const validNumber = value =>
      value !== null &&
      value !== undefined &&
      Number.isFinite(Number(value));

    if (
      !validNumber(temperature) ||
      !validNumber(rainProbability) ||
      !validNumber(precipitation)
    ) {
      throw new Error(
        `Invalid hourly weather value at ${time} for ${location.locationName}`
      );
    }

    // Validate rainfall probability
    if (
      Number(rainProbability) < 0 ||
      Number(rainProbability) > 100
    ) {
      throw new Error(
        `Invalid rain probability at ${time} for ${location.locationName}`
      );
    }

    // Validate precipitation
    if (Number(precipitation) < 0) {
      throw new Error(
        `Invalid precipitation at ${time} for ${location.locationName}`
      );
    }

    todayForecast.push({
      time,
      temperature: Number(temperature),
      rainProbability: Number(rainProbability),
      precipitation: Number(precipitation)
    });
  }

  // ----------------------------------------
  // 5.5 Validate Today's Forecast
  // ----------------------------------------

  if (todayForecast.length === 0) {
    throw new Error(
      `No forecast data available for today: ${location.locationName}`
    );
  }

  // ----------------------------------------
  // 5.6 Prepare Current Weather
  // ----------------------------------------

  const currentWeather = {

    time: data.current?.time ?? null,

    temperature:
      data.current?.temperature_2m ?? null,

    feelsLike:
      data.current?.apparent_temperature ?? null,

    humidity:
      data.current?.relative_humidity_2m ?? null

  };

  // ----------------------------------------
  // 5.7 Prepare Daily Weather
  // ----------------------------------------

  const dailyWeather = {

    maxTemperature:
      data.daily?.temperature_2m_max?.[0] ?? null,

    minTemperature:
      data.daily?.temperature_2m_min?.[0] ?? null,

    maxFeelsLike:
      data.daily?.apparent_temperature_max?.[0] ?? null

  };

  // ----------------------------------------
  // 5.8 Return Prepared Data
  // ----------------------------------------

  return {
    json: {

      locationId: location.locationId,
      locationName: location.locationName,

      latitude: Number(location.latitude),
      longitude: Number(location.longitude),

      date: today,

      totalHours: todayForecast.length,

      forecast: todayForecast,

      currentWeather,

      dailyWeather

    }
  };

});
