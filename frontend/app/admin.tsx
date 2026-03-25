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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface TimeSlot {
  id: string;
  date: string;
  time: string;
  is_available: boolean;
}

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

type TabType = 'appointments' | 'slots';

export default function AdminPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/appointments`);
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  }, []);

  // Fetch all slots
  const fetchSlots = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/slots/all`);
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAppointments(), fetchSlots()]);
    setLoading(false);
  }, [fetchAppointments, fetchSlots]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        Alert.alert(
          'Éxito',
          status === 'confirmed' ? 'Cita confirmada' : 'Cita rechazada'
        );
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

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newSlotDate)) {
      Alert.alert('Error', 'Formato de fecha: YYYY-MM-DD');
      return;
    }

    // Validate time format
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(newSlotTime)) {
      Alert.alert('Error', 'Formato de hora: HH:MM');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Panel Admin</Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'appointments' && styles.tabActive]}
          onPress={() => setActiveTab('appointments')}
        >
          <Ionicons
            name="calendar"
            size={20}
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
            size={20}
            color={activeTab === 'slots' ? '#6366F1' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'slots' && styles.tabTextActive]}>
            Horarios
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
          ) : (
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
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
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
