#include "utils/ImageCache.h"
#include "utils/Logger.h"
#include <QCryptographicHash>
#include <QDateTime>
#include <QFile>
#include <QFileInfo>
#include <QSaveFile>
#include <QDirIterator>
#include <QStandardPaths>
#include <QBuffer>
#include <QImageReader>
#include <QUrl>
#include <QUrlQuery>

ImageCache::ImageCache(QObject* parent)
    : QObject(parent)
    , m_memoryCache(200) // 200 pixmaps in memory
{
    QString defaultCache = QStandardPaths::writableLocation(QStandardPaths::CacheLocation);
    if (defaultCache.isEmpty()) {
        defaultCache = QDir::homePath() + "/.cache/MemoriesClient";
    }
    setCacheDir(defaultCache + "/images");
}

ImageCache::~ImageCache() {
    clearMemory();
}

void ImageCache::setCacheDir(const QString& dir) {
    QMutexLocker lock(&m_mutex);
    m_cacheDir = QDir(dir);
    if (!m_cacheDir.exists()) {
        m_cacheDir.mkpath(".");
    }
    LOG_INFO("ImageCache dir set to: " + dir);
}

QString ImageCache::cacheDir() const {
    return m_cacheDir.absolutePath();
}

void ImageCache::setMaxSizeBytes(qint64 bytes) {
    m_maxDiskBytes = bytes;
    pruneDiskCache(bytes);
}

void ImageCache::setMaxMemoryItems(int count) {
    m_memoryCache.setMaxCost(count);
}

QPixmap ImageCache::getPixmap(const QString& key) {
    QMutexLocker lock(&m_mutex);

    // Try memory cache first
    if (auto* pix = m_memoryCache.object(key)) {
        return *pix;
    }

    // Try disk cache
    QString path = toLocalPath(key);
    if (QFileInfo::exists(path)) {
        QPixmap pix(path);
        if (pix.isNull()) {
            // 兼容旧缓存：按扩展名加载失败时，回退用 QImageReader 内容嗅探
            QImageReader reader(path);
            reader.setDecideFormatFromContent(true);
            QImage img = reader.read();
            if (!img.isNull()) {
                pix = QPixmap::fromImage(img);
            }
        }
        if (!pix.isNull()) {
            QFile file(path);
            file.setFileTime(QDateTime::currentDateTime(), QFileDevice::FileModificationTime);
            m_memoryCache.insert(key, new QPixmap(pix));
            return pix;
        }
    }
    return QPixmap();
}

QPixmap ImageCache::getLocalPixmap(const QString& localPath) {
    return getPixmap(localPath);
}

void ImageCache::putPixmap(const QString& key, const QPixmap& pixmap) {
    QMutexLocker lock(&m_mutex);

    // Memory cache
    m_memoryCache.insert(key, new QPixmap(pixmap));

    // Disk cache
    QString path = toLocalPath(key);
    QFileInfo fi(path);
    QDir().mkpath(fi.absolutePath());
    pixmap.save(path, "PNG");

    // Check disk usage periodically
    pruneDiskCache(m_maxDiskBytes);
}

bool ImageCache::putData(const QString& key, const QByteArray& data, QPixmap* decodedPixmap) {
    QPixmap pixmap;
    if (!pixmap.loadFromData(data)) {
        return false;
    }

    QMutexLocker lock(&m_mutex);
    m_memoryCache.insert(key, new QPixmap(pixmap));

    QString path = toLocalPath(key);
    QFileInfo fi(path);
    QDir().mkpath(fi.absolutePath());

    // 保存原始字节（Qt 已能识别 webp/jpeg/png 等格式），不强制再编码为 PNG
    QSaveFile file(path);
    if (!file.open(QIODevice::WriteOnly)) {
        return false;
    }
    if (file.write(data) != data.size() || !file.commit()) {
        return false;
    }

    if (decodedPixmap) {
        *decodedPixmap = pixmap;
    }
    pruneDiskCache(m_maxDiskBytes);
    return true;
}

QString ImageCache::localPath(const QString& urlKey) const {
    return toLocalPath(urlKey);
}

bool ImageCache::hasLocal(const QString& urlKey) const {
    QMutexLocker lock(&m_mutex);
    if (m_memoryCache.contains(urlKey)) return true;
    return QFileInfo::exists(toLocalPath(urlKey));
}

void ImageCache::removeLocal(const QString& urlKey) {
    QMutexLocker lock(&m_mutex);
    m_memoryCache.remove(urlKey);
    QFile::remove(toLocalPath(urlKey));
}

void ImageCache::clearMemory() {
    QMutexLocker lock(&m_mutex);
    m_memoryCache.clear();
}

void ImageCache::clearAll() {
    QMutexLocker lock(&m_mutex);
    m_memoryCache.clear();

    // Remove disk cache
    QDirIterator it(m_cacheDir.absolutePath(),
                    QDir::Files | QDir::NoDotAndDotDot,
                    QDirIterator::Subdirectories);
    while (it.hasNext()) {
        QFile::remove(it.next());
    }
    emit cacheCleared();
}

qint64 ImageCache::totalDiskUsage() const {
    qint64 total = 0;
    QDirIterator it(m_cacheDir.absolutePath(),
                    QDir::Files | QDir::NoDotAndDotDot,
                    QDirIterator::Subdirectories);
    while (it.hasNext()) {
        total += QFileInfo(it.next()).size();
    }
    return total;
}

void ImageCache::pruneDiskCache(qint64 maxBytes) {
    // Simple LRU-style pruning: remove oldest files if over limit
    qint64 current = totalDiskUsage();
    if (current <= maxBytes) return;

    QList<QPair<QDateTime, QString>> files;
    QDirIterator it(m_cacheDir.absolutePath(),
                    QDir::Files | QDir::NoDotAndDotDot,
                    QDirIterator::Subdirectories);
    while (it.hasNext()) {
        QString path = it.next();
        QFileInfo fi(path);
        files.append({fi.lastModified(), path});
    }

    std::sort(files.begin(), files.end(),
              [](const auto& a, const auto& b) { return a.first < b.first; });

    for (const auto& [time, path] : files) {
        if (current <= maxBytes * 0.8) break;
        QFileInfo fi(path);
        current -= fi.size();
        QFile::remove(path);
    }
}

QString ImageCache::toLocalPath(const QString& key) const {
    QByteArray hash = QCryptographicHash::hash(
        key.toUtf8(), QCryptographicHash::Sha256).toHex().left(16);
    return m_cacheDir.absoluteFilePath(hash + ".png");
}

QString ImageCache::convertibleUrl(const QString& url) {
    // 检查 URL 是否指向 webp 格式
    QString lowerUrl = url.toLower();
    bool isWebp = lowerUrl.endsWith(".webp") ||
                  QUrl(url).query().toLower().contains("format=webp");

    if (!isWebp) {
        // 非 webp 不需要转换
        return url;
    }

    QUrl u(url);
    QUrlQuery q(u);

    // 如果原 URL 路径以 .webp 结尾，去掉 .webp 后缀（保留原文件名 stem）
    QString path = u.path();
    if (path.toLower().endsWith(".webp")) {
        path.chop(5); // 移除 ".webp"
        u.setPath(path);
    }

    // 移除可能存在的原有 format/f 参数
    q.removeQueryItem("format");
    q.removeQueryItem("f");

    // 请求服务器以 jpeg 格式返回（多数 CDN 如 Cloudflare Images、img.scdn.io 支持）
    q.addQueryItem("format", "jpg");

    u.setQuery(q);
    return u.toString();
}
