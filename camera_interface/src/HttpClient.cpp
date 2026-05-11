#include "HttpClient.hpp"

#include <curl/curl.h>
#include <stdexcept>

static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp)
{
    size_t totalSize = size * nmemb;
    auto* buffer = static_cast<std::string*>(userp);
    buffer->append(static_cast<char*>(contents), totalSize);
    return totalSize;
}

HttpClient::HttpClient(int connectTimeoutMs, int requestTimeoutMs)
    : connectTimeoutMs_(connectTimeoutMs),
      requestTimeoutMs_(requestTimeoutMs)
{
}

std::string HttpClient::get(const std::string& url) const
{
    CURL* curl = curl_easy_init();
    std::string response;

    if (!curl) {
        throw std::runtime_error("Failed to initialize CURL");
    }

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, connectTimeoutMs_);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, requestTimeoutMs_);

    CURLcode result = curl_easy_perform(curl);

    if (result != CURLE_OK) {
        std::string error = curl_easy_strerror(result);
        curl_easy_cleanup(curl);
        throw std::runtime_error("HTTP GET failed: " + error);
    }

    long httpCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);

    curl_easy_cleanup(curl);

    if (httpCode != 200) {
        throw std::runtime_error("HTTP response code: " + std::to_string(httpCode));
    }

    return response;
}