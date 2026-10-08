#include "optical_sensor.h"
#include "board_pins.h"
#include "config.h"
#include <Preferences.h>

static Preferences prefs;
static int baselineDelta = 50;       // Clean air chamber baseline delta
static int currentThreshold = DEFAULT_SMOKE_THRESHOLD_ADC;
static int consecutiveAlarms = 0;

void initOpticalSensor() {
    // Configure IR Emitter Pin
    pinMode(PIN_IR_TX, OUTPUT);
    digitalWrite(PIN_IR_TX, !IR_LED_ACTIVE_LEVEL); // Ensure IR LED starts OFF

    // Configure Photodiode / Receiver Analog Pin
    pinMode(PIN_IR_RX_ADC, INPUT);
    analogReadResolution(12);                      // 12-bit ADC (0 - 4095)
    analogSetAttenuation(ADC_11db);                // Full 0 - 3.1V range

    // Load saved calibration baseline & threshold from NVS
    prefs.begin(NVS_NAMESPACE, false);
    baselineDelta = prefs.getInt("baseline", 60);
    currentThreshold = prefs.getInt("thresh", DEFAULT_SMOKE_THRESHOLD_ADC);

    Serial.printf("[Optical Sensor] Initialized. Baseline Delta: %d | Threshold: %d\n",
                  baselineDelta, currentThreshold);
}

static int sampleAdcAverage(int samples) {
    uint32_t sum = 0;
    for (int i = 0; i < samples; i++) {
        sum += analogRead(PIN_IR_RX_ADC);
        delayMicroseconds(20);
    }
    return (int)(sum / samples);
}

OpticalReading sampleOpticalChamber() {
    OpticalReading reading;

    // 1. Measure Ambient / Dark Level (IR LED OFF)
    digitalWrite(PIN_IR_TX, !IR_LED_ACTIVE_LEVEL);
    delayMicroseconds(50); // Settle
    reading.ambientAdc = sampleAdcAverage(ADC_OVERSAMPLE_COUNT);

    // 2. Pulse IR LED ON (Strobe)
    digitalWrite(PIN_IR_TX, IR_LED_ACTIVE_LEVEL);
    delayMicroseconds(120); // Photodiode response rise time

    // 3. Measure Receiver during IR Pulse
    reading.pulseAdc = sampleAdcAverage(ADC_OVERSAMPLE_COUNT);

    // 4. Turn IR LED OFF immediately (conserve battery & prevent heating)
    digitalWrite(PIN_IR_TX, !IR_LED_ACTIVE_LEVEL);

    // 5. Differential Delta (Absolute value handles both Pull-Up and Pull-Down detector circuits)
    reading.rawDelta = abs(reading.pulseAdc - reading.ambientAdc);

    // 6. Net smoke signal (above clean chamber baseline)
    reading.netSmokeSignal = reading.rawDelta - baselineDelta;
    if (reading.netSmokeSignal < 0) {
        reading.netSmokeSignal = 0;
    }

    // 7. Estimate equivalent PPM (mapped for smart building ecosystem gateway)
    // 0 delta = 15 PPM (clean air), 500 delta = ~450 PPM (threshold), 1500 delta = ~800 PPM (heavy smoke)
    reading.estimatedPpm = 15.0f + (reading.netSmokeSignal * 0.85f);

    // 8. Alarm Decision with multi-cycle noise confirmation
    if (reading.netSmokeSignal >= currentThreshold) {
        consecutiveAlarms++;
        if (consecutiveAlarms >= ALARM_CONFIRM_CYCLES) {
            reading.isAlarm = true;
        } else {
            reading.isAlarm = false;
        }
    } else {
        if (consecutiveAlarms > 0) {
            consecutiveAlarms--;
        }
        reading.isAlarm = false;
    }

    reading.confirmCount = consecutiveAlarms;
    return reading;
}

