import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import multer from 'multer';

import { initializeDatabase, isMysqlConnected } from './config/database';
import { configurePassport } from './config/passport';
import { isMqttBrokerConnected } from './config/mqtt';
import { socketService } from './services/socket.service';
import { mqttService } from './services/mqtt.service';

import { authenticateJWT } from './middleware/auth.middleware';
import { authorizeRoles } from './middleware/rbac.middleware';

import {
  getCurrentUser,
  googleAuthCallback,
  listAllUsers,
  ssoDemoLogin
} from './controllers/auth.controller';
import {
  getAllFloors,
  getFloorDetail,
  getRs485Diagnostics,
  uploadFloorBlueprint
} from './controllers/floor.controller';
import {
  getAllSensors,
  pairNewBleSensor,
  recalibrateSensor,
  updateSensorConfiguration,
  updateSensorCoordinates
} from './controllers/sensor.controller';
import {
  assignApartmentOwner,
  broadcastBuildingAnnouncement,
  getAllApartments,
  updatePerimeterSecurity
} from './controllers/apartment.controller';
import {
  getPartitionMetadata,
  getTelemetryAnalytics
} from './controllers/telemetry.controller';
import {
  acknowledgeFalseAlarm,
  addCommentToAlarm,
  forceDispatch112,
  getAlarmsList,
  getSim7670GatewayStatus,
  resolveAlarmEvent,
  sendSim7670AtCommand,
  triggerEmergencySimulation
} from './controllers/emergency.controller';
import {
  addApartmentToFloor,
  addFloorToBuilding,
  assignBuildingTenant,
  completePairingViaIntroPacket,
  createBuilding,
  createNewUserAccount,
  deleteApartment,
  deleteBuilding,
  deleteCentralGateway,
  deleteEndDevice,
  deleteFloor,
  deleteFloorHub,
  deleteUserAccount,
  getAllBuildings,
  getDeviceAttributes,
  getDeviceProfiles,
  getDevicesInventory,
  getRpcCommands,
  getTopologyRollup,
  registerCentralGateway,
  registerOrUpdateFloorHub,
  sendRpcCommand,
  startDevicePairingSession,
  updateApartment,
  updateBuilding,
  updateCentralGateway,
  updateDeviceProfile,
  updateDeviceSharedAttributes,
  updateEndDevice,
  updateFloor,
  updateUserAccount
} from './controllers/saas.controller';

dotenv.config();

const app = express();
const server = http.createServer(app);

