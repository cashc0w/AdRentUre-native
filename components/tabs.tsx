import { Tabs } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useClientWithUserID } from "../hooks/useClientWithUserID";

function TabNavigation() {
    const { user } = useAuth();

    const { client } = useClientWithUserID(user?.id || "");
    
    return (
      <Tabs>
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="about" options={{ title: 'About' }} />
        <Tabs.Screen name="browse" options={{ title: 'Browse' }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
        <Tabs.Screen 
          name="profile/[id]" 
          options={{ 
            title: 'Profile',
            href: user ? `/profile/${client?.id}` : null
          }} 
        />
      </Tabs>
    );
  }

  export default TabNavigation;