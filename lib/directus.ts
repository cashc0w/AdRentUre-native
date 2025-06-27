import {
  createDirectus,
  rest,
  authentication,
  login,
  refresh,
  readItem,
  readItems,
  createItem,
  updateItem,
  deleteItem as deleteDirectusItem,
  readAssetRaw,
  createUser,
  readMe,
  uploadFiles,
  auth,
  updateItems,
  type AuthenticationClient,
  type AuthenticationData,
  staticToken,
  logout as sdkLogout,
} from "@directus/sdk";
import { read } from "fs";
import { get } from "http";
import { geocode, Location } from "./mapbox";
import { publishMessage } from "./ably";
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { get as getStoreValue } from 'svelte/store';

type AppSchema = {
  gear_listings: DirectusGearListing[];
  rental_requests: DirectusRentalRequest[];
  reviews: DirectusReview[];
  clients: DirectusClientUser[];
  conversations: DirectusConversation[];
  messages: DirectusMessage[];
  notifications: DirectusNotification[];
  directus_users: DirectusUser[];
};

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Cross-platform token storage helpers
const setItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Local storage is unavailable:', e);
    }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const getItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      console.error('Local storage is unavailable:', e);
      return null;
    }
  } else {
    return await SecureStore.getItemAsync(key);
  }
};

const deleteItem = async (key: string) => {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Local storage is unavailable:', e);
    }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

// Use the correct Directus URL directly
const DIRECTUS_URL = "https://creative-blini-b15912.netlify.app";

export interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  location: string;
  created_at: string;
  updated_at: string;
}

export interface DirectusFile {
  id: string;
  filename_download: string;
  url: string;
}

export interface DirectusClientUser {
  id: string;
  user: DirectusUser;
  first_name: string;
  last_name: string;
}

interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number, number][][]; // Array of arrays of [longitude, latitude] pairs
}

export interface DirectusGearListing {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  category: string;
  polygon: GeoJSONPolygon;
  owner: DirectusClientUser;
  distance?: number; // Optional distance field for sorted results
  date_created: string;
  gear_images: Array<{
    id: string;
    gear_listings_id: string;
    directus_files_id: {
      id: string;
    };
  }>;
}

export interface DirectusRentalRequest {
  id: string;
  gear_listing: DirectusGearListing;
  renter: DirectusClientUser;
  owner: DirectusClientUser;
  start_date: string;
  end_date: string;
  status: string;
}

export interface DirectusReview {
  id: string;
  rental_request_id: DirectusRentalRequest;
  reviewer: DirectusClientUser;
  reviewed: DirectusClientUser;
  rating: number;
  comment: string;
  date_created: string;
}

export interface DirectusConversation {
  id: string;
  user_1: DirectusClientUser;
  user_2: DirectusClientUser;
  gear_listing: DirectusGearListing;
  last_change: string;
  // created_at: string;
}

export interface DirectusMessage {
  id: string;
  conversation: DirectusConversation;
  sender: DirectusClientUser;
  message: string;
  date_created: string;
}
export interface DirectusNotification {
  id: string;
  client: DirectusClientUser;
  conversation: DirectusConversation;
  request: DirectusRentalRequest;
  date_created: string;
  read: boolean;
}

interface DirectusResponse<T> {
  data: T[];
  meta?: {
    total_count?: number;
    filter_count?: number;
  };
}

interface MapboxGeocodingResponse {
  features: Array<{
    center: [number, number]; // [longitude, latitude]
    place_name: string;
    text: string;
    properties: any;
  }>;
}

// Initialize the Directus client with a manual interceptor for token refresh.
export const directus = createDirectus(DIRECTUS_URL)
  .with(authentication('json'))
  .with(rest({
    onResponse: async (response, options) => {
      const retry = () => options as any;

      // Only handle 401 errors for routes that are not the refresh route itself
      if (response.status === 401 && !(options as any).path?.includes('auth/refresh')) {
        // If a refresh isn't already in progress, start one.
        if (!refreshPromise) {
          console.log('Token expired, starting refresh...');
          refreshPromise = refreshAuth();
        }

        console.log('A request is waiting for the token to be refreshed...');
        const refreshed = await refreshPromise;
        refreshPromise = null; // Reset for the next time a refresh is needed.

        if (refreshed) {
          console.log('Token was refreshed, retrying original request...');
          // The token is now set on the client, so we can retry the original request.
          return directus.request(retry);
        } else {
          console.log('Token refresh failed, the original request will not be retried.');
        }
      }

      return response;
    },
  }));

