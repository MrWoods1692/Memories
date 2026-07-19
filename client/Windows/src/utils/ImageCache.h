#pragma once
#include <QObject>
#include <QString>
#include <QByteArray>
#include <QDir>
#include <QPixmap>
#include <QCache>
#include <QMutex>

class ImageCache : public QObject {
    Q_OBJECT
public:
    explicit ImageCache(QObject* parent = nullptr);
    ~ImageCache();

    void setCacheDir(const QString& dir);
    QString cacheDir() const;

    void setMaxSizeBytes(qint64 bytes);
    void setMaxMemoryItems(int count);

    QPixmap getPixmap(const QString& key);
    QPixmap getLocalPixmap(const QString& localPath);
    void putPixmap(const QString& key, const QPixmap& pixmap);
    bool putData(const QString& key, const QByteArray& data, QPixmap* decodedPixmap = nullptr);

    QString localPath(const QString& urlKey) const;
    bool hasLocal(const QString& urlKey) const;
    void removeLocal(const QString& urlKey);

    void clearMemory();
    void clearAll();

    qint64 totalDiskUsage() const;
    void pruneDiskCache(qint64 maxBytes);

    // 将图片 URL 转换为 Qt 可解码的格式（webp → jpg）
    static QString convertibleUrl(const QString& url);

signals:
    void cacheCleared();

private:
    QString toLocalPath(const QString& key) const;

    QDir m_cacheDir;
    qint64 m_maxDiskBytes = 512 * 1024 * 1024; // 512 MB
    QCache<QString, QPixmap> m_memoryCache;
    mutable QMutex m_mutex;
};
