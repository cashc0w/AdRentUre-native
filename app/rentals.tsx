import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Pressable,
  Platform,
  Alert,
  TextInput,
} from "react-native";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  DirectusRentalRequest,
  getRentalRequests,
  getAssetURL,
} from "../lib/directus";
import { useClientWithUserID } from "../hooks/useClientWithUserID";
import { useRouter } from "expo-router";
import { useUpdateRentalStatus } from "../hooks/useUpdateRentalStatus";
import { useCreateReview } from "../hooks/useCreateReview";
import StarRating from "../components/StarRating";

// Define statuses for ongoing and completed requests
const ONGOING_STATUSES = ["pending", "approved", "ongoing"];
const COMPLETED_STATUSES = ["completed", "rejected", "cancelled"];

// A "dumb" component for rendering a single request card
const RequestCard = ({
  request,
  role,
  onStatusChange,
  updateLoading,
  onSubmitReview,
  reviewLoading,
}: {
  request: DirectusRentalRequest;
  role: "owner" | "renter";
  onStatusChange: (
    requestId: string,
    status: "approved" | "rejected" | "completed"
  ) => void;
  updateLoading: boolean;
  onSubmitReview: (
    request: DirectusRentalRequest,
    reviewData: { rating: number; comment: string }
  ) => void;
  reviewLoading: boolean;
}) => {
  const router = useRouter();
  const isCompleted = COMPLETED_STATUSES.includes(request.status);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: "" });

  // Defensive check for missing data - we primarily need the gear listing.
  if (!request.gear_listing?.id) {
    return (
      <View className="bg-white rounded-xl shadow-md overflow-hidden mb-6 p-4">
        <Text className="text-red-500">
          This rental request has incomplete gear data and cannot be displayed.
        </Text>
      </View>
    );
  }

  return (
    <View
      className={`bg-white rounded-xl shadow-md overflow-hidden mb-6 ${
        isCompleted ? "opacity-80" : ""
      }`}
    >
      <Pressable onPress={() => router.push(`/gear/${request.gear_listing.id}`)}>
        <View className="flex-row">
          {/* Image */}
          {request.gear_listing.gear_images &&
          request.gear_listing.gear_images.length > 0 ? (
            <Image
              source={{
                uri: getAssetURL(
                  request.gear_listing.gear_images[0].directus_files_id.id
                ),
              }}
              className={`${isCompleted ? "w-24 h-24" : "w-32 h-full"}`}
            />
          ) : (
            <View
              className={`bg-gray-200 flex items-center justify-center ${
                isCompleted ? "w-24 h-24" : "w-32 h-full"
              }`}
            >
              <Text className="text-gray-500 text-xs">No Image</Text>
            </View>
          )}

          {/* Main Info */}
          <View className="p-4 flex-1">
            <Text
              className={`font-bold ${
                isCompleted ? "text-base" : "text-xl"
              } text-gray-900`}
            >
              {request.gear_listing.title}
            </Text>
            <Text className="text-sm text-gray-600">
              {new Date(request.start_date).toLocaleDateString()} -{" "}
              {new Date(request.end_date).toLocaleDateString()}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-sm text-gray-600">
                {role === "owner" ? "Renter:" : "Owner:"}{" "}
              </Text>
              {(role === "owner" && request.renter?.id) ||
              (role === "renter" && request.owner?.id) ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/profile/${
                        role === "owner"
                          ? request.renter.id
                          : request.owner.id
                      }`
                    );
                  }}
                >
                  <Text className="text-sm font-semibold text-green-600">
                    {role === "owner"
                      ? `${request.renter.first_name}`
                      : `${request.owner.first_name}`}
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-sm italic text-gray-400">
                  (details unavailable)
                </Text>
              )}
            </View>
            <View className="flex-row items-center mt-2">
              <Text
                className={`text-sm font-semibold capitalize ${
                  request.status === "approved"
                    ? "text-green-600"
                    : request.status === "rejected"
                    ? "text-red-600"
                    : request.status === "ongoing"
                    ? "text-blue-600"
                    : "text-yellow-600"
                }`}
              >
                {request.status}
              </Text>
              {request.status === "approved" && role === "owner" && (
                <Text className="text-gray-600 italic ml-2">
                  - awaiting handover
                </Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>

      {/* ACTIONS SECTION */}
      {!isCompleted && (
        <View className="p-4 border-t border-gray-200">
          {/* Owner actions for pending requests */}
          {role === "owner" && request.status === "pending" && (
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => onStatusChange(request.id, "approved")}
                disabled={updateLoading}
                className="flex-1 bg-green-600 p-3 rounded-lg items-center disabled:opacity-50"
              >
                <Text className="text-white font-bold">Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onStatusChange(request.id, "rejected")}
                disabled={updateLoading}
                className="flex-1 bg-red-600 p-3 rounded-lg items-center disabled:opacity-50"
              >
                <Text className="text-white font-bold">Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Owner action for approved requests */}
          {role === "owner" && request.status === "approved" && (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/handover",
                  params: { id: request.id, flow: "pickup" },
                })
              }
              disabled={updateLoading}
              className="bg-green-600 p-3 rounded-lg items-center disabled:opacity-50"
            >
              <Text className="text-white font-bold">Begin Handover</Text>
            </TouchableOpacity>
          )}

          {/* Renter action for approved requests */}
          {role === "renter" && request.status === "approved" && (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: "/scanner",
                params: { flow: "pickup" }
              })}
              className="bg-blue-600 p-3 rounded-lg items-center"
            >
              <Text className="text-white font-bold">Scan to Receive Gear</Text>
            </TouchableOpacity>
          )}

          {/* RETURN FLOW - Renter initiates return when ongoing */}
          {role === "renter" && request.status === "ongoing" && (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/handover",
                  params: { id: request.id, flow: "return" },
                })
              }
              disabled={updateLoading}
              className="bg-orange-600 p-3 rounded-lg items-center disabled:opacity-50"
            >
              <Text className="text-white font-bold">Initiate Return</Text>
            </TouchableOpacity>
          )}

          {/* RETURN FLOW - Owner scans when ongoing */}
          {role === "owner" && request.status === "ongoing" && (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: "/scanner",
                params: { flow: "return" }
              })}
              className="bg-purple-600 p-3 rounded-lg items-center"
            >
              <Text className="text-white font-bold">Scan to Confirm Return</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Review Section - only show if the user to be reviewed exists */}
      {role === "renter" && request.status === "completed" && request.owner?.id && (
        <View className="p-4 border-t border-gray-200">
          <Text className="font-semibold text-gray-800 mb-2">
            Leave a review
          </Text>
          <StarRating
            rating={reviewData.rating}
            onRatingChange={(r) => setReviewData((p) => ({ ...p, rating: r }))}
          />
          <TextInput
            value={reviewData.comment}
            onChangeText={(t) => setReviewData((p) => ({ ...p, comment: t }))}
            placeholder="How was your experience?"
            className="border border-gray-300 rounded-lg p-2 mt-2 h-20"
            multiline
          />
          <TouchableOpacity
            onPress={() => onSubmitReview(request, reviewData)}
            disabled={reviewLoading}
            className="bg-green-600 p-3 rounded-lg items-center mt-2 disabled:opacity-50"
          >
            <Text className="text-white font-bold">Submit Review</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default function RentalsPage() {
  const { user, loading: authLoading } = useAuth();
  const { client } = useClientWithUserID(user?.id || "");
  const [requests, setRequests] = useState<DirectusRentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [role, setRole] = useState<"renter" | "owner">("owner");

  const fetchRequests = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const [ownerReqs, renterReqs] = await Promise.all([
        getRentalRequests(client.id, "owner"),
        getRentalRequests(client.id, "renter"),
      ]);
      setRequests([...ownerReqs, ...renterReqs]);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (client) {
      fetchRequests();
    }
  }, [client]);

  const { updateStatus, loading: updateLoading } = useUpdateRentalStatus({
    onSuccess: fetchRequests,
  });
  const { submitReview, loading: reviewLoading } = useCreateReview({
    onSuccess: fetchRequests,
  });

  const handleStatusChange = (
    requestId: string,
    status: "approved" | "rejected" | "completed"
  ) => {
    if (Platform.OS === "web") {
      if (confirm(`Are you sure you want to ${status} this request?`)) {
        updateStatus(requestId, status);
      }
    } else {
      Alert.alert(
        "Confirm",
        `Are you sure you want to ${status} this request?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "OK", onPress: () => updateStatus(requestId, status) },
        ]
      );
    }
  };

  const handleReviewSubmit = (
    request: DirectusRentalRequest,
    reviewData: { rating: number; comment: string }
  ) => {
    if (!client || !request.owner?.id || !request.renter?.id) return;
    const reviewedId =
      role === "renter" ? request.owner.id : request.renter.id;
    submitReview({
      ...reviewData,
      rental_request: request.id,
      reviewer: client.id,
      reviewed: reviewedId,
    });
  };

  const { ongoing, completed } = useMemo(() => {
    if (!client) return { ongoing: [], completed: [] };
    const filtered = requests.filter((r) =>
      role === "renter"
        ? r.renter?.id === client.id
        : r.owner?.id === client.id
    );
    return {
      ongoing: filtered.filter((r) => ONGOING_STATUSES.includes(r.status)),
      completed: filtered.filter((r) => COMPLETED_STATUSES.includes(r.status)),
    };
  }, [requests, role, client]);

  if (authLoading || !user) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loading && requests.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-red-500 text-center">{error.message}</Text>
        <TouchableOpacity onPress={fetchRequests} className="mt-4">
          <Text className="text-green-600">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="bg-gray-50" key={role}>
      <View className="p-4">
        <Text className="text-3xl font-bold text-gray-900 mb-4">My Rentals</Text>

        {/* Role switcher */}
        <View className="flex-row bg-gray-200 rounded-lg p-1 mb-6">
          <TouchableOpacity
            onPress={() => setRole("renter")}
            className={`flex-1 p-2 rounded-md ${
              role === "renter" ? "bg-white shadow" : ""
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                role === "renter" ? "text-green-600" : "text-gray-600"
              }`}
            >
              My Trips
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setRole("owner")}
            className={`flex-1 p-2 rounded-md ${
              role === "owner" ? "bg-white shadow" : ""
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                role === "owner" ? "text-green-600" : "text-gray-600"
              }`}
            >
              My Gear Rentals
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ongoing Requests */}
        <View>
          <Text className="text-xl font-bold text-gray-800 mb-4">
            Ongoing
          </Text>
          {ongoing.length > 0 ? (
            ongoing.map((req) => (
              <RequestCard
                key={`${role}-${req.id}`}
                request={req}
                role={role}
                onStatusChange={handleStatusChange}
                updateLoading={updateLoading}
                onSubmitReview={handleReviewSubmit}
                reviewLoading={reviewLoading}
              />
            ))
          ) : (
            <Text className="text-gray-500 text-center py-4">
              No ongoing requests.
            </Text>
          )}
        </View>

        {/* Completed Requests */}
        <View className="mt-8">
          <Text className="text-xl font-bold text-gray-800 mb-4">
            Completed & Past
          </Text>
          {completed.length > 0 ? (
            completed.map((req) => (
              <RequestCard
                key={`${role}-${req.id}`}
                request={req}
                role={role}
                onStatusChange={handleStatusChange}
                updateLoading={updateLoading}
                onSubmitReview={handleReviewSubmit}
                reviewLoading={reviewLoading}
              />
            ))
          ) : (
            <Text className="text-gray-500 text-center py-4">
              No completed or past requests.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
} 