// Create a public client instance for unauthenticated requests
export const publicClient = (() => {
  try {
    console.log('Initializing public Directus client...');
    const client = createDirectus(DIRECTUS_URL)
      .with(authentication('json'))
      .with(rest());
    console.log('Public Directus client initialized successfully');
    return client;
  } catch (error) {
    console.error('Error initializing public Directus client:', error);
    throw new Error('Failed to initialize public Directus client');
  }
})();

// Auth functions
export const loginUser = async (email: string, password: string) => {
  try {
    console.log('Attempting to login user...');

    // 1. Log in and get tokens using a direct fetch call.
    // NOTE: We are using a direct fetch call here instead of the Directus SDK's login()
    // function because the SDK was consistently failing to retrieve the refresh_token,
    // even with correct server permissions and client configuration. This direct
    // approach is proven to work reliably.
    const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        // We explicitly ask for the token in the response, although this is default
        mode: 'json' 
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      const errorMessage = json.errors?.[0]?.message || 'Login request failed';
      throw new Error(errorMessage);
    }
    
    const authResponse = json.data;
    console.log('Auth response from server:', authResponse);

    if (!authResponse.access_token || !authResponse.refresh_token) {
      console.log('Tokens received:', {
        hasAccessToken: !!authResponse.access_token,
        hasRefreshToken: !!authResponse.refresh_token
      });
      throw new Error("Login did not return valid tokens.");
    }

    // 2. Save tokens securely
    await setItem('auth_token', authResponse.access_token);
    await setItem('auth_refresh_token', authResponse.refresh_token);

    // 3. Set the token on the client for immediate use
    directus.setToken(authResponse.access_token);

    // 4. Fetch user data with the now-authenticated client
    console.log('Login successful, fetching user data...');
    const user = await directus.request(readMe());
    return user as DirectusUser;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const register = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  address: string
) => {
  try {
    // Geocode the address first

    // Create the user
    const userResponse = await directus.request(
      createUser({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        role: "5886bdc4-8845-49f5-9db7-9073390e1e77",
        location: address,
      })
    );

    // Login the user
    const loginResult = await loginUser(email, password);

    // Get the current user
    const currentUser = await directus.request(readMe());

    if (!currentUser?.id) {
      throw new Error("Failed to get current user after login");
    }

    // Create client for the user
    const clientResponse = await directus.request(
      createItem("clients", {
        user: currentUser.id,
      })
    );

    return {
      user: currentUser,
      client: clientResponse,
    };
  } catch (error) {
    console.error("Registration error:", error);
    throw new Error("Failed to register. Please try again.");
  }
};

export const logout = async () => {
  try {
    console.log("Starting logout process...");
    const refreshToken = await getItem('auth_refresh_token');

    if (refreshToken) {
      try {
        // Best practice: invalidate the refresh token on the server.
        await publicClient.request(sdkLogout(refreshToken));
        console.log("Server session successfully ended.");
      } catch (serverError) {
        // Don't block the logout if the server call fails.
        // The token might already be expired or invalid, which is fine.
        console.warn("Could not invalidate token on server during logout. This can happen if the token is already expired.", serverError);
      }
    }
  } catch(e) {
    console.error("Error during server logout, proceeding with local cleanup:", e);
  } finally {
    // Always clear local data to complete the logout on the client side.
    console.log("Clearing local tokens...");
    await deleteItem("auth_token");
    await deleteItem('auth_refresh_token');
    directus.setToken(null);
    console.log("Local logout successful.");
  }
};

