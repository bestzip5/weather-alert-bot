/*
 * Filter Upcoming Periods
 * Weather Alert Bot - Multi Location
 *
 * Responsibilities:
 * 1. Filter expired forecast hours.
 * 2. Keep current and future forecast hours.
 * 3. Filter expired WATCH / HIGH risk periods.
 * 4. Filter expired rainfall periods.
 * 5. Filter expired MODERATE hours.
 * 6. Identify currently ongoing periods.
 * 7. Preserve all original weather data.
 *
 * Timezone: Asia/Bangkok (UTC+7)
 */

// ==========================================
// 1. Get Input Data
// ==========================================

const items = $input.all();

if (items.length === 0) {
  throw new Error("No location data received");
}

// Capture current time once for all locations
const now = new Date();
const nowMs = now.getTime();

// ==========================================
// 2. Get Thailand Date and Time
// ==========================================

const thaiDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(now);

const thaiTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
}).format(now);

// ==========================================
// 3. Time Conversion Functions
// ==========================================

// Convert Thailand date and time to timestamp
function toBangkokTimestamp(date, time) {

  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    return NaN;
  }

  return new Date(
    `${date}T${time}:00+07:00`
  ).getTime();
}

// Convert forecast ISO time to timestamp
function toForecastTimestamp(time) {

  if (
    typeof time !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    return NaN;
  }

  return new Date(
    `${time}:00+07:00`
  ).getTime();
}

// ==========================================
// 4. Filter Upcoming Periods
// ==========================================

function filterUpcoming(
  periods,
  date,
  locationName,
  fieldName
) {

  if (!Array.isArray(periods)) {
    throw new Error(
      `Invalid ${fieldName} for ${locationName}`
    );
  }

  return periods
    .map(period => {

      // Validate period data
      if (
        !period ||
        !period.startTime ||
        !period.endTime
      ) {
        throw new Error(
          `Invalid period data in ${fieldName} for ${locationName}`
        );
      }

      // Convert start and end time
      const startMs = toBangkokTimestamp(
        date,
        period.startTime
      );

      let endMs = toBangkokTimestamp(
        date,
        period.endTime
      );

      if (
        !Number.isFinite(startMs) ||
        !Number.isFinite(endMs)
      ) {
        throw new Error(
          `Invalid period time in ${fieldName} for ${locationName}`
        );
      }

      // Support periods ending after midnight
      if (endMs <= startMs) {
        endMs += 24 * 60 * 60 * 1000;
      }

      // Check whether the period is currently ongoing
      const isOngoing =
        startMs <= nowMs &&
        endMs > nowMs;

      return {
        ...period,

        displayStartTime: isOngoing
          ? thaiTime
          : period.startTime,

        isOngoing,

        _endMs: endMs
      };

    })

    // Keep periods that have not ended
    .filter(period =>
      period._endMs > nowMs
    )

    // Remove internal timestamp
    .map(({ _endMs, ...period }) => period);
}

// ==========================================
// 5. Filter Upcoming Moderate Hours
// ==========================================

function filterUpcomingModerate(
  hours,
  locationName
) {

  if (!Array.isArray(hours)) {
    throw new Error(
      `Invalid moderateHours for ${locationName}`
    );
  }

  return hours.filter(hour => {

    if (!hour || !hour.time) {
      throw new Error(
        `Invalid moderate hour for ${locationName}`
      );
    }

    const startMs = toForecastTimestamp(
      hour.time
    );

    if (!Number.isFinite(startMs)) {
      throw new Error(
        `Invalid moderate forecast time for ${locationName}`
      );
    }

    const endMs =
      startMs + 60 * 60 * 1000;

    // Keep current and future hours
    return endMs > nowMs;

  });
}

// ==========================================
// 6. Process Each Location
// ==========================================

return items.map((item, index) => {

  const data = item.json;

  const locationName =
    data.locationName || `Location ${index + 1}`;

  // ----------------------------------------
  // 6.1 Validate Location Data
  // ----------------------------------------

  if (!data.locationId || !data.locationName) {
    throw new Error(
      `Missing location information at item ${index}`
    );
  }

  if (
    typeof data.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
  ) {
    throw new Error(
      `Invalid forecast date for ${locationName}`
    );
  }

  // ----------------------------------------
  // 6.2 Validate Forecast
  // ----------------------------------------

  if (!Array.isArray(data.forecast)) {
    throw new Error(
      `Invalid forecast data for ${locationName}`
    );
  }

  // ----------------------------------------
  // 6.3 Filter Upcoming Forecast
  // ----------------------------------------

  const upcomingForecast = data.forecast.filter(hour => {

    if (!hour || !hour.time) {
      throw new Error(
        `Invalid forecast hour for ${locationName}`
      );
    }

    const forecastStartMs = toForecastTimestamp(
      hour.time
    );

    if (!Number.isFinite(forecastStartMs)) {
      throw new Error(
        `Invalid forecast timestamp for ${locationName}`
      );
    }

    const forecastEndMs =
      forecastStartMs + 60 * 60 * 1000;

    // Keep current and future forecast hours
    return forecastEndMs > nowMs;

  });

  // ----------------------------------------
  // 6.4 Filter Upcoming Risk Periods
  // ----------------------------------------

  const upcomingRiskPeriods = filterUpcoming(
    data.riskPeriods || [],
    data.date,
    locationName,
    "riskPeriods"
  );

  // ----------------------------------------
  // 6.5 Filter Upcoming Rainfall Periods
  // ----------------------------------------

  const upcomingRainfallPeriods = filterUpcoming(
    data.rainfallPeriods || [],
    data.date,
    locationName,
    "rainfallPeriods"
  );

  // ----------------------------------------
  // 6.6 Filter Upcoming Moderate Hours
  // ----------------------------------------

  const upcomingModerateHours = filterUpcomingModerate(
    data.moderateHours || [],
    locationName
  );

  // ----------------------------------------
  // 6.7 Calculate Upcoming Status
  // ----------------------------------------

  const hasUpcomingRainRisk =
    upcomingRiskPeriods.length > 0;

  const hasUpcomingModerateChance =
    upcomingModerateHours.length > 0;

  // Show rain alert section only for WATCH / HIGH
  const showRainSection =
    hasUpcomingRainRisk;

  // ========================================
  // 7. Return Processed Data
  // ========================================

  return {
    json: {

      // Preserve original data
      ...data,

      // Processing timestamp
      processedAt: `${thaiDate}T${thaiTime}`,

      // Upcoming forecast
      upcomingForecast,

      // Upcoming WATCH / HIGH risk periods
      upcomingRiskPeriods,

      // Upcoming rainfall periods
      upcomingRainfallPeriods,

      // Upcoming MODERATE hours
      upcomingModerateHours,

      // Upcoming status
      hasUpcomingRainRisk,
      hasUpcomingModerateChance,

      // Rain alert visibility
      showRainSection

    }
  };

});
