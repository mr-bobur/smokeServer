#include "buzzer_alarm.h"
#include "board_pins.h"

static bool g_alarmActive = false;
static uint32_t g_lastAlarmRefreshMs = 0;
static const uint32_t ALARM_AUTOSILENCE_TIMEOUT_MS = 30000; // 30 sec auto-silence if unrefreshed

// Non-blocking siren cadence state
static uint32_t g_lastSirenToggleMs = 0;
static bool g_sirenPhaseOn = false;

// Non-blocking chirp state for pairing / events
static uint8_t g_chirpCount = 0;
static uint16_t g_chirpDurationMs = 80;
static uint32_t g_lastChirpToggleMs = 0;
static bool g_chirpPhaseOn = false;

void initBuzzer() {
#if defined(BUZZER_PIN) && (BUZZER_PIN >= 0)
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
    noTone(BUZZER_PIN);
    Serial.printf("[Buzzer] Initialized on GPIO %d (Direct GPIO drive, No Transistor)\n", BUZZER_PIN);
#endif
}

void setAlarmBuzzerState(bool active) {
    g_alarmActive = active;
    if (active) {
        g_lastAlarmRefreshMs = millis();
        Serial.println("[Buzzer] >>> ALARM SIREN ACTIVATED <<<");
    } else {
#if defined(BUZZER_PIN) && (BUZZER_PIN >= 0)
        noTone(BUZZER_PIN);
        digitalWrite(BUZZER_PIN, LOW);
#endif
        Serial.println("[Buzzer] Alarm Siren Silenced.");
    }
}

bool isAlarmBuzzerActive() {
    return g_alarmActive;
}

void chirpBuzzer(uint8_t count, uint16_t durationMs) {
    g_chirpCount = count * 2; // on/off transitions
    g_chirpDurationMs = durationMs;
    g_chirpPhaseOn = false;
    g_lastChirpToggleMs = 0;
}

void updateBuzzer() {
#if !defined(BUZZER_PIN) || (BUZZER_PIN < 0)
    return;
#endif

    uint32_t now = millis();

    // 1. High-priority Alarm Siren pattern
    if (g_alarmActive) {
        // Auto-silence check
        if (now - g_lastAlarmRefreshMs > ALARM_AUTOSILENCE_TIMEOUT_MS) {
            setAlarmBuzzerState(false);
            return;
        }

        // Fast pulsing alarm cadence: 150ms 2800Hz / 150ms 2400Hz
        if (now - g_lastSirenToggleMs >= 150) {
            g_lastSirenToggleMs = now;
            g_sirenPhaseOn = !g_sirenPhaseOn;
            if (g_sirenPhaseOn) {
                tone(BUZZER_PIN, 2800);
            } else {
                tone(BUZZER_PIN, 2200);
            }
        }
        return;
    }

    // 2. Chirp feedback handling (Pairing mode, ACK, etc.)
    if (g_chirpCount > 0) {
        if (now - g_lastChirpToggleMs >= g_chirpDurationMs) {
            g_lastChirpToggleMs = now;
            g_chirpPhaseOn = !g_chirpPhaseOn;
            g_chirpCount--;

            if (g_chirpPhaseOn) {
                tone(BUZZER_PIN, 2700);
            } else {
                noTone(BUZZER_PIN);
                digitalWrite(BUZZER_PIN, LOW);
            }

            if (g_chirpCount == 0) {
                noTone(BUZZER_PIN);
                digitalWrite(BUZZER_PIN, LOW);
            }
        }
    }
}
