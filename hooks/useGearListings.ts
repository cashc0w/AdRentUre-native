import { useState, useEffect } from "react";
import { getGearListings, directus, type DirectusGearListing, type DirectusUser } from "../lib/directus";
import { readMe } from "@directus/sdk";

export type SortOption =
  | "price_asc"
  | "price_desc"
  | "date_created_desc"
  | "date_created_asc";

interface UseGearListingsOptions {
  filters?: {
    category?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    owner?: string;
    search?: string;
  };
  page?: number;
  itemsPerPage?: number;
  sort?: SortOption;
  maxRadius?: number;
  userLocation?: string;
  enabled?: boolean;
}

export function useGearListings({
  filters,
  page = 1,
  itemsPerPage = 9,
  sort = "date_created_desc",
  maxRadius,
  userLocation,
  enabled = true,
}: UseGearListingsOptions = {}) {
  const [listings, setListings] = useState<DirectusGearListing[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    async function fetchListings() {
      if (!enabled) {
        setListings([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // First, get the current user. This will handle auth state.
        let currentUser: DirectusUser | null = null;
        try {
          currentUser = (await directus.request(readMe())) as DirectusUser;
        } catch (e) {
          // Ignore error, currentUser will be null for logged-out users
        }
        
        const response = await getGearListings(
          {
            filters,
            page,
            limit: itemsPerPage,
            sort,
            maxRadius,
          },
          currentUser // Pass the user to the function
        );

        // If we have a search term, filter the listings client-side
        let filteredListings = response;

        if (filters?.search && filters.search.trim() !== "") {
          const searchTerm = filters.search.toLowerCase().trim();
          filteredListings = response.filter(
            (listing) =>
              listing.title.toLowerCase().includes(searchTerm) ||
              listing.description.toLowerCase().includes(searchTerm)
          );
        }

        setListings(response);
        setTotalItems(response.length);
        setTotalPages(Math.ceil(response.length / itemsPerPage));
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, [filters, page, itemsPerPage, sort, maxRadius, userLocation, enabled]);

  return {
    listings,
    loading,
    error,
    totalPages,
    totalItems,
    currentPage: page,
  };
}

