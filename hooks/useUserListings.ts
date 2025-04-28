import { useState, useEffect } from "react";
import { getGearListings, getOrCreateClient } from "../lib/directus";
import type { DirectusGearListing } from "../lib/directus";

export function useUserListings(userId: string) {
  const [listings, setListings] = useState<DirectusGearListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchListings() {
      try {
        setLoading(true);

        // First get the client for this user
        const client = await getOrCreateClient(userId);
        if (!client) {
          throw new Error("Could not get client for user");
        }

        // Then fetch listings using the client ID
        const response = await getGearListings({
          filters: {
            owner: client.id,
          },
        });
        setListings(response);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchListings();
    }
  }, [userId]);

  return {
    listings,
    loading,
    error,
  };
}
