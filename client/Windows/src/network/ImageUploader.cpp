#include "network/ImageUploader.h"
#include "utils/Logger.h"
#include <QNetworkReply>
#include <QHttpMultiPart>
#include <QFile>
#include <QFileInfo>
#include <QMimeDatabase>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTimer>

ImageUploader::ImageUploader(QObject* parent)
    : QObject(parent)
    , m_manager(new QNetworkAccessManager(this))
    , m_queue(new UploadQueue(this))
{
}

void ImageUploader::setScndioUrl(const QString& url) { m_scndioUrl = url; }
void ImageUploader::setMemoriesApiUrl(const QString& url) { m_memoriesApiUrl = url; }
void ImageUploader::setAccessToken(const QString& token) { m_token = token; }
void ImageUploader::setDelayMs(int ms) { m_delayMs = ms; }

bool ImageUploader::isUploading() const { return m_uploading; }

void ImageUploader::startUpload() {
    if (m_uploading) return;
    if (m_queue->pendingCount() == 0) {
        LOG_INFO("No pending uploads");
        return;
    }
    m_uploading = true;
    m_cancelled = false;

    // Start from before the first item so processNext picks up index 0
    m_queue->setCurrentIndex(-1);
    processNext();
}

void ImageUploader::cancelUpload() {
    m_cancelled = true;
    m_uploading = false;
}

void ImageUploader::processNext() {
    // Advance to next pending item
    const auto& items = m_queue->items();
    int startIdx = m_queue->currentIndex() + 1;
    bool found = false;
    for (int i = startIdx; i < items.size(); ++i) {
        if (items[i].state == UploadState::Pending) {
            m_queue->setCurrentIndex(i);
            found = true;
            break;
        }
    }

    if (!found || m_cancelled) {
        m_uploading = false;
        if (m_queue->pendingCount() == 0) {
            LOG_INFO("Upload queue finished");
            emit uploadQueueFinished();
        }
        return;
    }

    auto* item = m_queue->currentItem();
    if (!item) {
        m_uploading = false;
        return;
    }

    uploadToScndio(*item);
}