export const refreshAuth = async () => {
  try {
    const refreshToken = await getItem('auth_refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available.');
    }

    const refreshResult = await directus.request(refresh('json', refreshToken));

    if (!refreshResult.access_token || !refreshResult.refresh_token) {
      throw new Error("Refresh did not return valid tokens.");
    }

    await setItem('auth_token', refreshResult.access_token);
    await setItem('auth_refresh_token', refreshResult.refresh_token);
    directus.setToken(refreshResult.access_token);

    console.log('Token refresh successful.');
    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    await logout(); // Log out user if refresh fails
    return false;
  }
};

export async function getCurrentUser(): Promise<DirectusUser> {
  try {
    const token = await getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    directus.setToken(token);

    console.log('Getting current user...');
    const response = await directus.request(readMe());
    console.log('Current user fetched successfully');

    return response as DirectusUser;
  } catch (error) {
    console.log("Error getting current user:", error);
    throw new Error("Failed to get current user");
  }
}

// Add this helper function to calculate the center point of a polygon
function calculatePolygonCenter(
  polygon: GeoJSONPolygon | null
): { lat: number; lng: number } | null {
  if (
    !polygon ||
    !polygon.coordinates ||
    !polygon.coordinates[0] ||
    polygon.coordinates[0].length === 0
  ) {
    console.warn("Invalid polygon data:", polygon);
    return null;
  }

  const coordinates = polygon.coordinates[0]; // Get the outer ring
  let sumLat = 0;
  let sumLng = 0;

  // Skip the last coordinate since it's the same as the first in a closed polygon
  for (let i = 0; i < coordinates.length - 1; i++) {
    sumLng += coordinates[i][0]; // longitude
    sumLat += coordinates[i][1]; // latitude
  }

  return {
    lat: sumLat / (coordinates.length - 1),
    lng: sumLng / (coordinates.length - 1),
  };
}

// Add this helper function to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// Modify the getGearListings function
export const getGearListings = async ({
  filters,
  page = 1,
  limit = 9,
  sort = "date_created_desc",
  maxRadius, // in kilometers
}: {
  filters?: {
    category?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    owner?: string;
  };
  page?: number;
  limit?: number;
  sort?: string;
  maxRadius?: number;
} = {}) => {
  try {
    const filter: any = {};
    if (filters?.category) filter.category = filters.category;
    if (filters?.condition) filter.condition = filters.condition;
    if (filters?.minPrice) filter.price = { _gte: filters.minPrice };
    if (filters?.maxPrice)
      filter.price = { ...filter.price, _lte: filters.maxPrice };
    if (filters?.owner) filter.owner = filters.owner;

    // Add search filter if provided
    if (filters?.search && filters.search.trim() !== "") {
      filter._or = [
        { title: { _contains: filters.search } },
        { description: { _contains: filters.search } },
      ];
    }

    let response = (await directus.request(
      readItems("gear_listings", {
        fields: [
          "*",
          "owner.*",
          "gear_images.*",
          "gear_images.directus_files_id.*",
        ],
        filter,
        page,
        limit,
        sort:
          sort === "date_created_desc"
            ? "-date_created"
            : sort === "date_created_asc"
              ? "date_created"
              : sort === "price_asc"
                ? "price"
                : "-price",
      })
    )) as DirectusGearListing[];

    console.log("Initial listings count:", response.length);

    // Try to get current user's location for distance-based sorting
    let userLocation = null;
    try {
      const currentUser = await directus.request(readMe());
      console.log("Current user:", currentUser);

      if (currentUser?.location) {
        console.log("User's location string:", currentUser.location);
        try {
          userLocation = await geocodeAddress(currentUser.location);
          console.log("Geocoded user location:", userLocation);
        } catch (geocodeError) {
          console.warn("Geocoding failed, proceeding without location-based sorting:", geocodeError);
          // Continue without location-based sorting
        }

        if (userLocation) {
          // Add distance to each listing
          response = await Promise.all(
            response.map(async (listing) => {
              try {
                console.log("Processing listing:", listing.id);
                console.log("Listing polygon:", listing.polygon);

                const center = calculatePolygonCenter(listing.polygon);
                console.log("Listing center:", center);

                let distance: number | undefined = undefined;
                if (center) {
                  distance = calculateDistance(
                    userLocation!.latitude,
                    userLocation!.longitude,
                    center.lat,
                    center.lng
                  );
                  console.log("Calculated distance:", distance, "km");
                } else {
                  console.warn(
                    `Could not calculate distance for listing ${listing.id} due to invalid polygon data`
                  );
                }

                return {
                  ...listing,
                  distance,
                };
              } catch (listingError) {
                console.error(`Error processing listing ${listing.id}:`, listingError);
                return {
                  ...listing,
                  distance: undefined,
                };
              }
            })
          );

          // Filter by radius if specified
          if (maxRadius) {
            console.log("Filtering by max radius:", maxRadius, "km");
            const beforeCount = response.length;
            response = response.filter((listing) => {
              // Keep listings with valid distances that are within radius
              // Put listings with invalid distances at the end
              if (listing.distance === undefined) return true;
              return listing.distance <= maxRadius;
            });
            console.log(
              "Filtered out",
              beforeCount - response.length,
              "listings"
            );
          }

          // Sort by distance, putting listings with no distance at the end
          console.log("Sorting by distance");
          response = response.sort((a, b) => {
            if (a.distance === undefined && b.distance === undefined) return 0;
            if (a.distance === undefined) return 1;
            if (b.distance === undefined) return -1;
            return a.distance - b.distance;
          });
        }
      } else {
        console.log("No user location available, using default sort");
      }
    } catch (error) {
      console.warn("Error processing user location, using default sort:", error);
    }

    // If no user location or geocoding failed, apply the requested sort
    if (!userLocation) {
      response = response.sort((a, b) => {
        switch (sort) {
          case "date_created_desc":
            return (
              new Date(b.date_created).getTime() -
              new Date(a.date_created).getTime()
            );
          case "date_created_asc":
            return (
              new Date(a.date_created).getTime() -
              new Date(b.date_created).getTime()
            );
          case "price_asc":
            return a.price - b.price;
          case "price_desc":
            return b.price - a.price;
          default:
            return 0;
        }
      });
    }

    console.log(
      "Final listings with distances:",
      response.map((l) => ({
        id: l.id,
        title: l.title,
        distance: l.distance,
      }))
    );

    return response;
  } catch (error) {
    console.error("Error fetching gear listings:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch gear listings: ${error.message}`);
    }
    throw new Error("Failed to fetch gear listings: Unknown error");
  }
};

