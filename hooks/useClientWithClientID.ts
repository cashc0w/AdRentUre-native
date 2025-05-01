import { useState, useEffect } from "react";
import { getClientWithClientID } from "../lib/directus";
import type { DirectusClientUser } from "../lib/directus";

export function useClientWithClientID(clientID: string) {
  const [client, setClient] = useState<DirectusClientUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchClient() {
      try {
        setLoading(true);

        // First get the client ID for this user
        const client = await getClientWithClientID(clientID);
        if (!client) {
          throw new Error("Could not get client for user");
        }

        setClient(client);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    if (clientID) {
      fetchClient();
    }
  }, [clientID]);

  return {
    client,
    loading,
    error,
  };
}
