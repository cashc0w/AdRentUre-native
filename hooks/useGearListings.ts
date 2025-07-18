import { useState, useEffect } from "react";
import { getGearListings, directus, type DirectusGearListing, type DirectusUser, checkAvailability } from "../lib/directus";
import { readItems } from "@directus/sdk";
import { useAuth } from "../contexts/AuthContext";

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
    startDate?: Date | null;
    endDate?: Date | null;
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
  const { user } = useAuth();
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
        
        const response = await getGearListings(
          {
            filters,
            page,
            limit: itemsPerPage,
            sort,
            maxRadius,
          },
          user as DirectusUser | null // Pass the user from context to the function
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

        if (filters?.startDate && filters?.endDate) {
          const availabilityChecks = await Promise.all(
            filteredListings.map(l => 
              checkAvailability(l.id, filters.startDate!.toISOString(), filters.endDate!.toISOString())
            )
          );
          filteredListings = filteredListings.filter((_, index) => availabilityChecks[index]);
        }


        setListings(filteredListings);
        setTotalItems(filteredListings.length);
        setTotalPages(Math.ceil(filteredListings.length / itemsPerPage));
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, [filters, page, itemsPerPage, sort, maxRadius, userLocation, enabled, user]);

  return {
    listings,
    loading,
    error,
    totalPages,
    totalItems,
    currentPage: page,
  };
}

