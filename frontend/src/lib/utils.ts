import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Decode an encoded polyline string into a series of coordinates.
 * Uses the Google Polyline encoding format:
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded || encoded.length === 0) {
    console.warn('Attempted to decode empty polyline string');
    return [];
  }

  console.log(
    `Decoding polyline of length ${encoded.length}, first 20 chars: ${encoded.substring(0, 20)}...`
  );

  try {
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;
    const coordinates: [number, number][] = [];

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;

      // Decode latitude
      do {
        b = encoded.charCodeAt(index++) - 63; // Subtract 63 from char code
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      // Decode longitude
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      // Coordinates are stored as E5 values (multiplied by 10^5), so divide to get actual coordinates
      // Important: the correct format is [longitude, latitude] for use with Mapbox!
      const finalLat = lat * 0.00001;
      const finalLng = lng * 0.00001;

      coordinates.push([finalLng, finalLat]);
    }

    // Show decoded coordinates summary
    if (coordinates.length > 0) {
      console.log(
        `Decoded ${coordinates.length} points. First: [${coordinates[0][0].toFixed(5)}, ${coordinates[0][1].toFixed(5)}], Last: [${coordinates[coordinates.length - 1][0].toFixed(5)}, ${coordinates[coordinates.length - 1][1].toFixed(5)}]`
      );
    } else {
      console.warn('Decoding resulted in zero coordinates');
    }

    // Verify the coordinates are valid (in reasonable lat/lng ranges)
    let invalidCount = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const [lng, lat] = coordinates[i];
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        invalidCount++;
        // Keep this warning as it indicates potentially problematic data
        console.warn(`Found invalid coordinate at index ${i}: [${lng}, ${lat}]`);
        coordinates[i] = [Math.max(-180, Math.min(180, lng)), Math.max(-90, Math.min(90, lat))];
      }
    }

    if (invalidCount > 0) {
      console.warn(`Fixed ${invalidCount} invalid coordinates`);
    }

    return coordinates;
  } catch (e) {
    console.error('Error decoding polyline:', e);
    return [];
  }
}

/**
 * A utility function to test if we can decode some known polylines
 */
export function testPolylineDecoding() {
  // Some test polylines
  const tests = [
    // From OSRM docs - should decode to approximately these coordinates:
    // [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]
    '_p~iF~ps|U_ulLnnqC_mqNvxq`@',

    // Empty string
    '',

    // A very short polyline
    '~hv`Hk}qcS',
  ];

  tests.forEach((polyline, index) => {
    console.log(`Testing polyline ${index + 1}:`, polyline);
    try {
      const coords = decodePolyline(polyline);
      console.log(`Decoded to ${coords.length} points:`, coords);
    } catch (e) {
      console.error(`Failed to decode test polyline ${index + 1}:`, e);
    }
  });
}