void calibrateCleanAirBaseline(int sampleCycles) {
    Serial.println("\n[Calibration] Starting Clean Air Baseline Calibration...");
    Serial.printf("[Calibration] Sampling %d cycles in clean air chamber...\n", sampleCycles);

    uint32_t totalDelta = 0;
    for (int i = 0; i < sampleCycles; i++) {
        // Quick sample
        digitalWrite(PIN_IR_TX, !IR_LED_ACTIVE_LEVEL);
        delayMicroseconds(50);
        int amb = sampleAdcAverage(ADC_OVERSAMPLE_COUNT);

        digitalWrite(PIN_IR_TX, IR_LED_ACTIVE_LEVEL);
        delayMicroseconds(120);
        int pls = sampleAdcAverage(ADC_OVERSAMPLE_COUNT);
        digitalWrite(PIN_IR_TX, !IR_LED_ACTIVE_LEVEL);

        totalDelta += abs(pls - amb);
        delay(50);
    }

    baselineDelta = (int)(totalDelta / sampleCycles);
    prefs.putInt("baseline", baselineDelta);

    Serial.printf("[Calibration] Success! New Baseline Delta: %d ADC counts.\n", baselineDelta);
    playTestChirp();
}

void setSmokeThreshold(int newThreshold) {
    if (newThreshold < 50) newThreshold = 50;
    if (newThreshold > 3000) newThreshold = 3000;
    currentThreshold = newThreshold;
    prefs.putInt("thresh", currentThreshold);
    Serial.printf("[Config] Smoke Alarm Threshold updated to: %d ADC counts\n", currentThreshold);
}

int getSmokeThreshold() {
    return currentThreshold;
}

int getBaselineDelta() {
    return baselineDelta;
}

// -----------------------------------------------------------------------------
// Alarm Sounder (Buzzer & LED) Implementation
// -----------------------------------------------------------------------------
static void soundBuzzerDirect(bool state) {
    if (BUZZER_IS_PASSIVE) {
        if (state) {
            tone(PIN_ALARM_BUZZER, BUZZER_PWM_FREQ_HZ);
        } else {
            noTone(PIN_ALARM_BUZZER);
        }
    } else {
        digitalWrite(PIN_ALARM_BUZZER, state ? BUZZER_ACTIVE_LEVEL : !BUZZER_ACTIVE_LEVEL);
    }
}

void initAlarmSounder() {
    pinMode(PIN_ALARM_BUZZER, OUTPUT);
    soundBuzzerDirect(false);

    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);
}

/**
 * Executes ISO 8201 / T3 Standard Temporal Fire Alarm Pattern:
 * 3 beeps of 0.5s separated by 0.5s pause, then 1.5s pause.
 */
void updateAlarmSounder(bool isAlarm) {
    static uint32_t patternStartMs = 0;

    if (!isAlarm) {
        soundBuzzerDirect(false);
        digitalWrite(PIN_STATUS_LED, LOW);
        patternStartMs = 0;
        return;
    }

    if (patternStartMs == 0) {
        patternStartMs = millis();
    }

    uint32_t t = (millis() - patternStartMs) % 4000; // 4000ms cycle

    bool beepOn = false;
    if (t < 500) {
        beepOn = true;              // Beep 1 (0 - 500ms)
    } else if (t < 1000) {
        beepOn = false;             // Silence (500 - 1000ms)
    } else if (t < 1500) {
        beepOn = true;              // Beep 2 (1000 - 1500ms)
    } else if (t < 2000) {
        beepOn = false;             // Silence (1500 - 2000ms)
    } else if (t < 2500) {
        beepOn = true;              // Beep 3 (2000 - 2500ms)
    } else {
        beepOn = false;             // Long Silence (2500 - 4000ms)
    }

    soundBuzzerDirect(beepOn);
    digitalWrite(PIN_STATUS_LED, beepOn ? HIGH : LOW);
}

void playTestChirp() {
    soundBuzzerDirect(true);
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(100);
    soundBuzzerDirect(false);
    digitalWrite(PIN_STATUS_LED, LOW);
}
