#pragma once
#include <QObject>
#include <QNetworkAccessManager>
#include "models/UploadQueue.h"

class ImageUploader : public QObject {
    Q_OBJECT
public:
    explicit ImageUploader(QObject* parent = nullptr);

    void setScndioUrl(const QString& url);
    void setMemoriesApiUrl(const QString& url);
    void setAccessToken(const QString& token);
    void setDelayMs(int ms);

    void startUpload();
    void cancelUpload();
    bool isUploading() const;

    UploadQueue* queue() { return m_queue; }

signals:
    void uploadProgress(const QString& filePath, int progress);
    void uploadCompleted(const UploadItem& item);
    void uploadFailed(const QString& filePath, const QString& error);
    void itemStateChanged(int index, UploadState state);
    void uploadQueueFinished();

private slots:
    void processNext();

private:
    void uploadToScndio(UploadItem& item);
    void uploadToMemories(UploadItem& item);
    void queryScndioMetadata(UploadItem& item);

    QNetworkAccessManager* m_manager;
    UploadQueue* m_queue;
    QString m_scndioUrl;
    QString m_memoriesApiUrl;
    QString m_token;
    int m_delayMs = 1000;
    bool m_uploading = false;
    bool m_cancelled = false;
};
