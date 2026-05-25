#include "CaptureController.hpp"

#include "JsonInputParser.hpp"
#include "Utils.hpp"

#include <nlohmann/json.hpp>
#include <opencv2/opencv.hpp>

#include <atomic>
#include <chrono>
#include <csignal>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <thread>

using json = nlohmann::json;
namespace fs = std::filesystem;

static std::atomic<bool> stopRequested(false);

static void signalHandler(int signal)
{
    std::cout << "\n[INFO] Stop signal received: " << signal << "\n";
    stopRequested.store(true);
}

CaptureController::CaptureController(const CaptureConfig& config)
    : config_(config),
      httpClient_(500, 800)
{
}

PinSnapshot CaptureController::readPinsSafe(
    const PinSnapshot& fallback,
    std::string* rawJsonOut
)
{
    try {
        std::string rawJson = httpClient_.get(config_.inputUrl);

        if (rawJsonOut != nullptr) {
            *rawJsonOut = rawJson;
        }

        return parseInputJson(rawJson);

    } catch (const std::exception& e) {
        std::cerr << "[WARN] Failed to read input pins: "
                  << e.what() << "\n";
        return fallback;
    }
}

bool CaptureController::waitUntilTriggerLow()
{
    std::cout << "[INFO] Waiting PIN "
              << config_.photoTriggerPin
              << " to become LOW...\n";

    PinSnapshot lastPins;

    while (!stopRequested.load()) {
        cv::Mat frame;

        if (!camera_.readFrame(frame)) {
            std::cerr << "[WARN] Empty camera frame while waiting trigger LOW\n";
            std::this_thread::sleep_for(
                std::chrono::milliseconds(config_.pollingDelayMs)
            );
            continue;
        }

        PinSnapshot pins = readPinsSafe(lastPins);
        lastPins = pins;

        int state = pins.getState(config_.photoTriggerPin, 0);

        std::cout << "\r[STATUS] PIN "
                  << config_.photoTriggerPin
                  << " = "
                  << state
                  << " | waiting LOW..."
                  << std::flush;

        if (state == 0) {
            std::cout << "\n[OK] Trigger pin is LOW. System armed.\n";
            return true;
        }

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.pollingDelayMs)
        );
    }

    std::cout << "\n[INFO] waitUntilTriggerLow stopped by user\n";
    return false;
}

bool CaptureController::sendStartPulseToUR5()
{
    std::cout << "[INFO] Sending START pulse to UR5\n";
    std::cout << "[INFO] Start relay URL: "
              << config_.startRelayUrl << "\n";

    try {
        httpClient_.post(config_.startRelayUrl, "state=on");

        std::cout << "[OK] Start relay ON\n";

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.startPulseMs)
        );

        httpClient_.post(config_.startRelayUrl, "state=off");

        std::cout << "[OK] Start relay OFF\n";
        std::cout << "[OK] UR5 sequence should start now\n";

        return true;

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] Failed to send start pulse: "
                  << e.what() << "\n";
        return false;
    }
}

