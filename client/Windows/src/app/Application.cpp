#include "app/Application.h"
#include "app/Settings.h"
#include "network/ApiClient.h"
#include "network/HealthChecker.h"
#include "network/ImageUploader.h"
#include "utils/ImageCache.h"
#include "utils/Logger.h"

Application* Application::instance() {
    static Application app;
    return &app;
}

Application::Application(QObject* parent)
    : QObject(parent)
    , m_settings(std::make_unique<Settings>())
    , m_apiClient(std::make_unique<ApiClient>())
    , m_healthChecker(std::make_unique<HealthChecker>())
    , m_imageUploader(std::make_unique<ImageUploader>())
    , m_imageCache(std::make_unique<ImageCache>())
{
}

Application::~Application() = default;

Settings* Application::settings() const { return m_settings.get(); }
ApiClient* Application::apiClient() const { return m_apiClient.get(); }
HealthChecker* Application::healthChecker() const { return m_healthChecker.get(); }
ImageUploader* Application::imageUploader() const { return m_imageUploader.get(); }
ImageCache* Application::imageCache() const { return m_imageCache.get(); }

void Application::initialize() {
    if (m_initialized) return;

    LOG_INFO("Initializing Memories...");

    auto* s = m_settings.get();

    // Configure API client
    m_apiClient->setBaseUrl(s->apiBaseUrl());
    m_apiClient->setAccessToken(s->accessToken());

    // Configure health checker
    m_healthChecker->setBaseUrl(s->apiBaseUrl());

    // Configure uploader
    m_imageUploader->setScndioUrl(s->imgUploadUrl());
    m_imageUploader->setMemoriesApiUrl(s->apiBaseUrl());
    m_imageUploader->setAccessToken(s->accessToken());
    m_imageUploader->setDelayMs(s->uploadDelayMs());

    // Configure cache
    m_imageCache->setMaxSizeBytes(s->maxCacheBytes());

    m_initialized = true;
    LOG_INFO("Initialization complete.");
    emit initialized();
}

bool Application::isHeadless() const {
#ifdef HEADLESS_ONLY
    return true;
#else
    return false;
#endif
}
