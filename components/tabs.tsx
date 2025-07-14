import { Tabs, useRouter } from 'expo-router';
import "../globals.css";
import { useAuth } from "../contexts/AuthContext";
import { useClientWithUserID } from "../hooks/useClientWithUserID";
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { getMessageNotifications } from '../lib/directus'; // Adjust the import path

// Custom component for the mail icon with badge
const MailIconWithBadge = ({ color, size }: { color: string; size: number }) => {
  const { user } = useAuth();
  const { client } = useClientWithUserID(user?.id || "");
  const [messageNotificationCount, setMessageNotificationCount] = useState(0);

  useEffect(() => {
    if (user && client) {
      const fetchNotifications = async () => {
        try {
          const notifications = await getMessageNotifications(client.id);
          setMessageNotificationCount(notifications.length);
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        }
      };
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    } else {
      setMessageNotificationCount(0);
    }
  }, [user, client]);

  return (
    <View className="relative w-15 h-6 items-center justify-center">
      <Ionicons name="mail-outline" size={size} color={color} />
      {messageNotificationCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -5,
            right: -7,
            backgroundColor: '#ef4444',
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 3,
            paddingRight: 4,
          }}>
          <Text className="text-xs font-bold text-white"> {messageNotificationCount > 99 ? '99+' : messageNotificationCount.toString()} </Text>
        </View>
      )}
    </View>
  );
};

export default function TabLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { client } = useClientWithUserID(user?.id || "");

  return (
    <Tabs
      initialRouteName="about"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: 'gray',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="scanner" options={{ href: null }} />
      <Tabs.Screen name="photoproof" options={{ href: null }} />
      <Tabs.Screen name="handover" options={{ href: null }} />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
          href: !user?'/about': null,
          tabBarIcon: ({ color, size }) => <Ionicons name="information-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="gear"
        options={{
          title: 'Browse',
          
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          href: user?'/cart':null,
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          href: user?'/messages':null,
          tabBarIcon: (props) => <MailIconWithBadge {...props} />,
        }}
      />
      <Tabs.Screen
        name="rentals"
        options={{
          title: 'My Rentals',
          href: user?'/rentals':null,
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: user && client?.id ? `/profile/${client.id}` : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="auth"
        options={{
          title: 'Login',
          href: !user ? '/auth' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="log-in-outline" size={size} color={color} />,
        }}
      />

      {/* {user && (
        <Tabs.Screen
          name="logout" // This is a dummy screen
          options={{
            title: 'Logout',
            tabBarIcon: ({ color, size }) => <Ionicons name="log-out-outline" size={size} color={color} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Alert.alert('Logout', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: async () => {
                    await logout();
                    router.replace('/auth');
                  },
                },
              ]);
            },
          }}
        />
      )} */}
    </Tabs>
  );
}