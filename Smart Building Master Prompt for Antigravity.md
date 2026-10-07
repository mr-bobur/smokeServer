# **🏢 ENTERPRISE MASTER PROMPT: Smart Building Wireless Smoke & Security Ecosystem (Digital Twin)**

You are an expert Principal Full-Stack Engineer, IoT Systems Architect, and Industrial Automation Specialist. Your mission is to build and deploy a production-grade, enterprise-ready **Smart Building Wireless Smoke & Security Monitoring Ecosystem (Digital Twin)** designed for a 9-story residential/commercial building.

Follow this comprehensive specification document rigorously. Write complete, typed, robust code without placeholders or shortcuts.

## **📐 1\. High-Level Architectural Blueprint**

\[ ESP32-C3 Modular Endpoints \] (Smoke, CO, Temp, Reed Switch, Glass Break)  
         │ (BLE 5.0 Broadcast & Dynamic Beaconing / 5-10s Long-Press Pairing)  
         ▼  
\[ Floor Sub-Hubs (Floors 1 to 9\) \] (ESP32-C3 \+ 4x DIP Switch Binary Address 0001-1001 \+ Backup LiPo)  
         │  
         │ (RS485 Half-Duplex Bus / Twisted Pair Industrial Trunk Line)  
         ▼  
\[ Central Building Gateway \] (Industrial ESP32-S3/ARM Host \+ SIM7670 4G LTE Cat 1\)  
         │  
         │ (MQTT over TLS / 4G Cellular Backhaul \+ Fallback SMS/Voice Call)  
         ▼  
\[ Cloud / On-Premise Core Server \] (Node.js/TypeScript \+ PM2 \+ MySQL Partitioned DB)  
         │  
         ├─► \[ Socket.io Engine \] ──► \[ Next.js App Router Frontend (Digital Twin 2D Map) \]  
         └─► \[ Emergency Dispatcher \] ──► \[ 112 State Emergency API \+ Automated Voice Dispatch \]

## **📁 2\. Target File Directory Structure**

Organize the repository using the following monorepo architecture:

smart-building-ecosystem/  
├── server/  
│   ├── src/  
│   │   ├── config/  
│   │   │   ├── database.ts            \# MySQL Pool Connection & Partition Manager  
│   │   │   ├── mqtt.ts                \# MQTT.js Client & Connection Handlers  
│   │   │   └── passport.ts            \# Google OAuth 2.0 Strategy Configuration  
│   │   ├── controllers/  
│   │   │   ├── auth.controller.ts     \# Google OAuth & JWT token generation  
│   │   │   ├── floor.controller.ts    \# Floor plan upload (Multer) & Blueprint retrieval  
│   │   │   ├── sensor.controller.ts   \# Sensor coordinates, configuration, pairing triggers  
│   │   │   ├── apartment.controller.ts\# Arm/Disarm perimeter security  
│   │   │   ├── telemetry.controller.ts\# Time-series analytics with aggregation  
│   │   │   └── emergency.controller.ts\# 112 API dispatcher & alarm lifecycle  
│   │   ├── middleware/  
│   │   │   ├── auth.middleware.ts     \# JWT Verification  
│   │   │   └── rbac.middleware.ts     \# Role enforcement: super\_admin, tenant, user  
│   │   ├── models/  
│   │   │   └── ddl.sql                \# Complete schema & migration script  
│   │   ├── services/  
│   │   │   ├── mqtt.service.ts        \# Ingests telemetry & routes alarms  
│   │   │   ├── socket.service.ts      \# WebSocket broadcast to Next.js clients  
│   │   │   ├── sim7670.service.ts     \# AT commands pipeline: SMS, Voice calls  
│   │   │   └── emergency.service.ts   \# 60s countdown escalation & 112 REST API caller  
│   │   ├── types/  
│   │   │   └── index.ts               \# Shared TypeScript interfaces & enums  
│   │   └── index.ts                   \# Express app initialization & server entry  
│   ├── ecosystem.config.js            \# PM2 Cluster & Deployment configuration  
│   ├── package.json  
│   └── tsconfig.json  
│  
├── client/  
│   ├── src/  
│   │   ├── app/  
│   │   │   ├── (auth)/  
│   │   │   │   └── login/page.tsx     \# Google Login with SSO  
│   │   │   ├── (dashboard)/  
│   │   │   │   ├── admin/page.tsx     \# Super Admin 9-floor overview & RS485 diagnostics  
│   │   │   │   ├── tenant/page.tsx    \# Building Manager (Shirkat) dashboard  
│   │   │   │   ├── resident/page.tsx  \# User portal (Apartment view & Arm/Disarm)  
│   │   │   │   └── layout.tsx         \# Responsive sidebar & real-time notification toaster  
│   │   │   ├── layout.tsx  
│   │   │   └── page.tsx  
│   │   ├── components/  
│   │   │   ├── map/  
│   │   │   │   ├── BlueprintViewer.tsx\# Interactive Canvas/SVG floor plan viewer  
│   │   │   │   ├── SensorPin.tsx      \# Pulsing pin with color-coded severity  
│   │   │   │   └── SensorModal.tsx    \# Live telemetry popup & calibration drawer  
│   │   │   ├── charts/  
│   │   │   │   └── TelemetryChart.tsx \# 1-year historical chart (Recharts)  
│   │   │   └── common/  
│   │   │       ├── FloorSelector.tsx  \# Floor 1 to 9 selector with status badges  
│   │   │       └── EmergencyBanner.tsx\# Screen-wide flashing alarm modal  
│   │   ├── hooks/  
│   │   │   ├── useSocket.ts           \# Socket.io connection hook  
│   │   │   └── useFloorData.ts        \# SWR/React Query floor data fetcher  
│   │   └── types/  
│   │       └── index.ts  
│   ├── tailwind.config.ts  
│   ├── package.json  
│   └── tsconfig.json

