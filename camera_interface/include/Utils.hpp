#pragma once

#include <opencv2/opencv.hpp>

#include <filesystem>
#include <map>
#include <string>

std::string timestampNow();
std::string makeImageName(int index);
int findNextImageIndex(const std::filesystem::path& imageDir);

void drawOverlay(
    cv::Mat& frame,
    const std::map<int, int>& pinStates
);