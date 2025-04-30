import { useState } from "react";
import { updateRentalRequestStatus } from "../lib/directus";

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
      console.log('useUpdateRentalStatus: Starting status update', { requestId, status });
      setLoading(true);
      setError(null);
      console.log('useUpdateRentalStatus: Calling updateRentalRequestStatus');
      await updateRentalRequestStatus(requestId, status);
      console.log('useUpdateRentalStatus: Status update successful');
      options.onSuccess?.();
    } catch (err) {
      console.error('useUpdateRentalStatus: Error updating status:', err);
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
