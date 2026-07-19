#pragma once
#include <QObject>
#include <QDateTime>
#include <QString>
#include <QJsonObject>

struct ImageInfo {
    qint64 id = 0;
    QString url;
    qint64 uploadedAt = 0;
    bool cached = false;

    // From img.scdn.io metadata
    QString filename;
    QString originalFilename;
    qint64 originalSize = 0;
    qint64 compressedSize = 0;
    QString sizeDisplay;
    QString uploadDate;
    QString uploaderMasked;
    QString location;
    QStringList tags;
    QString contentDescription;
    QString storageBackend;
    QString storageLocation;
    QString cdnDomain;
    QString imageUrl; // direct link

    QJsonObject toJson() const {
        QJsonObject obj;
        obj["id"] = id;
        obj["url"] = url;
        obj["uploaded_at"] = uploadedAt;
        return obj;
    }

    static ImageInfo fromMemoriesJson(const QJsonObject& obj) {
        ImageInfo info;
        info.id = obj["id"].toInteger();
        info.url = obj["url"].toString();
        info.uploadedAt = obj["uploaded_at"].toInteger();
        return info;
    }

    static ImageInfo fromScndioJson(const QJsonObject& data) {
        ImageInfo info;
        info.id = data["id"].toInteger();
        info.filename = data["filename"].toString();
        info.originalFilename = data["original_filename"].toString();
        info.originalSize = data["original_size_bytes"].toInteger();
        info.compressedSize = data["compressed_size_bytes"].toInteger();
        info.sizeDisplay = data["size_display"].toString();
        info.uploadDate = data["upload_date"].toString();
        info.uploaderMasked = data["uploader_masked"].toString();
        info.location = data["location"].toString();
        info.tags = data["tags_array"].toVariant().toStringList();
        info.contentDescription = data["content_description"].toString();
        info.storageBackend = data["storage_backend"].toString();
        info.storageLocation = data["storage_location"].toString();
        info.imageUrl = data["image_url"].toString();
        info.cdnDomain = data["cdn_domain"].toString();
        return info;
    }
};
