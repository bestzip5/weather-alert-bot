// Locations Configuration
// Supported locations: Salaya and Nong Khaem

const locations = [
  {
    locationId: "salaya",
    locationName: "ศาลายา",
    latitude: 13.803,
    longitude: 100.321
  },
  {
    locationId: "nongkhaem",
    locationName: "หนองแขม",
    latitude: 13.705,
    longitude: 100.349
  }
];

return locations.map(location => ({
  json: location
}));
