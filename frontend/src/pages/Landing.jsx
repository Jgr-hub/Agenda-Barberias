import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Landing.css'

export default function Landing() {
  const navigate = useNavigate()
  const { barbershop, isLoading, token } = useAuth()

  useEffect(() => {
    if (!isLoading && token && barbershop) navigate('/admin')
  }, [isLoading, token, barbershop, navigate])

  if (isLoading) {
    return <div className="landing-page"><div className="loading-container"><div className="spinner"></div></div></div>
  }

  return (
    <div className="landing-page">
      <div className="landing-noise"></div>

      <div className="landing-content fade-in">
        {/* Barber Pole */}
        <div className="barber-pole-container">
          <div className="barber-pole">
            <div className="barber-stripes"></div>
          </div>
        </div>

        {/* Logo */}
        <div className="logo-container">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="3"/>
            <path d="M8.12 8.12 12 12"/>
            <path d="M20 4 8.12 15.88"/>
            <circle cx="6" cy="18" r="3"/>
            <path d="M14.8 14.8 20 20"/>
          </svg>
        </div>

        <h1 className="landing-title">BarberBook</h1>
        <p className="landing-subtitle">Sistema de reservas para barberías</p>

        <div className="features">
          <div className="feature-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Gestiona tus horarios</span>
          </div>
          <div className="feature-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Recibe reservas online</span>
          </div>
          <div className="feature-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <span>Link único para tu barbería</span>
          </div>
        </div>

        <div className="landing-buttons">
          <Link to="/register" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Crear cuenta
          </Link>
          <Link to="/login" className="btn btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Iniciar sesión
          </Link>
        </div>

        <p className="landing-footer">
          ¿Tienes un link de barbería? Ingresa directamente a <code>/b/ID</code>
        </p>
      </div>
    </div>
  )
}
