import { createContext, useContext, useState, useEffect } from 'react'

const API_URL = '/api'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [barbershop, setBarbershop] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStoredAuth()
  }, [])

  const loadStoredAuth = async () => {
    try {
      const storedToken = localStorage.getItem('auth_token')
      const storedBarbershop = localStorage.getItem('barbershop')
      
      if (storedToken && storedBarbershop) {
        setToken(storedToken)
        setBarbershop(JSON.parse(storedBarbershop))
        
        // Verify token is still valid
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        })
        
        if (!response.ok) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('barbershop')
          setToken(null)
          setBarbershop(null)
        } else {
          const data = await response.json()
          setBarbershop(data)
          localStorage.setItem('barbershop', JSON.stringify(data))
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Error al iniciar sesión')
    }

    const data = await response.json()
    setToken(data.access_token)
    setBarbershop(data.barbershop)
    
    localStorage.setItem('auth_token', data.access_token)
    localStorage.setItem('barbershop', JSON.stringify(data.barbershop))
  }

  const register = async (email, password, name) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Error al registrarse')
    }

    const data = await response.json()
    setToken(data.access_token)
    setBarbershop(data.barbershop)
    
    localStorage.setItem('auth_token', data.access_token)
    localStorage.setItem('barbershop', JSON.stringify(data.barbershop))
  }

  const logout = () => {
    setToken(null)
    setBarbershop(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('barbershop')
  }

  const updateProfile = async (name, photo) => {
    if (!token) throw new Error('No autenticado')
    
    const response = await fetch(`${API_URL}/barbershop/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, photo }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Error al actualizar perfil')
    }

    const data = await response.json()
    setBarbershop(data)
    localStorage.setItem('barbershop', JSON.stringify(data))
  }

  return (
    <AuthContext.Provider value={{
      barbershop,
      token,
      isLoading,
      login,
      register,
      logout,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
