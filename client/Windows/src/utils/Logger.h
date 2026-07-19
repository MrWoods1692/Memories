#pragma once
#include <QString>
#include <QFile>
#include <QMutex>
#include <QDateTime>
#include <QTextStream>

enum class LogLevel {
    Debug = 0,
    Info,
    Warning,
    Error
};

class Logger {
public:
    static Logger& instance();

    void setLogFile(const QString& path);
    void setLogLevel(LogLevel level);
    void setConsoleOutput(bool enabled);

    void debug(const QString& msg);
    void info(const QString& msg);
    void warning(const QString& msg);
    void error(const QString& msg);

private:
    Logger() = default;
    ~Logger();
    void write(LogLevel level, const QString& msg);

    QFile m_file;
    QMutex m_mutex;
    LogLevel m_level = LogLevel::Info;
    bool m_consoleOutput = true;
};

#define LOG_DEBUG(msg)   Logger::instance().debug(msg)
#define LOG_INFO(msg)    Logger::instance().info(msg)
#define LOG_WARNING(msg) Logger::instance().warning(msg)
#define LOG_ERROR(msg)   Logger::instance().error(msg)
