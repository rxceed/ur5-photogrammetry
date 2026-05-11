#pragma once

#include "HttpClient.hpp"
#include "CameraCapture.hpp"
#include "PinSnapshot.hpp"

#include <string>

struct CaptureConfig {
    std::string endpointUrl = "http://192.168.200.219/input";
    std::string datasetDir = "dataset";

    int triggerPin = 25;
    int stopPin = 32;
    int cameraIndex = 0;
    int pollingDelayMs = 200;
};

class CaptureController {
public:
    explicit CaptureController(const CaptureConfig& config);

    int run();

private:
    CaptureConfig config_;
    HttpClient httpClient_;
    CameraCapture camera_;
};