const uploadDir = path.join(__dirname, '../uploads/blueprints');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `floor-blueprint-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

configurePassport();
app.use(passport.initialize());

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    service: 'Smart Building Wireless Smoke & Security SaaS Ecosystem API',
    architecture: 'ThingsBoard-Inspired Domain Safety Engine',
    status: 'OPERATIONAL',
    mysql_connected: isMysqlConnected,
    mqtt_broker_connected: isMqttBrokerConnected,
    timestamp: new Date().toISOString()
  });
});

// 1. Auth & Users RBAC CRUD Routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get(
  '/api/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleAuthCallback
);
app.post('/api/auth/sso-demo', ssoDemoLogin);
app.get('/api/auth/me', authenticateJWT, getCurrentUser);
app.get('/api/auth/users', authenticateJWT, authorizeRoles('super_admin', 'tenant'), listAllUsers);
app.post('/api/users', authenticateJWT, authorizeRoles('super_admin', 'tenant'), createNewUserAccount);
app.put('/api/users/:id', authenticateJWT, authorizeRoles('super_admin', 'tenant'), updateUserAccount);
app.delete('/api/users/:id', authenticateJWT, authorizeRoles('super_admin', 'tenant'), deleteUserAccount);

// 2. Multi-Building SaaS Management & Asset Rollup CRUD Routes
app.get('/api/buildings', getAllBuildings);
app.get('/api/topology/rollup', getTopologyRollup);
app.post('/api/buildings', authenticateJWT, authorizeRoles('super_admin'), createBuilding);
app.put('/api/buildings/:id', authenticateJWT, authorizeRoles('super_admin', 'tenant'), updateBuilding);
app.delete('/api/buildings/:id', authenticateJWT, authorizeRoles('super_admin'), deleteBuilding);
app.patch(
  '/api/buildings/:id/assign-tenant',
  authenticateJWT,
  authorizeRoles('super_admin'),
  assignBuildingTenant
);
app.post(
  '/api/buildings/:id/floors',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  addFloorToBuilding
);
app.put('/api/floors/:id', authenticateJWT, authorizeRoles('super_admin', 'tenant'), updateFloor);
app.delete('/api/floors/:id', authenticateJWT, authorizeRoles('super_admin', 'tenant'), deleteFloor);
app.post(
  '/api/buildings/:id/apartments',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  addApartmentToFloor
);
app.put('/api/apartments/:id', authenticateJWT, authorizeRoles('super_admin', 'tenant'), updateApartment);
app.delete('/api/apartments/:id', authenticateJWT, authorizeRoles('super_admin', 'tenant'), deleteApartment);

// 3. Dedicated Devices Registry, Device Profiles, 3-Scope Attributes & RPC Queue CRUD Routes
app.get('/api/devices/inventory', getDevicesInventory);
app.get('/api/device-profiles', getDeviceProfiles);
app.patch(
  '/api/device-profiles/:code',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  updateDeviceProfile
);
app.get('/api/devices/:id/attributes', getDeviceAttributes);
app.patch(
  '/api/devices/:id/attributes/shared',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  updateDeviceSharedAttributes
);
app.get('/api/rpc/commands', getRpcCommands);
app.post(
  '/api/rpc/commands',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  sendRpcCommand
);
app.post(
  '/api/devices/gateways',
  authenticateJWT,
  authorizeRoles('super_admin'),
  registerCentralGateway
);
app.put(
  '/api/devices/gateways/:id',
  authenticateJWT,
  authorizeRoles('super_admin'),
  updateCentralGateway
);
app.delete(
  '/api/devices/gateways/:id',
  authenticateJWT,
  authorizeRoles('super_admin'),
  deleteCentralGateway
);
app.post(
  '/api/devices/hubs',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  registerOrUpdateFloorHub
);
app.delete(
  '/api/devices/hubs/:id',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  deleteFloorHub
);
app.put(
  '/api/devices/endpoints/:id',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  updateEndDevice
);
app.delete(
  '/api/devices/endpoints/:id',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  deleteEndDevice
);
app.post(
  '/api/devices/pairing/start',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  startDevicePairingSession
);
app.post(
  '/api/devices/pairing/intro-packet',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  completePairingViaIntroPacket
);

// 4. Floors & RS485 Trunk Diagnostics Routes
app.get('/api/floors', getAllFloors);
app.get('/api/floors/diagnostics/rs485', getRs485Diagnostics);
app.get('/api/floors/:floorNumber', getFloorDetail);
app.post(
  '/api/floors/:floorNumber/blueprint',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  upload.single('blueprint'),
  uploadFloorBlueprint
);

// 5. Modular Single-Sensor Endpoints Routes
app.get('/api/sensors', getAllSensors);
app.patch(
  '/api/sensors/:id/coordinates',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  updateSensorCoordinates
);
app.patch(
  '/api/sensors/:id/config',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  updateSensorConfiguration
);
app.post(
  '/api/sensors/:id/calibrate',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  recalibrateSensor
);
app.post(
  '/api/sensors/pair',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  pairNewBleSensor
);

// 6. Apartments & Perimeter Security Routes
app.get('/api/apartments', getAllApartments);
app.patch(
  '/api/apartments/:id/perimeter',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  updatePerimeterSecurity
);
app.patch(
  '/api/apartments/:id/assign-owner',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  assignApartmentOwner
);
app.post(
  '/api/apartments/broadcast-evacuation',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  broadcastBuildingAnnouncement
);

// 7. Partitioned Telemetry Analytics Routes
app.get('/api/telemetry', getTelemetryAnalytics);
app.get('/api/telemetry/partitions', getPartitionMetadata);

// 8. Emergency 112 Dispatcher, Stateful Alarm Lifecycle & SIM7670 Gateway Routes
app.get('/api/emergency/alarms', getAlarmsList);
app.post('/api/emergency/trigger', triggerEmergencySimulation);
app.post(
  '/api/emergency/alarms/:id/acknowledge',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  acknowledgeFalseAlarm
);
app.post(
  '/api/emergency/alarms/:id/dispatch-112',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  forceDispatch112
);
app.post(
  '/api/emergency/alarms/:id/resolve',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant'),
  resolveAlarmEvent
);
app.post(
  '/api/emergency/alarms/:id/comment',
  authenticateJWT,
  authorizeRoles('super_admin', 'tenant', 'user'),
  addCommentToAlarm
);
app.get('/api/emergency/sim7670', getSim7670GatewayStatus);
app.post(
  '/api/emergency/sim7670/at',
  authenticateJWT,
  authorizeRoles('super_admin'),
  sendSim7670AtCommand
);

const PORT = Number(process.env.PORT || 5000);

const startServer = async (): Promise<void> => {
  await initializeDatabase();
  socketService.initialize(server);
  mqttService.start();

  server.listen(PORT, () => {
    console.log(`======================================================================`);
    console.log(`🏢 SMART BUILDING SAAS DIGITAL TWIN SERVER RUNNING ON PORT ${PORT}`);
    console.log(`📡 Full CRUD + ThingsBoard Profiles, 3-Scope Attributes & RPC Ready`);
    console.log(`======================================================================`);
  });
};

startServer();
