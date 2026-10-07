#pragma once
#include <Arduino.h>
#include "telemetry_data.h"

void initCellularModem();
bool connectCellularGprs();
bool connectMqttBroker();
void maintainCellularMqtt();
bool publishTelemetryToMqtt(const SensorTelemetry& data);
void publishGatewayHeartbeat();
bool isMqttConnected();
