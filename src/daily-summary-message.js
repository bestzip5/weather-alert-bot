/*
 * Daily Summary Message - Compact Pattern A FINAL
 * Weather Alert Bot - Multi Location
 *
 * Business Rules:
 * NONE     = 0%
 * LOW      = 1-29%
 * MODERATE = 30-59%
 * WATCH    = 60-69%
 * HIGH     = 70-100%
 *
 * Notification Policy:
 * - HIGH: Show risk period, probability and precipitation.
 * - WATCH: Show monitoring period, probability and precipitation.
 * - LOW / MODERATE: Brief summary only.
 * - NONE: Show no-rain-probability message.
 * - No separator lines between locations.
 * - One LINE message for all locations.
 */

// ==========================================
// 1. Configuration
// ==========================================

const REQUIRED_LOCATIONS = ["salaya", "nongkhaem"];

const MODERATE_THRESHOLD = 30;
const WATCH_THRESHOLD = 60;
const HIGH_THRESHOLD = 70;

const locationOrder = {
  salaya: 1,
  nongkhaem: 2
};

// ==========================================
// 2. Get and Validate Input
// ==========================================

const items = $input.all();

if (items.length === 0) {
  throw new Error("No weather data received");
}

const locations = items
  .map(item => item.json)
  .sort((a, b) =>
    (locationOrder[a.locationId] ?? 99) -
    (locationOrder[b.locationId] ?? 99)
  );

// Validate location count
if (locations.length !== REQUIRED_LOCATIONS.length) {
  throw new Error(
    `Expected ${REQUIRED_LOCATIONS.length} locations, received ${locations.length}`
  );
}

// Validate required location IDs
const receivedIds = locations.map(
  data => data.locationId
);

for (const id of REQUIRED_LOCATIONS) {
  if (!receivedIds.includes(id)) {
    throw new Error(`Missing location: ${id}`);
  }
}

// Prevent duplicate locations
if (new Set(receivedIds).size !== receivedIds.length) {
  throw new Error("Duplicate location detected");
}

// ==========================================
// 3. Validate Location Data
// ==========================================

for (const data of locations) {

  if (
    !data.locationName ||
    !data.date ||
    !data.dailyAnalysis
  ) {
    throw new Error(
      `Incomplete weather data for ${data.locationId}`
    );
  }

  if (
    !Array.isArray(data.upcomingForecast) ||
    !Array.isArray(data.upcomingRiskPeriods) ||
    !Array.isArray(data.upcomingModerateHours) ||
    !Array.isArray(data.upcomingRainfallPeriods)
  ) {
    throw new Error(
      `Missing forecast or rain analysis data for ${data.locationId}`
    );
  }
}

// Validate matching forecast dates
const dates = [
  ...new Set(locations.map(data => data.date))
];

if (
  dates.length !== 1 ||
  !/^\d{4}-\d{2}-\d{2}$/.test(dates[0])
) {
  throw new Error(
    "Forecast dates are invalid or do not match"
  );
}

// ==========================================
// 4. Format Date and Numbers
// ==========================================

const [year, month, day] = dates[0]
  .split("-")
  .map(Number);

const monthNames = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.",
  "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.",
  "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

if (
  !Number.isInteger(year) ||
  !Number.isInteger(month) ||
  !Number.isInteger(day) ||
  month < 1 ||
  month > 12 ||
  day < 1 ||
  day > 31
) {
  throw new Error("Invalid forecast date");
}

const thaiDate =
  `${day} ${monthNames[month - 1]} ${year + 543}`;

function formatNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "ไม่ระบุ";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "ไม่ระบุ";
  }

  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(1);
}

function formatTemperature(value) {

  const formatted = formatNumber(value);

  return formatted === "ไม่ระบุ"
    ? formatted
    : `${formatted}°C`;
}

// ==========================================
// 5. Rain Classification V2
// ==========================================

