#include "CaptureController.hpp"

#include "JsonInputParser.hpp"
#include "Utils.hpp"

#include <nlohmann/json.hpp>
#include <opencv2/opencv.hpp>

#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <thread>

using json = nlohmann::json;
namespace fs = std::filesystem;

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

bool CaptureController::waitForTriggerLow()
{
    std::cout << "[INFO] Waiting pin "
              << config_.photoTriggerPin
              << " LOW...\n";

    PinSnapshot lastPins;

    while (true) {
        cv::Mat frame;

        if (camera_.readFrame(frame)) {
            PinSnapshot pins = readPinsSafe(lastPins);
            lastPins = pins;

            cv::Mat preview = frame.clone();
            drawOverlay(preview, pins.states);

            cv::putText(
                preview,
                "Waiting PIN " + std::to_string(config_.photoTriggerPin) + " LOW",
                cv::Point(20, preview.rows - 55),
                cv::FONT_HERSHEY_SIMPLEX,
                0.6,
                cv::Scalar(255, 255, 255),
                2
            );

            cv::imshow("UR5 OpenSfM Capture", preview);

            if (pins.getState(config_.photoTriggerPin, 0) == 0) {
                std::cout << "[OK] Trigger pin LOW\n";
                return true;
            }
        }

        int key = cv::waitKey(1);

        if (key == 'q' || key == 'Q' || key == 27) {
            return false;
        }

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.pollingDelayMs)
        );
    }
}

bool CaptureController::waitForPhotoTriggerAndCapture(
    int waypointId,
    int& imageIndex,
    std::ofstream& metadata,
    const fs::path& imageDir
)
{
    std::cout << "[INFO] Waypoint " << waypointId << ": Waiting for robot signal...\n";

    PinSnapshot previousPins;
    PinSnapshot currentPins;
    std::string rawJson;

    previousPins = readPinsSafe(previousPins, &rawJson);
    auto startTime = std::chrono::steady_clock::now();

    // --- ADJUST THIS: How long to wait before "pressing C" automatically ---
    const int64_t autoCaptureDelayMs = 1000; 

    while (true) {
        auto now = std::chrono::steady_clock::now();
        auto elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(now - startTime).count();

        // 1. Hard Timeout (Total wait time allowed before error)
        if (elapsedMs > config_.triggerTimeoutMs) {
            std::cerr << "[ERROR] Timeout at waypoint " << waypointId << "\n";
            return false;
        }

        cv::Mat rawFrame;
        if (!camera_.readFrame(rawFrame)) {
            std::this_thread::sleep_for(std::chrono::milliseconds(config_.pollingDelayMs));
            continue;
        }

        // 2. Hardware Signal Check
        try {
            rawJson = httpClient_.get(config_.inputUrl);
            currentPins = parseInputJson(rawJson);
        } catch (...) {
            currentPins = previousPins;
        }

        int previousState = previousPins.getState(config_.photoTriggerPin, 0);
        int currentState = currentPins.getState(config_.photoTriggerPin, 0);
        
        // This is your crucial rising edge logic
        bool risingEdge = (previousState == 0 && currentState == 1);

        // 3. SUBSTITUTE FOR PRESSING 'C'
        // If the hardware signal hasn't arrived, but the delay has passed:
        if (!risingEdge && elapsedMs >= autoCaptureDelayMs) {
            std::cout << "[AUTO] Signal timer reached (" << autoCaptureDelayMs << "ms). Simulating capture trigger...\n";
            risingEdge = true; // Set risingEdge to true to trigger the capture block below
        }

        // 4. Update UI
        cv::Mat preview = rawFrame.clone();
        drawOverlay(preview, currentPins.states);
        
        std::string statusText = "Waiting for Pin " + std::to_string(config_.photoTriggerPin);
        if (elapsedMs >= autoCaptureDelayMs) statusText = "AUTO-TRIGGERING...";
        
        cv::putText(preview, statusText, cv::Point(20, preview.rows - 55),
                    cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(0, 255, 255), 2);
        
        cv::imshow("UR5 OpenSfM Capture", preview);
        
        // Check for 'Q' to quit, but removed the 'C' capture check
        int key = cv::waitKey(1);
        if (key == 'q' || key == 'Q' || key == 27) return false;

        // 5. Capture Logic (triggered by Hardware Pulse OR Timer)
        if (risingEdge) {
            std::string filename = makeImageName(imageIndex);
            fs::path imagePath = imageDir / filename;

            if (camera_.saveImage(rawFrame, imagePath)) {
                std::cout << "[CAPTURE] Waypoint " << waypointId << " saved.\n";

                json meta;
                meta["filename"] = filename;
                meta["timestamp"] = timestampNow();
                meta["waypoint"] = waypointId;
                meta["trigger_type"] = (elapsedMs >= autoCaptureDelayMs) ? "timer" : "hardware";
                meta["pins"] = currentPins.states;
                
                metadata << meta.dump() << "\n";
                metadata.flush();

                imageIndex++;
                return true;
            }
        }

        previousPins = currentPins;
        std::this_thread::sleep_for(std::chrono::milliseconds(config_.pollingDelayMs));
    }
}

