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
  createItems,
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
  bundle: DirectusBundle;
  renter: DirectusClientUser;
  owner: DirectusClientUser;
  start_date: string;
  end_date: string;
  status: string;
  handover_token?: string;
  handover_token_expires_at?: string;
}

export interface DirectusBundle {
  id: string;
  renter: DirectusClientUser;
  owner: DirectusClientUser;
  gear_listings: DirectusGearListing[];
  start_date?: string;
  end_date?: string;
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
  rental_request: DirectusRentalRequest;
  //gear_listing: DirectusGearListing;
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
      // If the request is for refreshing the token, we don't need to intercept it
      if ((options as any).path?.includes('auth/refresh')) {
        return response;
      }

      // If the request failed with a 401 status, it means the token has expired
      if (response.status === 401) {
        // If there's no refresh promise, create one.
        // This is the "lock" that prevents multiple refresh requests.
        if (!refreshPromise) {
          console.log('Token expired, starting refresh...');
          refreshPromise = refreshAuth().finally(() => {
            // Once the refresh attempt is complete (success or failure),
            // reset the promise so the next failed request can trigger a new refresh.
            refreshPromise = null;
          });
        }

        console.log('A request is waiting for the token to be refreshed...');

        try {
          const refreshed = await refreshPromise;

          if (refreshed) {
            console.log('Token was refreshed, retrying original request...');
            // The token is now set on the client, so we can retry the original request.
            return directus.request(options as any);
          }
        } catch (e) {
          console.error('An error occurred during token refresh, original request will fail.', e);
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
  } catch (e) {
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
export const getGearListings = async (
  {
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
  },
  currentUser: DirectusUser | null = null // Accept pre-fetched user
) => {
  try {
    let userLocation = null;
    if (currentUser?.location) {
      try {
        userLocation = await geocodeAddress(currentUser.location);
      } catch (e) {
        console.warn("Could not geocode user address", e);
      }
    }

    const client = currentUser ? directus : publicClient;

    const filter: any = {};
    if (filters?.category) filter.category = { _eq: filters.category };
    if (filters?.condition) filter.condition = { _eq: filters.condition };
    if (filters?.minPrice) filter.price = { _gte: filters.minPrice };
    if (filters?.maxPrice)
      filter.price = { ...filter.price, _lte: filters.maxPrice };
    if (filters?.owner) filter.owner = { _eq: filters.owner };

    // Add search filter if provided
    if (filters?.search && filters.search.trim() !== "") {
      filter._or = [
        { title: { _contains: filters.search } },
        { description: { _contains: filters.search } },
      ];
    }

    let response = (await client.request(
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

    // If we have a user location, calculate distances and sort
    if (userLocation) {
      // Add distance to each listing
      response = response.map((listing) => {
        const center = calculatePolygonCenter(listing.polygon);
        let distance: number | undefined = undefined;
        if (center) {
          distance = calculateDistance(
            userLocation!.latitude,
            userLocation!.longitude,
            center.lat,
            center.lng
          );
        }
        return { ...listing, distance };
      });

      // Filter by radius if specified
      if (maxRadius) {
        response = response.filter(
          (listing) => listing.distance !== undefined && listing.distance <= maxRadius
        );
      }

      // Sort by distance, putting listings with no distance at the end
      response.sort((a, b) => {
        if (a.distance === undefined && b.distance === undefined) return 0;
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });
    } else {
      // Fallback to default sort if no user location
      response.sort((a, b) => {
        switch (sort) {
          case "date_created_desc":
            return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
          case "date_created_asc":
            return new Date(a.date_created).getTime() - new Date(b.date_created).getTime();
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
          // The previous `image instanceof File` check could cause a ReferenceError on native.
          // Checking for the 'uri' property is a safer way to distinguish the image types.
          if ("uri" in image) {
            formData.append("file", {
              uri: image.uri,
              type: image.type,
              name: image.name,
            } as any);
          } else {
            formData.append("file", image as File);
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


export const createBundle = async (data: {
  renter: string;
  owner: string;
  start_date?: string;
  end_date?: string;
}) => {
  try {
    const response = await directus.request(createItem("bundles", data));
    return response as DirectusBundle;
  } catch (error) {
    console.error("Error creating bundle:", error);
    throw error;
  }
};

export const getBundles = async (clientId: string) => {
  try {
    const response = await directus.request(readItems("bundles", { 
      filter: { renter: { _eq: clientId } },
      fields: [
        '*', 
        'owner.*', 
        'gear_listings.gear_listings_id.*',
        'gear_listings.gear_listings_id.gear_images.directus_files_id.*'
      ]
    }));
    return response as DirectusBundle[];
  } catch (error) {
    console.error("Error getting bundles:", error);
    throw error;
  }
};

export const addGearToBundle = async (bundleId: string, gearId: string) => {
  try {
    // Use the SDK's relational update feature to create the link.
    // This is more reliable than manually creating the junction item.
    await directus.request(updateItem('bundles', bundleId, {
      gear_listings: {
        create: [{
          gear_listings_id: gearId
        }]
      }
    }));

    // Re-fetch the updated bundle to ensure all relations are populated.
    const updatedBundle = await directus.request(readItem('bundles', bundleId, {
      fields: [
        '*', 
        'owner.*', 
        'gear_listings.gear_listings_id.*',
        'gear_listings.gear_listings_id.gear_images.directus_files_id.*'
      ]
    }));

    return updatedBundle as DirectusBundle;
  } catch (error) {
    console.error('Error adding gear to bundle:', error);
    throw error;
  }
};

export const removeGearFromBundle = async (bundleId: string, gearId: string) => {
  try {
    // 1. Find the specific link in the junction table to remove
    const junctionItems = await directus.request(readItems('bundles_gear_listings', {
      filter: {
        _and: [
          { bundles_id: { _eq: bundleId } },
          { gear_listings_id: { _eq: gearId } }
        ]
      },
      limit: 1 // We only need to find one to delete it
    }));

    if (!junctionItems || junctionItems.length === 0) {
      console.warn('Attempted to remove an item that was not in the bundle.');
      return { bundleDeleted: false };
    }

    const junctionItemId = junctionItems[0].id;

    // 2. Delete the link item
    await directus.request(deleteDirectusItem('bundles_gear_listings', junctionItemId));

    // 3. Check the bundle to see if it's now empty
    const updatedBundle = await directus.request(readItem('bundles', bundleId, {
      fields: ['gear_listings']
    }));

    // 4. If the bundle has no more linked items, delete the bundle itself
    if (updatedBundle && updatedBundle.gear_listings.length === 0) {
      await directus.request(deleteDirectusItem('bundles', bundleId));
      return { bundleDeleted: true };
    }

    return { bundleDeleted: false };

  } catch (error) {
    console.error('Error removing gear from bundle:', error);
    throw error;
  }
};

export const removeGearFromPendingRequest = async (requestId: string, bundleId: string, gearId: string) => {
  try {
    // 1. Read the bundle to count how many items it has.
    const bundle = await directus.request(readItem('bundles', bundleId, { fields: ['gear_listings'] }));

    if (bundle && bundle.gear_listings && bundle.gear_listings.length > 1) {
      // 2a. If more than one item, just remove the specific gear link.
      const junctionItems = await directus.request(readItems('bundles_gear_listings', {
        filter: {
          _and: [{ bundles_id: { _eq: bundleId } }, { gear_listings_id: { _eq: gearId } }]
        },
        limit: 1
      }));
      if (junctionItems.length > 0) {
        await directus.request(deleteDirectusItem('bundles_gear_listings', junctionItems[0].id));
      }
    } else {
      // 2b. If it's the last item, cancel the entire rental request.
      await directus.request(updateItem('rental_requests', requestId, { status: 'cancelled' }));
    }
  } catch (error) {
    console.error('Error removing gear from pending request:', error);
    throw error;
  }
};

export const createBundleWithListings = async (data: {
  renter: string;
  owner: string;
  startDate: string;
  endDate: string;
  gearIds: string[];
}) => {
  try {
    // 1. Create the parent bundle with dates
    const newBundle = await createBundle({
      renter: data.renter,
      owner: data.owner,
      start_date: data.startDate,
      end_date: data.endDate,
    });

    if (!newBundle?.id) {
      throw new Error("Failed to create bundle shell.");
    }

    // 2. Prepare the junction table entries for all selected gear
    const junctionItems = data.gearIds.map(gearId => ({
      bundles_id: newBundle.id,
      gear_listings_id: gearId
    }));

    // 3. Create all junction items in a single batch request
    if (junctionItems.length > 0) {
      await directus.request(createItems('bundles_gear_listings', junctionItems));
    }

    return newBundle;
  } catch (error) {
    console.error('Error creating bundle with listings:', error);
    throw error;
  }
};

export const checkAvailability = async (gearId: string, startDate: string, endDate: string): Promise<boolean> => {
  try {
    // Step 1: Find all bundles that contain the gear item.
    const bundlesWithGear = await directus.request(readItems('bundles_gear_listings', {
      filter: { gear_listings_id: { _eq: gearId } },
      fields: ['bundles_id']
    }));

    const bundleIds = bundlesWithGear.map(item => item.bundles_id);

    if (bundleIds.length === 0) {
      return true; // If no bundles contain this gear, it's definitely available.
    }

    // Step 2: Check if any of those bundles are in an active, overlapping rental request.
    const overlappingRequestsFilter = {
      _and: [
        { bundle: { _in: bundleIds } },
        { status: { _in: ['approved', 'ongoing'] } },
        {
          _and: [
            { start_date: { _lte: endDate } },
            { end_date: { _gte: startDate } }
          ]
        }
      ]
    };
    
    const overlappingRequests = await directus.request(readItems('rental_requests', {
      filter: overlappingRequestsFilter,
      limit: 1
    }));

    return overlappingRequests.length === 0;

  } catch (error) {
    console.error('Error checking availability:', error);
    return false;
  }
};

// Rental request functions
export const createRentalRequest = async (requestData: {
  bundle: string;
  renter: string;
  owner: string;
  start_date: string;
  end_date: string;
}) => {
  try {
    const response = (await directus.request(
      createItem("rental_requests", requestData)
    )) as DirectusRentalRequest;
    // try {
    //   // Create and publish notification
    //   await createAndPublishNotification({
    //     client: requestData.owner,
    //     request: response.id,
    //   });
    // } catch (error) {
    //   console.error("Error sending notification:", error);
    // }
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
        fields: [
          "*",
          "renter.*",
          "owner.*",
          "bundle.*",
          "bundle.owner.*",
          "bundle.gear_listings.gear_listings_id.*",
          "bundle.gear_listings.gear_listings_id.gear_images.directus_files_id.*"
        ],
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

export const generateHandoverToken = async (requestId: string) => {
  try {
    const token = await Crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // Token expires in 5 minutes

    await directus.request(
      updateItem("rental_requests", requestId, {
        handover_token: token,
        handover_token_expires_at: expiresAt.toISOString(),
      })
    );

    return token;
  } catch (error) {
    console.error("Error generating handover token:", error);
    throw new Error("Could not generate QR code token.");
  }
};


export const updateRentalRequestStatus = async (
  requestId: string,
  status: "approved" | "rejected" | "completed" | "ongoing",
  token?: string
) => {
  try {
    const correspondingConversation = await getConversationByRentalRequest(requestId);

    // For "approved" and "rejected", no token is needed as it's a manual owner action.
    if (status === "approved" || status === "rejected") {
      const response = await directus.request(
        updateItem("rental_requests", requestId, {
          status,
        })
      );
      // Notification logic for approval/rejection
      try {
        if (correspondingConversation) {

          await sendMessage({
            conversation: correspondingConversation.id,
            sender: correspondingConversation.user_2.id,
            message: `This rental request has been marked as ${status}.`,
          });
          console.log('Message sent in conversation:', correspondingConversation.id);
        } else {
          console.warn('No conversation found for rental request:', requestId);
        }
      } catch (error) {
        console.error("Error sending notification after status update:", error);
      }
      return response as DirectusRentalRequest;
    }

    // For "ongoing" or "completed", a token is required.
    if (!token) {
      throw new Error("A QR code token is required for this action.");
    }

    console.log('Updating rental request status via QR code:', { requestId, status, token });

    // 1. Get the current user and the rental request details in one go
    const [scanner, request] = await Promise.all([
      directus.request(readMe()),
      directus.request(readItem("rental_requests", requestId, { fields: ["*", "renter.*", "owner.*"] })) as Promise<DirectusRentalRequest & { handover_token?: string; handover_token_expires_at?: string }>
    ]);

    // 2. Authorize the scanner
    const scannerClient = await getClientWithUserID(scanner.id);
    const isPickup = status === "ongoing";
    const isReturn = status === "completed";

    if (isPickup && scannerClient.id !== request.renter.id) {
      throw new Error("Only the renter can scan the pickup code.");
    }
    if (isReturn && scannerClient.id !== request.owner.id) {
      throw new Error("Only the owner can scan the return code.");
    }

    // 3. Validate the token
    if (!request.handover_token || request.handover_token !== token) {
      throw new Error("Invalid or expired QR code. Please try again.");
    }
    if (!request.handover_token_expires_at || new Date() > new Date(request.handover_token_expires_at)) {
      throw new Error("Expired QR code. Please generate a new one.");
    }

    // 4. Update the status and invalidate the token in a single operation
    const response = await directus.request(
      updateItem("rental_requests", requestId, {
        status,
        handover_token: null, // Invalidate the token
        handover_token_expires_at: null,
      })
    );
    console.log('Status update response:', response);

    // 5. Send message to the other party
    try {
      if (correspondingConversation) {
        await sendMessage({
          conversation: correspondingConversation.id,
          sender: scannerClient.id,
          message: `This rental request has been marked as ${status}.`,
        });
        console.log('Message sent in conversation:', correspondingConversation.id);
      } else {
        console.warn('No conversation found for rental request:', requestId);
      }
    } catch (error) {
      console.error("Error sending notification after status update:", error);
    }

    return response as DirectusRentalRequest;
  } catch (error) {
    console.error("Error updating rental request status:", error);
    // Forward the specific error message from the validation checks
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to update rental status.");
  }
};

// Create a conversation
export const createConversation = async (data: {
  user_1: string;
  user_2: string;
  rental_request: string;
  //gear_listing: string;
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
          "rental_request.*",
          "rental_request.bundle.gear_listings.gear_listings_id.*",
          "rental_request.bundle.gear_listings.gear_listings_id.gear_images.directus_files_id.*"
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
          "rental_request.*",
          "rental_request.bundle.gear_listings.gear_listings_id.*",
          "rental_request.bundle.gear_listings.gear_listings_id.gear_images.directus_files_id.*"
        ],
      })
    );
    return response as DirectusConversation;
  } catch (error) {
    console.error("Error getting conversation:", error);
    throw error;
  }
};
export const getConversationByRentalRequest = async (
  rentalRequestId: string
) => {
  try {
    const response = await directus.request(
      readItems("conversations", {
        filter: { rental_request: rentalRequestId },
        fields: [
          "*",
          "user_1.*",
          "user_2.*",
          "user_1.user.*",
          "user_2.user.*",
          "rental_request.*",
          //"gear_listing.*",
        ],
        limit: 1, // Assuming only one conversation per rental request
      })
    );
    return response && response.length > 0
      ? (response[0] as DirectusConversation)
      : null;
  } catch (error) {
    console.error("Error getting conversation by rental request:", error);
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
              fields: ["*", "user_1.*", "user_2.*", "user_1.user.*", "user_2.user.*", "rental_request.*",
                //"gear_listing.*"
              ],
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
    // return [];
    // Instead of returning empty array, throw the error so it can be handled properly
    throw new Error(`Failed to fetch notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);

  }
};
export const getMessageNotifications = async (clientID: string) => {
  try {
    const allCLientNotifictions = await getNotifications(clientID);
    const messageNotifications = allCLientNotifictions.filter(
      (notification) => notification.conversation);
    console.log("About to return messageNotifications:", messageNotifications);
    console.log("Type of messageNotifications:", typeof messageNotifications);
    console.log("Is array:", Array.isArray(messageNotifications));

    return messageNotifications as DirectusNotification[];
  } catch (error) {
    console.error("Error in message notification processing:", error);
    //return [];
    // Instead of returning empty array, throw the error so it can be handled properly
    throw new Error(`Failed to fetch notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);

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
