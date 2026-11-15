/*
 * Analyze Rain Risk - V2
 * Weather Alert Bot - Multi Location
 *
 * Responsibilities:
 * 1. Validate hourly rain forecast data.
 * 2. Classify rainfall probability into five risk levels.
 * 3. Separate forecast hours by risk level.
 * 4. Calculate overall maximum rain probability.
 * 5. Prepare WATCH and HIGH hours for Time Grouping.
 *
 * Business Rules:
 * NONE     = 0%
 * LOW      = 1-29%
 * MODERATE = 30-59%
 * WATCH    = 60-69%
 * HIGH     = 70-100%
 *
 * Notification Policy:
 * - Only WATCH and HIGH are used for rain alerts.
 * - MODERATE is retained for Daily Summary.
 * - LOW and NONE are retained for analysis.
 */

// ==========================================
// 1. Get Input Data
// ==========================================

const items = $input.all();

if (items.length === 0) {
  throw new Error("No weather data received");
}

// ==========================================
// 2. Define Risk Thresholds
// ==========================================

const MODERATE_THRESHOLD = 30;
const WATCH_THRESHOLD = 60;
const HIGH_THRESHOLD = 70;

// ==========================================
// 3. Classify Rain Probability
// ==========================================

function classifyRisk(probability) {

  if (probability === 0) {
    return "NONE";
  }

  if (probability < MODERATE_THRESHOLD) {
    return "LOW";
  }

  if (probability < WATCH_THRESHOLD) {
    return "MODERATE";
  }

  if (probability < HIGH_THRESHOLD) {
    return "WATCH";
  }

  return "HIGH";
}

// ==========================================
// 4. Process Each Location
// ==========================================

return items.map((item, index) => {

  const data = item.json;

  // ----------------------------------------
  // 4.1 Validate Location
  // ----------------------------------------

  if (!data.locationId || !data.locationName) {
    throw new Error(
      `Missing location information at item ${index}`
    );
  }

  // ----------------------------------------
  // 4.2 Validate Forecast
  // ----------------------------------------

  if (
    !Array.isArray(data.forecast) ||
    data.forecast.length === 0
  ) {
    throw new Error(
      `Missing forecast data for ${data.locationName}`
    );
  }

  // ----------------------------------------
  // 4.3 Classify Every Forecast Hour
  // ----------------------------------------

  const classifiedForecast = data.forecast.map(hour => {

    if (
      !hour ||
      typeof hour.time !== "string" ||
      hour.rainProbability === null ||
      hour.rainProbability === undefined ||
      !Number.isFinite(Number(hour.rainProbability))
    ) {
      throw new Error(
        `Invalid rain probability for ${data.locationName}`
      );
    }

    const probability = Number(
      hour.rainProbability
    );

    if (probability < 0 || probability > 100) {
      throw new Error(
        `Rain probability out of range for ${data.locationName}`
      );
    }

    return {
      ...hour,

      rainProbability: probability,

      riskLevel: classifyRisk(probability)
    };

  });

  // ==========================================
  // 5. Separate Rain Risk Levels
  // ==========================================

  const noneHours = classifiedForecast.filter(
    hour => hour.riskLevel === "NONE"
  );

  const lowHours = classifiedForecast.filter(
    hour => hour.riskLevel === "LOW"
  );

  const moderateHours = classifiedForecast.filter(
    hour => hour.riskLevel === "MODERATE"
  );

  const watchHours = classifiedForecast.filter(
    hour => hour.riskLevel === "WATCH"
  );

  const highRiskHours = classifiedForecast.filter(
    hour => hour.riskLevel === "HIGH"
  );

  // ==========================================
  // 6. Prepare Alert-Level Risk Hours
  // ==========================================

  // Only WATCH and HIGH are passed to Time Grouping.

  const riskHours = classifiedForecast.filter(
    hour =>
      hour.riskLevel === "WATCH" ||
      hour.riskLevel === "HIGH"
  );

  // ==========================================
  // 7. Calculate Maximum Rain Probability
  // ==========================================

  const maxRainProbability = Math.max(
    ...classifiedForecast.map(
      hour => hour.rainProbability
    )
  );

  const overallRainStatus = classifyRisk(
    maxRainProbability
  );

  // ==========================================
  // 8. Return Analysis Results
  // ==========================================

  return {
    json: {

      // Preserve original weather data
      ...data,

      // Risk thresholds
      noneThreshold: 0,
      moderateThreshold: MODERATE_THRESHOLD,
      watchThreshold: WATCH_THRESHOLD,
      highThreshold: HIGH_THRESHOLD,

      // Overall rain status
      maxRainProbability,
      overallRainStatus,

      // Rain potential and alert flags
      hasRainPotential:
        maxRainProbability >= MODERATE_THRESHOLD,

      hasModerateRainChance:
        moderateHours.length > 0,

      hasRainRisk:
        riskHours.length > 0,

      // Hour counts by risk level
      noneHoursCount: noneHours.length,
      lowHoursCount: lowHours.length,
      moderateHoursCount: moderateHours.length,
      watchHoursCount: watchHours.length,
      highRiskHoursCount: highRiskHours.length,

      // Preserve existing field names
      rainyHoursCount: riskHours.length,
      riskHoursCount: riskHours.length,

      // Fully classified forecast
      classifiedForecast,

      // Separate risk groups
      noneHours,
      lowHours,
      moderateHours,
      watchHours,
      highRiskHours,

      // Input for Time Grouping
      riskHours

    }
  };

});
