'use client';

import React, { useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Upload,
  PlusCircle,
  Radio,
  Sparkles,
  X
} from 'lucide-react';
import {
  FloorData,
  PairingSessionData,
  RoomApartmentData,
  SensorEndpointData
} from '../../types';
import { SensorPin } from './SensorPin';
import { useAppSettings } from '../../context/AppSettingsContext';

interface BlueprintViewerProps {
  floor: FloorData | null;
  rooms: RoomApartmentData[];
  sensors: SensorEndpointData[];
  selectedSensor: SensorEndpointData | null;
  onSelectSensor: (sensor: SensorEndpointData) => void;
  allowDragSensors?: boolean;
  onSaveSensorCoords?: (sensorId: number, coord_x: number, coord_y: number) => void;
  onUploadBlueprintUrl?: (url: string) => void;
  // Drag & Drop New Device Pairing
  activePairingSession?: PairingSessionData | null;
  onStartDragDropPairing?: (params: {
    room_id?: number;
    coord_x: number;
    coord_y: number;
  }) => Promise<PairingSessionData | null>;
  onCompleteIntroPacketPairing?: (params: {
    session_id?: string;
    intro_type_byte: string;
    raw_intro_packet_hex?: string;
    chip_id?: string;
  }) => Promise<unknown>;
  onCancelPairing?: () => void;
  filterRoomId?: number;
}

const INTRO_PACKET_PRESETS = [
  {
    typeByte: '0x01',
    sensorType: 'SMOKE_MQ2',
    nameKey: 'type_SMOKE_MQ2',
    sampleHex: 'AA FF C38A9101 01 64 C4 9B 55',
    desc: 'Byte[5]=0x01 → Auto-detected as Dedicated Smoke Detector (MQ-2)'
  },
  {
    typeByte: '0x02',
    sensorType: 'TEMP_DS18B20',
    nameKey: 'type_TEMP_DS18B20',
    sampleHex: 'AA FF C38A9102 02 64 A2 1F 55',
    desc: 'Byte[5]=0x02 → Auto-detected as Dedicated Temperature Sensor (DS18B20)'
  },
  {
    typeByte: '0x03',
    sensorType: 'DOOR_REED',
    nameKey: 'type_DOOR_REED',
    sampleHex: 'AA FF C38A9103 03 64 7E 40 55',
    desc: 'Byte[5]=0x03 → Auto-detected as Dedicated Door Reed Switch'
  },
  {
    typeByte: '0x04',
    sensorType: 'CO_MQ7',
    nameKey: 'type_CO_MQ7',
    sampleHex: 'AA FF C38A9104 04 64 5B 88 55',
    desc: 'Byte[5]=0x04 → Auto-detected as Dedicated CO Gas Detector (MQ-7)'
  },
  {
    typeByte: '0x05',
    sensorType: 'GLASS_BREAK',
    nameKey: 'type_GLASS_BREAK',
    sampleHex: 'AA FF C38A9105 05 64 39 D1 55',
    desc: 'Byte[5]=0x05 → Auto-detected as Dedicated Glass Break Sensor'
  }
];

