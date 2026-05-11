#include "Utils.hpp"

#include <chrono>
#include <iomanip>
#include <sstream>
#include <iostream>

std::string timestampNow()
{
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);

    std::tm tm{};
    localtime_r(&time, &tm);

    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y%m%d_%H%M%S");

    return oss.str();
}

std::string makeImageName(int index)
{
    std::ostringstream oss;
    oss << "img_" << std::setw(5) << std::setfill('0') << index << ".jpg";
    return oss.str();
}

int findNextImageIndex(const std::filesystem::path& imageDir)
{
    int maxIndex = 0;

    if (!std::filesystem::exists(imageDir)) {
        return 1;
    }

    for (const auto& entry : std::filesystem::directory_iterator(imageDir)) {
        if (!entry.is_regular_file()) {
            continue;
        }

        std::string name = entry.path().filename().string();

        if (name.rfind("img_", 0) != 0) {
            continue;
        }

        if (name.size() < 13) {
            continue;
        }

        try {
            int index = std::stoi(name.substr(4, 5));
            if (index > maxIndex) {
                maxIndex = index;
            }
        } catch (...) {
            continue;
        }
    }

    return maxIndex + 1;
}

void drawOverlay(
    cv::Mat& frame,
    const std::map<int, int>& pinStates
)
{
    int y = 30;

    cv::putText(
        frame,
        "UR5 OpenSfM Capture",
        cv::Point(20, y),
        cv::FONT_HERSHEY_SIMPLEX,
        0.8,
        cv::Scalar(255, 255, 255),
        2
    );

    y += 35;

    for (const auto& [pin, state] : pinStates) {
        std::string text = "PIN " + std::to_string(pin) + " = " + std::to_string(state);

        cv::putText(
            frame,
            text,
            cv::Point(20, y),
            cv::FONT_HERSHEY_SIMPLEX,
            0.65,
            cv::Scalar(255, 255, 255),
            2
        );

        y += 30;
    }

    cv::putText(
        frame,
        "C = manual capture | Q/ESC = quit",
        cv::Point(20, frame.rows - 25),
        cv::FONT_HERSHEY_SIMPLEX,
        0.6,
        cv::Scalar(255, 255, 255),
        2
    );
}