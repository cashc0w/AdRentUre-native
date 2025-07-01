import { View, Text, ActivityIndicator } from "react-native";
import React, { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { generateHandoverToken } from "../lib/directus";

export default function HandoverPage() {
  const { id, flow = "pickup" } = useLocalSearchParams<{
    id: string;
    flow?: "pickup" | "return";
  }>();
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      generateHandoverToken(id)
        .then((token) => {
          setQrData(JSON.stringify({ rentalId: id, token }));
          setError(null);
        })
        .catch((e) => {
          console.error("Failed to generate QR token:", e);
          setError(e.message || "Could not generate a secure QR code. Please go back and try again.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  if (!id) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <Text className="text-red-500 text-lg">
          Rental request not found.
        </Text>
      </View>
    );
  }

  const isReturnFlow = flow === "return";

  return (
    <View className="flex-1 justify-center items-center bg-gray-100 p-8">
      <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
        {isReturnFlow ? "Initiate Return" : "Begin Handover"}
      </Text>
      <Text className="text-lg text-gray-600 text-center mb-8">
        {isReturnFlow
          ? "Have the owner scan this code to confirm the gear return."
          : "Have the renter scan this code to begin the rental."}
      </Text>
      <View className="bg-white p-6 rounded-lg shadow-lg h-72 w-72 justify-center items-center">
        {loading && <ActivityIndicator size="large" color="#0000ff" />}
        {error && <Text className="text-red-500 text-center">{error}</Text>}
        {qrData && !loading && !error && (
            <QRCode
            value={qrData}
            size={250}
            logoBackgroundColor="transparent"
            />
        )}
      </View>
      <Text className="text-sm text-gray-500 mt-8 text-center">
        This code will expire in 5 minutes. Make sure the{" "}
        {isReturnFlow ? "owner" : "renter"} scans it promptly.
      </Text>
    </View>
  );
} 