export const BlueprintViewer: React.FC<BlueprintViewerProps> = ({
  floor,
  rooms,
  sensors,
  selectedSensor,
  onSelectSensor,
  allowDragSensors = false,
  onSaveSensorCoords,
  onUploadBlueprintUrl,
  activePairingSession,
  onStartDragDropPairing,
  onCompleteIntroPacketPairing,
  onCancelPairing,
  filterRoomId
}) => {
  const { t } = useAppSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<boolean>(false);
  const [draggingSensorId, setDraggingSensorId] = useState<number | null>(null);
  const [customBgUrl, setCustomBgUrl] = useState<string>('');
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false);

  // Drag & drop new device installation state
  const [placeNewDeviceMode, setPlaceNewDeviceMode] = useState<boolean>(false);
  const [selectedIntroPreset, setSelectedIntroPreset] = useState(INTRO_PACKET_PRESETS[0]);
  const [customIntroHex, setCustomIntroHex] = useState<string>(
    INTRO_PACKET_PRESETS[0].sampleHex
  );
  const [pairingBusy, setPairingBusy] = useState<boolean>(false);

  const visibleRooms = filterRoomId
    ? rooms.filter((r) => r.id === filterRoomId)
    : rooms;
  const visibleSensors = filterRoomId
    ? sensors.filter((s) => s.room_id === filterRoomId)
    : sensors;

  // Determine which room contains (relX, relY)
  const findRoomAtCoordinates = (relX: number, relY: number): RoomApartmentData | undefined => {
    if (filterRoomId) {
      return rooms.find((r) => r.id === filterRoomId);
    }
    const matched = rooms.find((rm) => {
      if (!rm.bounds) return false;
      return (
        relX >= rm.bounds.x &&
        relX <= rm.bounds.x + rm.bounds.w &&
        relY >= rm.bounds.y &&
        relY <= rm.bounds.y + rm.bounds.h
      );
    });
    return matched || rooms[0];
  };

  const triggerDropAtClientCoords = async (clientX: number, clientY: number) => {
    if (!containerRef.current || !onStartDragDropPairing) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = Number(
      Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100)).toFixed(2)
    );
    const relY = Number(
      Math.max(6, Math.min(94, ((clientY - rect.top) / rect.height) * 100)).toFixed(2)
    );

    const targetRoom = findRoomAtCoordinates(relX, relY);
    setPlaceNewDeviceMode(false);
    await onStartDragDropPairing({
      room_id: targetRoom?.id,
      coord_x: relX,
      coord_y: relY
    });
  };

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (placeNewDeviceMode && onStartDragDropPairing) {
      e.stopPropagation();
      triggerDropAtClientCoords(e.clientX, e.clientY);
      return;
    }
    if (draggingSensorId !== null) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (draggingSensorId !== null && containerRef.current && onSaveSensorCoords) {
      const rect = containerRef.current.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;
      const clampedX = Number(Math.max(3, Math.min(97, relX)).toFixed(2));
      const clampedY = Number(Math.max(3, Math.min(97, relY)).toFixed(2));
      onSaveSensorCoords(draggingSensorId, clampedX, clampedY);
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setDraggingSensorId(null);
  };

  const handleHtml5DropNewDevice = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.getData('text/plain') === 'NEW_IOT_DEVICE') {
      await triggerDropAtClientCoords(e.clientX, e.clientY);
    }
  };

  const handleCompleteIntroHandshake = async () => {
    if (!onCompleteIntroPacketPairing) return;
    setPairingBusy(true);
    await onCompleteIntroPacketPairing({
      session_id: activePairingSession?.session_id,
      intro_type_byte: selectedIntroPreset.typeByte,
      raw_intro_packet_hex: customIntroHex
    });
    setPairingBusy(false);
  };

  const resetTransform = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const customUploadedBlueprint =
    floor?.map_image_url && !floor.map_image_url.startsWith('/blueprints/')
      ? floor.map_image_url
      : null;

  return (
    <div className="relative w-full rounded-2xl bg-slate-950 border border-slate-800/90 overflow-hidden shadow-2xl containment-panel">
      {/* Top Map Toolbar */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-30 relative">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-400 text-xs font-mono font-bold">
            FLOOR {floor?.floor_number || 4} TOPOLOGY
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {floor?.building_name ? `${floor.building_name} • ` : ''}
              {floor?.name || 'Floor 4 — Residential Apartments'}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {floor?.has_sub_hub !== false ? (
                <>
                  Floor Sub-Hub: <span className="text-emerald-400 font-bold">{floor?.hub_id || 'HUB-B1-FL04'}</span> • DIP:{' '}
                  <span className="text-amber-400 font-bold">{floor?.dip_binary || '0100'}</span> • LiPo: {floor?.hub_battery_pct ?? 97}%
                </>
              ) : (
                <span className="text-amber-400 font-bold">
                  NO FLOOR HUB — DIRECT CENTRAL GATEWAY MODE ({floor?.hub_id})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Interactive Map & Drag-and-Drop Device Installation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Draggable + Clickable New Device Installer Button */}
          {onStartDragDropPairing && (
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', 'NEW_IOT_DEVICE');
              }}
              onClick={() => setPlaceNewDeviceMode(!placeNewDeviceMode)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-grab active:cursor-grabbing transition shadow-lg ${
                placeNewDeviceMode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 animate-pulse'
                  : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
              }`}
              title="Drag this button onto any room on the map or click and tap a spot on the map!"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('drag_new_device')}</span>
            </div>
          )}

          {allowDragSensors && (
            <button
              type="button"
              onClick={() => setDragMode(!dragMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                dragMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              {dragMode ? 'Move Existing Pins: ON' : 'Move Pins'}
            </button>
          )}

          {onUploadBlueprintUrl && (
            <button
              type="button"
              onClick={() => setShowUrlModal(!showUrlModal)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Upload className="w-3.5 h-3.5" /> Blueprint PNG
            </button>
          )}

          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
              className="p-1.5 text-slate-400 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
              className="p-1.5 text-slate-400 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetTransform}
              className="p-1.5 text-slate-400 hover:text-white border-l border-slate-800 transition"
              title="Reset Pan & Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Placement Mode Instruction Bar */}
      {placeNewDeviceMode && (
        <div className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between z-30 relative">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            {t('drag_hint')} (Click anywhere on the topology map below to drop the sensor!)
          </span>
          <button
            type="button"
            onClick={() => setPlaceNewDeviceMode(false)}
            className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/40 text-[11px]"
          >
            {t('cancel_pairing')}
          </button>
        </div>
      )}

      {/* Optional Blueprint URL Input Bar */}
      {showUrlModal && onUploadBlueprintUrl && (
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={customBgUrl}
            onChange={(e) => setCustomBgUrl(e.target.value)}
            placeholder="Paste custom Floor Plan PNG/SVG URL..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
          />
          <button
            type="button"
            onClick={() => {
              onUploadBlueprintUrl(
                customBgUrl || `/blueprints/floor-${floor?.floor_number || 1}.svg`
              );
              setShowUrlModal(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
          >
            Apply Blueprint
          </button>
        </div>
      )}

      {/* Interactive 2D Topological Canvas */}
      <div
        className={`relative w-full h-[520px] overflow-hidden blueprint-grid select-none ${
          placeNewDeviceMode ? 'cursor-crosshair' : ''
        }`}
        onMouseDown={handleMouseDownCanvas}
        onMouseMove={handleMouseMoveCanvas}
        onMouseUp={handleMouseUpCanvas}
        onMouseLeave={handleMouseUpCanvas}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleHtml5DropNewDevice}
      >
        <div
          ref={containerRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
          className="relative w-full h-full transition-transform duration-75 ease-out"
        >
          {customUploadedBlueprint && (
            <img
              src={customUploadedBlueprint}
              alt="Custom Floor Blueprint"
              className="absolute inset-0 w-full h-full object-cover opacity-45 pointer-events-none"
            />
          )}

          {/* Architectural CAD SVG Floor Plan Overlay */}
          <svg
            viewBox="0 0 1000 560"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            <rect
              x="25"
              y="20"
              width="950"
              height="520"
              rx="8"
              fill="rgba(15, 23, 42, 0.45)"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeOpacity="0.45"
            />
            <rect
              x="430"
              y="258"
              width="140"
              height="64"
              rx="4"
              fill="rgba(30, 41, 59, 0.8)"
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <text
              x="500"
              y="294"
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontFamily="monospace"
            >
              ELEVATOR &amp; STAIR CORE
            </text>
            <line
              x1="500"
              y1="20"
              x2="500"
              y2="540"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="6 6"
              strokeOpacity="0.45"
            />
          </svg>

          {/* Render Rooms & Apartments Architectural Zones */}
          {visibleRooms.map((rm) => {
            const b = filterRoomId
              ? { x: 8, y: 8, w: 84, h: 80, label: rm.room_number }
              : rm.bounds || { x: 10, y: 10, w: 35, h: 35, label: rm.room_number };
            const isArmed = rm.perimeter_security_status !== 'disarmed';
            const hasRoomAlarm = visibleSensors.some(
              (s) => s.room_id === rm.id && s.status === 'alarm'
            );

            return (
              <div
                key={rm.id}
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: `${b.w}%`,
                  height: `${b.h}%`
                }}
                className={`absolute rounded-xl border-2 transition-colors pointer-events-none flex flex-col justify-between p-3 ${
                  hasRoomAlarm
                    ? 'bg-red-950/40 border-red-500/80 shadow-[inset_0_0_30px_rgba(239,68,68,0.35)]'
                    : isArmed
                      ? 'bg-slate-900/45 border-sky-500/40'
                      : 'bg-slate-900/30 border-slate-700/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-white tracking-wide block">
                      {rm.room_number}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {rm.owner_name || b.label}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold flex items-center gap-1 ${
                      rm.perimeter_security_status === 'armed_away'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : rm.perimeter_security_status === 'armed_home'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {rm.perimeter_security_status === 'disarmed' ? (
                      <ShieldAlert className="w-2.5 h-2.5" />
                    ) : (
                      <ShieldCheck className="w-2.5 h-2.5" />
                    )}
                    {rm.perimeter_security_status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 border-t border-slate-800/60 pt-1">
                  <span>APT ID #{rm.id}</span>
                  <span className="flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> SINGLE-SENSOR NODES
                  </span>
                </div>
              </div>
            );
          })}

          {/* Floor Sub-Hub or Central Gateway Node Indicator */}
          <div
            style={{ left: '50%', top: '49%' }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 px-3 py-1 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 shadow-lg pointer-events-none ${
              activePairingSession
                ? 'bg-sky-600 text-white border-white animate-bounce shadow-[0_0_25px_#38bdf8]'
                : floor?.has_sub_hub !== false
                  ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                  : 'bg-purple-950/90 border-purple-500/60 text-purple-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {activePairingSession
                ? `PAIRING MODE ACTIVE: ${activePairingSession.target_receiver_id}`
                : floor?.has_sub_hub !== false
                  ? `SUB-HUB ${floor?.hub_id || 'HUB-FL04'} [DIP:${floor?.dip_binary || '0100'}]`
                  : `DIRECT CENTRAL GATEWAY LINK`}
            </span>
          </div>

          {/* Pending Dropped Sensor Pin Preview during Active Pairing Session */}
          {activePairingSession && (
            <div
              style={{
                left: `${activePairingSession.coord_x}%`,
                top: `${activePairingSession.coord_y}%`
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
            >
              <div className="w-12 h-12 rounded-full bg-sky-500/30 border-2 border-sky-300 animate-ping absolute -inset-2" />
              <div className="w-8 h-8 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center shadow-[0_0_20px_#38bdf8]">
                <Radio className="w-4 h-4 text-white animate-spin" />
              </div>
            </div>
          )}

          {/* Render All Modular Single-Sensor Pins */}
          {visibleSensors.map((sensor) => (
            <SensorPin
              key={sensor.id}
              sensor={sensor}
              isSelected={selectedSensor?.id === sensor.id}
              isDragMode={dragMode}
              onSelect={onSelectSensor}
              onDragStart={(_e, s) => setDraggingSensorId(s.id)}
            />
          ))}
        </div>

        {/* ACTIVE PAIRING MODE & INTRO PACKET AUTO-DETECTION MODAL OVERLAY */}
        {activePairingSession && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl bg-slate-900 border-2 border-sky-500 shadow-[0_0_50px_rgba(14,165,233,0.4)] p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold">
                      {activePairingSession.target_receiver_type === 'FLOOR_HUB'
                        ? `${t('listening_via_hub')}: ${activePairingSession.target_receiver_id}`
                        : `${t('listening_via_gateway')}: ${activePairingSession.target_receiver_id}`}
                    </span>
                    <h4 className="text-sm font-black text-white mt-0.5">
                      {t('pairing_mode_active')} — {activePairingSession.room_number} (
                      {activePairingSession.coord_x}%, {activePairingSession.coord_y}%)
                    </h4>
                  </div>
                </div>
                {onCancelPairing && (
                  <button
                    type="button"
                    onClick={onCancelPairing}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  {t('select_intro_packet')}
                </label>
                <p className="text-[11px] text-slate-400">
                  {t('single_sensor_rule')}
                </p>

                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {INTRO_PACKET_PRESETS.map((preset) => {
                    const isSel = selectedIntroPreset.typeByte === preset.typeByte;
                    return (
                      <button
                        key={preset.typeByte}
                        type="button"
                        onClick={() => {
                          setSelectedIntroPreset(preset);
                          setCustomIntroHex(preset.sampleHex);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                          isSel
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-sky-400 text-[10px]">
                              {preset.typeByte}
                            </span>
                            <span>{t(preset.nameKey)}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {preset.desc}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 hidden sm:inline">
                          {preset.sampleHex}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Raw BLE / RS485 Intro Handshake Packet Hex:
                </label>
                <input
                  type="text"
                  value={customIntroHex}
                  onChange={(e) => setCustomIntroHex(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {onCancelPairing && (
                  <button
                    type="button"
                    onClick={onCancelPairing}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    {t('cancel_pairing')}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pairingBusy}
                  onClick={handleCompleteIntroHandshake}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition"
                >
                  {pairingBusy ? 'Decoding Intro Packet...' : t('complete_intro_pairing')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Legend Bar */}
        <div className="absolute bottom-3 left-3 right-3 px-3.5 py-2 rounded-xl bg-slate-950/90 border border-slate-800/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-[11px] z-20">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              Online (1 Sensor / Device)
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              Warning / Low Bat
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              Critical Alarm
            </span>
          </div>
          <div className="text-emerald-400 font-mono font-semibold">
            Drag &amp; Drop &quot;{t('drag_new_device')}&quot; onto any room to trigger Hub/Gateway Pairing Mode!
          </div>
        </div>
      </div>
    </div>
  );
};
