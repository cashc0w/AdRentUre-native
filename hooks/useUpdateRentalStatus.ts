import { useState } from "react";
import { updateRentalRequestStatus } from "@/lib/directus";

interface UseUpdateRentalStatusOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useUpdateRentalStatus(
  options: UseUpdateRentalStatusOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateStatus = async (
    requestId: string,
    status: "approved" | "rejected" | "completed"
  ) => {
    try {
      setLoading(true);
      setError(null);
      await updateRentalRequestStatus(requestId, status);
      options.onSuccess?.();
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return {
    updateStatus,
    loading,
    error,
  };
}