function classifyRainRisk(probability) {

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

const statusMessages = {
  NONE: "ไม่พบโอกาสเกิดฝนจากแบบจำลอง",
  LOW: "โอกาสเกิดฝนต่ำ",
  MODERATE: "มีโอกาสเกิดฝนปานกลาง"
};

// ==========================================
// 6. Analyze Upcoming Rain Forecast
// ==========================================

function analyzeRainStatus(forecast, locationName) {

  if (forecast.length === 0) {
    return {
      available: false,
      maxProbability: null,
      maxProbabilityTime: null,
      riskLevel: null,
      statusText: "ไม่มีข้อมูลพยากรณ์ฝน"
    };
  }

  const validHours = forecast.map(hour => {

    if (
      !hour ||
      typeof hour.time !== "string" ||
      hour.rainProbability === null ||
      hour.rainProbability === undefined
    ) {
      throw new Error(
        `Invalid rainfall forecast for ${locationName}`
      );
    }

    const probability = Number(
      hour.rainProbability
    );

    if (
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 100
    ) {
      throw new Error(
        `Invalid rain probability for ${locationName}`
      );
    }

    return {
      ...hour,
      rainProbability: probability
    };
  });

  // Find highest probability in remaining forecast
  const maxHour = validHours.reduce((max, hour) =>
    hour.rainProbability > max.rainProbability
      ? hour
      : max
  );

  const maxProbability = maxHour.rainProbability;

  const riskLevel = classifyRainRisk(
    maxProbability
  );

  return {
    available: true,
    maxProbability,
    maxProbabilityTime: maxHour.time.slice(11, 16),
    riskLevel,
    statusText:
      statusMessages[riskLevel] || riskLevel
  };
}

// ==========================================
// 7. Validate Risk Periods
// ==========================================

function prepareRiskPeriods(periods, locationName) {

  if (!Array.isArray(periods)) {
    throw new Error(
      `Invalid risk periods for ${locationName}`
    );
  }

  // Validate all periods before sorting
  const validatedPeriods = periods.map(period => {

    if (
      !period ||
      !["WATCH", "HIGH"].includes(period.riskLevel) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.startTime || "") ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.endTime || "")
    ) {
      throw new Error(
        `Invalid risk period for ${locationName}`
      );
    }

    const minProbability = Number(
      period.minProbability
    );

    const maxProbability = Number(
      period.maxProbability
    );

    if (
      !Number.isFinite(minProbability) ||
      !Number.isFinite(maxProbability) ||
      minProbability < 0 ||
      maxProbability > 100 ||
      minProbability > maxProbability
    ) {
      throw new Error(
        `Invalid probability range for ${locationName}`
      );
    }

    // HIGH must be 70-100%
    if (
      period.riskLevel === "HIGH" &&
      minProbability < HIGH_THRESHOLD
    ) {
      throw new Error(
        `HIGH threshold mismatch for ${locationName}`
      );
    }

    // WATCH must be 60-69%
    if (
      period.riskLevel === "WATCH" &&
      (
        minProbability < WATCH_THRESHOLD ||
        maxProbability >= HIGH_THRESHOLD
      )
    ) {
      throw new Error(
        `WATCH threshold mismatch for ${locationName}`
      );
    }

    // Validate accumulated precipitation
    const precipitation =
      period.totalPrecipitation === null ||
      period.totalPrecipitation === undefined
        ? null
        : Number(period.totalPrecipitation);

    if (
      precipitation !== null &&
      (
        !Number.isFinite(precipitation) ||
        precipitation < 0
      )
    ) {
      throw new Error(
        `Invalid precipitation for ${locationName}`
      );
    }

    return {
      ...period,
      minProbability,
      maxProbability,
      totalPrecipitation: precipitation
    };
  });

  return validatedPeriods.sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
}

// ==========================================
// 8. Prepare Daily Summary
// ==========================================

const lines = [
  "🌤️ Weather Alert — Daily Summary",
  `📅 ${thaiDate}`,
  ""
];

const locationResults = [];

let hasAnyRainRisk = false;
let hasCompleteRainForecast = true;

// ==========================================
// 9. Build Each Location Report
// ==========================================

