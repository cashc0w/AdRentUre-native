import { Tabs } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useClientWithUserID } from "../hooks/useClientWithUserID";
import { Ionicons } from '@expo/vector-icons';

function TabNavigation() {
    const { user } = useAuth();

    const { client } = useClientWithUserID(user?.id || "");
    
    return (
      <Tabs 
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#16a34a', 
          tabBarInactiveTintColor: 'gray',
        }}
      >
        <Tabs.Screen 
          name="about" 
          options={{ 
            title: '',//'About', 
            href: !user ? `/about` : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
            tabBarStyle: user ? { display: 'none' } : undefined,
          }} 
        />
        <Tabs.Screen 
          name="gear/browse" 
          options={{ 
            title: '',//'Browse',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search-outline" size={size} color={color} />
            ),
          }} 
        />
        <Tabs.Screen 
          name="messages" 
          options={{ 
            title: '',//'Messages',  
            href: user ? `/messages` : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="mail-outline" size={size} color={color} />
            ),
            tabBarStyle: !user ? { display: 'none' } : undefined,
          }} 
        />
        <Tabs.Screen 
          name="profile/[id]" 
          options={{ 
            title: '',//'Profile', 
            href: user ? `/profile/${client?.id}` : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
            tabBarStyle: !user ? { display: 'none' } : undefined,
          }} 
        />
        <Tabs.Screen 
          name="auth" 
          options={{ 
            title: '',//'Login', 
            href: !user ? `/auth` : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
            tabBarStyle: user ? { display: 'none' } : undefined,
          }} 
        />
        <Tabs.Screen 
          name="gear/new" 
          options={{ 
            title: '',//'New', 
            href: null,
            tabBarStyle: { display: 'none' },
          }} 
        />
        <Tabs.Screen 
          name="gear/[id]" 
          options={{ 
            title: '',//'Gear', 
            href: null,
            tabBarStyle: { display: 'none' },
          }} 
        />
      </Tabs>
    );
  }

  export default TabNavigation;