## **🗄️ 3\. Production MySQL Schema & 1-Year Retention Partitioning**

Implement the following complete MySQL DDL script (server/src/models/ddl.sql):

\-- Enable strict SQL modes  
SET sql\_mode \= 'STRICT\_TRANS\_TABLES,NO\_ENGINE\_SUBSTITUTION';

\-- 1\. Users Table (RBAC Matrix)  
CREATE TABLE IF NOT EXISTS users (  
    id INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,  
    google\_id VARCHAR(191) NOT NULL UNIQUE,  
    email VARCHAR(191) NOT NULL UNIQUE,  
    name VARCHAR(255) NOT NULL,  
    avatar\_url VARCHAR(512) NULL,  
    role ENUM('super\_admin', 'tenant', 'user') NOT NULL DEFAULT 'user',  
    phone\_number VARCHAR(32) NULL,  
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP ON UPDATE CURRENT\_TIMESTAMP,  
    INDEX idx\_user\_role (role),  
    INDEX idx\_user\_email (email)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- 2\. Floors Table (1 to 9 floors)  
CREATE TABLE IF NOT EXISTS floors (  
    id INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,  
    floor\_number TINYINT UNSIGNED NOT NULL UNIQUE CHECK (floor\_number BETWEEN 1 AND 9),  
    name VARCHAR(64) NOT NULL, \-- e.g. "3rd Floor \- Residential"  
    map\_image\_url VARCHAR(512) NOT NULL, \-- Static uploaded PNG blueprint  
    map\_width INT UNSIGNED NOT NULL DEFAULT 1920,  
    map\_height INT UNSIGNED NOT NULL DEFAULT 1080,  
    hub\_mac VARCHAR(32) NOT NULL UNIQUE, \-- ESP32-C3 Floor Hub MAC  
    dip\_switch\_address TINYINT UNSIGNED NOT NULL UNIQUE CHECK (dip\_switch\_address BETWEEN 1 AND 9),  
    hub\_status ENUM('online', 'offline', 'battery\_warning') DEFAULT 'offline',  
    hub\_battery\_pct TINYINT UNSIGNED DEFAULT 100,  
    last\_heartbeat TIMESTAMP NULL,  
    INDEX idx\_floor\_number (floor\_number)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- 3\. Rooms & Apartments Table  
CREATE TABLE IF NOT EXISTS rooms\_apartments (  
    id INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,  
    floor\_id INT UNSIGNED NOT NULL,  
    room\_number VARCHAR(32) NOT NULL, \-- e.g. "Apt 42", "Corridor East"  
    owner\_user\_id INT UNSIGNED NULL,  
    perimeter\_security\_status ENUM('disarmed', 'armed\_home', 'armed\_away') DEFAULT 'disarmed',  
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
    FOREIGN KEY (floor\_id) REFERENCES floors(id) ON DELETE CASCADE,  
    FOREIGN KEY (owner\_user\_id) REFERENCES users(id) ON DELETE SET NULL,  
    UNIQUE KEY uq\_floor\_room (floor\_id, room\_number)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- 4\. Modular Sensor Endpoints Table  
CREATE TABLE IF NOT EXISTS sensors\_endpoints (  
    id INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,  
    room\_id INT UNSIGNED NOT NULL,  
    chip\_id VARCHAR(64) NOT NULL UNIQUE, \-- ESP32-C3 Unique Hardware ID  
    sensor\_type ENUM('SMOKE\_MQ2', 'CO\_MQ7', 'TEMP\_DS18B20', 'DOOR\_REED', 'GLASS\_BREAK', 'MULTI\_FIRE') NOT NULL,  
    status ENUM('online', 'offline', 'alarm', 'warning', 'pairing') DEFAULT 'online',  
    coord\_x FLOAT NOT NULL, \-- Percentage (0.00 to 100.00%) on PNG canvas  
    coord\_y FLOAT NOT NULL, \-- Percentage (0.00 to 100.00%) on PNG canvas  
    battery\_level TINYINT UNSIGNED NOT NULL DEFAULT 100,  
    beacon\_interval\_seconds INT UNSIGNED NOT NULL DEFAULT 600, \-- Dynamic interval (Normal \= 600s, Alarm \= 2s)  
    last\_seen TIMESTAMP NULL,  
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
    FOREIGN KEY (room\_id) REFERENCES rooms\_apartments(id) ON DELETE CASCADE,  
    INDEX idx\_sensor\_chip (chip\_id),  
    INDEX idx\_sensor\_status (status)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

\-- 5\. Partitioned Telemetry Logs Table (1+ Year Retention)  
\-- Partitioned by RANGE on UNIX timestamp for high performance querying  
CREATE TABLE IF NOT EXISTS telemetry\_logs (  
    id BIGINT UNSIGNED NOT NULL AUTO\_INCREMENT,  
    sensor\_id INT UNSIGNED NOT NULL,  
    smoke\_ppm FLOAT NULL,  
    co\_ppm FLOAT NULL,  
    temperature FLOAT NULL,  
    reed\_switch\_open BOOLEAN NULL,  
    glass\_break\_detected BOOLEAN NULL,  
    battery\_level TINYINT UNSIGNED NOT NULL,  
    recorded\_at TIMESTAMP NOT NULL DEFAULT CURRENT\_TIMESTAMP,  
    PRIMARY KEY (id, recorded\_at),  
    INDEX idx\_telemetry\_sensor\_time (sensor\_id, recorded\_at)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci  
PARTITION BY RANGE (UNIX\_TIMESTAMP(recorded\_at)) (  
    PARTITION p\_prev VALUES LESS THAN (UNIX\_TIMESTAMP('2026-01-01 00:00:00')),  
    PARTITION p\_2026\_q1 VALUES LESS THAN (UNIX\_TIMESTAMP('2026-04-01 00:00:00')),  
    PARTITION p\_2026\_q2 VALUES LESS THAN (UNIX\_TIMESTAMP('2026-07-01 00:00:00')),  
    PARTITION p\_2026\_q3 VALUES LESS THAN (UNIX\_TIMESTAMP('2026-10-01 00:00:00')),  
    PARTITION p\_2026\_q4 VALUES LESS THAN (UNIX\_TIMESTAMP('2027-01-01 00:00:00')),  
    PARTITION p\_future VALUES LESS THAN MAXVALUE  
);

\-- 6\. Permanent Alarm Events Archive Table  
CREATE TABLE IF NOT EXISTS alarm\_events (  
    id INT UNSIGNED AUTO\_INCREMENT PRIMARY KEY,  
    sensor\_id INT UNSIGNED NOT NULL,  
    event\_type ENUM('SMOKE\_CRITICAL', 'CO\_DANGER', 'TEMP\_THRESHOLD', 'UNAUTHORIZED\_ENTRY', 'GLASS\_BREAK') NOT NULL,  
    severity ENUM('warning', 'critical', 'emergency') NOT NULL,  
    smoke\_val FLOAT NULL,  
    temp\_val FLOAT NULL,  
    status ENUM('active', 'acknowledged', 'resolved', 'escalated\_to\_112') NOT NULL DEFAULT 'active',  
    acknowledged\_by INT UNSIGNED NULL,  
    acknowledged\_at TIMESTAMP NULL,  
    emergency\_112\_payload JSON NULL,  
    emergency\_112\_dispatched\_at TIMESTAMP NULL,  
    emergency\_112\_response JSON NULL,  
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
    FOREIGN KEY (sensor\_id) REFERENCES sensors\_endpoints(id) ON DELETE CASCADE,  
    FOREIGN KEY (acknowledged\_by) REFERENCES users(id) ON DELETE SET NULL,  
    INDEX idx\_alarm\_status (status),  
    INDEX idx\_alarm\_created (created\_at)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4\_unicode\_ci;

## **📡 4\. Hardware, Communication & Protocol Contracts**

### **4.1. ESP32-C3 Endpoint: BLE Pairing & Beaconing FSM**

1. **Long-Press Commissioning Algorithm:**  
   * Pin: GPIO 9 (Active LOW with internal pullup).  
   * Press held **5 to 10 seconds**: Transitions device into STATE\_PAIRING.  
   * Endpoint initiates BLE Advertising with Custom Manufacturer Data:  
     \[0xFF, 0xFF, CHIP\_ID (6 bytes), CAPABILITY\_MASK (1 byte), BATTERY\_PCT (1 byte)\].  
   * Floor Hub captures packet, registers chip ID, sends RS485 registration upstream, and sends BLE ACK.  
   * On ACK received, ESP32-C3 writes configuration to NVS (Non-Volatile Storage) and flashes status LED 3 times (Green).  
2. **Dynamic Beaconing Engine:**  
   * **Standby Mode:** Sleep in Deep/Light sleep, wake up every beacon\_interval\_seconds (default: 600s), sample sensors, transmit short packet, return to sleep.  
   * **Alarm Trigger Mode:** When sensor reading \> threshold (e.g. Smoke MQ-2 \> 400ppm or Temp \> ![][image1]), immediately bypass sleep timer, latch buzzer on GPIO 4, and transmit alarm packet every 1000ms until server ACK is received.

### **4.2. Floor Sub-Hub: 4x DIP Switch & RS485 Industrial Bus**

* **DIP Switch Pinout:** Connected to GPIO 1, 2, 3, 4 with pull-ups.  
* **Floor Hardware ID Calculation:**  
  uint8\_t floor\_address \= (\!digitalRead(SW1) \<\< 0\) |  
                          (\!digitalRead(SW2) \<\< 1\) |  
                          (\!digitalRead(SW3) \<\< 2\) |  
                          (\!digitalRead(SW4) \<\< 3);  
  // Address 0001 (1) \= Floor 1 ... Address 1001 (9) \= Floor 9

* **RS485 Half-Duplex Control:** Uses MAX485 / SP485 transceiver.  
  * GPIO 5 \= DI (TX), GPIO 6 \= RO (RX), GPIO 7 \= DE/RE (Transmit Enable).  
  * Packet Frame Format: \[START\_BYTE(0xAA), SRC\_FLOOR, MSG\_TYPE, LEN, PAYLOAD..., CRC16\_H, CRC16\_L, STOP\_BYTE(0x55)\].

### **4.3. Central Building Gateway (SIM7670 4G LTE Cat 1\)**

* **Serial Interface:** UART at 115200 baud (AT+ command set).  
* **Network & MQTT Pipeline:**  
  AT+CPIN?                        \--\> Check SIM readiness  
  AT+CSQ                          \--\> Query RSSI signal strength  
  AT+CGATT=1                      \--\> Attach GPRS/LTE service  
  AT+CMQTTSTART                   \--\> Start internal MQTT client  
  AT+CMQTTACCQ=0,"building\_gw\_01" \--\> Set ClientID  
  AT+CMQTTCONNECT=0,"tcp://mqtt.yourdomain.com:1883",60,1

* **Hardware Emergency Fallback Pipeline (Voice & SMS):**  
  If cellular internet drops or MQTT ping fails during an active critical alarm:  
  1. Send SMS to Building Manager: AT+CMGS="+99890XXXXXXX" \<CR\> "EMERGENCY: Smoke detected in Floor 4, Apt 42\! Check immediately\!" \<Ctrl+Z\>  
  2. Initiate Direct Voice Alarm: ATD+99890XXXXXXX; to ring responsible personnel with pre-recorded warning tone.

## **🛰️ 5\. MQTT Topic Taxonomy & Payload Schemas**

### **5.1. Telemetry Topic**

* **Topic:** smartbuilding/floor\_{floorId}/hub\_{hubId}/sensor\_{chipId}/telemetry  
* **JSON Payload:**

{  
  "timestamp": 1774418400,  
  "chip\_id": "C3-9A4F22B8",  
  "floor": 4,  
  "hub\_id": "HUB-FL04",  
  "data": {  
    "smoke\_ppm": 45.2,  
    "co\_ppm": 8.1,  
    "temperature\_c": 24.6,  
    "door\_open": false,  
    "glass\_broken": false  
  },  
  "battery\_pct": 94,  
  "rssi\_dbm": \-68  
}

### **5.2. Alarm Topic (Highest Priority QoS 2\)**

* **Topic:** smartbuilding/floor\_{floorId}/hub\_{hubId}/sensor\_{chipId}/alarm  
* **JSON Payload:**

{  
  "alarm\_id": "ALM-20260925-992",  
  "timestamp": 1774418400,  
  "chip\_id": "C3-9A4F22B8",  
  "floor": 4,  
  "room\_number": "Apt 42",  
  "event\_type": "SMOKE\_CRITICAL",  
  "severity": "critical",  
  "metrics": {  
    "smoke\_ppm": 680.5,  
    "temperature\_c": 62.4  
  }  
}

### **5.3. Configuration Downlink (Server to Sensor)**

* **Topic:** smartbuilding/floor\_{floorId}/hub\_{hubId}/sensor\_{chipId}/config  
* **JSON Payload:**

{  
  "cmd": "SET\_CONFIG",  
  "beacon\_interval\_seconds": 60,  
  "smoke\_threshold\_ppm": 200,  
  "arm\_perimeter": true  
}

## **⚡ 6\. Backend Engineering (Node.js, Express, Socket.io, TypeScript)**

### **6.1. Google OAuth 2.0 & Role Authorization Pipeline**

* Provide Google Strategy via passport-google-oauth20.  
* Upon Google callback:  
  * Look up user in users table by google\_id.  
  * If new user, create record with default role 'user'.  
  * Sign a JWT with payload { id: user.id, email: user.email, role: user.role } expiring in 7 days.  
* Implement TypeScript RBAC middleware:  
  export const authorizeRoles \= (...allowedRoles: Array\<'super\_admin' | 'tenant' | 'user'\>) \=\> {  
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) \=\> {  
      if (\!req.user || \!allowedRoles.includes(req.user.role)) {  
        return res.status(403).json({ error: 'Access Denied: Insufficient Privileges' });  
      }  
      next();  
    };  
  };

### **6.2. 112 Emergency Dispatcher State Machine**

Create an autonomous background service (server/src/services/emergency.service.ts):

1. **Trigger Condition:** Incoming MQTT message with severity: 'critical' or 'emergency'.  
2. **Step 1:** Persist alarm into alarm\_events table (status \= 'active').  
3. **Step 2:** Emit WebSocket event ALARM\_TRIGGERED across all active Socket.io clients with audio alert payload.  
4. **Step 3:** Trigger SIM7670 gateway AT commands to send SMS to registered apartment owner and building manager.  
5. **Step 4 (60-Second Grace Period Countdown):**  
   * If any Tenant/Admin clicks **"Acknowledge False Alarm"** within 60s, cancel escalation.  
   * If **60 seconds elapse without resolution**, execute automated POST request to the State Emergency 112 API:

const payload112 \= {  
  agency\_code: "EMERGENCY\_UZ\_112",  
  building\_id: "SMART-BLD-TASHKENT-09",  
  address: "Amir Timur Avenue 108, Block B",  
  floor\_number: alarm.floor,  
  room\_number: alarm.room\_number,  
  threat\_type: "FIRE\_SMOKE\_HAZARD",  
  readings: { smoke\_ppm: alarm.smoke\_val, temp\_celsius: alarm.temp\_val },  
  contact\_person: "Shirkat Manager",  
  contact\_phone: "+998712000000",  
  dispatched\_at: new Date().toISOString()  
};  
const response \= await axios.post(process.env.EMERGENCY\_112\_API\_URL\!, payload112, {  
  headers: { Authorization: \`Bearer \${process.env.EMERGENCY\_112\_TOKEN}\` }  
});

### **6.3. PM2 Cluster Configuration (server/ecosystem.config.js)**

module.exports \= {  
  apps: \[  
    {  
      name: "smart-building-api",  
      script: "./dist/index.js",  
      instances: "max",  
      exec\_mode: "cluster",  
      autorestart: true,  
      watch: false,  
      max\_memory\_restart: "1G",  
      env: {  
        NODE\_ENV: "production",  
        PORT: 5000  
      }  
    }  
  \]  
};

## **🖥️ 7\. Frontend Engineering (Next.js App Router, Tailwind CSS, Digital Twin Map)**

### **7.1. Interactive Topological Map Component (BlueprintViewer.tsx)**

Create an interactive visual canvas that renders the building floor plan with dynamic pins:

* **Floor Blueprint Rendering:** Loads the uploaded PNG/SVG floor plan. Supports zoom in/out and drag-to-pan using CSS transforms or HTML5 Canvas.  
* **Sensor Pin Marker Calculation:** Coordinates are stored as relative percentages (![][image2] to ![][image3]) so markers accurately scale across any screen resolution:  
  style={{ left: ![][image4]{sensor.coord\_y}% }}.  
* **Pin Visual State Indicator:**  
  * **Green (Normal):** Steady soft glow.  
  * **Amber (Warning):** Pulsing beacon (low battery or slightly elevated temp).  
  * **Red (Critical Alarm):** Rapidly expanding strobe ring with SVG flame/smoke icon.  
  * **Gray (Offline):** Faded marker with disconnected badge.  
* **Interactive Sensor Inspection Drawer (On Pin Click):**  
  * Opens a sliding modal detailing: Sensor Chip ID, Battery Bar Gauge, Smoke PPM Level, Ambient Temperature, Signal Strength (dBm), and Last Heartbeat time.  
  * Action controls: **Arm/Disarm toggle**, **Change Beacon Interval slider (1s \- 600s)**, and **Re-calibrate sensor button**.

### **7.2. Three Dedicated Portals Based on User Role**

1. **Super Admin Dashboard (/admin):**  
   * Multi-floor isometric selector (Floor 1 through 9).  
   * RS485 Trunk Line Health Matrix: Displays communication status, latency, and packet loss for all 9 floor hubs.  
   * SIM7670 Gateway Status widget: 4G signal bars, cellular operator, SMS credit balance, and 112 API uplink status.  
   * Sensor drag-and-drop mode: Allows repositioning sensors on the topological map and saving new ![][image5] coordinates.  
2. **Tenant (Shirkat / Building Manager) Dashboard (/tenant):**  
   * 9-Story aggregated health list: Count of active alarms, low batteries, and offline nodes.  
   * Mass building announcement: Send push notification or trigger building-wide evacuation sirens.  
   * Tenant assignment drawer: Map registered Google users to specific apartment numbers.  
3. **Resident User Portal (/resident):**  
   * Restricted strictly to the authenticated user's apartment.  
   * **Perimeter Security Controls:** Large tactile buttons for **Arm Away**, **Arm Home**, and **Disarm** (activates door reed sensors and glass break detectors).  
   * Live environmental badges: Indoor air quality (Good/Fair/Hazardous), Room temperature, and Door open/close indicator.

### **7.3. 1-Year Historical Analytics (TelemetryChart.tsx)**

* Use **Recharts** or **Chart.js** with range selectors: \[24 Hours, 7 Days, 30 Days, 1 Year\].  
* Dual-axis line chart: Left Y-axis for Smoke Concentration (PPM), Right Y-axis for Temperature (![][image6]).  
* Includes benchmark threshold lines (Red dashed line at ![][image7] and ![][image8]).

## **🛠️ 8\. Antigravity Execution Instructions**

When you start executing this project:

1. **Database First:** Execute the MySQL DDL script with partitioning and seed the 9 floors with sample data.  
2. **Server Setup:** Implement the TypeScript Express server, MQTT listener, Google Passport OAuth, and REST controllers.  
3. **Emergency Pipeline:** Implement the Socket.io broadcaster and the 112 escalation state machine.  
4. **Client Setup:** Build the Next.js App Router application with Tailwind CSS, the interactive BlueprintViewer, and role-protected routes.  
5. **Quality Standard:** Ensure all files are strictly typed, modular, and error-handled for a production environment.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAZCAYAAABKM8wfAAACvElEQVR4Xu2WT4hNURzH70uKBY0/Re/PvXfee3pS0nhYzEqzsVRiQki2ZFKK5WSIhd1IFkpNaaKEUhZKoSZKSgllyoaSJjWLKTI1Pt+55878nO57b0ZW3G99e+d8f7/zO79z7jm/84IgR45/AM1mc2kcx+tpFqxWqVSKxi1QX7rVQMHXGo3GCsXzdYtyubw8iqIT8A38AT/Bj4y7VavVKvzG/vxzkAHncTgBx+AI/AaPWz+nT8F3ri3fCSXoXAoaA88z3wF+rxN7m40hoG+F7+HXMAwP24V1d3dvYexTbONtE2bgE5x6XHuV7yMoSYIdlQ+B1yEt8ex92LZbjViH7MT4PIbT6Eesnw/mOds2YQVq6eDgEt7t6ymw92Lfn/bdZ7+A1mV8vsMPpVKpnGpZ0MJb5pMmrCBypL0nMOc5RZpwtVoN5cMu7/DOaccjgTYDH2BfZnUf5LJG9PVZuITfwld8qgGdK9p32KHV1k8Ja3fgMD798Ib61kdodemku4RHrL5oKLhbdZxqUXJrb9tJ6V8lyX1pXza0uyxsQ6q1w19LOAtRcjkmYa9vs9DlwOecr2fBLVAJ3wwyjpwH2bN9tPJisbg2MA4u4Rl2dK/6mkyVwf/MLuGFJDALF/NFq0qUol6vr9SX93VN2BUl9XQaHkx1P2HtotudUZv0HySsGt7xy3GvapkXUyvVignwGfYYXdoXzudm179I/ydBTs2PTnR40mrtoDsQJY/PI22Wb3dQtRnyxTkwcJBAZ4Lfj8Qk2rV0N7Uj9O/ZSVR20J93qqkelMxpLT7KqETOfgxe8fR5uGMxCh+GSUkbhpdV+I2bAuntfx0mpW8gSp7zZ8ZnoSgw507GvoRTtO9rw2gPwTH6l7y5M6EgGxnYH7d5zbSrsssPbgq853mx0GUn3i7FI9k+878kR44cOf4H/AIHh8WWh4/WqwAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAZCAYAAAB6v90+AAADYUlEQVR4Xu2WyWsUQRTGewiC4kKijFEzMz1LNHE7jeJBMKjBHPXgEg+JXjxEwUuCC3hSUBFvUTCgIoKIAUUlB4MieDNuIAjiekggCpK/QX8fXZWpqekZc8yhP3hUvfe+r6pedXV1B0GCBAlikMrn871hGH6iPSLfJwjlcnkBnGvYLj8XCwmKxeK6jo6OpX6uEawum81uaaTN5XIt2PZSqZTFbfLzFLOPxX7ECtht/CfwNwZOgfhFco/IjWheRx4PBN2QvyIaxt6rTafTS3yeD1dH/1g9rXx4bwxHu60Cdto8uYX4Y9g93FShUNihPvyLtG+xd2rxxzUH/Hxl9Dowxfxsa2vL2BgDXFJMO+Ryffg6wdfSbsCfdjk83RLxSeLnjb+G/nfsrnyNSf5Oa2vrYqshdxy7ENQ5olXIRcdjAsEXNmGVjdM/Q+wvuf0u34W0vk7wtbR98l2OLYTcq/b29mUqAP+5Lcw8sSuWD68cRkewuTJKAzg799J9P/AHtRgt0uW7kNbXCb7WPMGqwrQZ2hQVpyINrx//M1YgP0Jxewy3mdgo7TZ3jIZg0K2IZvwFMsheLSY0OxgHo60pzNeq9QuTRlrNrXFMuIniThL7gZ0IoiOnm/Is/lBFPQfMs8JqwFhdcO5nMplFxu/EfxFGr8BlG6/BfC7MXCDjLH6t9eF/YPxe3BS509gpTxYhZ24sf4H2hcfOuXwXRltTmK8No1u3qjBdPLno0qq5VQX7EYZzwMYoaCB03kkunTT+aEXlwCT1TZkVCPnKzdbn8l0YbZVO8LVmQfVuxQkV6eYEFaTC3I9wGD352flM8TcrqmqkSF5noEndcjYYRrs8radiYzoSuqmcc63jUKUTfC38zfi/XY5zUobduAX5cf9J+oUFZu0upwrmXfnDYP3yGXAF/mv8G3bH8pXrWdf4gNW6unpas7O3lLM8aYj9oi3bmIU2jjm6/Lg5Ce7noYXYA5/nQlfqUURT2BA2hugZEyy3BE1G/CE2o4+njbs6+ofjtALx1coZjuaYon8oiPmLIDcYF6egTeS+Mf5u+fnoh/mqz6sBxGasB+sMYgauB6tjwoONtDp+htPj/0tasND1YfS/GAv03WF0Mz6l/5gf6pU+Z76iaQ5/7Sn3HzJBggQJEvwP/wDcWjSyxHkM8wAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEoAAAAZCAYAAACWyrgoAAAD7UlEQVR4Xu1XTUhUURQekaLoB/sZrNGZ90YNY6iFDCW4qFZBCBlREUFR0KLctEhEoSKIqE0Q1KKISCpJxIIiiAqEKAqpjbkIogxatAmDcOMisO9z7hmPp/vGSVrZ++Dw7j3nfOeee+6de+8kEjFixIjx75BMJpeGYXg5CILPkFfWLoBPCHt/TU3NKmubFbW1tSutTqEim81WI3gLv9YowPiLEGcjhW1rL4UyeVN5uBwqtCGfzy/IZDLXID1sI9csYp01xagEdztsw/Dbq/SzorK+vj4N0hkEbbNGAkHXwvYMPk/xPYL+PXzXG7cK6A7DNspYkBNof2DCxs+HKa7m4dtpuToP5gB5rfOAPgfdN3z3iI6FQr8P+ndO3pAHuWHjlwUE7PIVylV/Qg9OQPcTcoBt7gC0H8PnRUNDw3LxcavKyVRNM2dCc0XneAOa68sDui0mjza0J/U80D8pbezWxUFhkbeK7q8RVSgkdgHBf0FatR79MUgvmhXpdLoefl/Rf15dXb3E+P1A3Gat09BcrUf/tub68gB3k84D3ybIdz0PFljasHXA1k1f0f01fIVSKzvGpLSNCUEGGxsbl7mVHefktI/zm7HCFlFc9G8KNyoPKYzk4fz6M+qMcmcZ59dMW1hid5cFX6E4OJOwCRLQfaJAnyKPkwqiC9Vl9YIoLjnCjcqDY+s8qOOFhH4v5AsKNuRiVaH/AP28cOeM+VIoD/iTPAdplz5i7kd/GDIC3k7qlH9pzNdCgb8L9jtyw7k+i5QNCzvtvp1bSfgKFbobySZI8ACWW05uJDtZgpO1N6ZGFNcd3lPcqDzS7iKwt60GuA8hoWtLnOJYbvxLRcJs8BWKQJArTNjamDRkwD3ypt4vgTtUjd84D2yt09BcredkNNeXB4um85hmF+ByKz4q1Q4sForFRv+uva0jUaJQO4LC++Wg0U/A/zjb7n3yhIcnZIX4uBUcxmonnYqvYt5yTQl3Lmiu4XHli1xfHrIbJQ8L+B7SBfQVCq/2Wvj1lF0okE/5fiLqfOhXg/KAHOEg4kduUHjDFB9zKMI66Dqkj3ZrUHgL8fWcE71wpe94o5rryYM5nLd5CFCUDcjlkdapGPqnx4W7qv3+gNq6k0ZmHI6cFAZ9j+8tyD60L8KnRcdy25x/gz5CjnHl4fOWO0bHyRQely/1/y/FLfLQvq65wpc8XA4s5ow8CBYEPn2h56EL/3bYhlKp1GqOy3G4M63fnMGgCLjZFWqbtQtgWxMWbrLddXV1GWsvhXJ4kgdz8J1LBGIcRZ6dCc+17x6ip1ksfAcRpzsqzryHm3il1WvQJ5fLLbT6GDFixIgR4//Fb1cwn6B4QcLxAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAaCAYAAAAjZdWPAAACmElEQVR4Xu2WTWhTURCFE0SJu4p/JX8vMVlIwB8IWKigrgQRQQRdFHThzo0iQnVZlCKCCKIiRdpFxVXFbgoFxY0LN4og3SsIYhciFDcFhfqdZJ7cjkn6UsQWyYFDXubMnZk7c3NfUqkeelg71Ov1jVEU3SuVSru99legBMVi8RJJHsUk2Vi5XN4nnecjoSbiP+zjhMjn83vwm2RtBt+aXw+v1Gq1TbG/+Q0H+W/xfUsY0yOdzWa34XSQBUvwrZ61GYm5XG4rtgn4Az6Gx9nQTh8kBElH8Buy5wy8zPdF+A2ealFQmpgH0D6inWPTOdmcT2tY4A8s3BXbKDqP7QVBj4a+7aCC8H8WxqDofmxzcAn72dDfkMZ+FX3SCyuChRcVGL4mUYnPGWynvV872FmeYIOHvIZ9EC7AeR2f2E6aAWwvlS9wTw51R52Omh1XZ86nko4p9Xv9FPn7vEahm9FmrSnXZVPB8NWqCzakCfjAAk/H5zopNCnR22O4Se63gge8X1ew8eoXrMDLxrgSrJNPOq0pFAoVCv+E30/4mecT3qdrEOg2vMHun1vhjTEmQdQ8s+OdpmNNmVbRuiW8vhpsoNgRCzxk3ZjD1u8dWwG/u/Ckt4eoVqvbifle3VbXvd4tGldO3CUVqoKt8MZ92wnm/3SlDepWwe87nME34/Vu0CiYIGOhUUcjah6RWZ3XUPOwyYx6uwc5rikm+W56LTHsbXcfvqlUKjtCjcB17F/hAskOh1oIO07jcNBrIYIrbzHpi2oZKOhM1By9OhnzXazzfMdpol7jx8I4gv3P0K3RdhroX1rEm6f4vd73n0B3L5O44O3rFhTbR8em9Cb02rqFbgMKfpjq4lW/prAfsf77/vE/o4ceevhP8QuqA8GErpafuQAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAZCAYAAADaILXQAAABdklEQVR4Xu2UPS8FQRSGd4OEikQU7PdmVTSyEZ1CofURNCJ+gSgkSCQKpagUah2FUCr0oqSi8gfkKshNdDzHnb1mZ9ktboTivsmbmTnvOWfPnJlZy2rjzxCGYbfneUMympoO3/dH4GkQBC+Kj3AZqRP7FtzMBSDOwUOEJRllnXMAaZp2Yd+Hb/Ac3zjTmO9iu4V1ittuBlHtOMappsH6/FhuTfCCSnrjOE6/rmWI49hHv88llwrgOlNbmWycdjLddd0e1pfwPRdYhE2e44KPtEHa8V1bmI/BJ6k8iqJpPc4EiVeFpv3HA2U9I1XDmrRQ11rGryanFZMkfoXPfGjC1HXIrs2dlyJJkgES30n1nMmKqetQt2rDtJdCboBqzYncd1PPgL5XdegFkLyPwCtYp7pFUxdwZYfRz8TX1CpBUBg0XmGN6az19S6k4kF4UXUmpeAV9pLkIGj8Ux7gETtZY7xuKbEO6TvXclQ9unlMHaZPG238I3wAj0ZbixKz0fkAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAZCAYAAABKM8wfAAACuklEQVR4Xu2VT4hNYRjGz10oFjT+FO6/c2/31pWSxsXiLjTNgmShhJBR7ETZKJZqTCzsWFgoNSXRWKgpoRSLKSULCUVsKAk1iymixu859ztz3/t1znWnZsV56ul85/33Pec773lPEGTI8A+g2WwuqlQqa1jmrK1UKuVNWIxctVpdHYZhS1fd+wGNRmOp6qmG74tRLBaXUOMkfAl/wo/wA3m3arVaiWslZf8gkIPgd/ArnILj8Ds8YeO4X0udB+Vy+T7Xo9zfVLwJySkHnsd/kOs1am82/gjYN8E38Au1RuyDcQgbyX0iPT0Fk/iYoEG3Xu7HUGg7/h/49nr2bdgPac11mPwt1k/8YbsxMY/gb+xHbJwPRJ/tKViFUgOCaOML2gjusnYJxHYjaJ9ui40OxD732sewDcQ2PTR8WygUirEtCaqbqicWrCJOwJ7A62dsE/Cbf4LYBpWrvg36aAlss3AS/2Jr94GWlaJvj+AEv4LPOclT6ivWdzihFfJLjEQlCXa5Xf2W9tG5OhI8bu3zhoq7p67EtrD91d7WpvMVnIYFE5wEJ3AathZKsGstCY563vd7kD85RoLy+fyqwAQ4gbOaCuo31pMpgmuaMPV6fZm1p8HVfJo0iSxUT2/et6sdBsL27NUEiMaTYAW7+8u6J353J3tuSkz4/ZoGYl+H7s35PgsdROKHqSfVE1PgExw0dtk+8+Ft0D3rnWF7Do90stvzmcLHra0XyN9HnRn40I47D5o2o75xDiSeo9CZoLslprFdjU/O9HH0IbowFR7720z1oJzT8FdoJpHnPwavePYOXFvoN3vPjTS9/ksa/DYO33piX3C9DvezvkjcexvTJ3LkDpH7DM6wvqsDYz0Kp1TX3zsJKrLOCenqUwudLm2w1cUN9du7adDHTp0dqofYYfcDypAhQ4b/BX8AI9XQF6GY2kEAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEwAAAAZCAYAAACb1MhvAAAEHUlEQVR4Xu2YS2iUVxTHZwgFS2nV2jI2j7mTh8aqLUhQIQvtQqTVhVA0SG3Bboq6caFtYxC3FnGnCEG0VZSKZtFCIMQWQXBT1KaYUlsxaYitCEGhSiBSQX//mXMnd65fEig+aPz+cPjOPY/7+H/3nvvNZDIpUqRIMc1QU1NT65z7vLm5+dXYB7L19fU5/K16xk6PQqEwo7a29h2J9Ng/rZDP57+BkOt1dXXVoR3bWyz+LP5enp/S/pbngjAGZLFtxjdI3B5kO/pVnl9EcdMDkLSYBf4SE8ZuWo1tjIWvD+Ox/YN8JF07Cb2bmPNNTU2v+ZiWlpaXsHfhnzWeOQ2gI8hiT7G4czFh2Pdie4CsDXNo30ZOomaJbyRumPYPuVzulSjuOIQtD23/e7CoHTo6MWF+h4gcbEujnBHFi2x24Qr0eyInjLG4IxC2LrYL+OrxdfL8FelDf9/0P5BDjY2NdYpjbrNp70cuIwO023juNP0Usijocy3t77yPWlqDvs/67aD9suJtgwyoT/QNpGbLE5sMevtK1sJdRFhgSyLsuo8VIegPXQJh+NolsV3Q5MlZw/g/Wf4lzFns89B/Q/7mZSzDVqWXQj/fW9yASgVxr6P/iNzNW8ng4pqD/hm2W8gQclrEk7sRfQw5gRxsaGiYqbHQO5BR9VcxuSSotqhDBmhR2z1jwjyUh9zRy/M29JWuVCd7RKzZ2jWOJ0cwckVMP/65sgXzVn6rbJqnzfkqZOV9vsa0sSedo6BbbRfB27zBBnlehFWMoWNoO09Hf4lsnjCN5+OCslGus0mnJSCsWEZ8vsbU2FPN0QeeYSs6dWYdXkD+1ASrq6vfsCPTrQ5jwljMcN5uRX+TugTCiNkb7ogkKC8eI1h0maAkwgTLl7246KdCmC1SRS+Uf02GVNd046EfmGCSuiW79IaJXYh+M56MxR1X/QltMRSj/iYg7J7Pn4ow5vFJlPvkCEuCdVjxWUH7A1f6DitOJrCPMchW6bYTe3SEdJR8TMG+z9iFb45nPg5bcAVh1Jn52P5CflYhly2JMJ0EbBeRG8jbsj1LwgbDQYRg8NPaTWbW7dKvn1I+TscO2wgDr/Q2K8iDvj0RXImwB/TxpdpWlw4jo/nSlV+EJ0w+m0tWObTvW27x00BlQuUiXIv97NP6KggrWNFHdnvblAjY12S8lDvWkaPjKzy/RtrQv3J2+3jY0dyD7xqyRTuSmIvonWFcEtz4LXnMlYjSL47f6WNVJvg+Cgg7iq/XSNHnwybcVVFMWZJs5H7srEYG8lit/s8QIfomMsLei/0e+OYWSrfmh+H1PRlccCSVr2OWCYjy8AtX/5nSt5n+BCgS9UIhJCz2hYgIe/HADnkXAvpccFPHv0UtLmfHrxyndhyXIkWKFClSPBE8AmwAvJTpUSQeAAAAAElFTkSuQmCC>