import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import './Admin.css'

const API_URL = '/api'

export default function Admin() {
  const navigate = useNavigate()
  const { barbershop, token, logout, updateProfile, isLoading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [newSlotDate, setNewSlotDate] = useState('')
  const [newSlotTime, setNewSlotTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhoto, setProfilePhoto] = useState(null)

  useEffect(() => { if (!authLoading && !token) navigate('/login') }, [authLoading, token, navigate])
  useEffect(() => { if (barbershop) { setProfileName(barbershop.name); setProfilePhoto(barbershop.photo) } }, [barbershop])

  const fetchAppointments = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch(`${API_URL}/appointments`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (r.ok) setAppointments(await r.json())
    } catch (e) { console.error(e) }
  }, [token])

  const fetchSlots = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch(`${API_URL}/slots/all`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (r.ok) setSlots(await r.json())
    } catch (e) { console.error(e) }
  }, [token])

  const loadData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchAppointments(), fetchSlots()])
    setLoading(false)
  }, [fetchAppointments, fetchSlots])

  useEffect(() => { if (token) loadData() }, [token, loadData])

  const updateStatus = async (id, status) => {
    try {
      const r = await fetch(`${API_URL}/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (r.ok) { alert(status === 'confirmed' ? 'Cita confirmada ✓' : 'Cita rechazada'); fetchAppointments(); fetchSlots() }
    } catch { alert('Error de conexión') }
  }

  const deleteSlot = async (id) => {
    if (!confirm('¿Eliminar este horario?')) return
    try {
      const r = await fetch(`${API_URL}/slots/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      if (r.ok) fetchSlots()
    } catch { alert('Error de conexión') }
  }

  const addSlot = async (e) => {
    e.preventDefault()
    if (!newSlotDate || !newSlotTime) { alert('Completa fecha y hora'); return }
    setSubmitting(true)
    try {
      const r = await fetch(`${API_URL}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ date: newSlotDate, time: newSlotTime }),
      })
      if (r.ok) { setShowAddSlot(false); setNewSlotDate(''); setNewSlotTime(''); fetchSlots() }
      else { const err = await r.json(); alert(err.detail || 'No se pudo agregar') }
    } catch { alert('Error de conexión') }
    finally { setSubmitting(false) }
  }

  const quickAddSlots = async () => {
    if (!newSlotDate) { alert('Ingresa una fecha primero'); return }
    setSubmitting(true)
    const times = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']
    try {
      const r = await fetch(`${API_URL}/slots/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(times.map(time => ({ date: newSlotDate, time }))),
      })
      if (r.ok) { const created = await r.json(); setShowAddSlot(false); setNewSlotDate(''); fetchSlots(); alert(`${created.length} horarios agregados`) }
    } catch { alert('Error de conexión') }
    finally { setSubmitting(false) }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) { const reader = new FileReader(); reader.onloadend = () => setProfilePhoto(reader.result); reader.readAsDataURL(file) }
  }

  const saveProfile = async () => {
    if (!profileName.trim()) { alert('El nombre es requerido'); return }
    setSubmitting(true)
    try { await updateProfile(profileName.trim(), profilePhoto); setEditingProfile(false); alert('Perfil actualizado') }
    catch (err) { alert(err.message || 'No se pudo actualizar') }
    finally { setSubmitting(false) }
  }

  const copyLink = () => {
    if (barbershop) { navigator.clipboard.writeText(`${window.location.origin}/b/${barbershop.id}`); alert('Link copiado ✓') }
  }

  const handleLogout = () => { if (confirm('¿Cerrar sesión?')) { logout(); navigate('/') } }

  const statusClass = (s) => s === 'confirmed' ? 'status-confirmed' : s === 'rejected' ? 'status-rejected' : 'status-pending'
  const statusText = (s) => s === 'confirmed' ? 'Confirmada' : s === 'rejected' ? 'Rechazada' : 'Pendiente'
  const pendingCount = appointments.filter(a => a.status === 'pending').length

  if (authLoading) return <div className="admin-page"><div className="loading-container"><div className="spinner"></div></div></div>

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="header-left">
          {barbershop?.photo
            ? <img src={barbershop.photo} alt="" className="header-avatar" />
            : <div className="header-avatar-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg></div>
          }
          <div className="header-info">
            <h1>{barbershop?.name || 'Mi Barbería'}</h1>
            {pendingCount > 0 && <span className="pending-badge">{pendingCount} pendiente(s)</span>}
          </div>
        </div>
        <div className="header-actions">
          <button onClick={loadData} className="icon-btn" title="Actualizar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <button onClick={handleLogout} className="icon-btn logout-btn" title="Cerrar sesión">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      <nav className="admin-tabs">
        {[
          { key: 'appointments', label: 'Citas', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
          { key: 'slots', label: 'Horarios', icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
          { key: 'profile', label: 'Perfil', icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
        ].map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{t.icon}</svg>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="admin-content">
        {loading ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : (
          <>
            {activeTab === 'appointments' && (
              <div className="appointments-list fade-in">
                {appointments.length === 0 ? (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p>No hay citas</p>
                  </div>
                ) : appointments.map((apt) => (
                  <div key={apt.id} className="appointment-card">
                    <div className="appointment-header">
                      <div className="appointment-info">
                        <h3>{apt.client_name}</h3>
                        <p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>{apt.client_phone}</p>
                      </div>
                      <span className={`status-badge ${statusClass(apt.status)}`}>{statusText(apt.status)}</span>
                    </div>
                    <div className="appointment-datetime">
                      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{apt.date}</span>
                      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{apt.time}</span>
                    </div>
                    {apt.status === 'pending' && (
                      <div className="appointment-actions">
                        <button className="btn-confirm" onClick={() => updateStatus(apt.id, 'confirmed')}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>Confirmar
                        </button>
                        <button className="btn-reject" onClick={() => updateStatus(apt.id, 'rejected')}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'slots' && (
              <div className="slots-section fade-in">
                <button className="add-slot-btn" onClick={() => setShowAddSlot(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  Agregar horario
                </button>
                {slots.length === 0 ? (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p>No hay horarios configurados</p>
                  </div>
                ) : (
                  <div className="slots-list">
                    {slots.map((slot) => (
                      <div key={slot.id} className="slot-card">
                        <div className="slot-info">
                          <span className="slot-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>{slot.date}</span>
                          <span className="slot-time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{slot.time}</span>
                        </div>
                        <div className="slot-status">
                          <span className={`availability-badge ${slot.is_available ? 'available' : 'booked'}`}>{slot.is_available ? 'Disponible' : 'Reservado'}</span>
                          <button className="delete-btn" onClick={() => deleteSlot(slot.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="profile-section fade-in">
                <div className="profile-photo-container">
                  {editingProfile ? (
                    <label className="photo-upload">
                      {profilePhoto ? <img src={profilePhoto} alt="" /> : <div className="photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg></div>}
                      <div className="photo-overlay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
                      <input type="file" accept="image/*" onChange={handlePhotoChange} />
                    </label>
                  ) : (
                    <div className="profile-photo">
                      {barbershop?.photo ? <img src={barbershop.photo} alt="" /> : <div className="photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg></div>}
                    </div>
                  )}
                </div>

                {editingProfile
                  ? <input type="text" className="profile-name-input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Nombre de la barbería" />
                  : <h2 className="profile-name">{barbershop?.name}</h2>
                }

                {editingProfile ? (
                  <div className="profile-actions">
                    <button className="btn-cancel" onClick={() => { setEditingProfile(false); setProfileName(barbershop?.name || ''); setProfilePhoto(barbershop?.photo || null) }}>Cancelar</button>
                    <button className="btn-save" onClick={saveProfile} disabled={submitting}>{submitting ? <div className="spinner small"></div> : 'Guardar'}</button>
                  </div>
                ) : (
                  <button className="edit-profile-btn" onClick={() => setEditingProfile(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar perfil
                  </button>
                )}

                <div className="link-section">
                  <h3>Link de reservas</h3>
                  <div className="link-container">
                    <span className="link-text">{window.location.origin}/b/{barbershop?.id}</span>
                    <button className="copy-btn" onClick={copyLink}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                  </div>
                  <p className="link-hint">Comparte este link con tus clientes para que reserven citas</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {showAddSlot && (
        <div className="modal-overlay" onClick={() => setShowAddSlot(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Agregar Horario</h2>
              <button className="close-btn" onClick={() => setShowAddSlot(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={addSlot}>
              <div className="input-group"><label>Fecha</label><input type="date" value={newSlotDate} onChange={(e) => setNewSlotDate(e.target.value)} /></div>
              <div className="input-group"><label>Hora</label><input type="time" value={newSlotTime} onChange={(e) => setNewSlotTime(e.target.value)} /></div>
              <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? <div className="spinner small"></div> : 'Agregar horario'}</button>
              <button type="button" className="quick-add-btn" onClick={quickAddSlots} disabled={submitting}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Agregar horarios del día (9am-6pm)
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
