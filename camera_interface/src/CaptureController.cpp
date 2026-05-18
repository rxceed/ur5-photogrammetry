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

bool CaptureController::sendStartPulseToUR5()
{
    std::cout << "[INFO] Sending START pulse to UR5...\n";
    std::cout << "[INFO] URL: " << config_.startRelayUrl << "\n";

    try {
        httpClient_.post(config_.startRelayUrl, "state=on");

        std::cout << "[OK] Start relay ON\n";

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.startPulseMs)
        );

        httpClient_.post(config_.startRelayUrl, "state=off");

        std::cout << "[OK] Start relay OFF\n";
        std::cout << "[OK] UR5 sequence should now start\n";

        return true;

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] Failed to send start pulse: "
                  << e.what() << "\n";
        return false;
    }
}

bool CaptureController::waitUntilTriggerLow()
{
    std::cout << "[INFO] Waiting PIN "
              << config_.photoTriggerPin
              << " to become LOW...\n";

    PinSnapshot lastPins;

    while (true) {
        cv::Mat rawFrame;

        if (!camera_.readFrame(rawFrame)) {
            std::cerr << "[WARN] Empty camera frame\n";
            std::this_thread::sleep_for(
                std::chrono::milliseconds(config_.pollingDelayMs)
            );
            continue;
        }

        PinSnapshot pins = readPinsSafe(lastPins);
        lastPins = pins;

        cv::Mat preview = rawFrame.clone();
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

        cv::imshow("UR5 Passive Capture Listener", preview);

        int key = cv::waitKey(1);

        if (key == 'q' || key == 'Q' || key == 27) {
            return false;
        }

        if (pins.getState(config_.photoTriggerPin, 0) == 0) {
            std::cout << "[OK] Trigger pin is LOW. System armed.\n";
            return true;
        }

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.pollingDelayMs)
        );
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

    std::cout << "Input URL         : " << config_.inputUrl << "\n";
    std::cout << "Dataset           : " << config_.datasetDir << "\n";
    std::cout << "Image dir         : " << imageDir << "\n";
    std::cout << "Photo trigger pin : " << config_.photoTriggerPin << "\n";
    std::cout << "Camera index      : " << config_.cameraIndex << "\n";
    std::cout << "Polling delay     : " << config_.pollingDelayMs << " ms\n";
    std::cout << "Max captures      : "
              << (config_.maxCaptures == 0 ? std::string("unlimited") : std::to_string(config_.maxCaptures))
              << "\n\n";

    int imageIndex = findNextImageIndex(imageDir);
    int captureCount = 0;

    if (!waitUntilTriggerLow()) {
        camera_.release();
        cv::destroyAllWindows();
        return 1;
    }

    if (!sendStartPulseToUR5()) {
    camera_.release();
    cv::destroyAllWindows();
    return 1;
    }

    PinSnapshot previousPins;
    PinSnapshot currentPins;

    previousPins = readPinsSafe(previousPins);

    std::cout << "[READY] Waiting UR5 DO[0] trigger on PIN "
              << config_.photoTriggerPin << "\n";
    std::cout << "[CONTROL] Press C = manual capture | Q/ESC = quit\n";

    while (true) {
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

        bool risingEdgeDetected = previousState == 0 && currentState == 1;
        bool captureRequested = risingEdgeDetected;

        cv::Mat preview = rawFrame.clone();
        drawOverlay(preview, currentPins.states);

        cv::putText(
            preview,
            "Capture " + std::to_string(captureCount) + "/" +
            (config_.maxCaptures == 0 ? std::string("inf") : std::to_string(config_.maxCaptures)) +
            " | waiting PIN " + std::to_string(config_.photoTriggerPin) + " 0->1",
            cv::Point(20, preview.rows - 55),
            cv::FONT_HERSHEY_SIMPLEX,
            0.6,
            cv::Scalar(255, 255, 255),
            2
        );

        cv::imshow("UR5 Passive Capture Listener", preview);

        int key = cv::waitKey(1);

        if (key == 'c' || key == 'C') {
            std::cout << "[MANUAL] Capture requested by keyboard\n";
            captureRequested = true;
        }

        if (key == 'q' || key == 'Q' || key == 27) {
            std::cout << "[INFO] Exit requested\n";
            break;
        }

        if (captureRequested) {
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
                      << " -> "
                      << imagePath << "\n";

            json meta;
            meta["filename"] = filename;
            meta["timestamp"] = timestampNow();
            meta["capture_index"] = captureCount;
            meta["estimated_waypoint"] = captureCount;
            meta["photo_trigger_pin"] = config_.photoTriggerPin;
            meta["trigger_source"] = risingEdgeDetected ? "pin_rising_edge" : "manual_keyboard";
            meta["pins"] = currentPins.states;
            meta["raw_json"] = rawJson;

            metadata << meta.dump() << "\n";
            metadata.flush();

            imageIndex++;

            // Setelah capture, jangan lanjut sebelum pin balik LOW.
            // Ini mencegah spam foto selama DO[0] masih HIGH.
            if (risingEdgeDetected) {
                if (!waitUntilTriggerLow()) {
                    break;
                }

                previousPins = readPinsSafe(currentPins);
                continue;
            }
        }

        previousPins = currentPins;

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.pollingDelayMs)
        );
    }

    camera_.release();
    cv::destroyAllWindows();

    std::cout << "[DONE] Passive UR5 capture finished. Total captures: "
              << captureCount << "\n";

    return 0;
}