for (const data of locations) {

  const daily = data.dailyAnalysis;
  const locationName = data.locationName;

  // ----------------------------------------
  // 9.1 Analyze Remaining Rain Forecast
  // ----------------------------------------

  const rainStatus = analyzeRainStatus(
    data.upcomingForecast,
    locationName
  );

  if (!rainStatus.available) {
    hasCompleteRainForecast = false;
  }

  // ----------------------------------------
  // 9.2 Prepare WATCH / HIGH Periods
  // ----------------------------------------

  const riskPeriods = prepareRiskPeriods(
    data.upcomingRiskPeriods,
    locationName
  );

  const hasRainAlert =
    riskPeriods.length > 0;

  // ----------------------------------------
  // 9.3 Cross-check Forecast and Risk Periods
  // ----------------------------------------

  if (rainStatus.available) {

    const forecastHasRisk =
      rainStatus.maxProbability >= WATCH_THRESHOLD;

    if (forecastHasRisk !== hasRainAlert) {
      throw new Error(
        `Forecast and risk periods do not match for ${locationName}`
      );
    }

  } else if (hasRainAlert) {

    throw new Error(
      `Risk periods exist but forecast is unavailable for ${locationName}`
    );
  }

  // Validate upstream risk flag
  if (
    typeof data.hasUpcomingRainRisk === "boolean" &&
    data.hasUpcomingRainRisk !== hasRainAlert
  ) {
    throw new Error(
      `Upcoming rain risk flag mismatch for ${locationName}`
    );
  }

  if (hasRainAlert) {
    hasAnyRainRisk = true;
  }

  // ----------------------------------------
  // 9.4 Location Heading
  // ----------------------------------------

  lines.push(
    `📍 ${locationName}`
  );

  // ----------------------------------------
  // 9.5 Temperature Summary
  // ----------------------------------------

  lines.push(
    `🌡️ สูงสุด ${formatTemperature(daily.maxTemperature)} (${daily.maxTemperatureTime || "ไม่ระบุ"}) | ต่ำสุด ${formatTemperature(daily.minTemperature)} (${daily.minTemperatureTime || "ไม่ระบุ"})`,
    `🥵 รู้สึกเหมือนสูงสุด ${formatTemperature(daily.maxFeelsLike)}`
  );

  lines.push("");

  // ----------------------------------------
  // 9.6 LOW / MODERATE / NONE Summary
  // ----------------------------------------

  if (!rainStatus.available) {

    lines.push(
      "⚪ ไม่มีข้อมูลพยากรณ์ฝนสำหรับช่วงเวลาที่เหลือ"
    );

  } else if (rainStatus.riskLevel === "HIGH") {

    // HIGH details displayed in risk period section.

  } else if (rainStatus.riskLevel === "WATCH") {

    // WATCH details displayed in risk period section.

  } else if (rainStatus.riskLevel === "MODERATE") {

    lines.push(
      `🟡 ${statusMessages.MODERATE} (สูงสุด ${rainStatus.maxProbability}%)`
    );

  } else if (rainStatus.riskLevel === "LOW") {

    lines.push(
      `🟢 ${statusMessages.LOW} (สูงสุด ${rainStatus.maxProbability}%)`
    );

  } else {

    lines.push(
      `✅ ${statusMessages.NONE}`
    );
  }

  // ----------------------------------------
  // 9.7 Display HIGH / WATCH Periods
  // ----------------------------------------

  if (hasRainAlert) {

    for (const period of riskPeriods) {

      const start =
        period.displayStartTime || period.startTime;

      const end = period.endTime;

      // Separate HIGH and WATCH wording
      const periodHeading =
        period.riskLevel === "HIGH"
          ? `🔴 HIGH | ช่วงเสี่ยงฝนสูง: ${start}–${end} น.`
          : `🟠 WATCH | ช่วงที่ควรเฝ้าระวังฝน: ${start}–${end} น.`;

      // Risk level and specific time
      lines.push(
        "",
        periodHeading
      );

      // Probability for this specific period
      lines.push(
        `โอกาสเกิดฝน: ${period.minProbability}–${period.maxProbability}%`
      );

      // Accumulated precipitation for this period
      lines.push(
        `ปริมาณฝนคาดการณ์สะสม: ${
          period.totalPrecipitation === null
            ? "ไม่มีข้อมูล"
            : `${formatNumber(period.totalPrecipitation)} mm`
        }`
      );

      // Currently ongoing period
      if (period.isOngoing) {
        lines.push(
          "ช่วงเวลาดังกล่าวกำลังดำเนินอยู่"
        );
      }
    }
  }

  // ----------------------------------------
  // 9.8 Preserve Detailed Data for QA
  // ----------------------------------------

  locationResults.push({

    locationId: data.locationId,
    locationName,

    dailyAnalysis: daily,

    rainStatus,

    hasUpcomingRainRisk: hasRainAlert,

    upcomingRiskPeriods: riskPeriods,

    upcomingModerateHours:
      data.upcomingModerateHours,

    upcomingRainfallPeriods:
      data.upcomingRainfallPeriods,

    moderateHoursCount:
      data.upcomingModerateHours.length,

    rainfallPeriodsCount:
      data.upcomingRainfallPeriods.length
  });

  // Blank lines between locations
  lines.push("", "");
}

// ==========================================
// 10. Overall Rain Risk Summary
// ==========================================

if (
  !hasAnyRainRisk &&
  hasCompleteRainForecast
) {

  lines.push(
    "✅ ไม่พบช่วงเวลาที่มีความเสี่ยงในการเกิดฝนทั้งสองพื้นที่",
    ""
  );
}

if (hasAnyRainRisk) {

  lines.push(
    "☂️ คำแนะนำ: ควรเตรียมร่มหรือเสื้อกันฝนก่อนเดินทาง",
    ""
  );
}

// ==========================================
// 11. Footer
// ==========================================

lines.push(
  "หมายเหตุ: โอกาสเกิดฝนเป็นค่าพยากรณ์จากแบบจำลอง",
  "สภาพอากาศจริงอาจแตกต่างจากการคาดการณ์"
);

// ==========================================
// 12. Build Final Message
// ==========================================

const message = lines.join("\n").trim();

if (!message || message.length > 5000) {
  throw new Error(
    `Invalid message length: ${message.length}`
  );
}

// ==========================================
// 13. Output
// ==========================================

return [{
  json: {

    message,

    messageLength: message.length,

    locationCount: locations.length,

    locationIds: locations.map(
      data => data.locationId
    ),

    locations: locationResults,

    hasAnyRainRisk,

    processedAt:
      locations[0].processedAt || null

  }
}];
