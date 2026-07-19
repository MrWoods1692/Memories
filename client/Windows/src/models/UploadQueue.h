#pragma once
#include <QObject>
#include <QQueue>
#include <QMutex>

enum class UploadState {
    Pending,
    UploadingToScndio,
    UploadingToMemories,
    Completed,
    Failed,
    Cancelled
};

struct UploadItem {
    QString localFilePath;
    QString outputFormat;      // "auto", "jpg", "png", "webp", "gif", "webp_animated"
    QString storageDestination; // "auto", "local", "telegram", "r2"
    QString cdnDomain;
    QString scndioUrl;         // result URL from img.scdn.io
    qint64 memoriesId = -1;    // result ID from memories API
    UploadState state = UploadState::Pending;
    QString errorMessage;
    int progress = 0;

    bool isVideo() const {
        QString ext = localFilePath.section('.', -1).toLower();
        return ext == "mp4" || ext == "webm" || ext == "mov" || ext == "avi";
    }
};

class UploadQueue : public QObject {
    Q_OBJECT
public:
    explicit UploadQueue(QObject* parent = nullptr);

    void enqueue(const UploadItem& item);
    void enqueueBatch(const QList<UploadItem>& items);
    void dequeue(int index);
    void clear();
    void clearCompleted();

    int count() const;
    int pendingCount() const;
    int completedCount() const;
    int failedCount() const;
    const QList<UploadItem>& items() const;

    UploadItem* currentItem();
    const UploadItem* currentItem() const;

    void setCurrentIndex(int index);
    int currentIndex() const;

signals:
    void queueChanged();
    void itemProgressChanged(int index, int progress);
    void itemStateChanged(int index, UploadState state);
    void allCompleted();

private:
    QList<UploadItem> m_items;
    int m_currentIndex = -1;
    mutable QMutex m_mutex;
};
