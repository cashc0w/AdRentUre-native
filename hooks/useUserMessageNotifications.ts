import { useState, useEffect } from "react";
import { getMessageNotifications,  } from "../lib/directus";
import { DirectusNotification } from "@directus/sdk";

export function useUserMessageNotifications(userID: string, reload: boolean) {
  const [notifications, setNotifications] = useState<DirectusNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUserMessageNotifications() {
      try {
        setLoading(true);

        const messageNotifications = await getMessageNotifications(userID);
        setNotifications(messageNotifications);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    if (userID) {
      fetchUserMessageNotifications();
    }
  }, [userID, reload]);

  return {
    notifications,
    loading,
    error,
  };
}
