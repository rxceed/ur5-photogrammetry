#pragma once

#include <string>

class HttpClient {
public:
    HttpClient(int connectTimeoutMs = 500, int requestTimeoutMs = 800);

    std::string get(const std::string& url) const;
    std::string post(const std::string& url, const std::string& body = "") const;

private:
    int connectTimeoutMs_;
    int requestTimeoutMs_;
};