#pragma once

#include "HttpClient.hpp"
#include "CameraCapture.hpp"
#include "PinSnapshot.hpp"
#include "WaypointRelayController.hpp"

#include <filesystem>
#include <fstream>
#include <string>

struct CaptureConfig {
    std::string inputUrl = "http://192.168.200.219/input";
    std::string relayBaseUrl = "http://192.168.200.219/relay";
    std::string datasetDir = "dataset";

    int photoTriggerPin = 33;
    int cameraIndex = 0;

    int pollingDelayMs = 100;
    int relayCommandGapMs = 100;
    int waypointSettleMs = 500;
    int triggerTimeoutMs = 30000;
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

    bool waitForTriggerLow();

    bool waitForPhotoTriggerAndCapture(
        int waypointId,
        int& imageIndex,
        std::ofstream& metadata,
        const std::filesystem::path& imageDir
    );
};