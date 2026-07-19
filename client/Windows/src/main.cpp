#include <QApplication>
#include <QCommandLineParser>
#include <QDir>
#include <QStandardPaths>
#include <QIcon>
#include <QTimer>
#include <QFile>
#include <iostream>

#include "app/Application.h"
#include "app/Settings.h"
#include "network/HealthChecker.h"
#include "network/ApiClient.h"
#include "utils/Logger.h"
#include "utils/ThemeManager.h"

#ifdef HEADLESS_ONLY
// Headless mode - just print status
int main(int argc, char* argv[]) {
    QCoreApplication app(argc, argv);
    QCoreApplication::setApplicationName("Memories");
    QCoreApplication::setApplicationVersion("1.2.0");

    QCommandLineParser parser;
    parser.setApplicationDescription("Memories Image Client - Headless Mode");
    parser.addHelpOption();
    parser.addVersionOption();

    QCommandLineOption healthOption("health", "Check service health");
    parser.addOption(healthOption);

    QCommandLineOption listOption("list", "List images");
    parser.addOption(listOption);

    QCommandLineOption uploadOption("upload", "Upload an image", "file");
    parser.addOption(uploadOption);

    QCommandLineOption logLevelOption("log-level", "Log level (debug/info/warning/error)", "level", "info");
    parser.addOption(logLevelOption);

    parser.process(app);

    // Set log level
    QString level = parser.value(logLevelOption).toLower();
    if (level == "debug") Logger::instance().setLogLevel(LogLevel::Debug);
    else if (level == "warning") Logger::instance().setLogLevel(LogLevel::Warning);
    else if (level == "error") Logger::instance().setLogLevel(LogLevel::Error);

    auto* appInstance = Application::instance();
    appInstance->initialize();

    if (parser.isSet(healthOption)) {
        appInstance->healthChecker()->ping();
        QObject::connect(appInstance->healthChecker(), &HealthChecker::healthOk, &app, [&]() {
            std::cout << "Service is healthy." << std::endl;
            QCoreApplication::quit();
        });
        QObject::connect(appInstance->healthChecker(), &HealthChecker::healthFail, &app, [&](const QString& err) {
            std::cerr << "Service unhealthy: " << err.toStdString() << std::endl;
            QCoreApplication::exit(1);
        });
    } else if (parser.isSet(listOption)) {
        appInstance->apiClient()->fetchImages(0);
        QObject::connect(appInstance->apiClient(), &ApiClient::imagesFetched, &app,
            [&](const QJsonArray& data, qint64 nextId) {
                for (const auto& val : data) {
                    auto obj = val.toObject();
                    std::cout << "[" << obj["id"].toInteger() << "] "
                              << obj["url"].toString().toStdString()
                              << " (" << obj["uploaded_at"].toInteger() << ")" << std::endl;
                }
                QCoreApplication::quit();
            });
    } else {
        std::cout << "Memories Client - Headless Mode" << std::endl;
        std::cout << "Use --help for available options." << std::endl;
        QTimer::singleShot(0, &app, &QCoreApplication::quit);
    }

    return app.exec();
}
#else
#include "ui/MainWindow.h"
// GUI mode
int main(int argc, char* argv[]) {
    QApplication app(argc, argv);
    QApplication::setApplicationName("Memories");
    QApplication::setApplicationVersion("1.2.0");
    QApplication::setOrganizationName("memories");
    QApplication::setOrganizationDomain("memories.mrcwoods.com");

    // Set default application icon
    app.setWindowIcon(QIcon(":/icons/app.svg"));

    QCommandLineParser parser;
    parser.setApplicationDescription("Memories Image Client");
    parser.addHelpOption();
    parser.addVersionOption();

    QCommandLineOption headlessOption(
        QStringList() << "headless" << "no-gui",
        "Run in headless mode (no GUI)"
    );
    parser.addOption(headlessOption);

    QCommandLineOption logLevelOption(
        "log-level",
        "Log level (debug/info/warning/error)",
        "level", "info"
    );
    parser.addOption(logLevelOption);

    parser.process(app);

    // Set log level
    QString level = parser.value(logLevelOption).toLower();
    if (level == "debug") Logger::instance().setLogLevel(LogLevel::Debug);
    else if (level == "warning") Logger::instance().setLogLevel(LogLevel::Warning);
    else if (level == "error") Logger::instance().setLogLevel(LogLevel::Error);

    // Initialize application core
    auto* appInstance = Application::instance();
    appInstance->initialize();

    if (parser.isSet(headlessOption)) {
        // Headless mode via flag
        LOG_INFO("Running in headless mode");
        appInstance->healthChecker()->ping();
        QObject::connect(appInstance->healthChecker(), &HealthChecker::healthOk, &app, [&]() {
            LOG_INFO("Service is healthy.");
            QCoreApplication::quit();
        });
        QObject::connect(appInstance->healthChecker(), &HealthChecker::healthFail, &app, [&](const QString& err) {
            LOG_ERROR("Service unhealthy: " + err);
            QCoreApplication::exit(1);
        });
        return app.exec();
    }

    // GUI mode
    LOG_INFO("Starting Memories Client GUI...");

    // Apply theme
    QString theme = appInstance->settings()->theme();
    ThemeManager::instance().setTheme(theme);
    bool isDark = (theme == "dark");
    app.setStyleSheet(ThemeManager::instance().buildStylesheet(isDark));

    // Set default font
    QFont font = app.font();
    font.setPointSize(appInstance->settings()->fontSize());
    font.setFamily(appInstance->settings()->fontFamily());
    app.setFont(font);

    MainWindow window;
    window.setWindowFlags(Qt::FramelessWindowHint | Qt::Window);
    window.show();

    return app.exec();
}
#endif
