import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import './Admin.css'
 
const API_URL = import.meta.env.VITE_API_URL || '/api'
 
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
 
const TIME_SLOTS = [
  '10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00'
]
 
const getTodayStr = () => {
  const t = new Date()
  t.setHours(0,0,0,0)
  return t.toISOString().split('T')[0]
}
 
const getTomorrowStr = () => {
  const t = new Date()
  t.setHours(0,0,0,0)
  t.setDate(t.getDate() + 1)
  return t.toISOString().split('T')[0]
}
 
const formatDateLabel = (dateStr) => {
  const [year, month, day] = dateStr.split('-')
  if (dateStr === getTodayStr()) return 'Hoy — ' + parseInt(day) + ' ' + MESES[parseInt(month)-1] + ' ' + year
  if (dateStr === getTomorrowStr()) return 'Mañana — ' + parseInt(day) + ' ' + MESES[parseInt(month)-1] + ' ' + year
  return parseInt(day) + ' ' + MESES[parseInt(month)-1] + ' ' + year
}
 
const formatTime = (time) => {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'pm' : 'am'
  const hour12 = hour % 12 || 12
  return hour12 + ':' + m + ampm
}
 
function StatsTab({ appointments }) {
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
 
  const thisMonthApts = appointments.filter(a => {
    const d = new Date(a.date)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const lastMonthApts = appointments.filter(a => {
    const d = new Date(a.date)
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
  })
 
  const weekStart = new Date()
  weekStart.setHours(0,0,0,0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const thisWeekApts = appointments.filter(a => new Date(a.date) >= weekStart)
 
  const todayApts = appointments.filter(a => a.date === getTodayStr())
 
  const diffMonth = thisMonthApts.length - lastMonthApts.length
 
  const dayCount = [0,0,0,0,0,0,0]
  appointments.forEach(a => {
    const d = new Date(a.date)
    dayCount[d.getDay()]++
  })
  const maxDay = Math.max(...dayCount, 1)
 
  const hourCount = {}
  TIME_SLOTS.forEach(t => { hourCount[t] = 0 })
  appointments.forEach(a => {
    if (hourCount[a.time] !== undefined) hourCount[a.time]++
  })
  const maxHour = Math.max(...Object.values(hourCount), 1)
 
  const clientCount = {}
  appointments.forEach(a => {
    const key = a.client_name + '|' + a.client_phone
    clientCount[key] = (clientCount[key] || 0) + 1
  })
  const topClients = Object.entries(clientCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ name: key.split('|')[0], phone: key.split('|')[1], count }))
 
  const hotHours = TIME_SLOTS.filter(t => hourCount[t] >= maxHour * 0.7)
 
  return (
    <div className="stats-tab fade-in">
      <div className="stats-metrics">
        <div className="stat-card">
          <div className="stat-label">Este mes</div>
          <div className="stat-value">{thisMonthApts.length}</div>
          <div className={'stat-sub ' + (diffMonth >= 0 ? 'up' : 'down')}>
            {diffMonth >= 0 ? '+' : ''}{diffMonth} vs mes ant.
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Esta semana</div>
          <div className="stat-value">{thisWeekApts.length}</div>
          <div className="stat-sub up">{todayApts.length} citas hoy</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total citas</div>
          <div className="stat-value">{appointments.length}</div>
          <div className="stat-sub up">desde el inicio</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hora pico</div>
          <div className="stat-value" style={{fontSize:'18px'}}>
            {hotHours.length > 0 ? formatTime(hotHours[0]) : '--'}
          </div>
          <div className="stat-sub up">más solicitada</div>
        </div>
      </div>
 
      <div className="stats-section-title">Citas por día de la semana</div>
      <div className="stats-chart-card">
        {DIAS_SEMANA.map((dia, i) => (
          <div key={dia} className="stats-bar-row">
            <div className="stats-bar-label">{dia}</div>
            <div className="stats-bar-track">
              <div
                className="stats-bar-fill"
                style={{width: Math.round((dayCount[i] / maxDay) * 100) + '%'}}
              >
                {dayCount[i] > 0 && <span>{dayCount[i]}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
 
      <div className="stats-section-title">Horas más solicitadas</div>
      <div className="stats-chart-card">
        <div className="stats-hour-grid">
          {TIME_SLOTS.map(time => {
            const count = hourCount[time]
            const ratio = count / maxHour
            const isHot = ratio >= 0.7
            const isWarm = ratio >= 0.4 && ratio < 0.7
            return (
              <div key={time} className={'stats-hour-cell' + (isHot ? ' hot' : isWarm ? ' warm' : '')}>
                <div className="stats-hour-time">{formatTime(time)}</div>
                <div className="stats-hour-count">{count}</div>
              </div>
            )
          })}
        </div>
      </div>
 
      {topClients.length > 0 && (
        <>
          <div className="stats-section-title">Clientes frecuentes</div>
          <div className="stats-chart-card">
            {topClients.map((c, i) => (
              <div key={i} className="stats-client-row">
                <div className="stats-client-rank">{i + 1}</div>
                <div className="stats-client-info">
                  <div className="stats-client-name">{c.name}</div>
                  <div className="stats-client-phone">{c.phone}</div>
                </div>
                <div className="stats-client-badge">{c.count} visita{c.count > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </>
      )}
 
      {appointments.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p>Aún no hay datos suficientes</p>
          <span>Las estadísticas aparecerán cuando tengas citas registradas</span>
        </div>
      )}
    </div>
  )
}
 
export default function Admin() {
  const navigate = useNavigate()
  const { barbershop, token, logout, updateProfile, isLoading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhoto, setProfilePhoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [expandedDays, setExpandedDays] = useState(() => ({ [getTodayStr()]: true }))
 
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedTimes, setSelectedTimes] = useState([])
  const [savingSlots, setSavingSlots] = useState(false)
 
  useEffect(() => { if (!authLoading && !token) navigate('/login') }, [authLoading, token, navigate])
  useEffect(() => { if (barbershop) { setProfileName(barbershop.name); setProfilePhoto(barbershop.photo) } }, [barbershop])
 
  const fetchAppointments = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch(API_URL + '/appointments', { headers: { 'Authorization': 'Bearer ' + token } })
      if (r.ok) setAppointments(await r.json())
    } catch (e) { console.error(e) }
  }, [token])
 
  const fetchSlots = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch(API_URL + '/slots/all', { headers: { 'Authorization': 'Bearer ' + token } })
      if (r.ok) setSlots(await r.json())
    } catch (e) { console.error(e) }
  }, [token])
 
  const loadData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchAppointments(), fetchSlots()])
    setLoading(false)
  }, [fetchAppointments, fetchSlots])
 
  useEffect(() => { if (token) loadData() }, [token, loadData])
 
  useEffect(() => {
    if (!token) return
    const interval = setInterval(() => { fetchAppointments() }, 30000)
    return () => clearInterval(interval)
  }, [token, fetchAppointments])
 
  const deleteAppointment = async (id) => {
    if (!confirm('¿Cancelar esta cita?')) return
    try {
      const r = await fetch(API_URL + '/appointments/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (r.ok) { fetchAppointments(); fetchSlots() }
      else alert('No se pudo cancelar la cita')
    } catch { alert('Error de conexión') }
  }
 
  const deleteSlot = async (id) => {
    if (!confirm('¿Eliminar este horario?')) return
    try {
      const r = await fetch(API_URL + '/slots/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
      if (r.ok) fetchSlots()
    } catch { alert('Error de conexión') }
  }
 
  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) { const reader = new FileReader(); reader.onloadend = () => setProfilePhoto(reader.result); reader.readAsDataURL(file) }
  }
 
  const saveProfile = async () => {
    if (!profileName.trim()) { alert('El nombre es requerido'); return }
    setSubmitting(true)
    try { await updateProfile(profileName.trim(), profilePhoto); setEditingProfile(false) }
    catch (err) { alert(err.message || 'No se pudo actualizar') }
    finally { setSubmitting(false) }
  }
 
  const copyLink = () => {
    if (barbershop) { navigator.clipboard.writeText(window.location.origin + '/b/' + barbershop.id); alert('Link copiado ✓') }
  }
 
  const handleLogout = () => { if (confirm('¿Cerrar sesión?')) { logout(); navigate('/') } }
 
  const statusClass = (s) => s === 'confirmed' ? 'status-confirmed' : s === 'rejected' ? 'status-rejected' : 'status-pending'
  const statusText = (s) => s === 'confirmed' ? 'Confirmada' : s === 'rejected' ? 'Rechazada' : 'Pendiente'
 
  const todayStr = getTodayStr()
  const todayCount = appointments.filter(a => a.date === todayStr).length
 
  const upcomingAppointments = appointments.filter(a => a.date >= todayStr)
  const pastAppointments = appointments.filter(a => a.date < todayStr)
 
  const groupByDate = (list) => {
    const sorted = [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.time.localeCompare(b.time)
    })
    return sorted.reduce((groups, apt) => {
      if (!groups[apt.date]) groups[apt.date] = []
      groups[apt.date].push(apt)
      return groups
    }, {})
  }
 
  const groupedUpcoming = groupByDate(upcomingAppointments)
  const groupedPast = groupByDate(pastAppointments)
  const upcomingDates = Object.keys(groupedUpcoming).sort()
  const pastDates = Object.keys(groupedPast).sort((a, b) => b.localeCompare(a))
 
  const toggleDay = (date) => setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }))
 
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth }
  }
 
  const formatDate = (year, month, day) => {
    return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')
  }
 
  const getSlotsForDate = (dateStr) => slots.filter(s => s.date === dateStr)
 
  const today = new Date()
  today.setHours(0,0,0,0)
 
  const handleDayClick = (day) => {
    const dateStr = formatDate(calendarDate.getFullYear(), calendarDate.getMonth(), day)
    const clicked = new Date(dateStr)
    if (clicked < today) return
    setSelectedDay(dateStr)
    const existingTimes = getSlotsForDate(dateStr).map(s => s.time)
    setSelectedTimes(existingTimes)
  }
 
  const toggleTime = (time) => {
    setSelectedTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    )
  }
 
  const saveSlots = async () => {
    if (!selectedDay) return
    setSavingSlots(true)
    try {
      const existingSlots = getSlotsForDate(selectedDay)
      for (const slot of existingSlots) {
        if (slot.is_available) {
          await fetch(API_URL + '/slots/' + slot.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        }
      }
      if (selectedTimes.length > 0) {
        await fetch(API_URL + '/slots/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify(selectedTimes.map(time => ({ date: selectedDay, time }))),
        })
      }
      await fetchSlots()
      setSelectedDay(null)
      setSelectedTimes([])
    } catch { alert('Error al guardar') }
    finally { setSavingSlots(false) }
  }
 
  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
 
  const { firstDay, daysInMonth } = getDaysInMonth(calendarDate)
 
  const renderAppointmentCard = (apt) => (
    <div key={apt.id} className="appointment-card">
      <div className="appointment-header">
        <div className="appointment-info">
          <h3>{apt.client_name}</h3>
          <p>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 11.9 19.79 19.79 0 0 1 1.12 3.24 2 2 0 0 1 3.1 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            {apt.client_phone}
          </p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <span className={'status-badge ' + statusClass(apt.status)}>{statusText(apt.status)}</span>
          <button
            onClick={() => deleteAppointment(apt.id)}
            style={{background:'none',border:'none',cursor:'pointer',padding:'4px',color:'#e55',opacity:0.7}}
            title="Cancelar cita"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div className="appointment-datetime">
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {formatDateLabel(apt.date)}
        </span>
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {formatTime(apt.time)}
        </span>
      </div>
    </div>
  )
 
  const renderDayGroup = (date, group) => (
    <div key={date} className="day-group">
      <div
        className={'day-label' + (date === todayStr ? ' day-label-today' : '')}
        onClick={() => toggleDay(date)}
        style={{cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}
      >
        <span>{formatDateLabel(date)}</span>
        <span style={{fontSize:'11px',opacity:0.7}}>
          {group.length} cita(s) {expandedDays[date] ? '▲' : '▼'}
        </span>
      </div>
      {expandedDays[date] && group.map(apt => renderAppointmentCard(apt))}
    </div>
  )
 
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
            {todayCount > 0
              ? <span className="pending-badge">{todayCount} cita(s) hoy</span>
              : <span style={{fontSize:'12px',color:'#888'}}>Sin citas hoy</span>
            }
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
          { key: 'stats', label: 'Estadísticas', icon: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
          { key: 'slots', label: 'Horarios', icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
          { key: 'profile', label: 'Perfil', icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
        ].map(t => (
          <button key={t.key} className={'tab' + (activeTab === t.key ? ' active' : '')} onClick={() => setActiveTab(t.key)}>
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
                {upcomingAppointments.length === 0 && pastAppointments.length === 0 ? (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p>No hay citas</p>
                  </div>
                ) : (
                  <>
                    {upcomingDates.map(date => renderDayGroup(date, groupedUpcoming[date]))}
                    {pastAppointments.length > 0 && (
                      <div style={{marginTop:'24px'}}>
                        <button
                          onClick={() => setShowHistory(prev => !prev)}
                          style={{width:'100%',background:'none',border:'0.5px solid #333',borderRadius:'8px',padding:'10px 16px',color:'#888',cursor:'pointer',fontSize:'13px',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                        >
                          <span>Historial ({pastAppointments.length} citas)</span>
                          <span>{showHistory ? '▲' : '▼'}</span>
                        </button>
                        {showHistory && (
                          <div style={{marginTop:'8px',opacity:0.7}}>
                            {pastDates.map(date => renderDayGroup(date, groupedPast[date]))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
 
            {activeTab === 'stats' && <StatsTab appointments={appointments} />}
 
            {activeTab === 'slots' && (
              <div className="calendar-section fade-in">
                {!selectedDay ? (
                  <>
                    <div className="calendar-header">
                      <button className="cal-nav-btn" onClick={prevMonth}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <h2>{MONTHS_ES[calendarDate.getMonth()]} {calendarDate.getFullYear()}</h2>
                      <button className="cal-nav-btn" onClick={nextMonth}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>
                    <div className="calendar-grid">
                      {DAYS_ES.map(d => (
                        <div key={d} className="cal-day-label">{d}</div>
                      ))}
                      {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={'empty-' + i} className="cal-day empty" />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1
                        const dateStr = formatDate(calendarDate.getFullYear(), calendarDate.getMonth(), day)
                        const daySlots = getSlotsForDate(dateStr)
                        const isPast = new Date(dateStr) < today
                        const hasSlots = daySlots.length > 0
                        const availableCount = daySlots.filter(s => s.is_available).length
                        const bookedCount = daySlots.filter(s => !s.is_available).length
                        return (
                          <div
                            key={day}
                            className={'cal-day ' + (isPast ? 'past' : 'future') + (hasSlots ? ' has-slots' : '')}
                            onClick={() => !isPast && handleDayClick(day)}
                          >
                            <span className="cal-day-num">{day}</span>
                            {hasSlots && (
                              <div className="cal-day-indicators">
                                {availableCount > 0 && <span className="dot available">{availableCount}</span>}
                                {bookedCount > 0 && <span className="dot booked">{bookedCount}</span>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="cal-legend">
                      <span><span className="dot available">2</span> Disponibles</span>
                      <span><span className="dot booked">1</span> Reservados</span>
                    </div>
                    <p className="cal-hint">Toca un día para configurar los horarios disponibles</p>
                  </>
                ) : (
                  <div className="time-picker fade-in">
                    <div className="time-picker-header">
                      <button className="back-btn" onClick={() => { setSelectedDay(null); setSelectedTimes([]) }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        Volver
                      </button>
                      <h2>{selectedDay}</h2>
                    </div>
                    <p className="time-picker-hint">Selecciona los horarios disponibles para este día</p>
                    <div className="time-grid">
                      {TIME_SLOTS.map(time => {
                        const existingSlot = getSlotsForDate(selectedDay).find(s => s.time === time)
                        const isBooked = existingSlot && !existingSlot.is_available
                        const isSelected = selectedTimes.includes(time)
                        return (
                          <button
                            key={time}
                            className={'time-slot-btn' + (isSelected ? ' selected' : '') + (isBooked ? ' booked' : '')}
                            onClick={() => !isBooked && toggleTime(time)}
                            disabled={isBooked}
                          >
                            {time}
                            {isBooked && <span className="booked-label">Reservado</span>}
                          </button>
                        )
                      })}
                    </div>
                    <div className="time-picker-actions">
                      <button className="btn-cancel" onClick={() => { setSelectedDay(null); setSelectedTimes([]) }}>Cancelar</button>
                      <button className="btn-save" onClick={saveSlots} disabled={savingSlots}>
                        {savingSlots ? <div className="spinner small"></div> : 'Guardar (' + selectedTimes.length + ' horarios)'}
                      </button>
                    </div>
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
    </div>
  )
}