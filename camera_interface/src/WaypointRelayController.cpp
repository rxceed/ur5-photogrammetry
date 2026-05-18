#include "WaypointRelayController.hpp"

#include <chrono>
#include <iostream>
#include <stdexcept>
#include <thread>

WaypointRelayController::WaypointRelayController(
    const std::string& relayBaseUrl,
    const HttpClient& httpClient,
    int relayCommandGapMs
)
    : relayBaseUrl_(relayBaseUrl),
      httpClient_(httpClient),
      relayCommandGapMs_(relayCommandGapMs)
{
}

void WaypointRelayController::setRelay(int relayIndex, bool state) const
{
    if (relayIndex < 0 || relayIndex > 3) {
        throw std::runtime_error("Relay index must be 0, 1, 2, or 3");
    }

    std::string url = relayBaseUrl_ + "/" + std::to_string(relayIndex);
    std::string body = state ? "state=on" : "state=off";

    std::cout << "[RELAY] relay " << relayIndex
              << " -> " << (state ? "ON" : "OFF") << "\n";

    httpClient_.post(url, body);

    std::this_thread::sleep_for(
        std::chrono::milliseconds(relayCommandGapMs_)
    );
}

void WaypointRelayController::setWaypoint(const WaypointCommand& waypoint) const
{
    std::cout << "\n[WAYPOINT] Set waypoint "
              << waypoint.waypointId << "\n";

    std::cout << "[WAYPOINT] Relay code relay[3..0]: "
              << waypoint.relayState[3] << " "
              << waypoint.relayState[2] << " "
              << waypoint.relayState[1] << " "
              << waypoint.relayState[0] << "\n";

    // Urutan kirim mengikuti format yang kamu kasih:
    // relay[3] -> relay[2] -> relay[1] -> relay[0]
    setRelay(3, waypoint.relayState[3]);
    setRelay(2, waypoint.relayState[2]);
    setRelay(1, waypoint.relayState[1]);
    setRelay(0, waypoint.relayState[0]);

    std::cout << "[WAYPOINT] Waypoint "
              << waypoint.waypointId
              << " command sent\n";
}

std::vector<WaypointCommand> WaypointRelayController::getWaypointSequence()
{
    return {
        // waypoint, relay[0], relay[1], relay[2], relay[3]
        // ditulis begini karena array index-nya mengikuti nomor relay.

        { 1,  {false, false, false, false}}, // relay[3..0] = 0 0 0 0
        { 2,  {true,  false, false, false}}, // relay[3..0] = 0 0 0 1
        { 3,  {false, true,  false, false}}, // relay[3..0] = 0 0 1 0
        { 4,  {true,  true,  false, false}}, // relay[3..0] = 0 0 1 1

        { 5,  {false, false, true,  false}}, // relay[3..0] = 0 1 0 0
        { 6,  {true,  false, true,  false}}, // relay[3..0] = 0 1 0 1
        { 7,  {false, true,  true,  false}}, // relay[3..0] = 0 1 1 0
        { 8,  {true,  true,  true,  false}}, // relay[3..0] = 0 1 1 1

        { 9,  {false, false, false, true }}, // relay[3..0] = 1 0 0 0
        {10,  {true,  false, false, true }}, // relay[3..0] = 1 0 0 1
        {11,  {false, true,  false, true }}, // relay[3..0] = 1 0 1 0
        {12,  {true,  true,  false, true }}, // relay[3..0] = 1 0 1 1

        {13,  {false, false, true,  true }}, // relay[3..0] = 1 1 0 0
        {14,  {true,  false, true,  true }}, // relay[3..0] = 1 1 0 1
        {15,  {false, true,  true,  true }}, // relay[3..0] = 1 1 1 0
        {16,  {true,  true,  true,  true }}  // relay[3..0] = 1 1 1 1
    };
}