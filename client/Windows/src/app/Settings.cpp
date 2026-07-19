#include "app/Settings.h"
#include <QStandardPaths>

Settings::Settings(QObject* parent)
    : QObject(parent)
    , m_settings("MemoriesClient", "MemoriesClient")
{
    load();
}

// -- API --
QString Settings::apiBaseUrl() const {
    return m_settings.value("api/baseUrl", "https://api.mrcwoods.com").toString();
}
void Settings::setApiBaseUrl(const QString& url) {
    m_settings.setValue("api/baseUrl", url);
}

QString Settings::imgUploadUrl() const {
    return m_settings.value("api/imgUploadUrl", "https://img.scdn.io/api/v1.php").toString();
}
void Settings::setImgUploadUrl(const QString& url) {
    m_settings.setValue("api/imgUploadUrl", url);
}

QString Settings::accessToken() const {
    return m_settings.value("auth/accessToken").toString();
}
void Settings::setAccessToken(const QString& token) {
    m_settings.setValue("auth/accessToken", token);
}

QString Settings::refreshToken() const {
    return m_settings.value("auth/refreshToken").toString();
}
void Settings::setRefreshToken(const QString& token) {
    m_settings.setValue("auth/refreshToken", token);
}

// -- Session (Campux OAuth) --
QString Settings::userSub() const {
    return m_settings.value("session/sub").toString();
}
void Settings::setUserSub(const QString& sub) {
    m_settings.setValue("session/sub", sub);
}
QString Settings::userQq() const {
    return m_settings.value("session/qq").toString();
}
void Settings::setUserQq(const QString& qq) {
    m_settings.setValue("session/qq", qq);
}
QString Settings::userName() const {
    return m_settings.value("session/username").toString();
}
void Settings::setUserName(const QString& name) {
    m_settings.setValue("session/username", name);
}
QString Settings::userTenantName() const {
    return m_settings.value("session/tenantName").toString();
}
void Settings::setUserTenantName(const QString& name) {
    m_settings.setValue("session/tenantName", name);
}
QString Settings::userTenantSlug() const {
    return m_settings.value("session/tenantSlug").toString();
}
void Settings::setUserTenantSlug(const QString& slug) {
    m_settings.setValue("session/tenantSlug", slug);
}
bool Settings::isLoggedIn() const {
    return !accessToken().isEmpty();
}
void Settings::clearSession() {
    m_settings.remove("auth/accessToken");
    m_settings.remove("auth/refreshToken");
    m_settings.remove("session/sub");
    m_settings.remove("session/qq");
    m_settings.remove("session/username");
    m_settings.remove("session/tenantName");
    m_settings.remove("session/tenantSlug");
}

// -- Download --
QString Settings::downloadLocation() const {
    return m_settings.value("download/location",
        QStandardPaths::writableLocation(QStandardPaths::PicturesLocation)).toString();
}
void Settings::setDownloadLocation(const QString& path) {
    m_settings.setValue("download/location", path);
    emit downloadLocationChanged(path);
}

// -- Appearance --
QString Settings::theme() const {
    return m_settings.value("appearance/theme", "mint").toString();
}
void Settings::setTheme(const QString& theme) {
    m_settings.setValue("appearance/theme", theme);
    emit themeChanged(theme);
}

QColor Settings::accentColor() const {
    return m_settings.value("appearance/accentColor", "#4A90D9").value<QColor>();
}
void Settings::setAccentColor(const QColor& color) {
    m_settings.setValue("appearance/accentColor", color);
}

int Settings::fontSize() const {
    return m_settings.value("appearance/fontSize", 12).toInt();
}
void Settings::setFontSize(int size) {
    m_settings.setValue("appearance/fontSize", size);
    emit fontSizeChanged(size);
}

QString Settings::fontFamily() const {
    return m_settings.value("appearance/fontFamily", "Sans Serif").toString();
}
void Settings::setFontFamily(const QString& family) {
    m_settings.setValue("appearance/fontFamily", family);
    emit fontFamilyChanged(family);
}

// -- Cache --
qint64 Settings::maxCacheBytes() const {
    return m_settings.value("cache/maxBytes", 512LL * 1024 * 1024).toLongLong();
}
void Settings::setMaxCacheBytes(qint64 bytes) {
    m_settings.setValue("cache/maxBytes", bytes);
}

// -- Upload --
QString Settings::defaultStorageDest() const {
    return m_settings.value("upload/storageDest", "auto").toString();
}
void Settings::setDefaultStorageDest(const QString& dest) {
    m_settings.setValue("upload/storageDest", dest);
}

QString Settings::defaultOutputFormat() const {
    return m_settings.value("upload/outputFormat", "auto").toString();
}
void Settings::setDefaultOutputFormat(const QString& fmt) {
    m_settings.setValue("upload/outputFormat", fmt);
}

QString Settings::defaultCdnDomain() const {
    return m_settings.value("upload/cdnDomain", "").toString();
}
void Settings::setDefaultCdnDomain(const QString& domain) {
    m_settings.setValue("upload/cdnDomain", domain);
}

int Settings::uploadDelayMs() const {
    return m_settings.value("upload/delayMs", 1000).toInt();
}
void Settings::setUploadDelayMs(int ms) {
    m_settings.setValue("upload/delayMs", ms);
}

// -- General --
bool Settings::firstRun() const {
    return m_settings.value("general/firstRun", true).toBool();
}
void Settings::setFirstRun(bool val) {
    m_settings.setValue("general/firstRun", val);
}

void Settings::save() { m_settings.sync(); }
void Settings::load() { m_settings.sync(); }
