import { useState, useEffect } from "react";
import { getRentalRequests, DirectusRentalRequest } from "../lib/directus";

export const useRentalRequests = (
  clientId: string,
  role: "owner" | "renter"
) => {
  const [requests, setRequests] = useState<DirectusRentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await getRentalRequests(clientId, role);
      console.log("Response in hook:", response);
      setRequests(response || []);
    } catch (err) {
      console.error("Error in useRentalRequests:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchRequests();
    }
  }, [clientId, role]);

  const updateRequestStatus = (
    requestId: string,
    newStatus: "approved" | "rejected" | "completed"
  ) => {
    setRequests((prevRequests) =>
      prevRequests.map((request) =>
        request.id === requestId ? { ...request, status: newStatus } : request
      )
    );
  };

  return {
    requests,
    loading,
    error,
    updateRequestStatus,
    refetchRequests: fetchRequests,
  };
};
