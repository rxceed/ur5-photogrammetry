#pragma once

#include <map>

struct PinSnapshot {
    std::map<int, int> states;

    bool hasPin(int pin) const {
        return states.find(pin) != states.end();
    }

    int getState(int pin, int defaultValue = 0) const {
        auto it = states.find(pin);
        if (it == states.end()) {
            return defaultValue;
        }
        return it->second;
    }
};