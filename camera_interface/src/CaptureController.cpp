#include "CaptureController.hpp"

#include "JsonInputParser.hpp"
#include "Utils.hpp"

#include <nlohmann/json.hpp>

#include <opencv2/opencv.hpp>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <thread>
#include <chrono>

using json = nlohmann::json;
namespace fs = std::filesystem;

CaptureController::CaptureController(const CaptureConfig& config)
    : config_(config),
      httpClient_(500, 800)
{
}

int CaptureController::run()
{
    fs::path datasetPath = config_.datasetDir;
    fs::path imageDir = datasetPath / "images";

    fs::create_directories(imageDir);

    std::ofstream metadata(datasetPath / "metadata.jsonl", std::ios::app);

    if (!metadata.is_open()) {
        std::cerr << "Failed to open metadata.jsonl\n";
        return 1;
    }

    if (!camera_.open(config_.cameraIndex)) {
        std::cerr << "Failed to open camera index " << config_.cameraIndex << "\n";
        return 1;
    }

    std::cout << "Endpoint    : " << config_.endpointUrl << "\n";
    std::cout << "Dataset     : " << config_.datasetDir << "\n";
    std::cout << "Image dir   : " << imageDir << "\n";
    std::cout << "Trigger pin : " << config_.triggerPin << "\n";
    std::cout << "Stop pin    : " << config_.stopPin << "\n";
    std::cout << "Camera      : " << config_.cameraIndex << "\n\n";

    PinSnapshot previousPins;
    PinSnapshot currentPins;

    int imageIndex = findNextImageIndex(imageDir);

    while (true) {
        cv::Mat rawFrame;

        if (!camera_.readFrame(rawFrame)) {
            std::cerr << "[WARN] Empty camera frame\n";
            continue;
        }

        std::string rawJson;

        try {
            rawJson = httpClient_.get(config_.endpointUrl);
            currentPins = parseInputJson(rawJson);
        } catch (const std::exception& e) {
            std::cerr << "[WARN] HTTP/JSON error: " << e.what() << "\n";
            currentPins = previousPins;
        }

        int previousTriggerState = previousPins.getState(config_.triggerPin, 0);
        int currentTriggerState = currentPins.getState(config_.triggerPin, 0);

        bool triggerCapture = false;

        if (previousTriggerState == 0 && currentTriggerState == 1) {
            triggerCapture = true;
        }

        bool stopRequested = currentPins.getState(config_.stopPin, 0) == 1;

        cv::Mat previewFrame = rawFrame.clone();
        drawOverlay(previewFrame, currentPins.states);

        cv::imshow("UR5 OpenSfM Capture", previewFrame);

        int key = cv::waitKey(1);

        if (key == 'c' || key == 'C') {
            triggerCapture = true;
        }

        if (key == 'q' || key == 'Q' || key == 27 || stopRequested) {
            std::cout << "Exit requested\n";
            break;
        }

        if (triggerCapture) {
            std::string filename = makeImageName(imageIndex);
            fs::path imagePath = imageDir / filename;

            bool saved = camera_.saveImage(rawFrame, imagePath);

            if (saved) {
                std::cout << "[CAPTURE] " << imagePath << "\n";

                json meta;
                meta["filename"] = filename;
                meta["timestamp"] = timestampNow();
                meta["trigger_pin"] = config_.triggerPin;
                meta["pins"] = currentPins.states;
                meta["raw_json"] = rawJson;

                metadata << meta.dump() << "\n";
                metadata.flush();

                imageIndex++;
            } else {
                std::cerr << "[ERROR] Failed to save image\n";
            }
        }

        previousPins = currentPins;

        std::this_thread::sleep_for(
            std::chrono::milliseconds(config_.pollingDelayMs)
        );
    }

    camera_.release();
    cv::destroyAllWindows();

    return 0;
}