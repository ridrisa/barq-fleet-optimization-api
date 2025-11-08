/**
 * Helper Utilities
 * Common utility functions for the application
 */

// Calculate distance between two coordinates in kilometers using the Haversine formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  return distance;
};

// Convert degrees to radians
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

// Generate a unique ID with a prefix
const generateId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${timestamp}-${random}`;
};

// Format time from 24-hour format to 12-hour format with AM/PM
const formatTime = (time24h) => {
  if (!time24h || typeof time24h !== 'string') return '';

  const [hours, minutes] = time24h.split(':').map((num) => parseInt(num, 10));

  if (isNaN(hours) || isNaN(minutes)) return '';

  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;

  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Parse a time window string ("HH:MM-HH:MM") into start and end time objects
const parseTimeWindow = (timeWindow) => {
  if (!timeWindow || typeof timeWindow !== 'string') {
    return { start: null, end: null };
  }

  const [startTime, endTime] = timeWindow.split('-');

  const parseTime = (timeStr) => {
    if (!timeStr) return null;

    const [hours, minutes] = timeStr.split(':').map((num) => parseInt(num, 10));

    if (isNaN(hours) || isNaN(minutes)) return null;

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date;
  };

  return {
    start: parseTime(startTime),
    end: parseTime(endTime),
  };
};

// Check if a time is within a time window
const isTimeInWindow = (time, timeWindow) => {
  if (!time || !timeWindow) return false;

  const { start, end } = parseTimeWindow(timeWindow);

  if (!start || !end) return false;

  const checkTime = typeof time === 'string' ? parseTime(time) : time instanceof Date ? time : null;

  if (!checkTime) return false;

  return checkTime >= start && checkTime <= end;
};

// Parse time from string to Date object
const parseTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;

  const [hours, minutes] = timeStr.split(':').map((num) => parseInt(num, 10));

  if (isNaN(hours) || isNaN(minutes)) return null;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date;
};

// Calculate the center point of multiple coordinates
const calculateCenter = (coordinates) => {
  if (!coordinates || !coordinates.length) {
    return null;
  }

  let sumLat = 0;
  let sumLng = 0;

  coordinates.forEach((coord) => {
    sumLat += parseFloat(coord[0]);
    sumLng += parseFloat(coord[1]);
  });

  return [sumLat / coordinates.length, sumLng / coordinates.length];
};

// Checks if a vehicle can handle a delivery based on capacity
const canVehicleHandleDelivery = (vehicle, delivery) => {
  return vehicle.capacity_kg >= delivery.load_kg;
};

// Calculate total load for a set of deliveries
const calculateTotalLoad = (deliveries) => {
  if (!deliveries || !deliveries.length) return 0;

  return deliveries.reduce((sum, delivery) => {
    return sum + (delivery.load_kg || 0);
  }, 0);
};

// Format the response time
const formatResponseTime = (startTime) => {
  const endTime = Date.now();
  return endTime - startTime;
};

// Calculate the vehicle utilization as a percentage of used capacity
const calculateVehicleUtilization = (totalLoad, capacity) => {
  if (!capacity || capacity <= 0) return 0;

  const utilization = (totalLoad / capacity) * 100;
  return Math.min(100, Math.round(utilization * 100) / 100);
};

// Calculate the stop density (stops per km)
const calculateStopDensity = (numberOfStops, totalDistance) => {
  if (!totalDistance || totalDistance <= 0) return 0;

  return Math.round((numberOfStops / totalDistance) * 100) / 100;
};

// Calculate the service efficiency based on stops per hour
const calculateServiceEfficiency = (numberOfStops, totalDuration) => {
  if (!totalDuration || totalDuration <= 0) return 0;

  // Convert duration from minutes to hours
  const durationInHours = totalDuration / 60;

  return Math.round((numberOfStops / durationInHours) * 100) / 100;
};

// Check if a polygon contains a point
const isPointInPolygon = (point, polygon) => {
  // Ray casting algorithm
  const x = point[0],
    y = point[1];

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
};

// Utility to deep clone an object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

module.exports = {
  calculateDistance,
  toRadians,
  generateId,
  formatTime,
  parseTimeWindow,
  isTimeInWindow,
  parseTime,
  calculateCenter,
  canVehicleHandleDelivery,
  calculateTotalLoad,
  formatResponseTime,
  calculateVehicleUtilization,
  calculateStopDensity,
  calculateServiceEfficiency,
  isPointInPolygon,
  deepClone,
};
