#pragma once
#include <QDialog>
#include <QListWidget>
#include <QProgressBar>
#include <QLabel>
#include <QPushButton>
#include <QComboBox>
#include "models/UploadQueue.h"

class UploadDialog : public QDialog {
    Q_OBJECT
public:
    explicit UploadDialog(QWidget* parent = nullptr);
    void addFiles(const QStringList& filePaths);

private slots:
    void onSelectFiles();
    void onSelectFolder();
    void onStartUpload();
    void onCancelUpload();
    void onClearCompleted();
    void onClearAll();
    void onItemProgress(int index, int progress);
    void onItemStateChanged(int index, UploadState state);
    void onUploadCompleted(const UploadItem& item);
    void onUploadFailed(const QString& path, const QString& error);
    void onAllCompleted();

private:
    void setupUi();
    void refreshList();

    QListWidget* m_listWidget;
    QProgressBar* m_overallProgress;
    QLabel* m_statusLabel;
    QLabel* m_countLabel;
    QPushButton* m_startBtn;
    QPushButton* m_cancelBtn;
    QPushButton* m_clearCompletedBtn;
    QPushButton* m_clearAllBtn;

    // Upload options
    QComboBox* m_storageDestCombo;
    QComboBox* m_outputFormatCombo;
    QComboBox* m_cdnDomainCombo;

    QStringList m_pendingFiles;
};
