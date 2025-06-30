import { useState, useEffect } from "react";
import { getUserConversations } from "../lib/directus";
import type { DirectusConversation } from "../lib/directus";

export function useUserConversations(userID: string, reload: boolean) {
  const [conversations, setConversations] = useState<DirectusConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUserConversations() {
      try {
        setLoading(true);

        const userConversations = await getUserConversations(userID);
        setConversations(userConversations);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    if (userID) {
      fetchUserConversations();
    }
  }, [userID, reload]);

  return {
    conversations,
    loading,
    error,
  };
}
