-- ============================================================================
-- SMART BUILDING WIRELESS SMOKE & SECURITY SAAS ECOSYSTEM (DIGITAL TWIN)
-- ThingsBoard-Inspired Domain Architecture (Device Profiles, 3-Scope Attributes,
-- Stateful Alarm Lifecycle, Gateway Auto-Provisioning & Persistent RPC Queue)
-- ============================================================================

SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- 1. Users Table (RBAC Matrix: super_admin [SysAdmin], tenant [Tenant], user [Customer])
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(191) NOT NULL UNIQUE,
    email VARCHAR(191) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(512) NULL,
    role ENUM('super_admin', 'tenant', 'user') NOT NULL DEFAULT 'user',
    phone_number VARCHAR(32) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Specialized Safety Device Profiles Table (ThingsBoard DeviceProfile Pattern)
CREATE TABLE IF NOT EXISTS device_profiles (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    intro_type_byte VARCHAR(8) NOT NULL UNIQUE,
    sensor_type ENUM('SMOKE_MQ2', 'TEMP_DS18B20', 'DOOR_REED', 'CO_MQ7', 'GLASS_BREAK') NOT NULL,
    unit VARCHAR(32) NOT NULL,
    default_beacon_interval_sec INT UNSIGNED NOT NULL DEFAULT 600,
    inactivity_timeout_sec INT UNSIGNED NOT NULL DEFAULT 1800,
    warning_threshold FLOAT NULL,
    critical_threshold FLOAT NULL,
    low_battery_threshold_pct TINYINT UNSIGNED NOT NULL DEFAULT 20,
    description VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Buildings Table (Multi-Building SaaS Asset Registry)
CREATE TABLE IF NOT EXISTS buildings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(64) NOT NULL DEFAULT 'Tashkent',
    total_floors TINYINT UNSIGNED NOT NULL DEFAULT 9,
    tenant_user_id INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Central Gateways Table (SIM7670 4G LTE Cat 1 + RS485 Master)
CREATE TABLE IF NOT EXISTS gateways (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_id INT UNSIGNED NULL,
    serial_number VARCHAR(64) NOT NULL UNIQUE,
    imei VARCHAR(32) NOT NULL UNIQUE,
    sim_operator VARCHAR(64) NOT NULL DEFAULT 'Uztelecom LTE',
    rssi_dbm SMALLINT NOT NULL DEFAULT -59,
    status ENUM('online', 'offline', 'pairing_mode') NOT NULL DEFAULT 'online',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Floors & Floor Sub-Hubs Table (Asset + Optional Retranslator Hub)
CREATE TABLE IF NOT EXISTS floors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_id INT UNSIGNED NOT NULL DEFAULT 1,
    floor_number TINYINT UNSIGNED NOT NULL CHECK (floor_number BETWEEN 1 AND 50),
    name VARCHAR(64) NOT NULL,
    map_image_url VARCHAR(512) NOT NULL,
    map_width INT UNSIGNED NOT NULL DEFAULT 1920,
    map_height INT UNSIGNED NOT NULL DEFAULT 1080,
    hub_mac VARCHAR(32) NULL UNIQUE,
    dip_switch_address TINYINT UNSIGNED NOT NULL DEFAULT 1,
    hub_status ENUM('online', 'offline', 'battery_warning', 'pairing_mode', 'none') DEFAULT 'online',
    hub_battery_pct TINYINT UNSIGNED DEFAULT 100,
    last_heartbeat TIMESTAMP NULL,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
    UNIQUE KEY uq_building_floor (building_id, floor_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Rooms & Apartments Table (Customer Asset)
CREATE TABLE IF NOT EXISTS rooms_apartments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_id INT UNSIGNED NOT NULL DEFAULT 1,
    floor_id INT UNSIGNED NOT NULL,
    room_number VARCHAR(32) NOT NULL,
    owner_user_id INT UNSIGNED NULL,
    perimeter_security_status ENUM('disarmed', 'armed_home', 'armed_away') DEFAULT 'disarmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_floor_room (floor_id, room_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Single-Sensor End Devices Table (1 Device = 1 Sensor + ThingsBoard 3-Scope Attributes)
CREATE TABLE IF NOT EXISTS sensors_endpoints (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_id INT UNSIGNED NOT NULL DEFAULT 1,
    room_id INT UNSIGNED NOT NULL,
    chip_id VARCHAR(64) NOT NULL UNIQUE,
    profile_code VARCHAR(64) NOT NULL,
    sensor_type ENUM('SMOKE_MQ2', 'TEMP_DS18B20', 'DOOR_REED', 'CO_MQ7', 'GLASS_BREAK') NOT NULL,
    intro_packet_hex VARCHAR(64) NOT NULL,
    parent_link_type ENUM('FLOOR_HUB', 'CENTRAL_GATEWAY') NOT NULL DEFAULT 'FLOOR_HUB',
    parent_node_id VARCHAR(64) NOT NULL,
    status ENUM('online', 'offline', 'alarm', 'warning', 'pairing') DEFAULT 'online',
    coord_x FLOAT NOT NULL,
    coord_y FLOAT NOT NULL,
    battery_level TINYINT UNSIGNED NOT NULL DEFAULT 100,
    beacon_interval_seconds INT UNSIGNED NOT NULL DEFAULT 600,
    -- ThingsBoard 3-Scope Attributes Model
    client_attributes JSON NULL,
    shared_attributes_desired JSON NULL,
    shared_attributes_reported JSON NULL,
    sync_status ENUM('SYNCED', 'PENDING_WAKEUP', 'FAILED') NOT NULL DEFAULT 'SYNCED',
    claimed_by_user_id INT UNSIGNED NULL,
    claimed_at TIMESTAMP NULL,
    last_seen TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms_apartments(id) ON DELETE CASCADE,
    FOREIGN KEY (claimed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_sensor_chip (chip_id),
    INDEX idx_sensor_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Partitioned Telemetry Logs Table (1+ Year Retention)
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sensor_id INT UNSIGNED NOT NULL,
    smoke_ppm FLOAT NULL,
    co_ppm FLOAT NULL,
    temperature FLOAT NULL,
    reed_switch_open BOOLEAN NULL,
    glass_break_detected BOOLEAN NULL,
    battery_level TINYINT UNSIGNED NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, recorded_at),
    INDEX idx_telemetry_sensor_time (sensor_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (UNIX_TIMESTAMP(recorded_at)) (
    PARTITION p_prev VALUES LESS THAN (UNIX_TIMESTAMP('2026-01-01 00:00:00')),
    PARTITION p_2026_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01 00:00:00')),
    PARTITION p_2026_q2 VALUES LESS THAN (UNIX_TIMESTAMP('2026-07-01 00:00:00')),
    PARTITION p_2026_q3 VALUES LESS THAN (UNIX_TIMESTAMP('2026-10-01 00:00:00')),
    PARTITION p_2026_q4 VALUES LESS THAN (UNIX_TIMESTAMP('2027-01-01 00:00:00')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- 9. Stateful Alarm Events Table (ThingsBoard Alarm Lifecycle & Deduplication)
CREATE TABLE IF NOT EXISTS alarm_events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT UNSIGNED NOT NULL,
    event_type ENUM('SMOKE_CRITICAL', 'CO_DANGER', 'TEMP_THRESHOLD', 'UNAUTHORIZED_ENTRY', 'GLASS_BREAK') NOT NULL,
    severity ENUM('warning', 'critical', 'emergency') NOT NULL,
    status ENUM('active', 'acknowledged', 'resolved', 'escalated_to_112') NOT NULL DEFAULT 'active',
    lifecycle_state ENUM('ACTIVE_UNACK', 'ACTIVE_ACK', 'CLEARED_UNACK', 'CLEARED_ACK') NOT NULL DEFAULT 'ACTIVE_UNACK',
    trigger_count INT UNSIGNED NOT NULL DEFAULT 1,
    peak_value FLOAT NULL,
    smoke_val FLOAT NULL,
    temp_val FLOAT NULL,
    acknowledged_by INT UNSIGNED NULL,
    acknowledged_at TIMESTAMP NULL,
    cleared_at TIMESTAMP NULL,
    comments JSON NULL,
    emergency_112_payload JSON NULL,
    emergency_112_dispatched_at TIMESTAMP NULL,
    emergency_112_response JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES sensors_endpoints(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_alarm_status (status),
    INDEX idx_alarm_lifecycle (lifecycle_state),
    INDEX idx_alarm_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Persistent RPC Command Queue Table (ThingsBoard 2-Way RPC Queue Pattern)
CREATE TABLE IF NOT EXISTS rpc_commands (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rpc_uid VARCHAR(64) NOT NULL UNIQUE,
    building_id INT UNSIGNED NOT NULL,
    target_type ENUM('CENTRAL_GATEWAY', 'FLOOR_HUB', 'END_DEVICE') NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    method VARCHAR(64) NOT NULL,
    params JSON NOT NULL,
    status ENUM('QUEUED', 'DELIVERED', 'ACKED', 'TIMED_OUT') NOT NULL DEFAULT 'QUEUED',
    initiated_by_user_id INT UNSIGNED NULL,
    response_payload JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ack_at TIMESTAMP NULL,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_rpc_target (target_type, target_id),
    INDEX idx_rpc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
