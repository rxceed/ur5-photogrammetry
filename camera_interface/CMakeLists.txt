cmake_minimum_required(VERSION 3.16)
project(opensfm_tadin)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenCV REQUIRED)
find_package(CURL REQUIRED)
find_package(nlohmann_json REQUIRED)

add_executable(ur5_capture
    src/main.cpp
    src/HttpClient.cpp
    src/JsonInputParser.cpp
    src/CameraCapture.cpp
    src/CaptureController.cpp
    src/Utils.cpp
    src/WaypointRelayController.cpp
)

target_include_directories(ur5_capture PRIVATE include)

target_link_libraries(ur5_capture
    PRIVATE
    ${OpenCV_LIBS}
    CURL::libcurl
    nlohmann_json::nlohmann_json
)