void ImageUploader::uploadToScndio(UploadItem& item) {
    item.state = UploadState::UploadingToScndio;
    item.progress = 0;
    int idx = m_queue->currentIndex();
    emit itemStateChanged(idx, item.state);
    emit uploadProgress(item.localFilePath, 0);

    auto* multiPart = new QHttpMultiPart(QHttpMultiPart::FormDataType);

    // File part
    QFile* file = new QFile(item.localFilePath);
    if (!file->open(QIODevice::ReadOnly)) {
        item.state = UploadState::Failed;
        item.errorMessage = "Cannot open file: " + item.localFilePath;
        emit itemStateChanged(idx, UploadState::Failed);
        emit uploadFailed(item.localFilePath, item.errorMessage);

        // Process next after delay
        QTimer::singleShot(m_delayMs, this, &ImageUploader::processNext);
        delete file;
        delete multiPart;
        return;
    }

    QHttpPart imagePart;
    QMimeDatabase mimeDb;
    QString mimeType = mimeDb.mimeTypeForFile(item.localFilePath).name();
    imagePart.setHeader(QNetworkRequest::ContentTypeHeader, mimeType);
    imagePart.setHeader(QNetworkRequest::ContentDispositionHeader,
        QVariant("form-data; name=\"image\"; filename=\"" +
                 QFileInfo(item.localFilePath).fileName() + "\""));
    imagePart.setBodyDevice(file);
    file->setParent(multiPart);
    multiPart->append(imagePart);

    // Output format
    if (!item.outputFormat.isEmpty() && item.outputFormat != "auto") {
        QHttpPart fmtPart;
        fmtPart.setHeader(QNetworkRequest::ContentDispositionHeader,
            QVariant("form-data; name=\"outputFormat\""));
        fmtPart.setBody(item.outputFormat.toUtf8());
        multiPart->append(fmtPart);
    }

    // Storage destination
    if (!item.storageDestination.isEmpty() && item.storageDestination != "auto") {
        QHttpPart destPart;
        destPart.setHeader(QNetworkRequest::ContentDispositionHeader,
            QVariant("form-data; name=\"storage_destination\""));
        destPart.setBody(item.storageDestination.toUtf8());
        multiPart->append(destPart);
    }

    // CDN domain
    if (!item.cdnDomain.isEmpty()) {
        QHttpPart cdnPart;
        cdnPart.setHeader(QNetworkRequest::ContentDispositionHeader,
            QVariant("form-data; name=\"cdn_domain\""));
        cdnPart.setBody(item.cdnDomain.toUtf8());
        multiPart->append(cdnPart);
    }

    QNetworkRequest req{QUrl(m_scndioUrl)};
    auto* reply = m_manager->post(req, multiPart);
    multiPart->setParent(reply);

    // Track upload progress
    connect(reply, &QNetworkReply::uploadProgress, this,
            [this, idx, filePath = item.localFilePath](qint64 sent, qint64 total) {
        if (total > 0) {
            int pct = static_cast<int>(sent * 100 / total);
            emit uploadProgress(filePath, pct);
        }
    });

    connect(reply, &QNetworkReply::finished, this, [this, idx]() {
        auto* finishedReply = qobject_cast<QNetworkReply*>(sender());
        finishedReply->deleteLater();

        auto* item = m_queue->currentItem();
        if (!item) {
            QTimer::singleShot(m_delayMs, this, &ImageUploader::processNext);
            return;
        }

        if (finishedReply->error() != QNetworkReply::NoError) {
            int statusCode = finishedReply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
            QString errBody = finishedReply->readAll();
            item->state = UploadState::Failed;

            // Parse error
            auto doc = QJsonDocument::fromJson(errBody.toUtf8());
            if (doc.isObject()) {
                item->errorMessage = doc.object()["message"].toString(
                    doc.object()["error"].toString(finishedReply->errorString()));
            } else {
                item->errorMessage = finishedReply->errorString();
            }

            LOG_ERROR(QString("Upload to scdn.io failed [%1]: %2")
                .arg(statusCode).arg(item->errorMessage));

            emit itemStateChanged(idx, UploadState::Failed);
            emit uploadFailed(item->localFilePath, item->errorMessage);

            QTimer::singleShot(m_delayMs, this, &ImageUploader::processNext);
            return;
        }

        auto doc = QJsonDocument::fromJson(finishedReply->readAll());
        auto obj = doc.object();
        if (obj["success"].toBool()) {
            item->scndioUrl = obj["url"].toString();
            item->state = UploadState::UploadingToMemories;
            emit itemStateChanged(idx, UploadState::UploadingToMemories);
            emit uploadProgress(item->localFilePath, 90);

            LOG_INFO("Uploaded to scdn.io: " + item->scndioUrl);

            // Upload URL to Memories API
            uploadToMemories(*item);
        } else {
            item->state = UploadState::Failed;
            item->errorMessage = obj["message"].toString(obj["error"].toString("Unknown scndio error"));
            emit itemStateChanged(idx, UploadState::Failed);
            emit uploadFailed(item->localFilePath, item->errorMessage);

            QTimer::singleShot(m_delayMs, this, &ImageUploader::processNext);
        }
    });
}

void ImageUploader::uploadToMemories(UploadItem& item) {
    QNetworkRequest req{QUrl(m_memoriesApiUrl + "/images")};
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    if (!m_token.isEmpty())
        req.setRawHeader("Authorization", ("Bearer " + m_token).toUtf8());

    QJsonObject body;
    body["url"] = item.scndioUrl;
    auto* reply = m_manager->post(req, QJsonDocument(body).toJson());

    int idx = m_queue->currentIndex();
    connect(reply, &QNetworkReply::finished, this, [this, idx]() {
        auto* finishedReply = qobject_cast<QNetworkReply*>(sender());
        finishedReply->deleteLater();
        auto* item = m_queue->currentItem();
        if (!item) {
            QTimer::singleShot(m_delayMs, this, &ImageUploader::processNext);
            return;
        }

        if (finishedReply->error() != QNetworkReply::NoError) {
            item->state = UploadState::Failed;
            item->errorMessage = "Memories API: " + finishedReply->errorString();
            emit itemStateChanged(idx, UploadState::Failed);
            emit uploadFailed(item->localFilePath, item->errorMessage);
        } else {
            auto doc = QJsonDocument::fromJson(finishedReply->readAll());
            auto obj = doc.object();
            item->memoriesId = obj["id"].toInteger();
            item->state = UploadState::Completed;
            item->progress = 100;

            LOG_INFO(QString("Upload completed, memories ID: %1").arg(item->memoriesId));
            emit itemStateChanged(idx, UploadState::Completed);
            emit uploadCompleted(*item);
            emit uploadProgress(item->localFilePath, 100);
        }

        // Process next item after delay to avoid rate limiting
        QTimer::singleShot(m_delayMs, this, &ImageUploader::processNext);
    });
}
