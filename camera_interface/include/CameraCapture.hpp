#pragma once

#include <opencv2/opencv.hpp>
#include <filesystem>

class CameraCapture {
public:
    bool open(int cameraIndex);
    bool readFrame(cv::Mat& frame);
    bool saveImage(const cv::Mat& frame, const std::filesystem::path& path);

    void release();

private:
    cv::VideoCapture cap_;
};