/*
 * Time Grouping
 * Weather Alert Bot - Multi Location
 *
 * Responsibilities:
 * 1. Group consecutive hourly rain-risk forecasts.
 * 2. Separate groups by risk level.
 * 3. Calculate minimum and maximum rain probability.
 * 4. Calculate accumulated precipitation.
 * 5. Format risk periods using Thailand timezone.
 *
 * Business Rules:
 * - Only WATCH and HIGH are processed.
 * - Hours must be consecutive to be grouped.
 * - Different risk levels must remain separate.
 *
 * Timezone: Asia/Bangkok (UTC+7)
 */

// ==========================================
// 1. Get Input Data
// ==========================================

const items = $input.all();

// ==========================================
// 2. Validate Input
// ==========================================

if (items.length === 0) {
  throw new Error("No location data received");
}

// ==========================================
// 3. Process Each Location
// ==========================================

return items.map(item => {

  const data = item.json;
  const locationName = data.locationName || "Unknown location";

  // ----------------------------------------
  // 3.1 Validate Risk Hours
  // ----------------------------------------

  const hours = Array.isArray(data.riskHours)
    ? [...data.riskHours]
    : [];

  // Validate each risk hour
  for (const hour of hours) {

    if (
      !hour ||
      typeof hour.time !== "string" ||
      !["WATCH", "HIGH"].includes(hour.riskLevel)
    ) {
      throw new Error(
        `Invalid risk hour data for ${locationName}`
      );
    }

    // Validate forecast time format
    if (
      !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(hour.time)
    ) {
      throw new Error(
        `Invalid forecast time for ${locationName}: ${hour.time}`
      );
    }

    // Validate rain probability
    const probability = Number(hour.rainProbability);

    if (
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 100
    ) {
      throw new Error(
        `Invalid rain probability for ${locationName}`
      );
    }

    // Validate precipitation
    const precipitation = Number(
      hour.precipitation ?? 0
    );

    if (
      !Number.isFinite(precipitation) ||
      precipitation < 0
    ) {
      throw new Error(
        `Invalid precipitation for ${locationName}`
      );
    }
  }

  // Sort risk hours chronologically
  hours.sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  // ========================================
  // 4. Group Consecutive Risk Hours
  // ========================================

  const groups = [];
  let currentGroup = null;

  for (const hour of hours) {

    // Convert Thailand local time to timestamp
    const startMs = new Date(
      `${hour.time}:00+07:00`
    ).getTime();

    if (!Number.isFinite(startMs)) {
      throw new Error(
        `Unable to parse forecast time for ${locationName}`
      );
    }

    const endMs =
      startMs + 60 * 60 * 1000;

    const probability = Number(
      hour.rainProbability
    );

    const precipitation = Number(
      hour.precipitation ?? 0
    );

    // Check whether the hour can be merged
    const canMerge =
      currentGroup !== null &&
      currentGroup.riskLevel === hour.riskLevel &&
      currentGroup.endMs === startMs;

    if (canMerge) {

      // Extend the current group
      currentGroup.endMs = endMs;

      // Update probability range
      currentGroup.maxProbability = Math.max(
        currentGroup.maxProbability,
        probability
      );

      currentGroup.minProbability = Math.min(
        currentGroup.minProbability,
        probability
      );

      // Update accumulated values
      currentGroup.hoursCount++;

      currentGroup.totalPrecipitation +=
        precipitation;

    } else {

      // Start a new risk period
      currentGroup = {

        riskLevel: hour.riskLevel,

        startMs,
        endMs,

        minProbability: probability,
        maxProbability: probability,

        hoursCount: 1,

        totalPrecipitation: precipitation

      };

      groups.push(currentGroup);
    }
  }

  // ========================================
  // 5. Format Time in Thailand Timezone
  // ========================================

  function formatTime(timestamp) {

    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).format(new Date(timestamp));

  }

  // ========================================
  // 6. Prepare Risk Periods
  // ========================================

  const riskPeriods = groups.map(group => ({

    riskLevel: group.riskLevel,

    startTime: formatTime(group.startMs),

    endTime: formatTime(group.endMs),

    minProbability: group.minProbability,

    maxProbability: group.maxProbability,

    hoursCount: group.hoursCount,

    totalPrecipitation: Number(
      group.totalPrecipitation.toFixed(1)
    )

  }));

  // ========================================
  // 7. Return Grouped Results
  // ========================================

  return {
    json: {

      // Preserve original weather data
      ...data,

      // Grouping results
      totalPeriods: riskPeriods.length,

      riskPeriods

    }
  };

});
