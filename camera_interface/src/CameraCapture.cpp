#include "CameraCapture.hpp"

#include <iostream>
#include <thread>
#include <chrono>

bool CameraCapture::open(int cameraIndex)
{
    std::cout << "[INFO] Opening camera index: " << cameraIndex << "\n";

    cap_.open(cameraIndex, cv::CAP_V4L2);

    if (!cap_.isOpened()) {
        std::cerr << "[ERROR] Failed to open camera with V4L2 backend\n";
        return false;
    }

    // Banyak USB camera lebih stabil pakai MJPG dibanding default YUYV
    cap_.set(cv::CAP_PROP_FOURCC, cv::VideoWriter::fourcc('M', 'J', 'P', 'G'));
    cap_.set(cv::CAP_PROP_FRAME_WIDTH, 1280);
    cap_.set(cv::CAP_PROP_FRAME_HEIGHT, 720);
    cap_.set(cv::CAP_PROP_FPS, 30);

    std::cout << "[INFO] Camera opened\n";
    std::cout << "[INFO] Width  : " << cap_.get(cv::CAP_PROP_FRAME_WIDTH) << "\n";
    std::cout << "[INFO] Height : " << cap_.get(cv::CAP_PROP_FRAME_HEIGHT) << "\n";
    std::cout << "[INFO] FPS    : " << cap_.get(cv::CAP_PROP_FPS) << "\n";

    // Warm-up kamera
    cv::Mat temp;
    for (int i = 0; i < 30; i++) {
        cap_.read(temp);
        std::this_thread::sleep_for(std::chrono::milliseconds(30));
    }

    if (temp.empty()) {
        std::cerr << "[ERROR] Camera opened but still returns empty frame after warm-up\n";
        return false;
    }

    std::cout << "[OK] Camera warm-up success\n";
    return true;
}

bool CameraCapture::readFrame(cv::Mat& frame)
{
    bool ok = cap_.read(frame);

    if (!ok || frame.empty()) {
        return false;
    }

    return true;
}

bool CameraCapture::saveImage(const cv::Mat& frame, const std::filesystem::path& path)
{
    if (frame.empty()) {
        std::cerr << "[ERROR] Cannot save empty frame\n";
        return false;
    }

    return cv::imwrite(path.string(), frame);
}

void CameraCapture::release()
{
    if (cap_.isOpened()) {
        cap_.release();
    }
}