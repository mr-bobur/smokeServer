/**
 * ============================================================================
 * SMART BUILDING ECOSYSTEM - ESP32-C3 FLOOR SUB-HUB FIRMWARE (FLOORS 1-9)
 * Section 4.2: 4x DIP Switch Binary Address (0001-1001) & RS485 Half-Duplex Bus
 * ============================================================================
 */
#include <Arduino.h>

// 4x DIP Switch Pinout (Active LOW with Internal Pull-ups)
#define SW1_PIN   1
#define SW2_PIN   2
#define SW3_PIN   3
#define SW4_PIN   4

// MAX485 / SP485 Transceiver Control Pins
#define RS485_DI_TX_PIN   5
#define RS485_RO_RX_PIN   6
#define RS485_DE_RE_PIN   7

#define FRAME_START_BYTE  0xAA
#define FRAME_STOP_BYTE   0x55

uint8_t floorAddress = 1;

/**
 * Reads 4x DIP Switch binary address (0001 = Floor 1 ... 1001 = Floor 9)
 */
uint8_t readFloorHardwareAddress() {
  uint8_t floor_address = (!digitalRead(SW1_PIN) << 0) |
                          (!digitalRead(SW2_PIN) << 1) |
                          (!digitalRead(SW3_PIN) << 2) |
                          (!digitalRead(SW4_PIN) << 3);
  if (floor_address < 1 || floor_address > 9) {
    return 1;
  }
  return floor_address;
}

/**
 * Standard Modbus/Industrial CRC-16 calculation
 */
uint16_t calculateCrc16(const uint8_t *data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= (uint16_t)data[i];
    for (uint8_t j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

/**
 * Transmits Industrial RS485 Frame:
 * [START_BYTE(0xAA), SRC_FLOOR, MSG_TYPE, LEN, PAYLOAD..., CRC16_H, CRC16_L, STOP_BYTE(0x55)]
 */
void sendRs485Frame(uint8_t msgType, const uint8_t *payload, uint8_t len) {
  uint8_t frame[128];
  size_t idx = 0;

  frame[idx++] = FRAME_START_BYTE;
  frame[idx++] = floorAddress;
  frame[idx++] = msgType;
  frame[idx++] = len;

  for (uint8_t i = 0; i < len; i++) {
    frame[idx++] = payload[i];
  }

  uint16_t crc = calculateCrc16(&frame[1], idx - 1);
  frame[idx++] = (uint8_t)((crc >> 8) & 0xFF); // CRC16_H
  frame[idx++] = (uint8_t)(crc & 0xFF);        // CRC16_L
  frame[idx++] = FRAME_STOP_BYTE;

  // Enable MAX485 Driver Output (DE/RE HIGH)
  digitalWrite(RS485_DE_RE_PIN, HIGH);
  delayMicroseconds(100);
  Serial1.write(frame, idx);
  Serial1.flush();
  delayMicroseconds(100);
  // Return to Receive Mode (DE/RE LOW)
  digitalWrite(RS485_DE_RE_PIN, LOW);
}

void setup() {
  pinMode(SW1_PIN, INPUT_PULLUP);
  pinMode(SW2_PIN, INPUT_PULLUP);
  pinMode(SW3_PIN, INPUT_PULLUP);
  pinMode(SW4_PIN, INPUT_PULLUP);
  pinMode(RS485_DE_RE_PIN, OUTPUT);
  digitalWrite(RS485_DE_RE_PIN, LOW);

  Serial.begin(115200);
  Serial1.begin(115200, SERIAL_8N1, RS485_RO_RX_PIN, RS485_DI_TX_PIN);

  floorAddress = readFloorHardwareAddress();
}

void loop() {
  floorAddress = readFloorHardwareAddress();
  uint8_t heartbeatPayload[4] = { floorAddress, 100, 0x01, 0x00 };
  sendRs485Frame(0x01, heartbeatPayload, 4);
  delay(5000);
}
