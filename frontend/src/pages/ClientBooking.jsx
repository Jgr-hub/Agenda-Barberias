import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import './ClientBooking.css'

const API_URL = '/api'

export default function ClientBooking() {
  const { id: barbershopId } = useParams()
  const [barbershop, setBarbershop] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ client_name: '', client_phone: '' })
 const [bookingSuccess, setBookingSuccess] = useState(false)
const [lastBooking, setLastBooking] = useState(null)
  const [error, setError] = useState(null)

  const generateDates = () => {
    const dates = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push({
        full: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('es-ES', { weekday: 'short' }),
        date: date.getDate(),
        month: date.toLocaleDateString('es-ES', { month: 'short' }),
      })
    }
    return dates
  }

  const dates = generateDates()

  const fetchBarbershop = useCallback(async () => {
    if (!barbershopId) return
    try {
      const r = await fetch(`${API_URL}/barbershop/${barbershopId}/public`)
      if (r.ok) { setBarbershop(await r.json()); setError(null) }
      else setError('Barbería no encontrada')
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }, [barbershopId])

  const fetchSlots = useCallback(async (date) => {
    if (!barbershopId) return
    setSlotsLoading(true)
    try {
      const r = await fetch(`${API_URL}/barbershop/${barbershopId}/slots?date=${date}`)
      if (r.ok) { const data = await r.json(); setSlots(data.filter(s => s.is_available)) }
    } catch (e) { console.error(e) }
    finally { setSlotsLoading(false) }
  }, [barbershopId])

  useEffect(() => { fetchBarbershop() }, [fetchBarbershop])
  useEffect(() => { if (selectedDate) fetchSlots(selectedDate) }, [selectedDate, fetchSlots])
  useEffect(() => { if (dates.length > 0 && !selectedDate && !loading) setSelectedDate(dates[0].full) }, [loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.client_name.trim()) { alert('Por favor ingresa tu nombre'); return }
    if (!form.client_phone.trim()) { alert('Por favor ingresa tu número de teléfono'); return }
    if (!selectedSlot || !barbershopId) return
    setSubmitting(true)
    try {
      const r = await fetch(`${API_URL}/barbershop/${barbershopId}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: form.client_name.trim(), client_phone: form.client_phone.trim(), date: selectedSlot.date, time: selectedSlot.time }),
      })
      if (r.ok) { setLastBooking(selectedSlot); setBookingSuccess(true); setShowForm(false); setForm({ client_name: '', client_phone: '' }); setSelectedSlot(null); fetchSlots(selectedDate) }
      else { const err = await r.json(); alert(err.detail || 'No se pudo crear la cita') }
    } catch { alert('Error de conexión') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="booking-page"><div className="loading-container"><div className="spinner"></div></div></div>

  if (error || !barbershop) return (
    <div className="booking-page">
      <div className="error-container fade-in">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h1>Barbería no encontrada</h1>
        <p>El link que ingresaste no es válido o la barbería ya no existe.</p>
      </div>
    </div>
  )

  if (bookingSuccess) return (
    <div className="booking-page">
      <div className="success-container fade-in">
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h1>¡Cita Confirmada! 💈</h1>
 <p>Tu cita con <strong>{barbershop.name}</strong> está confirmada. ¡Te esperamos!</p>
{(() => {
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const [year, month, day] = lastBooking?.date?.split('-') || ['','','']
  const [h, m] = lastBooking?.time?.split(':') || ['0','0']
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const hour12 = hour % 12 || 12
  return (
    <p className="booking-datetime">
      📅 {parseInt(day)}/{MESES[parseInt(month)-1]}/{year} a las {hour12}:{m}{ampm}
    </p>
  )
})()}
      </div>
    </div>
  )

  return (
    <div className="booking-page">
      <header className="booking-header">
        {barbershop.photo
          ? <img src={barbershop.photo} alt="" className="shop-photo" />
          : <div className="shop-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg></div>
        }
        <div className="shop-info">
          <h1>{barbershop.name}</h1>
          <p>Reserva tu cita</p>
        </div>
      </header>

      <main className="booking-content fade-in">
        <section className="section">
          <h2>Selecciona una fecha</h2>
          <div className="dates-scroll">
            {dates.map((d) => (
              <button key={d.full} className={`date-card ${selectedDate === d.full ? 'selected' : ''}`}
                onClick={() => { setSelectedDate(d.full); setSelectedSlot(null); setShowForm(false) }}>
                <span className="date-day">{d.day}</span>
                <span className="date-num">{d.date}</span>
                <span className="date-month">{d.month}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Horarios disponibles</h2>
          {slotsLoading ? (
            <div className="loading-slots"><div className="spinner"></div></div>
          ) : slots.length === 0 ? (
            <div className="empty-slots">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <p>No hay horarios disponibles</p>
              <span>Selecciona otra fecha</span>
            </div>
          ) : (
            <div className="slots-grid">
              {slots.map((slot) => (
                <button key={slot.id} className={`slot-card ${selectedSlot?.id === slot.id ? 'selected' : ''}`} onClick={() => { setSelectedSlot(slot); setShowForm(true) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </section>

        {showForm && selectedSlot && (
          <section className="section form-section fade-in">
            <h2>Completa tu reserva</h2>
            <p className="form-subtitle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {selectedDate} a las {selectedSlot.time}
            </p>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Nombre</label>
                <input type="text" placeholder="Tu nombre completo" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Teléfono</label>
                <input type="tel" placeholder="📱 Ingresa tu número real para confirmarte la cita" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
              </div>
              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting ? <div className="spinner small"></div> : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Solicitar Cita</>}
              </button>
              <button type="button" className="cancel-btn" onClick={() => { setShowForm(false); setSelectedSlot(null) }}>Cancelar</button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}
