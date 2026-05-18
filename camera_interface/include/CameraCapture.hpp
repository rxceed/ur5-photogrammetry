#pragma once

#include <opencv2/opencv.hpp>
#include <filesystem>
#include <string>

class CameraCapture {
public:
    bool open(const std::string& cameraPath);
    bool readFrame(cv::Mat& frame);
    bool saveImage(const cv::Mat& frame, const std::filesystem::path& path);

    void release();

private:
    cv::VideoCapture cap_;
};