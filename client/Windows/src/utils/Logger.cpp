#include "utils/Logger.h"
#include <QDebug>
#include <iostream>

Logger& Logger::instance() {
    static Logger inst;
    return inst;
}

Logger::~Logger() {
    if (m_file.isOpen()) m_file.close();
}

void Logger::setLogFile(const QString& path) {
    QMutexLocker lock(&m_mutex);
    if (m_file.isOpen()) m_file.close();
    m_file.setFileName(path);
    m_file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text);
}

void Logger::setLogLevel(LogLevel level) { m_level = level; }
void Logger::setConsoleOutput(bool enabled) { m_consoleOutput = enabled; }

void Logger::debug(const QString& msg)   { write(LogLevel::Debug, msg); }
void Logger::info(const QString& msg)    { write(LogLevel::Info, msg); }
void Logger::warning(const QString& msg) { write(LogLevel::Warning, msg); }
void Logger::error(const QString& msg)   { write(LogLevel::Error, msg); }

void Logger::write(LogLevel level, const QString& msg) {
    if (level < m_level) return;

    QMutexLocker lock(&m_mutex);
    QString timestamp = QDateTime::currentDateTime().toString("yyyy-MM-dd hh:mm:ss.zzz");
    const char* levelStr = "UNKN";
    switch (level) {
        case LogLevel::Debug:   levelStr = "DBUG"; break;
        case LogLevel::Info:    levelStr = "INFO"; break;
        case LogLevel::Warning: levelStr = "WARN"; break;
        case LogLevel::Error:   levelStr = "ERRO"; break;
    }
    QString line = QString("[%1] [%2] %3").arg(timestamp, levelStr, msg);

    if (m_consoleOutput) {
        std::cerr << line.toStdString() << std::endl;
    }

    if (m_file.isOpen()) {
        QTextStream stream(&m_file);
        stream << line << "\n";
        stream.flush();
    }
}
