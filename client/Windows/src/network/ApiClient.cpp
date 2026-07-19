#include "network/ApiClient.h"
#include "utils/Logger.h"
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QUrlQuery>

ApiClient::ApiClient(QObject* parent)
    : QObject(parent)
    , m_manager(new QNetworkAccessManager(this))
    , m_baseUrl("https://api.mrcwoods.com")
{
}

void ApiClient::setBaseUrl(const QString& url) { m_baseUrl = url; }
void ApiClient::setAccessToken(const QString& token) { m_token = token; }

void ApiClient::checkHealth() {
    QNetworkRequest req{QUrl(m_baseUrl + "/health")};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    if (!m_token.isEmpty())
        req.setRawHeader("Authorization", ("Bearer " + m_token).toUtf8());

    auto* reply = m_manager->get(req);
    connect(reply, &QNetworkReply::finished, this, [this]() {
        auto* finishedReply = qobject_cast<QNetworkReply*>(sender());
        finishedReply->deleteLater();
        if (finishedReply->error() != QNetworkReply::NoError) {
            LOG_ERROR("Health check failed: " + finishedReply->errorString());
            emit healthCheckError(finishedReply->errorString());
            return;
        }
        auto doc = QJsonDocument::fromJson(finishedReply->readAll());
        bool ok = doc.object()["ok"].toBool(false);
        LOG_INFO("Health check: " + QString(ok ? "OK" : "FAIL"));
        emit healthCheckResult(ok);
    });
}

void ApiClient::fetchImages(qint64 afterId) {
    QUrl url(m_baseUrl + "/images");
    QUrlQuery query;
    query.addQueryItem("after_id", QString::number(afterId));
    url.setQuery(query);

    QNetworkRequest req{url};
    if (!m_token.isEmpty())
        req.setRawHeader("Authorization", ("Bearer " + m_token).toUtf8());

    auto* reply = m_manager->get(req);
    connect(reply, &QNetworkReply::finished, this, [this]() {
        auto* finishedReply = qobject_cast<QNetworkReply*>(sender());
        finishedReply->deleteLater();
        if (finishedReply->error() != QNetworkReply::NoError) {
            LOG_ERROR("Fetch images failed: " + finishedReply->errorString());
            emit imagesFetchError(finishedReply->errorString());
            return;
        }
        auto doc = QJsonDocument::fromJson(finishedReply->readAll());
        auto obj = doc.object();
        auto data = obj["data"].toArray();
        qint64 nextId = obj["next_after_id"].toInteger(-1);
        LOG_INFO(QString("Fetched %1 images").arg(data.size()));
        emit imagesFetched(data, nextId);
    });
}

void ApiClient::postImage(const QString& imageUrl) {
    QNetworkRequest req{QUrl(m_baseUrl + "/images")};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    if (!m_token.isEmpty())
        req.setRawHeader("Authorization", ("Bearer " + m_token).toUtf8());

    QJsonObject body;
    body["url"] = imageUrl;
    auto* reply = m_manager->post(req, QJsonDocument(body).toJson());

    connect(reply, &QNetworkReply::finished, this, [this]() {
        auto* finishedReply = qobject_cast<QNetworkReply*>(sender());
        finishedReply->deleteLater();
        if (finishedReply->error() != QNetworkReply::NoError) {
            LOG_ERROR("Post image failed: " + finishedReply->errorString());
            emit imagePostError(finishedReply->errorString());
            return;
        }
        auto doc = QJsonDocument::fromJson(finishedReply->readAll());
        auto obj = doc.object();
        emit imagePosted(obj["id"].toInteger(), obj["url"].toString(),
                         obj["uploaded_at"].toInteger());
    });
}
