#pragma once
#include <Arduino.h>
#include "board_pins.h"

struct OpticalReading {
    int ambientAdc;        // Photodiode ADC before pulse (ambient light/dark level)
    int pulseAdc;          // Photodiode ADC during IR LED pulse
    int rawDelta;          // (pulseAdc - ambientAdc)
    int netSmokeSignal;    // (rawDelta - baselineDelta), clamped to >= 0
    float estimatedPpm;    // Estimated equivalent Smoke PPM
    bool isAlarm;          // True if smoke exceeds threshold
    int confirmCount;      // Number of consecutive alarm cycles
};

void initOpticalSensor();
OpticalReading sampleOpticalChamber();
void calibrateCleanAirBaseline(int sampleCycles = 20);
void setSmokeThreshold(int newThreshold);
int getSmokeThreshold();
int getBaselineDelta();

// Buzzer & Alarm Indicator (100% Non-Blocking millis() implementation)
void initAlarmSounder();
void updateAlarmSounder(bool isAlarm);
void triggerLedPulse(uint16_t durationMs = 30);
void triggerTestChirpNonBlocking(uint16_t durationMs = 120);

// Buzzer Mode Configuration
void setBuzzerMode(BuzzerMode mode);
BuzzerMode getBuzzerMode();
const char* getBuzzerModeName();
