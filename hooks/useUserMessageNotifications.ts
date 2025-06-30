import { useState, useEffect } from "react";
import { getMessageNotifications, DirectusNotification } from "../lib/directus";

export function useUserMessageNotifications(clientID: string, reload: boolean) {
  const [notifications, setNotifications] = useState<DirectusNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUserMessageNotifications() {
      try {
        setLoading(true);
        console.log("Hook: Fetching notifications for clientID:", clientID);
        const messageNotifications = await getMessageNotifications(clientID);
        console.log("Hook: Received notifications:", messageNotifications);
        console.log("Hook: Notifications count:", messageNotifications?.length || 0);
        setNotifications(messageNotifications);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    if (clientID) {
      fetchUserMessageNotifications();
    }
  }, [clientID, reload]);

  return {
    notifications,
    loading,
    error,
  };
}
