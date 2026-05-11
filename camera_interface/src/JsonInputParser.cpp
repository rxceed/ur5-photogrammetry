#include "JsonInputParser.hpp"

#include <nlohmann/json.hpp>
#include <stdexcept>

using json = nlohmann::json;

PinSnapshot parseInputJson(const std::string& rawJson)
{
    PinSnapshot snapshot;

    json data = json::parse(rawJson);

    if (!data.contains("inputs") || !data["inputs"].is_array()) {
        throw std::runtime_error("Invalid JSON: missing inputs array");
    }

    for (const auto& item : data["inputs"]) {
        if (!item.contains("pin") || !item.contains("state")) {
            continue;
        }

        int pin = item["pin"].get<int>();
        int state = item["state"].get<int>();

        snapshot.states[pin] = state;
    }

    return snapshot;
}