export const getGearListing = async (id: string) => {
  try {
    const response = (await directus.request(
      readItem("gear_listings", id, {
        fields: [
          "*",
          "owner.*",
          "gear_images.*",
          "gear_images.directus_files_id.*",
        ],
      })
    )) as DirectusGearListing;

    return response;
  } catch (error) {
    console.error("Error getting gear listing:", error);
    throw error;
  }
};

export const uploadFile = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await directus.request(uploadFiles(formData));
    return response[0]; // Return the first uploaded file
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

export const createGearListing = async (data: {
  title: string;
  description: string;
  category: string;
  price: number;
  condition: string;
  ownerID: string;
  images: Array<File | {
    uri: string;
    type: string;
    name: string;
  }>;
}) => {
  try {
    // Check if we have a token
    const token = await directus.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // Get the current user to access their address
    const currentUser = await directus.request(readMe());
    if (!currentUser?.location) {
      throw new Error("User address not found");
    }

    // Use the user's address to generate coordinates (this point won't be stored)
    const locationData = await geocodeAddress(currentUser.location);

    console.log("currentUser location", currentUser.location);
    console.log("locationData", locationData);

    // Generate random irregular polygon that contains the point
    const polygon: GeoJSONPolygon = generateRandomPolygonAroundPoint(
      locationData.latitude,
      locationData.longitude
    );

    console.log("polygon", polygon);

    // First upload the images with progress tracking
    const totalImages = data.images.length;
    let uploadedImages = 0;

    const uploadedImageIds = await Promise.all(
      data.images.map(async (image, index) => {
        try {
          console.log(`Uploading image ${index + 1}/${totalImages}`);
          const formData = new FormData();
          
          // Handle both web File objects and mobile image objects
          if (image instanceof File) {
            formData.append("file", image);
          } else {
            formData.append("file", {
              uri: image.uri,
              type: image.type,
              name: image.name,
            } as any);
          }

          const response = await fetch(`${DIRECTUS_URL}/files`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Image upload failed:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            throw new Error(`Failed to upload image ${index + 1}: ${response.status} ${response.statusText}`);
          }

          const fileData = await response.json();
          uploadedImages++;
          console.log(`Progress: ${uploadedImages}/${totalImages} images uploaded`);
          
          return fileData.data.id;
        } catch (error) {
          console.error(`Error uploading image ${index + 1}:`, error);
          throw error;
        }
      })
    );

    console.log('Successfully uploaded all images');

    // Then create the gear listing with the uploaded image IDs and polygon
    const response = await directus.request(
      createItem("gear_listings", {
        title: data.title,
        description: data.description,
        category: data.category,
        price: data.price,
        condition: data.condition,
        polygon: polygon,
        owner: data.ownerID,
        gear_images: uploadedImageIds.map((fileId) => ({
          directus_files_id: fileId,
        })),
      })
    );

    return response;
  } catch (error) {
    console.error("Error creating gear listing:", error);
    if (error instanceof Error) {
      if (error.message === "Not authenticated") {
        throw new Error("You must be logged in to create a gear listing");
      }
    }
    throw error;
  }
};

