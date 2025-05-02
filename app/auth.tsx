// import { StyleSheet, Text, View } from 'react-native'

// import "../globals.css";

// const Auth = () => {
//   return (
//     <View className='flex-1 items-center justify-center bg-red-300'>
//       <Text>yaya</Text>
//     </View>
//   )
// }

// export default Auth

import { useState,  } from 'react';
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { register } from '../lib/directus';
import "../globals.css";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();

  const handleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, firstName, lastName, address);
      }
      
      router.replace('/gear/browse');
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 min-h-screen px-4 py-12 sm:px-6 lg:px-8">
        <View className="max-w-md w-full mx-auto">
          <Text className="text-3xl font-extrabold text-center text-gray-900">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </Text>
          
          {error && (
            <View className="mt-4 p-4 bg-red-50 rounded-md">
              <Text className="text-red-700">{error.message}</Text>
            </View>
          )}

          <View className="mt-8 space-y-6">
            {!isLogin && (
              <>
                <View>
                  <Text className="text-sm font-medium text-gray-700">First Name</Text>
                  <TextInput
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter your first name"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>

                <View>
                  <Text className="text-sm font-medium text-gray-700">Last Name</Text>
                  <TextInput
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter your last name"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </>
            )}

            <View>
              <Text className="text-sm font-medium text-gray-700">Email address</Text>
              <TextInput
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700">Password</Text>
              <TextInput
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {!isLogin && (
              <View>
                <Text className="text-sm font-medium text-gray-700">Address</Text>
                <TextInput
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter your address"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            )}

            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                loading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <Text className="text-white text-center">
                {loading 
                  ? (isLogin ? 'Signing in...' : 'Creating account...')
                  : (isLogin ? 'Sign in' : 'Create account')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsLogin(!isLogin)}
              className="mt-4"
            >
              <Text className="text-center text-sm text-green-600">
                {isLogin 
                  ? "Don't have an account? Register"
                  : "Already have an account? Sign in"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
} 