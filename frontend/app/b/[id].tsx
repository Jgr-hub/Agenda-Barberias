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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Barbershop {
  id: string;
  name: string;
  photo: string | null;
}

interface TimeSlot {
  id: string;
  barberia_id: string;
  date: string;
  time: string;
  is_available: boolean;
}

interface BookingForm {
  client_name: string;
  client_phone: string;
}

export default function ClientBookingPage() {
  const { id: barbershopId } = useLocalSearchParams<{ id: string }>();
  
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<BookingForm>({
    client_name: '',
    client_phone: '',
  });
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate dates for next 14 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        full: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('es-ES', { weekday: 'short' }),
        date: date.getDate(),
        month: date.toLocaleDateString('es-ES', { month: 'short' }),
      });
    }
    return dates;
  };

  const dates = generateDates();

  // Fetch barbershop info
  const fetchBarbershop = useCallback(async () => {
    if (!barbershopId) return;
    
    try {
      const response = await fetch(`${API_URL}/api/barbershop/${barbershopId}/public`);
      if (response.ok) {
        const data = await response.json();
        setBarbershop(data);
        setError(null);
      } else {
        setError('Barbería no encontrada');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [barbershopId]);

  // Fetch available slots for selected date
  const fetchSlots = useCallback(async (date: string) => {
    if (!barbershopId) return;
    
    setSlotsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/barbershop/${barbershopId}/slots?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setSlots(data.filter((s: TimeSlot) => s.is_available));
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setSlotsLoading(false);
    }
  }, [barbershopId]);

  useEffect(() => {
    fetchBarbershop();
  }, [fetchBarbershop]);

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  // Select first date on mount
  useEffect(() => {
    if (dates.length > 0 && !selectedDate && !loading) {
      setSelectedDate(dates[0].full);
    }
  }, [loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBarbershop();
    if (selectedDate) {
      await fetchSlots(selectedDate);
    }
    setRefreshing(false);
  }, [fetchBarbershop, selectedDate, fetchSlots]);

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.client_name.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu nombre');
      return;
    }
    if (!form.client_phone.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu número de teléfono');
      return;
    }
    if (!selectedSlot || !barbershopId) return;

    Keyboard.dismiss();
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/barbershop/${barbershopId}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: form.client_name.trim(),
          client_phone: form.client_phone.trim(),
          date: selectedSlot.date,
          time: selectedSlot.time,
        }),
      });

      if (response.ok) {
        setBookingSuccess(true);
        setShowForm(false);
        setForm({ client_name: '', client_phone: '' });
        setSelectedSlot(null);
        fetchSlots(selectedDate);
      } else {
        const err = await response.json();
        Alert.alert('Error', err.detail || 'No se pudo crear la cita');
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setBookingSuccess(false);
    setSelectedSlot(null);
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !barbershop) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Barbería no encontrada</Text>
          <Text style={styles.errorText}>
            El link que ingresaste no es válido o la barbería ya no existe.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success Screen
  if (bookingSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>¡Solicitud Enviada!</Text>
          <Text style={styles.successText}>
            Tu solicitud de cita en {barbershop.name} ha sido enviada. Te confirmarán pronto.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={resetBooking}>
            <Text style={styles.primaryButtonText}>Hacer otra reserva</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          {barbershop.photo ? (
            <Image source={{ uri: barbershop.photo }} style={styles.headerPhoto} />
          ) : (
            <View style={styles.headerPhotoPlaceholder}>
              <Ionicons name="cut" size={24} color="#6366F1" />
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{barbershop.name}</Text>
            <Text style={styles.headerSubtitle}>Reserva tu cita</Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Date Picker */}
          <Text style={styles.sectionTitle}>Selecciona una fecha</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateScroll}
          >
            {dates.map((d) => (
              <TouchableOpacity
                key={d.full}
                style={[
                  styles.dateCard,
                  selectedDate === d.full && styles.dateCardSelected,
                ]}
                onPress={() => {
                  setSelectedDate(d.full);
                  setSelectedSlot(null);
                  setShowForm(false);
                }}
              >
                <Text
                  style={[
                    styles.dateDay,
                    selectedDate === d.full && styles.dateDaySelected,
                  ]}
                >
                  {d.day}
                </Text>
                <Text
                  style={[
                    styles.dateNum,
                    selectedDate === d.full && styles.dateNumSelected,
                  ]}
                >
                  {d.date}
                </Text>
                <Text
                  style={[
                    styles.dateMonth,
                    selectedDate === d.full && styles.dateMonthSelected,
                  ]}
                >
                  {d.month}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time Slots */}
          <Text style={styles.sectionTitle}>Horarios disponibles</Text>
          {slotsLoading ? (
            <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
          ) : slots.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No hay horarios disponibles</Text>
              <Text style={styles.emptySubtext}>Selecciona otra fecha</Text>
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.slotCard,
                    selectedSlot?.id === slot.id && styles.slotCardSelected,
                  ]}
                  onPress={() => handleSlotSelect(slot)}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={selectedSlot?.id === slot.id ? '#FFFFFF' : '#6366F1'}
                  />
                  <Text
                    style={[
                      styles.slotTime,
                      selectedSlot?.id === slot.id && styles.slotTimeSelected,
                    ]}
                  >
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Booking Form */}
          {showForm && selectedSlot && (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Completa tu reserva</Text>
              <Text style={styles.formSubtitle}>
                {selectedDate} a las {selectedSlot.time}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre completo"
                  placeholderTextColor="#9CA3AF"
                  value={form.client_name}
                  onChangeText={(text) => setForm({ ...form, client_name: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu número de teléfono"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={form.client_phone}
                  onChangeText={(text) => setForm({ ...form, client_phone: text })}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Solicitar Cita</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowForm(false);
                  setSelectedSlot(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
  },
  headerPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  dateScroll: {
    marginBottom: 24,
  },
  dateCard: {
    width: 70,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  dateCardSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  dateDay: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  dateDaySelected: {
    color: '#C7D2FE',
  },
  dateNum: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginVertical: 4,
  },
  dateNumSelected: {
    color: '#FFFFFF',
  },
  dateMonth: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  dateMonthSelected: {
    color: '#C7D2FE',
  },
  loader: {
    marginVertical: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minWidth: '30%',
  },
  slotCardSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  slotTimeSelected: {
    color: '#FFFFFF',
  },
  formContainer: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6366F1',
    marginTop: 4,
    marginBottom: 20,
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
