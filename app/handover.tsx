import { View, Text } from "react-native";
import React from "react";
import { useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";

export default function HandoverPage() {
  const { id, flow = "pickup" } = useLocalSearchParams<{ 
    id: string; 
    flow?: "pickup" | "return" 
  }>();

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
  
  const handoverData = {
    rentalId: id,
    action: isReturnFlow ? "initiate_return" : "start_handover",
  };

  return (
    <View className="flex-1 justify-center items-center bg-gray-100 p-8">
      <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
        {isReturnFlow ? "Initiate Return" : "Begin Handover"}
      </Text>
      <Text className="text-lg text-gray-600 text-center mb-8">
        {isReturnFlow 
          ? "Have the owner scan this code to confirm the gear return."
          : "Have the renter scan this code to begin the rental."
        }
      </Text>
      <View className="bg-white p-6 rounded-lg shadow-lg">
        <QRCode
          value={JSON.stringify(handoverData)}
          size={250}
          logoBackgroundColor="transparent"
        />
      </View>
      <Text className="text-sm text-gray-500 mt-8 text-center">
        Make sure both you and the {isReturnFlow ? "owner" : "renter"} have a stable internet connection.
      </Text>
    </View>
  );
} 