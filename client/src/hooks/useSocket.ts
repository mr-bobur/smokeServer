'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AlarmEventData,
  FloorData,
  SensorEndpointData,
  Sim7670Status
} from '../types';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  timestamp: string;
}

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<AlarmEventData | null>(null);
  const [latestSensorTick, setLatestSensorTick] = useState<SensorEndpointData[]>([]);
  const [latestFloorsTick, setLatestFloorsTick] = useState<FloorData[] | null>(null);
  const [sim7670Live, setSim7670Live] = useState<Sim7670Status | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [sirenBroadcast, setSirenBroadcast] = useState<{
    id: string;
    message: string;
    trigger_siren: boolean;
    issued_by: string;
    timestamp: string;
  } | null>(null);

  const pushToast = (
    title: string,
    message: string,
    type: ToastNotification['type'] = 'info'
  ) => {
    const item: ToastNotification = {
      id: `${Date.now()}-${Math.random()}`,
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setToasts((prev) => [item, ...prev.slice(0, 5)]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('TELEMETRY_BATCH_TICK', (data: { updated_sensors: SensorEndpointData[]; floors: FloorData[] }) => {
      if (data.updated_sensors) {
        setLatestSensorTick(data.updated_sensors);
      }
      if (data.floors) {
        setLatestFloorsTick(data.floors);
      }
    });

    socket.on('SENSOR_UPDATED', (data: { sensor: SensorEndpointData }) => {
      if (data.sensor) {
        setLatestSensorTick([data.sensor]);
      }
    });

    socket.on('SENSOR_PAIRED', (data: { sensor: SensorEndpointData; ble_packet: string }) => {
      if (data.sensor) {
        setLatestSensorTick([data.sensor]);
        pushToast(
          'BLE 5.0 Endpoint Commissioned',
          `${data.sensor.chip_id} paired on Floor ${data.sensor.floor_number} (${data.sensor.room_number}) — 3x Green LED NVS ACK`,
          'success'
        );
      }
    });

    socket.on('ALARM_TRIGGERED', (data: { alarm: AlarmEventData }) => {
      setActiveAlarm(data.alarm);
      pushToast(
        `CRITICAL ALARM: ${data.alarm.event_type}`,
        `Floor ${data.alarm.floor_number} • ${data.alarm.room_number} (${data.alarm.chip_id}) — 60s 112 Escalation Started!`,
        'critical'
      );
    });

    socket.on(
      'ALARM_COUNTDOWN',
      (data: { alarm_id: number; countdown_remaining_sec: number }) => {
        setActiveAlarm((prev) => {
          if (!prev || prev.id !== data.alarm_id) return prev;
          return {
            ...prev,
            countdown_remaining_sec: data.countdown_remaining_sec
          };
        });
      }
    );

    socket.on('ALARM_ACKNOWLEDGED', (data: { alarm: AlarmEventData }) => {
      setActiveAlarm((prev) => (prev && prev.id === data.alarm.id ? null : prev));
      pushToast(
        'False Alarm Acknowledged',
        `Alarm ${data.alarm.alarm_code} cancelled by ${data.alarm.acknowledged_by_name || 'Operator'}.`,
        'success'
      );
    });

    socket.on('ALARM_RESOLVED', (data: { alarm: AlarmEventData }) => {
      setActiveAlarm((prev) => (prev && prev.id === data.alarm.id ? null : prev));
      pushToast(
        'Alarm Resolved',
        `Incident ${data.alarm.alarm_code} marked as resolved.`,
        'info'
      );
    });

    socket.on('ALARM_ESCALATED_112', (data: { alarm: AlarmEventData }) => {
      setActiveAlarm(data.alarm);
      pushToast(
        '112 STATE EMERGENCY DISPATCHED',
        `Automated payload transmitted to FVV 112 Uzbekistan for Floor ${data.alarm.floor_number}, ${data.alarm.room_number}!`,
        'critical'
      );
    });

    socket.on('SIM7670_AT_LOG', (status: Sim7670Status) => {
      setSim7670Live(status);
    });

    socket.on(
      'SIREN_BROADCAST',
      (payload: {
        id: string;
        message: string;
        trigger_siren: boolean;
        issued_by: string;
        timestamp: string;
      }) => {
        setSirenBroadcast(payload);
        pushToast(
          payload.trigger_siren ? 'BUILDING EVACUATION SIREN' : 'Building Announcement',
          payload.message,
          payload.trigger_siren ? 'critical' : 'warning'
        );
      }
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    connected,
    activeAlarm,
    setActiveAlarm,
    latestSensorTick,
    latestFloorsTick,
    sim7670Live,
    toasts,
    pushToast,
    dismissToast,
    sirenBroadcast,
    setSirenBroadcast
  };
};
