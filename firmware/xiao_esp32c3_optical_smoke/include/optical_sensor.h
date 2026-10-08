#pragma once
#include <Arduino.h>

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

// Buzzer & Alarm Indicator
void initAlarmSounder();
void updateAlarmSounder(bool isAlarm);
void playTestChirp();
