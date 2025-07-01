import {
  View,
  Text,
  Button,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import React, { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

export default function PhotoProofPage() {
  const { id: rentalId, flow = "pickup" } = useLocalSearchParams<{ 
    id: string; 
    flow?: "pickup" | "return" 
  }>();
  const router = useRouter();
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const isReturnFlow = flow === "return";

  const pickImage = async () => {
    // No permissions needed to launch the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.5,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      setImages(result.assets);
    }
  };
  
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Sorry, we need camera permissions to make this work!');
        return;
    }

    let result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
    });

    if (!result.canceled) {
        setImages(prev => [...prev, ...result.assets]);
    }
  }

  const handleUpload = () => {
    // TODO: Implement the actual upload logic to Directus
    // 1. For each image in `images`, upload it to Directus Files
    // 2. Get the ID of each uploaded file.
    // 3. Create new entries in either `rental_handover_photos` or `rental_return_photos` collection,
    //    linking the rental_request ID and the file ID based on the flow.
    
    const successMessage = isReturnFlow 
      ? "Your photos have been saved. The rental is now complete!"
      : "Your photos have been saved. Enjoy your rental!";
    
    const alertTitle = isReturnFlow ? "Return Complete" : "Upload Complete";

    Alert.alert(
      alertTitle,
      successMessage,
      [{ text: "OK", onPress: () => router.push("/rentals") }]
    );
  };

  if (!rentalId) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-red-500">Rental ID not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-6">
        <Text className="text-2xl font-bold text-gray-800">
          {isReturnFlow ? "Document Return Condition" : "Protect Your Deposit"}
        </Text>
        <Text className="text-base text-gray-600 mt-2 mb-6">
          {isReturnFlow 
            ? "Take photos of the gear's condition upon return to protect yourself and complete the rental."
            : "Take at least 5 photos of the gear's current condition to document it before you leave."
          }
        </Text>

        <View className="flex-row gap-4 mb-6">
            <TouchableOpacity
              onPress={takePhoto}
              className="flex-1 bg-blue-600 p-4 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-base">Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickImage}
              className="flex-1 bg-gray-700 p-4 rounded-lg items-center"
            >
              <Text className="text-white font-bold text-base">Pick from Library</Text>
            </TouchableOpacity>
        </View>

        {images.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-2 text-gray-700">Selected Photos:</Text>
            <View className="flex-row flex-wrap gap-2">
                {images.map((image, index) => (
                  <Image
                    key={index}
                    source={{ uri: image.uri }}
                    className="w-24 h-24 rounded-lg bg-gray-200"
                  />
                ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={handleUpload}
          disabled={images.length < 1}
          className="bg-green-600 p-4 rounded-lg items-center disabled:opacity-50"
        >
          <Text className="text-white font-bold text-lg">
            {isReturnFlow ? "Complete Return" : "Complete Handover"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
} 