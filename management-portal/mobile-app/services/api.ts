import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../constants/Config';
import { Platform } from 'react-native';

const Storage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  }
};

const api = axios.create({
  baseURL: CONFIG.ADMIN_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle Apps Script specific wrapping
api.interceptors.response.use(
  (response) => {
    // Apps Script returns { success: true, data: ..., error: ... }
    const res = response.data;
    if (res && res.success === false) {
      return Promise.reject(new Error(res.error || 'Unknown API Error'));
    }
    return res;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Public Data Fetcher
 */
export const fetchPublicProperties = async () => {
  const response = await axios.get(CONFIG.PUBLIC_LISTINGS_URL);
  return response.data;
};

/**
 * Admin API Wrapper
 */
export const adminApi = {
  async post(action: string, params: any = {}, token?: string) {
    const currentToken = token || await Storage.getItem('userToken');
    
    console.log(`[API] Calling action: ${action}`);
    console.log(`[API] Has token: ${!!currentToken}`);
    
    // Send token in request body only (no Authorization header)
    // Authorization header triggers CORS preflight that Apps Script doesn't handle well
    const response = await axios.post(CONFIG.ADMIN_API_URL, JSON.stringify({
      action,
      params,
      token: currentToken
    }), {
      headers: { 
        'Content-Type': 'text/plain;charset=utf-8'
        // No Authorization header - it causes CORS preflight issues with Apps Script
      }
    });
    
    console.log(`[API] Response status: ${response.status}`);
    console.log(`[API] Response data:`, response.data);
    
    // Manual handling for Apps Script response patterns
    const res = response.data;
    if (res && res.success === false) {
      throw new Error(res.error || 'Action failed');
    }
    return res.data;
  }
};

export default api;
