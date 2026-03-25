import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface TimeSlot {
  id: string;
  barberia_id: string;
  date: string;
  time: string;
  is_available: boolean;
}

interface Appointment {
  id: string;
  barberia_id: string;
  client_name: string;
  client_phone: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

type TabType = 'appointments' | 'slots' | 'profile';

export default function AdminPanel() {
  const router = useRouter();
  const { barbershop, token, logout, updateProfile, isLoading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Profile state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !token) {
      router.replace('/login');
    }
  }, [authLoading, token]);

  useEffect(() => {
    if (barbershop) {
      setProfileName(barbershop.name);
      setProfilePhoto(barbershop.photo);
    }
  }, [barbershop]);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  }, [token]);

  // Fetch all slots
  const fetchSlots = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/slots/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  }, [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAppointments(), fetchSlots()]);
    setLoading(false);
  }, [fetchAppointments, fetchSlots]);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Update appointment status
  const updateAppointmentStatus = async (id: string, status: 'confirmed' | 'rejected') => {
    try {
      const response = await fetch(`${API_URL}/api/appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        Alert.alert('Éxito', status === 'confirmed' ? 'Cita confirmada' : 'Cita rechazada');
        fetchAppointments();
        fetchSlots();
      } else {
        Alert.alert('Error', 'No se pudo actualizar la cita');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  // Delete slot
  const deleteSlot = async (id: string) => {
    Alert.alert(
      'Eliminar horario',
      '¿Estás seguro de eliminar este horario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/slots/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (response.ok) {
                fetchSlots();
              } else {
                Alert.alert('Error', 'No se pudo eliminar el horario');
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            }
          },
        },
      ]
    );
  };

  // Add slot
  const addSlot = async () => {
    if (!newSlotDate || !newSlotTime) {
      Alert.alert('Error', 'Completa fecha y hora');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newSlotDate)) {
      Alert.alert('Error', 'Formato de fecha: YYYY-MM-DD');
      return;
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(newSlotTime)) {
      Alert.alert('Error', 'Formato de hora: HH:MM');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date: newSlotDate, time: newSlotTime }),
      });

      if (response.ok) {
        setShowAddSlot(false);
        setNewSlotDate('');
        setNewSlotTime('');
        fetchSlots();
        Alert.alert('Éxito', 'Horario agregado');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo agregar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick add slots for a date
  const quickAddSlots = async () => {
    if (!newSlotDate) {
      Alert.alert('Error', 'Ingresa una fecha primero');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newSlotDate)) {
      Alert.alert('Error', 'Formato de fecha: YYYY-MM-DD');
      return;
    }

    setSubmitting(true);
    const defaultTimes = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '14:00', '14:30', '15:00', '15:30', '16:00',
      '16:30', '17:00', '17:30', '18:00',
    ];

    try {
      const slotsToCreate = defaultTimes.map(time => ({
        date: newSlotDate,
        time,
      }));

      const response = await fetch(`${API_URL}/api/slots/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(slotsToCreate),
      });

      if (response.ok) {
        const created = await response.json();
        setShowAddSlot(false);
        setNewSlotDate('');
        fetchSlots();
        Alert.alert('Éxito', `${created.length} horarios agregados`);
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  // Pick image for profile
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setProfilePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // Save profile
  const saveProfile = async () => {
    if (!profileName.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    setSubmitting(true);
    try {
      await updateProfile(profileName.trim(), profilePhoto);
      setEditingProfile(false);
      Alert.alert('Éxito', 'Perfil actualizado');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  // Copy link
  const copyLink = () => {
    if (barbershop) {
      const link = `${API_URL}/b/${barbershop.id}`;
      Clipboard.setString(link);
      Alert.alert('Copiado', 'Link copiado al portapapeles');
    }
  };

  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'rejected': return 'Rechazada';
      default: return 'Pendiente';
    }
  };

  const pendingCount = appointments.filter(a => a.status === 'pending').length;

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {barbershop?.photo ? (
            <Image source={{ uri: barbershop.photo }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Ionicons name="cut" size={20} color="#6366F1" />
            </View>
          )}
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {barbershop?.name || 'Mi Barbería'}
            </Text>
            {pendingCount > 0 && (
              <Text style={styles.pendingText}>{pendingCount} pendiente(s)</Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
            <Ionicons name="refresh" size={22} color="#6366F1" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'appointments' && styles.tabActive]}
          onPress={() => setActiveTab('appointments')}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={activeTab === 'appointments' ? '#6366F1' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'appointments' && styles.tabTextActive]}>
            Citas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'slots' && styles.tabActive]}
          onPress={() => setActiveTab('slots')}
        >
          <Ionicons
            name="time"
            size={18}
            color={activeTab === 'slots' ? '#6366F1' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'slots' && styles.tabTextActive]}>
            Horarios
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons
            name="person"
            size={18}
            color={activeTab === 'profile' ? '#6366F1' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            Perfil
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === 'appointments' ? (
            // Appointments Tab
            <>
              {appointments.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No hay citas</Text>
                </View>
              ) : (
                appointments.map((apt) => (
                  <View key={apt.id} style={styles.appointmentCard}>
                    <View style={styles.appointmentHeader}>
                      <View style={styles.appointmentInfo}>
                        <Text style={styles.appointmentName}>{apt.client_name}</Text>
                        <Text style={styles.appointmentPhone}>
                          <Ionicons name="call-outline" size={14} color="#6B7280" />
                          {' '}{apt.client_phone}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(apt.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(apt.status) }]}>
                          {getStatusText(apt.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.appointmentDateTime}>
                      <View style={styles.dateTimeItem}>
                        <Ionicons name="calendar-outline" size={16} color="#6366F1" />
                        <Text style={styles.dateTimeText}>{apt.date}</Text>
                      </View>
                      <View style={styles.dateTimeItem}>
                        <Ionicons name="time-outline" size={16} color="#6366F1" />
                        <Text style={styles.dateTimeText}>{apt.time}</Text>
                      </View>
                    </View>
                    {apt.status === 'pending' && (
                      <View style={styles.appointmentActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.confirmButton]}
                          onPress={() => updateAppointmentStatus(apt.id, 'confirmed')}
                        >
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Confirmar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.rejectButton]}
                          onPress={() => updateAppointmentStatus(apt.id, 'rejected')}
                        >
                          <Ionicons name="close" size={18} color="#FFFFFF" />
                          <Text style={styles.actionButtonText}>Rechazar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          ) : activeTab === 'slots' ? (
            // Slots Tab
            <>
              <TouchableOpacity
                style={styles.addSlotButton}
                onPress={() => setShowAddSlot(true)}
              >
                <Ionicons name="add-circle" size={24} color="#6366F1" />
                <Text style={styles.addSlotButtonText}>Agregar horario</Text>
              </TouchableOpacity>

              {slots.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No hay horarios configurados</Text>
                </View>
              ) : (
                slots.map((slot) => (
                  <View key={slot.id} style={styles.slotCard}>
                    <View style={styles.slotInfo}>
                      <View style={styles.slotDateTime}>
                        <Ionicons name="calendar-outline" size={18} color="#6366F1" />
                        <Text style={styles.slotDateText}>{slot.date}</Text>
                      </View>
                      <View style={styles.slotDateTime}>
                        <Ionicons name="time-outline" size={18} color="#6366F1" />
                        <Text style={styles.slotTimeText}>{slot.time}</Text>
                      </View>
                    </View>
                    <View style={styles.slotStatus}>
                      <View
                        style={[
                          styles.availabilityBadge,
                          { backgroundColor: slot.is_available ? '#10B98120' : '#EF444420' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.availabilityText,
                            { color: slot.is_available ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {slot.is_available ? 'Disponible' : 'Reservado'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteSlot(slot.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : (
            // Profile Tab
            <View style={styles.profileContainer}>
              {/* Profile Photo */}
              <TouchableOpacity
                style={styles.profilePhotoContainer}
                onPress={editingProfile ? pickImage : undefined}
                disabled={!editingProfile}
              >
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.profilePhotoPlaceholder}>
                    <Ionicons name="cut" size={40} color="#6366F1" />
                  </View>
                )}
                {editingProfile && (
                  <View style={styles.editPhotoOverlay}>
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Profile Name */}
              {editingProfile ? (
                <TextInput
                  style={styles.profileNameInput}
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Nombre de la barbería"
                  placeholderTextColor="#9CA3AF"
                />
              ) : (
                <Text style={styles.profileName}>{barbershop?.name}</Text>
              )}

              {/* Edit/Save Button */}
              {editingProfile ? (
                <View style={styles.profileActions}>
                  <TouchableOpacity
                    style={styles.cancelProfileButton}
                    onPress={() => {
                      setEditingProfile(false);
                      setProfileName(barbershop?.name || '');
                      setProfilePhoto(barbershop?.photo || null);
                    }}
                  >
                    <Text style={styles.cancelProfileButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveProfileButton, submitting && styles.buttonDisabled]}
                    onPress={saveProfile}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.saveProfileButtonText}>Guardar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editProfileButton}
                  onPress={() => setEditingProfile(true)}
                >
                  <Ionicons name="pencil" size={18} color="#6366F1" />
                  <Text style={styles.editProfileButtonText}>Editar perfil</Text>
                </TouchableOpacity>
              )}

              {/* Shareable Link */}
              <View style={styles.linkSection}>
                <Text style={styles.linkLabel}>Link de reservas</Text>
                <View style={styles.linkContainer}>
                  <Text style={styles.linkText} numberOfLines={1}>
                    {`${API_URL}/b/${barbershop?.id}`}
                  </Text>
                  <TouchableOpacity style={styles.copyButton} onPress={copyLink}>
                    <Ionicons name="copy-outline" size={20} color="#6366F1" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.linkHint}>
                  Comparte este link con tus clientes para que reserven citas
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Slot Modal */}
      <Modal
        visible={showAddSlot}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddSlot(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Horario</Text>
              <TouchableOpacity onPress={() => setShowAddSlot(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Fecha (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2025-07-15"
                placeholderTextColor="#9CA3AF"
                value={newSlotDate}
                onChangeText={setNewSlotDate}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Hora (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="10:00"
                placeholderTextColor="#9CA3AF"
                value={newSlotTime}
                onChangeText={setNewSlotTime}
              />
            </View>

            <TouchableOpacity
              style={[styles.modalButton, styles.primaryModalButton]}
              onPress={addSlot}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalButtonText}>Agregar horario</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.secondaryModalButton]}
              onPress={quickAddSlots}
              disabled={submitting}
            >
              <Ionicons name="flash" size={18} color="#6366F1" />
              <Text style={styles.secondaryModalButtonText}>
                Agregar horarios del día (9am-6pm)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    maxWidth: 180,
  },
  pendingText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#6366F1',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  appointmentPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentDateTime: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 6,
  },
  appointmentActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  addSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
  },
  addSlotButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 8,
  },
  slotCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  slotDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotDateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 6,
  },
  slotTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 6,
  },
  slotStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 6,
  },
  // Profile styles
  profileContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  profilePhotoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  profileNameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    minWidth: 200,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 6,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelProfileButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  cancelProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveProfileButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#6366F1',
    borderRadius: 20,
  },
  saveProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  linkSection: {
    width: '100%',
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#6366F1',
    paddingVertical: 12,
  },
  copyButton: {
    padding: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  linkHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryModalButton: {
    backgroundColor: '#6366F1',
  },
  secondaryModalButton: {
    backgroundColor: '#EEF2FF',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryModalButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});
