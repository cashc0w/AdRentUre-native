import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import React, { useState, useEffect, useRef } from 'react'
import "../globals.css";
import { useGlobalMessages } from '../hooks/useGlobalMessages';
import { useConversationMessages } from '../hooks/useConversationMessages';
import { useUserConversations } from '../hooks/useUserConversations';
import { DirectusConversation, DirectusNotification, DirectusMessage, getMessageNotifications, markNotificationAsRead } from '../lib/directus';
import { format, set } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useClientWithUserID } from '../hooks/useClientWithUserID';
import { useUserMessageNotifications } from '../hooks/useUserMessageNotifications';

const Messages = () => {
  const [selectedConversation, setSelectedConversation] = useState<DirectusConversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [conversationListReload, setConversationListReload] = useState(false);
  const [notificationListReload, setNotificationListReload] = useState(false);

  // Ref for auto-scrolling
  const scrollViewRef = useRef<ScrollView>(null);

  const { user } = useAuth();
  const userId = user?.id || '';
  const { client, loading: clientLoading } = useClientWithUserID(userId);
  const currentClientId = client?.id || '';

  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
  } = useUserConversations(userId, conversationListReload);

  const {
    notifications,
    loading: notificationsLoading,
    error: notificationsError
  } = useUserMessageNotifications(currentClientId, notificationListReload);
  const [notificationCountMap, setNotificationCountMap] = useState(new Map());
  const [reloadCount, setReloadCount] = useState(false);

  // Get all conversation IDs for global subscription
  const conversationIds = conversations.map(conv => conv.id);

  // Initialize global messages connection
  const { onMessageReceived, isConnected: globalConnected, error: globalError } = useGlobalMessages(conversationIds);

  // Get messages for the selected conversation
  const {
    messages,
    sendMessage,
    isLoading: messagesLoading,
    sending,
    error: messageError,
    isConnected: conversationConnected,
  } = useConversationMessages(selectedConversation?.id || '', currentClientId);

  // Helper function to get notification count for a conversation
  const getNotificationCount = (conversationId: string): number => {
    return notifications.filter(notification =>
      notification.conversation.id === conversationId
    ).length;
  };

  // Auto-scroll to bottom when messages change or conversation loads
  useEffect(() => {
    if (messages.length > 0 && !messagesLoading) {
      // Small delay to ensure the UI has rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, messagesLoading]);

  // Auto-scroll when conversation changes (after loading completes)
  useEffect(() => {
    if (selectedConversation && !messagesLoading && messages.length > 0) {
      //scrolling
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }

  }, [selectedConversation?.id, messagesLoading]);

  //count notif for each conversation
  useEffect(() => {
    const countMap = new Map();
    conversations.forEach(conversation => {
      countMap.set(conversation.id, getNotificationCount(conversation.id));
    });
    setNotificationCountMap(countMap);
  }, [conversations, notifications, reloadCount]);

  // Mark notifications as read for the selected conversation
  useEffect(() => {
    // A guard to ensure we have everything needed to proceed
    if (!selectedConversation || notificationsLoading || notifications.length === 0) {
      return;
    }

    const markNotificationsAsRead = async () => {
      // 1. Find all notifications for the currently selected conversation
      const notificationsToMark = notifications.filter(
        notification => notification.conversation.id === selectedConversation.id
      );

      // If there are no notifications for this conversation, do nothing.
      if (notificationsToMark.length === 0) {
        return;
      }

      try {
        // 2. Create an array of promises, one for each API call
        const markAsReadPromises = notificationsToMark.map(notification =>
          markNotificationAsRead(notification.id)
        );

        // 3. Wait for ALL promises to resolve before continuing
        await Promise.all(markAsReadPromises);

        // 4. NOW that the server is updated, trigger a refetch of the notification list
        console.log("All notifications marked as read. Refetching list...");
        setNotificationListReload(prev => !prev);

      } catch (error) {
        console.error("Failed to mark notifications as read:", error);
      }
    };

    markNotificationsAsRead();

    // The dependency array is also cleaned up. This effect should only run
    // when the user selects a different conversation.
  }, [selectedConversation?.id, notifications]); // We also depend on notificationsLoading to ensure we don't run while a fetch is in progress.


  // Listen for messages from any conversation to update the conversation list
  useEffect(() => {
    if (!currentClientId) return;

    const unsubscribe = onMessageReceived((message, conversationId) => {
      console.log("Received global message:", message, "for conversation:", conversationId);

      // If the message is from someone else (not current user), reload conversation list and notif list
      if (message.sender.id !== currentClientId) {
        console.log("Message from another user, refreshing conversation list");
        setConversationListReload(prev => !prev);
        setNotificationListReload(prev => !prev);
      }
    });

    return unsubscribe;
  }, [onMessageReceived, currentClientId]);

  // USELESS // Auto-select first conversation
  // useEffect(() => {
  //   if (conversations.length > 0 && !selectedConversation) {
  //     setSelectedConversation(conversations[0]);
  //   }
  // }, [conversations, selectedConversation]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await sendMessage(newMessage.trim());
      setNewMessage('');

      // Trigger conversation list reload for sender
      setConversationListReload(prev => !prev);

      // Scroll to bottom after sending
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Get the other user in the conversation
  const getOtherUser = (conversation: DirectusConversation) => {
    return conversation.user_1.id === currentClientId
      ? conversation.user_2
      : conversation.user_1;
  };

  if (clientLoading) {
    return (
      <View className='flex-1 items-center justify-center'>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text className='text-gray-500 mt-2'>Loading user data...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className='flex-1 bg-white'
    >
      {/* Header */}
      <View className='bg-gray-900 py-4 px-4'>
        <Text className='text-2xl font-bold text-white'>Messages</Text>
        <Text className='text-gray-300 mt-1'>Chat with gear owners and renters</Text>

        {/* Connection Status in Header */}
        <View className='flex-row items-center mt-2'>
          <View className={`w-2 h-2 rounded-full mr-2 ${globalConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <Text className='text-gray-300 text-xs'>
            {globalConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <View className='flex-1 flex-row'>
        {/* Conversations List */}
        {conversationsLoading && conversations.length < 1 ? (
          <View className='w-1/4 border-r border-gray-200 bg-gray-50 flex-1 items-center justify-center'>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text className='text-gray-500 mt-2'>Loading conversations...</Text>
          </View>
        ) : (
          <View className='w-1/3 border-r border-gray-200 bg-gray-50'>
            <ScrollView>
              {conversations.length === 0 ? (
                <View className='p-4'>
                  <Text className='text-gray-500 text-center'>No conversations yet</Text>
                </View>
              ) : (
                conversations.map((conversation) => {
                  const otherUser = getOtherUser(conversation);


                  return (
                    <TouchableOpacity
                      key={conversation.id}
                      className={`p-4 border-b border-gray-200 ${selectedConversation?.id === conversation.id ? 'bg-gray-100' : ''
                        }`}
                      onPress={() => setSelectedConversation(conversation)}
                    >
                      <View className='flex-row items-center justify-between'>
                        <Text className={`font-medium flex-1 ${notificationCountMap.get(conversation.id) > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'Unknown User'}
                        </Text>
                        {notificationCountMap.get(conversation.id) > 0 && (
                          <View className='bg-green-600 rounded-full min-w-[20px] h-5 items-center justify-center ml-2'>
                            <Text className='text-white text-xs font-bold'>
                              {notificationCountMap.get(conversation.id)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className={`text-sm truncate ${notificationCountMap.get(conversation.id) > 0 ? 'text-green-500' : 'text-gray-600'}`}>
                        {conversation.rental_request.gear_listing ? conversation.rental_request.gear_listing.title : 'No gear listing'}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* Chat Area */}
        <View className='flex-1 flex-col'>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <View className='p-4 border-b border-gray-200 bg-white'>
                <Text className='font-semibold text-gray-900'>
                  {getOtherUser(selectedConversation)
                    ? `${getOtherUser(selectedConversation)?.first_name} ${getOtherUser(selectedConversation)?.last_name}`
                    : 'Unknown User'}
                </Text>
                <Text className='text-sm text-gray-600'>
                  {selectedConversation.rental_request.gear_listing
                    ? `About: ${selectedConversation.rental_request.gear_listing.title}`
                    : 'No gear listing'}
                </Text>
              </View>

              {/* Messages */}
              <ScrollView
                ref={scrollViewRef}
                className='flex-1 p-4 bg-gray-50'
                showsVerticalScrollIndicator={true}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: 10,
                }}
              >
                {messagesLoading ? (
                  <View className='flex-1 items-center justify-center py-8'>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text className='text-gray-500 mt-2'>Loading messages...</Text>
                  </View>
                ) : messages.length === 0 ? (
                  <View className='flex-1 items-center justify-center'>
                    <Text className='text-gray-500'>No messages yet. Start the conversation!</Text>
                  </View>
                ) : (
                  <View className='space-y-4'>
                    {messages.map((message) => {
                      const isCurrentUser = message.sender.id === currentClientId;
                      return (
                        <View
                          key={message.id}
                          className={`flex ${isCurrentUser ? 'items-end' : 'items-start'}`}
                        >
                          <View
                            className={`max-w-[75%] p-3 rounded-lg ${isCurrentUser
                              ? 'bg-green-600'
                              : 'bg-white border border-gray-200'
                              }`}
                          >
                            <Text
                              className={isCurrentUser ? 'text-white' : 'text-gray-800'}
                            >
                              {message.message}
                            </Text>
                            <Text
                              className={`text-xs mt-1 ${isCurrentUser ? 'text-green-200' : 'text-gray-500'
                                }`}
                            >
                              {format(new Date(message.date_created), 'MMM d, h:mm a')}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              {/* Message Input */}
              <View className='p-4 border-t border-gray-200 bg-white'>
                <View className='flex-row'>
                  <TextInput
                    className='flex-1 border border-gray-300 rounded-l-lg px-4 py-2'
                    placeholder='Type your message...'
                    value={newMessage}
                    onChangeText={setNewMessage}
                    editable={!sending && globalConnected}
                    onSubmitEditing={handleSendMessage}
                    returnKeyType='send'
                  />
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-r-lg ${sending || !newMessage.trim() || !globalConnected
                      ? 'bg-gray-400'
                      : 'bg-green-600'
                      }`}
                    onPress={handleSendMessage}
                    disabled={sending || !newMessage.trim() || !globalConnected}
                  >
                    <Text className='text-white'>
                      {sending ? 'Sending...' : 'Send'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View className='flex-1 items-center justify-center p-8'>
              <Text className='text-xl font-semibold text-gray-800 mb-2'>
                Select a conversation
              </Text>
              <Text className='text-gray-500 text-center'>
                Choose a conversation from the list to view messages
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Error Display */}
      {(globalError || messageError) && (
        <View className='bg-red-100 border-l-4 border-red-500 p-4'>
          <Text className='text-red-700'>
            {globalError?.message || messageError?.message}
          </Text>
        </View>
      )}

      {/* Connection Warning */}
      {!globalConnected && (
        <View className='bg-yellow-100 border-l-4 border-yellow-500 p-4'>
          <Text className='text-yellow-700'>
            Real-time connection is not available. Messages may be delayed.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default Messages;