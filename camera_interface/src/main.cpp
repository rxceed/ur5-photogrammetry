#include "CaptureController.hpp"

#include <curl/curl.h>

#include <iostream>
#include <string>

int main(int argc, char** argv)
{
    CaptureConfig config;

    if (argc >= 2) {
        config.inputUrl = argv[1];
    }

    if (argc >= 3) {
        config.datasetDir = argv[2];
    }

    if (argc >= 4) {
        config.photoTriggerPin = std::stoi(argv[3]);
    }

    if (argc >= 5) {
        config.cameraPath = argv[4];
    }

    if (argc >= 6) {
        config.maxCaptures = std::stoi(argv[5]);
    }

    if (argc >= 7) {
        config.startRelayUrl = argv[6];
    }

    curl_global_init(CURL_GLOBAL_DEFAULT);

    CaptureController controller(config);
    int result = controller.run();

    curl_global_cleanup();

    return result;
}