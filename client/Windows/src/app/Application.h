#pragma once
#include <QObject>
#include <memory>

class Settings;
class ApiClient;
class HealthChecker;
class ImageUploader;
class ImageCache;

class Application : public QObject {
    Q_OBJECT
public:
    explicit Application(QObject* parent = nullptr);
    ~Application();

    static Application* instance();

    Settings* settings() const;
    ApiClient* apiClient() const;
    HealthChecker* healthChecker() const;
    ImageUploader* imageUploader() const;
    ImageCache* imageCache() const;

    void initialize();
    bool isHeadless() const;

signals:
    void initialized();

private:
    std::unique_ptr<Settings> m_settings;
    std::unique_ptr<ApiClient> m_apiClient;
    std::unique_ptr<HealthChecker> m_healthChecker;
    std::unique_ptr<ImageUploader> m_imageUploader;
    std::unique_ptr<ImageCache> m_imageCache;
    bool m_initialized = false;
};