// Helper function to generate a random irregular polygon containing a point
function generateRandomPolygonAroundPoint(
  centerLat: number,
  centerLng: number
): GeoJSONPolygon {
  const numPoints = Math.floor(Math.random() * 3) + 5; // Random number of points (5-7)
  const minRadius = 0.5; // Minimum radius in km
  const maxRadius = 2; // Maximum radius in km
  const points: [number, number][] = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;

    // Generate random radius between min and max
    const radius = minRadius + Math.random() * (maxRadius - minRadius);

    // Add some randomness to the angle to make the polygon irregular
    const randomAngleOffset = (Math.random() - 0.5) * (Math.PI / 6); // ±15 degrees
    const finalAngle = angle + randomAngleOffset;

    // Convert radius from km to degrees (approximate)
    const latRadius = radius / 111.32; // 1 degree of latitude is approximately 111.32 km
    const lngRadius = radius / (111.32 * Math.cos(centerLat * (Math.PI / 180))); // Adjust for latitude

    const lat = centerLat + latRadius * Math.sin(finalAngle);
    const lng = centerLng + lngRadius * Math.cos(finalAngle);

    points.push([lng, lat]); // GeoJSON uses [longitude, latitude] order
  }

  // Close the polygon by adding the first point again
  points.push(points[0]);

  return {
    type: "Polygon",
    coordinates: [points],
  };
}

