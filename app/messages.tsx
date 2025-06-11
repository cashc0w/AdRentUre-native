import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import "../globals.css";
import { useRealTimeMessages } from '../hooks/useRealTimeMessages';
import { useUserConversations } from '../hooks/useUserConversations';
import { DirectusConversation, DirectusMessage, sendMessage } from '../lib/directus';
import { format, set } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useClientWithUserID } from '../hooks/useClientWithUserID';

const Messages = () => {
  const [selectedConversation, setSelectedConversation] = useState<DirectusConversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const userId = user?.id || '';
  const { client, loading, error: clientError } = useClientWithUserID(userId);
  const currentClientId = client?.id || '';

  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
  } = useUserConversations(userId);
  const [orderedConversations, setOrderedConversations] = useState<DirectusConversation[]>(conversations);
  
  console.log("conversations", conversations);
  console.log("orderedConversations", orderedConversations);
  const {
    messages: realTimeMessages,
    sendMessage: sendRealTimeMessage,
    error: realTimeError,
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts,
    isLoading,
  } = useRealTimeMessages(selectedConversation?.id || '');

  // Merge persisted and real-time messages, removing duplicates
  const allMessages = [...realTimeMessages]
    .filter((message, index, self) =>
      index === self.findIndex((m) => m.id === message.id)
    )
    .sort((a, b) =>
      new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
    );

  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0]);
    }
    setOrderedConversations(conversations);
  }, [conversations, selectedConversation]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      setSending(true);
      setError(null);

      if (!isConnected) {
        throw new Error("Real-time connection not available. Please try again.");
      }

      // Send message through real-time system
      await sendRealTimeMessage(newMessage.trim(), currentClientId);

      // Also send through Directus for persistence
      await sendMessage({
        conversation: selectedConversation.id,
        sender: currentClientId,
        message: newMessage.trim(),
      });

      
      setNewMessage('');
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
    const reorderedConversations = [...conversations].sort((a, b) => {
        const aTime = a.last_change ? new Date(a.last_change).getTime() : 0;
        const bTime = b.last_change ? new Date(b.last_change).getTime() : 0;
        return bTime - aTime;
      });
      setOrderedConversations(reorderedConversations);

  };

  // Get the other user in the conversation (not the current user)
  const getOtherUser = (conversation: DirectusConversation) => {
    return conversation.user_1.id === userId
      ? conversation.user_2
      : conversation.user_1;
  };

  if (conversationsLoading) {
    return (
      <View className='flex-1 items-center justify-center'>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }
  console.log("realTimeMessages", realTimeMessages);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className='flex-1 bg-white'
    >
      {/* Header */}
      <View className='bg-gray-900 py-4 px-4'>
        <Text className='text-2xl font-bold text-white'>Messages</Text>
        <Text className='text-gray-300 mt-1'>Chat with gear owners and renters</Text>
      </View>

      <View className='flex-1 flex-row'>
        {/* Conversations List */}
        <View className='w-1/3 border-r border-gray-200 bg-gray-50'>
          <ScrollView>
            {orderedConversations.map((conversation) => {
              const otherUser = getOtherUser(conversation);
              return (
                <TouchableOpacity
                  key={conversation.id}
                  className={`p-4 border-b border-gray-200 ${selectedConversation?.id === conversation.id ? 'bg-gray-100' : ''
                    }`}
                  onPress={() => setSelectedConversation(conversation)}
                >
                  <Text className='font-medium text-gray-900'>
                    {otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'Unknown User'}
                  </Text>
                  <Text className='text-sm text-gray-600 truncate'>
                    {conversation.gear_listing ? conversation.gear_listing.title : 'No gear listing'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

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
                  {selectedConversation.gear_listing
                    ? `About: ${selectedConversation.gear_listing.title}`
                    : 'No gear listing'}
                </Text>
              </View>

              {/* Messages */}
              <ScrollView className='flex-1 p-4 bg-gray-50'>
                {isLoading ? (
                  <View className='flex-1 items-center justify-center py-8'>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text className='text-gray-500 mt-2'>Loading messages...</Text>
                  </View>
                ) : allMessages.length === 0 ? (
                  <View className='flex-1 items-center justify-center'>
                    <Text className='text-gray-500'>No messages yet. Start the conversation!</Text>
                  </View>
                ) : (
                  <View className='space-y-4'>
                    {allMessages.map((message) => {
                      const isCurrentUser = message.sender.id === currentClientId;
                      console.log("message", message);
                      console.log("isCurrentUser", isCurrentUser);
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
                    editable={!sending}
                  />
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-r-lg ${sending || !newMessage.trim()
                        ? 'bg-gray-400'
                        : 'bg-green-600'
                      }`}
                    onPress={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
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

      {/* Connection Status */}
      {!isConnected && (
        <View className='bg-yellow-100 border-l-4 border-yellow-500 p-4'>
          <Text className='text-yellow-700'>
            {reconnectAttempts > 0
              ? `Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`
              : 'Real-time connection is not available. Messages may be delayed.'}
          </Text>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View className='bg-red-100 border-l-4 border-red-500 p-4'>
          <Text className='text-red-700'>{error}</Text>
          <TouchableOpacity
            onPress={() => setError(null)}
            className='absolute right-4 top-4'
          >
            <Text className='text-red-700'>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default Messages;

const styles = StyleSheet.create({});