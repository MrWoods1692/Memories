#pragma once
#include <QObject>
#include <QNetworkAccessManager>

class ApiClient : public QObject {
    Q_OBJECT
public:
    explicit ApiClient(QObject* parent = nullptr);

    void setBaseUrl(const QString& url);
    void setAccessToken(const QString& token);

    // Health check
    void checkHealth();

    // Images
    void fetchImages(qint64 afterId = 0);
    void postImage(const QString& imageUrl);

signals:
    void healthCheckResult(bool ok);
    void healthCheckError(const QString& error);

    void imagesFetched(const QJsonArray& data, qint64 nextAfterId);
    void imagesFetchError(const QString& error);

    void imagePosted(qint64 id, const QString& url, qint64 uploadedAt);
    void imagePostError(const QString& error);

private:
    QNetworkAccessManager* m_manager;
    QString m_baseUrl;
    QString m_token;
};
