#include "CaptureController.hpp"

#include <curl/curl.h>

#include <iostream>
#include <string>

int main(int argc, char** argv)
{
    CaptureConfig config;

    if (argc >= 2) {
        config.endpointUrl = argv[1];
    }

    if (argc >= 3) {
        config.datasetDir = argv[2];
    }

    if (argc >= 4) {
        config.triggerPin = std::stoi(argv[3]);
    }

    if (argc >= 5) {
        config.cameraIndex = std::stoi(argv[4]);
    }

    curl_global_init(CURL_GLOBAL_DEFAULT);

    CaptureController controller(config);
    int result = controller.run();

    curl_global_cleanup();

    return result;
}