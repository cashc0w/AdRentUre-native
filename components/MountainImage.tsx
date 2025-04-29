import { Image } from 'expo-image';
import { View } from 'react-native';

export default function MountainImage() {
  return (
    <View className="absolute inset-0">
      <Image
        source={require('../assets/images/mountain.jpg')}
        className="w-full h-full"
        contentFit="cover"
        contentPosition="center"
      />
      <View className="absolute inset-0 bg-black/50" />
    </View>
  );
} 