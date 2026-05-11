#pragma once

#include "HttpClient.hpp"

#include <array>
#include <string>
#include <vector>

struct WaypointCommand {
    int waypointId;

    // relayState[index] = state untuk relay index tersebut.
    // relayState[0] = relay 0
    // relayState[1] = relay 1
    // relayState[2] = relay 2
    // relayState[3] = relay 3
    std::array<bool, 4> relayState;
};

class WaypointRelayController {
public:
    WaypointRelayController(
        const std::string& relayBaseUrl,
        const HttpClient& httpClient,
        int relayCommandGapMs = 100
    );

    void setRelay(int relayIndex, bool state) const;
    void setWaypoint(const WaypointCommand& waypoint) const;

    static std::vector<WaypointCommand> getWaypointSequence();

private:
    std::string relayBaseUrl_;
    const HttpClient& httpClient_;
    int relayCommandGapMs_;
};