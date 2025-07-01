import { Text, View, Button, Alert, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useUpdateRentalStatus } from "../hooks/useUpdateRentalStatus";
import { BarcodeScanningResult } from "expo-camera";

export default function Scanner() {
  const { flow = "pickup" } = useLocalSearchParams<{ flow?: "pickup" | "return" }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const isReturnFlow = flow === "return";
  
  const { updateStatus, loading: updateLoading } = useUpdateRentalStatus({
    onSuccess: (rentalId) => {
      const successMessage = isReturnFlow 
        ? "Rental has been completed! Now, let's document the returned gear condition."
        : "Rental status updated! Now, let's take some photos.";
      
      const alertTitle = isReturnFlow ? "Return Confirmed" : "Success";
      
      Alert.alert(
        alertTitle,
        successMessage,
        [
          {
            text: "OK",
            onPress: () =>
              router.replace({
                pathname: "/photoproof",
                params: { id: rentalId, flow: isReturnFlow ? "return" : "pickup" },
              }),
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("Error", `Failed to update status: ${error.message}`);
      setScanned(false); // Allow scanning again
    },
  });

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = (scanningResult: BarcodeScanningResult) => {
    if (scanned || updateLoading) return;
    setScanned(true);

    try {
      const { data } = scanningResult;
      const parsedData = JSON.parse(data);

      const expectedAction = isReturnFlow ? "initiate_return" : "start_handover";
      const targetStatus = isReturnFlow ? "completed" : "ongoing";

      if (parsedData.action === expectedAction && parsedData.rentalId) {
        updateStatus(parsedData.rentalId, targetStatus);
      } else {
        throw new Error("Invalid QR code.");
      }
    } catch (e) {
      Alert.alert(
        "Invalid QR Code",
        `This QR code is not valid for a ${isReturnFlow ? "gear return" : "rental handover"}.`,
        [{ text: "OK", onPress: () => setScanned(false) }]
      );
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />
      {scanned && <View style={styles.overlay} />}
      <View style={styles.textContainer}>
        <Text style={styles.text}>
          {isReturnFlow 
            ? "Scan the renter's QR code to confirm gear return"
            : "Scan the owner's QR code to start the rental"
          }
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  textContainer: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 15,
    borderRadius: 10,
  },
  text: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
  },
}); 