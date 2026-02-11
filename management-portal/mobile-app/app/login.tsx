import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../services/api';
import { Lock, Mail } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const data = await adminApi.post('login', { email, password });
      await login(data.token, data.user);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      className="bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-12">
        <View className="flex-1 justify-center">
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-blue-600 rounded-2xl items-center justify-center mb-4 shadow-lg">
              <Lock color="white" size={40} />
            </View>
            <Text className="text-3xl font-bold text-gray-900">Al Badri</Text>
            <Text className="text-gray-500 mt-1">Property Management Portal</Text>
          </View>

          <View>
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">Email Address</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <Mail size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 text-gray-900 text-base ml-3"
                  placeholder="name@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-sm font-medium text-gray-700 mb-1 ml-1">Password</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <Lock size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 text-gray-900 text-base ml-3"
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className={`bg-blue-600 rounded-xl py-4 mt-8 flex-row justify-center items-center shadow-lg ${loading ? 'opacity-70' : ''}`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-bold">Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        <View className="items-center mt-10">
          <Text className="text-gray-400 text-xs">Internal Agent Use Only</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
