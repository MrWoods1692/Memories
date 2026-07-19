#include "network/HealthChecker.h"
#include "utils/Logger.h"
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>

HealthChecker::HealthChecker(QObject* parent)
    : QObject(parent)
    , m_manager(new QNetworkAccessManager(this))
{
}

void HealthChecker::setBaseUrl(const QString& url) { m_baseUrl = url; }
bool HealthChecker::isHealthy() const { return m_healthy; }

void HealthChecker::ping() {
    QNetworkRequest req{QUrl(m_baseUrl + "/health")};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    auto* reply = m_manager->get(req);
    connect(reply, &QNetworkReply::finished, this, [this]() {
        auto* finishedReply = qobject_cast<QNetworkReply*>(sender());
        finishedReply->deleteLater();
        if (finishedReply->error() != QNetworkReply::NoError) {
            m_healthy = false;
            LOG_WARNING("Health ping failed: " + finishedReply->errorString());
            emit healthFail(finishedReply->errorString());
            return;
        }
        auto doc = QJsonDocument::fromJson(finishedReply->readAll());
        m_healthy = doc.object()["ok"].toBool(false);
        if (m_healthy) {
            LOG_INFO("Service healthy");
            emit healthOk();
        } else {
            emit healthFail("Service returned ok=false");
        }
    });
}
