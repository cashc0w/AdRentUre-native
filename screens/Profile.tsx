import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-4">
        {user ? (
          <>
            <View className="mb-6">
              <Text className="text-2xl font-bold">Profile</Text>
              <Text className="text-gray-500 mt-2">Welcome, {user.first_name}!</Text>
            </View>
            
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-500">Email</Text>
              <Text className="text-lg">{user.email}</Text>
            </View>
            
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-500">Name</Text>
              <Text className="text-lg">{user.first_name} {user.last_name}</Text>
            </View>

            <TouchableOpacity
              onPress={logout}
              className="mt-8 bg-red-500 py-3 px-4 rounded-md"
            >
              <Text className="text-white text-center font-medium">Logout</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-2xl font-bold">Profile</Text>
            <Text className="text-gray-500 mt-2">Please sign in to view your profile</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
} 