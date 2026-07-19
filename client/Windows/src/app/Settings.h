#pragma once
#include <QObject>
#include <QSettings>
#include <QString>
#include <QColor>
#include <QFont>

class Settings : public QObject {
    Q_OBJECT
public:
    explicit Settings(QObject* parent = nullptr);

    // API
    QString apiBaseUrl() const;
    void setApiBaseUrl(const QString& url);

    QString imgUploadUrl() const;
    void setImgUploadUrl(const QString& url);

    QString accessToken() const;
    void setAccessToken(const QString& token);

    QString refreshToken() const;
    void setRefreshToken(const QString& token);

    // Session (Campux OAuth)
    QString userSub() const;
    void setUserSub(const QString& sub);
    QString userQq() const;
    void setUserQq(const QString& qq);
    QString userName() const;
    void setUserName(const QString& name);
    QString userTenantName() const;
    void setUserTenantName(const QString& name);
    QString userTenantSlug() const;
    void setUserTenantSlug(const QString& slug);
    bool isLoggedIn() const;
    void clearSession();

    // Download
    QString downloadLocation() const;
    void setDownloadLocation(const QString& path);

    // Appearance
    QString theme() const;           // "mint", "rose", "sky", "lavender", "sunset", "ocean", "dark"
    void setTheme(const QString& theme);

    QColor accentColor() const;
    void setAccentColor(const QColor& color);

    int fontSize() const;            // base font size in pt
    void setFontSize(int size);

    QString fontFamily() const;
    void setFontFamily(const QString& family);

    // Cache
    qint64 maxCacheBytes() const;
    void setMaxCacheBytes(qint64 bytes);

    // Upload
    QString defaultStorageDest() const;  // "auto", "local", "telegram", "r2"
    void setDefaultStorageDest(const QString& dest);

    QString defaultOutputFormat() const; // "auto", "jpg", "png", "webp", "gif", "webp_animated"
    void setDefaultOutputFormat(const QString& fmt);

    QString defaultCdnDomain() const;
    void setDefaultCdnDomain(const QString& domain);

    int uploadDelayMs() const;
    void setUploadDelayMs(int ms);

    // General
    bool firstRun() const;
    void setFirstRun(bool val);

    void save();
    void load();

signals:
    void themeChanged(const QString& theme);
    void fontSizeChanged(int size);
    void fontFamilyChanged(const QString& family);
    void downloadLocationChanged(const QString& path);

private:
    QSettings m_settings;
};