// Rental request functions
export const createRentalRequest = async (requestData: {
  gear_listing: string;
  renter: string;
  owner: string;
  start_date: string;
  end_date: string;
}) => {
  try {
    const response = (await directus.request(
      createItem("rental_requests", requestData)
    )) as DirectusRentalRequest;
    try {
      // Create and publish notification
      await createAndPublishNotification({
        client: requestData.owner,
        request: response.id,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
    return response;
  } catch (error) {
    console.error("Error creating rental request:", error);
    throw error;
  }
};
export const getRentalRequest = async (id: string) => {
  try {
    const response = await directus.request(
      readItem("rental_requests", id, {
        fields: ["*", "gear_listing.*", "renter.*", "owner.*"],
      })
    );
    return response as DirectusRentalRequest;
  } catch (error) {
    console.error("Error getting rental request:", error);
    throw error;
  }
};

export const getRentalRequests = async (
  clientId: string,
  type: "owner" | "renter"
) => {
  try {
    console.log("type", type);
    console.log("clientId", clientId);

    const query = type === "owner" ? { owner: clientId } : { renter: clientId };

    console.log("query", query);

    const response = (await directus.request(
      readItems("rental_requests", {
        filter: query,
        fields: ["*", "gear_listing.*", "renter.*", "owner.*"],
        meta: "total_count",
      })
    )) as unknown as DirectusRentalRequest[];

    console.log("Rental requests backend response: ", response);
    return response;
  } catch (error) {
    console.error("Error fetching rental requests:", error);
    throw error;
  }
};

// Review functions
export const createReview = async (data: {
  rental_request: string;
  reviewer: string;
  reviewed: string;
  rating: number;
  comment: string;
}) => {
  try {
    const response = await directus.request(createItem("reviews", data));
    return response as DirectusReview;
  } catch (error) {
    console.error("Error creating review:", error);
    throw error;
  }
};

export const getReviews = async (clientId: string) => {
  try {
    const response = (await directus.request(
      readItems("reviews", {
        filter: { reviewed: clientId },
        fields: ["*", "reviewer.*"],
      })
    )) as unknown as DirectusReview[];

    return {
      response,
    };
  } catch (error) {
    console.error("Error fetching reviews:", error);
    throw error;
  }
};

export const getAssetURL = (fileId: string) => {
  return `${DIRECTUS_URL}/assets/${fileId}?width=800&height=600&fit=cover&quality=80`;
};

export const getClientWithUserID = async (userId: string) => {
  try {
    // Check if we have a token
    const token = await directus.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // First try to find an existing client
    const existingClients = await directus.request(
      readItems("clients", {
        filter: { user: userId },
        fields: ["*", "user.*"],
        limit: 1,
      })
    );

    if (existingClients && existingClients.length > 0) {
      return existingClients[0] as DirectusClientUser;
    }

    // If no client exists, create one
    const newClient = await directus.request(
      createItem("clients", {
        user: userId,
      })
    );

    return newClient as DirectusClientUser;
  } catch (error) {
    console.error("Error getting or creating client:", error);
    if (error instanceof Error) {
      if (error.message === "Not authenticated") {
        throw new Error("You must be logged in to create a gear listing");
      }
    }
    throw error;
  }
};

export const getClientWithClientID = async (clientId: string) => {
  try {
    // Check if we have a token
    const token = await directus.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    // First try to find an existing client
    const existingClients = await directus.request(
      readItems("clients", {
        filter: { id: clientId },
        fields: ["*", "user.*"],
        limit: 1,
      })
    );

    if (existingClients && existingClients.length > 0) {
      return existingClients[0] as DirectusClientUser;
    }

    // If no client exists, create one
    const newClient = await directus.request(
      createItem("clients", {
        id: clientId,
      })
    );

    return newClient as DirectusClientUser;
  } catch (error) {
    console.error("Error getting or creating client:", error);
    if (error instanceof Error) {
      if (error.message === "Not authenticated") {
        throw new Error("You must be logged in to create a gear listing");
      }
    }
    throw error;
  }
};

export const getCurrentClient = async () => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const client = await getClientWithUserID(currentUser.id);
    return client;
  } catch (error) {
    console.log("Error getting current client:", error);
    return null;
  }
};

export const getUser = async (userId: string) => {
  try {
    const response = await directus.request(
      readItem("directus_users", userId, {
        fields: [
          "id",
          "email",
          "first_name",
          "last_name",
          "role",
          "status",
          "created_at",
          "updated_at",
        ],
      })
    );
    console.log("user fetched on the getUser function", response);
    return response as DirectusUser;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("User not found:directus");
  }
};

export const updateRentalRequestStatus = async (
  requestId: string,
  status: "approved" | "rejected" | "completed"
) => {
  try {
    console.log('Updating rental request status:', { requestId, status });
    const response = await directus.request(
      updateItem("rental_requests", requestId, {
        status,
      })
    );
    console.log('Status update response:', response);
    
    try {
      const currentRequest = await getRentalRequest(requestId);
      console.log('Current request after update:', currentRequest);
      
      // Determine which user should receive the notification
      const recipientId =
        status === "approved" || status === "rejected"
          ? currentRequest.renter.id
          : currentRequest.owner.id;

      // Create and publish notification
      await createAndPublishNotification({
        client: recipientId,
        request: currentRequest.id,
      });
      console.log('Notification sent to:', recipientId);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
    return response as DirectusRentalRequest;
  } catch (error) {
    console.error("Error updating rental request status:", error);
    throw error;
  }
};

// Create a conversation
export const createConversation = async (data: {
  user_1: string;
  user_2: string;
  gear_listing: string;
}) => {
  try {
    const response = await directus.request(createItem("conversations", data));
    return response as DirectusConversation;
  } catch (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }
};

// Get conversations for a user
export const getUserConversations = async (userID: string) => {
  try {
    console.log("userID from backend", userID);
    const client = await getClientWithUserID(userID);
    console.log("client", client);
    const response = (await directus.request(
      readItems("conversations", {
        filter: {
          _or: [{ user_1: { id: client.id } }, { user_2: { id: client.id } }],
        },
        fields: [
          "*",
          "user_1.*",
          "user_2.*",
          "user_1.user.*",
          "user_2.user.*",
          "gear_listing.*",
        ],
        sort: ["-last_change"], // Sort by last change date
      })
    )) as DirectusConversation[];

    console.log("User conversations response:", response);
    return response;
  } catch (error) {
    console.error("Error getting user conversations:", error);
    throw error;
  }
};

// Get a specific conversation
export const getConversation = async (conversationId: string) => {
  try {
    const response = await directus.request(
      readItem("conversations", conversationId, {
        fields: [
          "*",
          "user_1.*",
          "user_2.*",
          "user_1.user.*",
          "user_2.user.*",
          "gear_listing.*",
        ],
      })
    );
    return response as DirectusConversation;
  } catch (error) {
    console.error("Error getting conversation:", error);
    throw error;
  }
};

// Get conversation messages
export const getConversationMessages = async (conversationID: string) => {
  try {
    const response = (await directus.request(
      readItems("messages", {
        filter: {
          conversation: conversationID,
        },
        fields: [
          "id", // Message ID
          "conversation.id", // Conversation ID
          "sender.id", // Sender ID
          "sender.user.id", // Sender's user ID
          "sender.user.first_name", // Sender's first name
          "sender.user.last_name", // Sender's last name
          "sender.user.email", // Sender's email
          "message", // Message content
          "date_created", // Message creation timestamp
        ],
        sort: ["date_created"],
      })
    )) as DirectusMessage[];
    console.log("Conversation messages response:", response);
    return response as DirectusMessage[];
  } catch (error) {
    console.error("Error getting conversation messages:", error);
    throw error;
  }
};

// Send a message
export const sendMessage = async (data: {
  conversation: string;
  sender: string;
  message: string;
}) => {
  try {
    const response = await directus.request(createItem("messages", data));
    try {
      // Update the last_change field in the conversation
      await directus.request(
        updateItem("conversations", data.conversation, {
          last_change: new Date().toISOString(),
        })
      );
      console.log("Last change updated successfully");
    } catch (error) {
      console.error("Error editing last_change:", error);
    }
    try {
      const currentConversation = await getConversation(data.conversation);
      // Get the recipient ID (the other user in the conversation)
      const recipientId =
        data.sender === currentConversation.user_1.id
          ? currentConversation.user_2.id
          : currentConversation.user_1.id;

      // Create and publish notification
      await createAndPublishNotification({
        client: recipientId,
        conversation: currentConversation.id,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
    return response as DirectusMessage;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  } finally {
  }
};

// Find existing conversation between users for a specific gear listing
export const findConversation = async (
  user1Id: string,
  user2Id: string,
  gearListingId: string
) => {
  try {
    const response = await directus.request(
      readItems("conversations", {
        filter: {
          _and: [
            {
              _or: [
                { user_1: user1Id, user_2: user2Id },
                { user_1: user2Id, user_2: user1Id },
              ],
            },
            { gear_listing: gearListingId },
          ],
        },
        limit: 1,
      })
    );

    return response && response.length > 0
      ? (response[0] as DirectusConversation)
      : null;
  } catch (error) {
    console.error("Error finding conversation:", error);
    throw error;
  }
};

export const getNotifications = async (clientID: string) => {
  try {
    // First get the basic notifications
    const notifications = (await directus.request(
      readItems("notifications", {
        filter: {
          client: clientID,
          read: { _eq: false }, // Only fetch unread notifications
        },
        fields: ["*", "client.*"],
        sort: ["-date_created"],
      })
    )) as DirectusNotification[];
    
    // Then batch fetch the related conversations and requests with permissions issue tracking
    const relationshipPromises = {
      conversations: [] as Promise<any>[],
      requests: [] as Promise<any>[],
    };
    
    const relationshipResults = {
      conversations: {} as Record<string, any>,
      requests: {} as Record<string, any>,
    };
    
    // Collect conversation and request IDs and prepare batch fetches
    for (const notification of notifications) {
      if (notification.conversation) {
        const id = String(notification.conversation);
        relationshipPromises.conversations.push(
          directus.request(
            readItem("conversations", id, {
              fields: ["*", "user_1.*", "user_2.*", "user_1.user.*", "user_2.user.*", "gear_listing.*"],
            })
          )
          .then(data => {
            relationshipResults.conversations[id] = data;
          })
          .catch(err => {
            console.error(`Failed to fetch conversation ${id}:`, err);
            relationshipResults.conversations[id] = { id, error: true };
          })
        );
      }
      
      if (notification.request) {
        const id = String(notification.request);
        relationshipPromises.requests.push(
          directus.request(
            readItem("rental_requests", id, {
              fields: ["*", "gear_listing.*", "renter.*", "owner.*"],
            })
          )
          .then(data => {
            relationshipResults.requests[id] = data;
          })
          .catch(err => {
            console.error(`Failed to fetch request ${id}:`, err);
            relationshipResults.requests[id] = { id, error: true };
          })
        );
      }
    }
    
    // Wait for all promises to settle (regardless of success/failure)
    await Promise.allSettled([
      ...relationshipPromises.conversations,
      ...relationshipPromises.requests
    ]);
    
    // Merge the results
    const enrichedNotifications = notifications.map(notification => {
      const conversationId = notification.conversation ? String(notification.conversation) : null;
      const requestId = notification.request ? String(notification.request) : null;
      
      return {
        ...notification,
        conversation: conversationId ? relationshipResults.conversations[conversationId] || null : null,
        request: requestId ? relationshipResults.requests[requestId] || null : null,
      };
    });
    
    //console.log("Enriched notifications:", enrichedNotifications);
    return enrichedNotifications;
  } catch (error) {
    console.error("Error in notification processing:", error);
    return [];
  }
};
export const getMessageNotifications = async (clientID: string) => {
  try{
    const allCLientNotifictions = await getNotifications(clientID);
    const messageNotifications = allCLientNotifictions.filter(
      (notification) => notification.conversation)
    return messageNotifications;
    } catch (error) {
    console.error("Error in notification processing:", error);
    return [];
  }
};

export const markNotificationAsRead = async (
  notificationID: string,
  isRead: boolean = true
) => {
  try {
    const response = await directus.request(
      updateItem("notifications", notificationID, {
        read: isRead,
      })
    );
    return response;
  } catch (error) {
    console.error(
      "Error updating notification read status (directus.ts):",
      error
    );
    throw error;
  }
};
// function to create and publish notifications
export const createAndPublishNotification = async (data: {
  client: string;
  conversation?: string | null;
  request?: string | null;
}) => {
  try {
    // Create the notification in Directus
    const response = await directus.request(
      createItem("notifications", {
        client: data.client,
        conversation: data.conversation || null,
        request: data.request || null,
        read: false,
      })
    );

    // Publish to Ably channel for real-time updates
    await publishMessage(`private-chat:notifications:${data.client}`, {
      id: await Crypto.randomUUID(),
      conversationId: `private-chat:notifications:${data.client}`,
      senderId: "system",
      message: "new_notification",
      timestamp: new Date().toISOString(),
    });

    return response;
  } catch (error) {
    console.error("Error creating and publishing notification:", error);
    throw error;
  }
};

// Update the geocodeAddress function to use Mapbox
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number; radius: number }> {
  try {
    const data = await geocode(address);
    if (!data.features || data.features.length === 0) {
      throw new Error('No results found');
    }
    const [longitude, latitude] = data.features[0].center;
    return {
      latitude,
      longitude,
      radius: 5, // or whatever default you want
    };
  } catch (error) {
    console.log('Geocoding error:', error);
    throw error;
  }
}
