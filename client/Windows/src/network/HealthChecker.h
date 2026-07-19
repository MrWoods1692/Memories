#pragma once
#include <QObject>
#include <QNetworkAccessManager>

class HealthChecker : public QObject {
    Q_OBJECT
public:
    explicit HealthChecker(QObject* parent = nullptr);
    void setBaseUrl(const QString& url);
    void ping();

    bool isHealthy() const;

signals:
    void healthOk();
    void healthFail(const QString& error);

private:
    QNetworkAccessManager* m_manager;
    QString m_baseUrl;
    bool m_healthy = false;
};