int CaptureController::run()
{
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);

    fs::path datasetPath = config_.datasetDir;
    fs::path imageDir = datasetPath / "images";

    fs::create_directories(imageDir);

    std::ofstream metadata(datasetPath / "metadata.jsonl", std::ios::app);

    if (!metadata.is_open()) {
        std::cerr << "[ERROR] Failed to open metadata.jsonl\n";
        return 1;
    }

    if (!camera_.open(config_.cameraPath)) {
        std::cerr << "[ERROR] Failed to open camera index "
                  << config_.cameraPath << "\n";
        return 1;
    }

    std::cout << "========================================\n";
    std::cout << "UR5 Headless Camera Capture Interface\n";
    std::cout << "========================================\n";
    std::cout << "Input URL         : " << config_.inputUrl << "\n";
    std::cout << "Start relay URL   : " << config_.startRelayUrl << "\n";
    std::cout << "Dataset           : " << config_.datasetDir << "\n";
    std::cout << "Image dir         : " << imageDir << "\n";
    std::cout << "Photo trigger pin : " << config_.photoTriggerPin << "\n";
    std::cout << "Camera index      : " << config_.cameraPath << "\n";
    std::cout << "Polling delay     : " << config_.pollingDelayMs << " ms\n";
    std::cout << "Max captures      : "
              << (config_.maxCaptures == 0
                  ? std::string("unlimited")
                  : std::to_string(config_.maxCaptures))
              << "\n";
    std::cout << "Start pulse       : " << config_.startPulseMs << " ms\n";
    std::cout << "Stop command      : CTRL + C\n";
    std::cout << "========================================\n\n";

    int imageIndex = findNextImageIndex(imageDir);
    int captureCount = 0;

    if (!waitUntilTriggerLow()) {
        camera_.release();
        return 1;
    }

    if (!sendStartPulseToUR5()) {
        camera_.release();
        return 1;
    }

    PinSnapshot previousPins;
    PinSnapshot currentPins;

    previousPins = readPinsSafe(previousPins);

    std::cout << "[READY] Waiting UR5 DO[0] trigger on PIN "
              << config_.photoTriggerPin << "\n\n";

    while (!stopRequested.load()) {
        if (config_.maxCaptures > 0 && captureCount >= config_.maxCaptures) {
            std::cout << "[DONE] Reached max captures: "
                      << config_.maxCaptures << "\n";
            break;
        }

        cv::Mat rawFrame;

        if (!camera_.readFrame(rawFrame)) {
            std::cerr << "[WARN] Empty camera frame\n";
            std::this_thread::sleep_for(
                std::chrono::milliseconds(config_.pollingDelayMs)
            );
            continue;
        }

        std::string rawJson;

        try {
            rawJson = httpClient_.get(config_.inputUrl);
            currentPins = parseInputJson(rawJson);

        } catch (const std::exception& e) {
            std::cerr << "[WARN] HTTP/JSON error: "
                      << e.what() << "\n";
            currentPins = previousPins;
        }

        int previousState = previousPins.getState(config_.photoTriggerPin, 0);
        int currentState = currentPins.getState(config_.photoTriggerPin, 0);

        bool risingEdgeDetected =
            previousState == 0 && currentState == 1;

        std::cout << "\r[STATUS] Capture "
                  << captureCount
                  << "/"
                  << (config_.maxCaptures == 0
                      ? std::string("inf")
                      : std::to_string(config_.maxCaptures))
                  << " | PIN "
                  << config_.photoTriggerPin
                  << " = "
                  << currentState
                  << " | waiting 0->1..."
                  << std::flush;

        if (risingEdgeDetected) {
            std::cout << "\n[TRIGGER] Rising edge detected on PIN "
                      << config_.photoTriggerPin << "\n";

            std::string filename = makeImageName(imageIndex);
            fs::path imagePath = imageDir / filename;

            bool saved = camera_.saveImage(rawFrame, imagePath);

            if (!saved) {
                std::cerr << "[ERROR] Failed to save image\n";
                break;
            }

            captureCount++;

            std::cout << "[CAPTURE] #"
                      << captureCount
                      << " saved: "
                      << imagePath << "\n";

            json meta;
            meta["filename"] = filename;
            meta["timestamp"] = timestampNow();
            meta["capture_index"] = captureCount;
            meta["estimated_waypoint"] = captureCount;
            meta["photo_trigger_pin"] = config_.photoTriggerPin;
            meta["trigger_source"] = "pin_rising_edge";
            meta["pins"] = currentPins.states;
            meta["raw_json"] = rawJson;

            metadata << meta.dump() << "\n";
            metadata.flush();

            imageIndex++;

            if (!waitUntilTriggerLow()) {
                break;
            }

            previousPins = readPinsSafe(currentPins);
            continue;
        }

        previousPins = currentPins;

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.pollingDelayMs)
        );
    }

    camera_.release();

    std::cout << "\n[DONE] Headless UR5 capture finished\n";
    std::cout << "[DONE] Total captures: "
              << captureCount << "\n";

    return 0;
}