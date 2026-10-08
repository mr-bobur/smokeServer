#include "optical_sensor.h"
#include "board_pins.h"
#include "config.h"
#include <Preferences.h>

static Preferences prefs;
static int baselineDelta = 50;       // Clean air chamber baseline delta
static int currentThreshold = DEFAULT_SMOKE_THRESHOLD_ADC;
static int consecutiveAlarms = 0;
static BuzzerMode currentBuzzerMode = BUZZER_MODE_TONE_2700;

void initOpticalSensor() {
    // Configure IR Emitter Pin
    pinMode(PIN_IR_TX, OUTPUT);
    digitalWrite(PIN_IR_TX, !IR_LED_ACTIVE_LEVEL); // Ensure IR LED starts OFF

    // Configure Photodiode / Receiver Analog Pin
    pinMode(PIN_IR_RX_ADC, INPUT);
    analogReadResolution(12);                      // 12-bit ADC (0 - 4095)
    analogSetAttenuation(ADC_11db);                // Full 0 - 3.1V range

    // Load saved calibration baseline, threshold & buzzer mode from NVS
    prefs.begin(NVS_NAMESPACE, false);
    baselineDelta = prefs.getInt("baseline", 60);
    currentThreshold = prefs.getInt("thresh", DEFAULT_SMOKE_THRESHOLD_ADC);
    currentBuzzerMode = (BuzzerMode)prefs.getInt("buzzer_mode", BUZZER_MODE_TONE_2700);

    Serial.printf("[Optical Sensor] Initialized. Baseline: %d | Thresh: %d | Buzzer: %s\n",
                  baselineDelta, currentThreshold, getBuzzerModeName());
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
    triggerTestChirpNonBlocking(150);
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
// Alarm Sounder (Buzzer & LED) Implementation - 100% Non-Blocking millis()
// -----------------------------------------------------------------------------
static uint32_t ledTurnOffAtMs = 0;
static bool ledPulseActive = false;
static uint32_t testChirpOffAtMs = 0;
static bool testChirpActive = false;

static void soundBuzzerDirect(bool state) {
    if (state) {
        switch (currentBuzzerMode) {
            case BUZZER_MODE_TONE_2700:
                tone(PIN_ALARM_BUZZER, 2700);
                break;
            case BUZZER_MODE_TONE_4000:
                tone(PIN_ALARM_BUZZER, 4000);
                break;
            case BUZZER_MODE_DC_HIGH:
                digitalWrite(PIN_ALARM_BUZZER, HIGH);
                break;
            case BUZZER_MODE_DC_LOW:
                digitalWrite(PIN_ALARM_BUZZER, LOW);
                break;
        }
    } else {
        noTone(PIN_ALARM_BUZZER);
        // Ensure transistor is completely OFF in silent state (0V LOW for Tone & DC_HIGH)
        if (currentBuzzerMode == BUZZER_MODE_DC_LOW) {
            digitalWrite(PIN_ALARM_BUZZER, HIGH);
        } else {
            digitalWrite(PIN_ALARM_BUZZER, LOW);
        }
    }
}

static void setStatusLed(bool on) {
    digitalWrite(PIN_STATUS_LED, on ? STATUS_LED_ACTIVE_LEVEL : !STATUS_LED_ACTIVE_LEVEL);
}

void triggerLedPulse(uint16_t durationMs) {
    setStatusLed(true);
    ledTurnOffAtMs = millis() + durationMs;
    ledPulseActive = true;
}

void triggerTestChirpNonBlocking(uint16_t durationMs) {
    soundBuzzerDirect(true);
    setStatusLed(true);
    testChirpOffAtMs = millis() + durationMs;
    testChirpActive = true;
}

void initAlarmSounder() {
    pinMode(PIN_ALARM_BUZZER, OUTPUT);
    soundBuzzerDirect(false);

    pinMode(PIN_STATUS_LED, OUTPUT);
    setStatusLed(false);
}

void setBuzzerMode(BuzzerMode mode) {
    currentBuzzerMode = mode;
    prefs.putInt("buzzer_mode", (int)mode);
    Serial.printf("[Config] Buzzer Mode changed to: %s\n", getBuzzerModeName());
    triggerTestChirpNonBlocking(100);
}

BuzzerMode getBuzzerMode() {
    return currentBuzzerMode;
}

const char* getBuzzerModeName() {
    switch (currentBuzzerMode) {
        case BUZZER_MODE_TONE_2700: return "Piezo PWM Tone 2.7 kHz (Standard Smoke Alarm)";
        case BUZZER_MODE_TONE_4000: return "Piezo PWM Tone 4.0 kHz (High Pitch)";
        case BUZZER_MODE_DC_HIGH:   return "Active DC Buzzer (HIGH=ON, LOW=OFF)";
        case BUZZER_MODE_DC_LOW:    return "Active DC Buzzer (LOW=ON, HIGH=OFF)";
        default: return "Unknown";
    }
}

/**
 * Executes ISO 8201 / T3 Standard Temporal Fire Alarm Pattern completely non-blocking:
 * 3 beeps of 0.5s separated by 0.5s pause, then 1.5s pause.
 */
void updateAlarmSounder(bool isAlarm) {
    static uint32_t patternStartMs = 0;

    // Handle test chirp timer
    if (testChirpActive) {
        if (millis() >= testChirpOffAtMs) {
            soundBuzzerDirect(false);
            setStatusLed(false);
            testChirpActive = false;
        }
        return;
    }

    if (!isAlarm) {
        soundBuzzerDirect(false);
        patternStartMs = 0;

        // Manage non-blocking LED pulse timer in normal mode
        if (ledPulseActive) {
            if (millis() >= ledTurnOffAtMs) {
                setStatusLed(false);
                ledPulseActive = false;
            }
        } else {
            setStatusLed(false);
        }
        return;
    }

    // Alarm mode: T3 fire temporal cadence
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
    setStatusLed(beepOn);
}
