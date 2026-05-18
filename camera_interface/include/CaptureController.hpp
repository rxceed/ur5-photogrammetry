#pragma once

#include "HttpClient.hpp"
#include "CameraCapture.hpp"
#include "PinSnapshot.hpp"

#include <string>

struct CaptureConfig {
    std::string inputUrl = "http://192.168.200.219/input";
    std::string startRelayUrl = "http://192.168.200.219/relay/1";
    std::string datasetDir = "dataset";

    int photoTriggerPin = 33;
    int cameraIndex = 0;

    int pollingDelayMs = 50;
    int maxCaptures = 16;

    int startPulseMs = 300;
};

class CaptureController {
public:
    explicit CaptureController(const CaptureConfig& config);

    int run();

private:
    CaptureConfig config_;
    HttpClient httpClient_;
    CameraCapture camera_;

    PinSnapshot readPinsSafe(
        const PinSnapshot& fallback,
        std::string* rawJsonOut = nullptr
    );

    bool waitUntilTriggerLow();
    bool sendStartPulseToUR5();
};