int CaptureController::run()
{
    fs::path datasetPath = config_.datasetDir;
    fs::path imageDir = datasetPath / "images";

    fs::create_directories(imageDir);

    std::ofstream metadata(datasetPath / "metadata.jsonl", std::ios::app);

    if (!metadata.is_open()) {
        std::cerr << "[ERROR] Failed to open metadata.jsonl\n";
        return 1;
    }

    if (!camera_.open(config_.cameraIndex)) {
        std::cerr << "[ERROR] Failed to open camera index "
                  << config_.cameraIndex << "\n";
        return 1;
    }

    WaypointRelayController relayController(
        config_.relayBaseUrl,
        httpClient_,
        config_.relayCommandGapMs
    );

    std::cout << "Input URL         : " << config_.inputUrl << "\n";
    std::cout << "Relay Base URL    : " << config_.relayBaseUrl << "\n";
    std::cout << "Dataset           : " << config_.datasetDir << "\n";
    std::cout << "Photo trigger pin : " << config_.photoTriggerPin << "\n";
    std::cout << "Camera index      : " << config_.cameraIndex << "\n\n";

    int imageIndex = findNextImageIndex(imageDir);

    auto waypointSequence = WaypointRelayController::getWaypointSequence();

    if (!waitForTriggerLow()) {
        camera_.release();
        cv::destroyAllWindows();
        return 1;
    }

    for (const auto& waypoint : waypointSequence) {
        std::cout << "\n====================================\n";
        std::cout << "[SEQUENCE] Waypoint "
                  << waypoint.waypointId << "\n";
        std::cout << "====================================\n";

        try {
            relayController.setWaypoint(waypoint);
        } catch (const std::exception& e) {
            std::cerr << "[ERROR] Failed to set waypoint "
                      << waypoint.waypointId
                      << ": " << e.what() << "\n";
            break;
        }

        std::cout << "[INFO] Waiting waypoint settle: "
                  << config_.waypointSettleMs
                  << " ms\n";

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.waypointSettleMs)
        );

        bool captured = waitForPhotoTriggerAndCapture(
            waypoint.waypointId,
            imageIndex,
            metadata,
            imageDir
        );

        if (!captured) {
            std::cerr << "[ERROR] Capture stopped/failed at waypoint "
                      << waypoint.waypointId << "\n";
            break;
        }

        bool triggerReturnedLow = waitForTriggerLow();

        if (!triggerReturnedLow) {
            std::cerr << "[ERROR] Trigger did not return LOW after waypoint "
                      << waypoint.waypointId << "\n";
            break;
        }
    }

    camera_.release();
    cv::destroyAllWindows();

    std::cout << "\n[DONE] Waypoint 1 to 5 capture sequence finished\n";

    return 0;
}