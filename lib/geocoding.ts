const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface Location {
  latitude: number;
  longitude: number;
  radius: number;
}

export async function geocodeAddress(address: string): Promise<Location> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    if (data.status !== "OK") {
      throw new Error("Geocoding failed: " + data.status);
    }

    const location = data.results[0].geometry.location;

    return {
      latitude: location.lat,
      longitude: location.lng,
      radius: 5, // Default radius of 5km
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    throw error;
  }
}

export function isLocationWithinRadius(
  userLocation: Location,
  listingLocation: Location
): boolean {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(listingLocation.latitude - userLocation.latitude);
  const dLon = toRad(listingLocation.longitude - userLocation.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLocation.latitude)) *
      Math.cos(toRad(listingLocation.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= listingLocation.radius;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
