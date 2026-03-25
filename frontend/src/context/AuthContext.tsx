import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Barbershop {
  id: string;
  name: string;
  photo: string | null;
}

interface AuthContextType {
  barbershop: Barbershop | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, photo: string | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored auth on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedBarbershop = await AsyncStorage.getItem('barbershop');
      
      if (storedToken && storedBarbershop) {
        setToken(storedToken);
        setBarbershop(JSON.parse(storedBarbershop));
        
        // Verify token is still valid
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        
        if (!response.ok) {
          // Token invalid, clear storage
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('barbershop');
          setToken(null);
          setBarbershop(null);
        } else {
          const data = await response.json();
          setBarbershop(data);
          await AsyncStorage.setItem('barbershop', JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Error al iniciar sesión');
    }

    const data = await response.json();
    setToken(data.access_token);
    setBarbershop(data.barbershop);
    
    await AsyncStorage.setItem('auth_token', data.access_token);
    await AsyncStorage.setItem('barbershop', JSON.stringify(data.barbershop));
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Error al registrarse');
    }

    const data = await response.json();
    setToken(data.access_token);
    setBarbershop(data.barbershop);
    
    await AsyncStorage.setItem('auth_token', data.access_token);
    await AsyncStorage.setItem('barbershop', JSON.stringify(data.barbershop));
  };

  const logout = async () => {
    setToken(null);
    setBarbershop(null);
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('barbershop');
  };

  const updateProfile = async (name: string, photo: string | null) => {
    if (!token) throw new Error('No autenticado');
    
    const response = await fetch(`${API_URL}/api/barbershop/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, photo }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Error al actualizar perfil');
    }

    const data = await response.json();
    setBarbershop(data);
    await AsyncStorage.setItem('barbershop', JSON.stringify(data));
  };

  const refreshProfile = async () => {
    if (!token) return;
    
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      setBarbershop(data);
      await AsyncStorage.setItem('barbershop', JSON.stringify(data));
    }
  };

  return (
    <AuthContext.Provider value={{
      barbershop,
      token,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
