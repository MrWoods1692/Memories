#include "ui/UploadDialog.h"
#include "app/Application.h"
#include "app/Settings.h"
#include "network/ImageUploader.h"
#include "models/UploadQueue.h"
#include "ui/AppleTitleBar.h"
#include "utils/Logger.h"

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGroupBox>
#include <QFormLayout>
#include <QListWidget>
#include <QProgressBar>
#include <QLabel>
#include <QPushButton>
#include <QComboBox>
#include <QFileDialog>
#include <QMessageBox>
#include <QMimeDatabase>
#include <QFileInfo>
#include <QSpinBox>

UploadDialog::UploadDialog(QWidget* parent)
    : QDialog(parent)
    , m_listWidget(new QListWidget(this))
    , m_overallProgress(new QProgressBar(this))
    , m_statusLabel(new QLabel(tr("就绪"), this))
    , m_countLabel(new QLabel(this))
    , m_startBtn(new QPushButton(tr("开始上传"), this))
    , m_cancelBtn(new QPushButton(tr("取消"), this))
    , m_clearCompletedBtn(new QPushButton(tr("清除已完成"), this))
    , m_clearAllBtn(new QPushButton(tr("清空全部"), this))
    , m_storageDestCombo(new QComboBox(this))
    , m_outputFormatCombo(new QComboBox(this))
    , m_cdnDomainCombo(new QComboBox(this))
{
    setupUi();

    // Connect uploader signals
    auto* uploader = Application::instance()->imageUploader();
    connect(uploader, &ImageUploader::uploadProgress,
            this, [this](const QString& /*filePath*/, int progress) {
        Q_UNUSED(progress)
        refreshList();
    });
    connect(uploader, &ImageUploader::uploadCompleted,
            this, &UploadDialog::onUploadCompleted);
    connect(uploader, &ImageUploader::uploadFailed,
            this, &UploadDialog::onUploadFailed);
    connect(uploader, &ImageUploader::uploadQueueFinished,
            this, &UploadDialog::onAllCompleted);
    connect(uploader, &ImageUploader::itemStateChanged,
            this, [this](int /*index*/, UploadState /*state*/) {
        refreshList();
    });
}

void UploadDialog::setupUi() {
    setWindowFlags(Qt::Dialog | Qt::FramelessWindowHint);
    resize(660, 580);
    setMinimumSize(540, 460);

    auto* outerLayout = new QVBoxLayout(this);
    outerLayout->setContentsMargins(0, 0, 0, 0);
    outerLayout->setSpacing(0);

    // Apple title bar - no title text
    auto* titleBar = new AppleTitleBar(this, "", false);
    outerLayout->addWidget(titleBar);

    auto* mainLayout = new QVBoxLayout();
    mainLayout->setSpacing(16);
    mainLayout->setContentsMargins(28, 18, 28, 28);
    outerLayout->addLayout(mainLayout);

    // Header
    auto* headerLabel = new QLabel(tr("📤 上传图片"));
    headerLabel->setStyleSheet("font-size: 18px; font-weight: 700; color: #0f172a; background: transparent; border: none;");
    mainLayout->addWidget(headerLabel);

    // File selection buttons at top
    auto* headerLayout = new QHBoxLayout();
    headerLayout->setSpacing(10);
    headerLayout->addStretch();
    auto* addFileBtn = new QPushButton(tr("＋ 添加文件"));
    addFileBtn->setProperty("primaryBtn", true);
    addFileBtn->setMinimumHeight(38);
    auto* addFolderBtn = new QPushButton(tr("📁 添加文件夹"));
    addFolderBtn->setProperty("flat", true);
    addFolderBtn->setMinimumHeight(38);
    headerLayout->addWidget(addFileBtn);
    headerLayout->addWidget(addFolderBtn);
    mainLayout->addLayout(headerLayout);

    // Upload options in a compact row
    auto* optionsGroup = new QGroupBox(tr("上传选项"));
    auto* optionsLayout = new QHBoxLayout(optionsGroup);
    optionsLayout->setSpacing(16);

    auto* opt1 = new QWidget();
    auto* opt1Layout = new QVBoxLayout(opt1);
    opt1Layout->setContentsMargins(0,0,0,0);
    opt1Layout->addWidget(new QLabel(tr("存储位置")));
    m_storageDestCombo->addItems({"auto", "local", "telegram", "r2"});
    m_storageDestCombo->setCurrentText(Application::instance()->settings()->defaultStorageDest());
    opt1Layout->addWidget(m_storageDestCombo);
    optionsLayout->addWidget(opt1);

    auto* opt2 = new QWidget();
    auto* opt2Layout = new QVBoxLayout(opt2);
    opt2Layout->setContentsMargins(0,0,0,0);
    opt2Layout->addWidget(new QLabel(tr("输出格式")));
    m_outputFormatCombo->addItems({"auto", "jpg", "png", "webp", "gif", "webp_animated"});
    m_outputFormatCombo->setCurrentText(Application::instance()->settings()->defaultOutputFormat());
    opt2Layout->addWidget(m_outputFormatCombo);
    optionsLayout->addWidget(opt2);

    auto* opt3 = new QWidget();
    auto* opt3Layout = new QVBoxLayout(opt3);
    opt3Layout->setContentsMargins(0,0,0,0);
    opt3Layout->addWidget(new QLabel(tr("CDN 域名")));
    m_cdnDomainCombo->addItems({
        "img.scdn.io", "cloudflareimg.cdn.sn", "edgeoneimg.cdn.sn",
        "esaimg.cdn1.vip", "cloudflarecnimg.scdn.io", "anycastimg.scdn.io", "edgeoneimg.cdn1.vip"
    });
    m_cdnDomainCombo->setCurrentText(Application::instance()->settings()->defaultCdnDomain());
    opt3Layout->addWidget(m_cdnDomainCombo);
    optionsLayout->addWidget(opt3);

    mainLayout->addWidget(optionsGroup);

    // Queue label
    auto* queueHeader = new QHBoxLayout();
    auto* queueLabel = new QLabel(tr("上传队列"));
    queueLabel->setStyleSheet("font-weight: 700; font-size: 14px; color: #1e293b; background: transparent; border: none;");
    queueHeader->addWidget(queueLabel);
    queueHeader->addStretch();
    m_countLabel->setStyleSheet("color: #94a3b8; font-size: 12px; font-weight: 500; background: transparent; border: none;");
    queueHeader->addWidget(m_countLabel);
    mainLayout->addLayout(queueHeader);

    mainLayout->addWidget(m_listWidget, 1);

    // Progress
    m_overallProgress->setVisible(false);
    m_overallProgress->setFixedHeight(10);
    mainLayout->addWidget(m_overallProgress);

    // Status + buttons
    auto* bottomLayout = new QHBoxLayout();
    bottomLayout->setSpacing(10);
    m_statusLabel->setStyleSheet("color: #94a3b8; font-size: 12px; background: transparent; border: none;");
    bottomLayout->addWidget(m_statusLabel);
    bottomLayout->addStretch();
    m_clearCompletedBtn->setProperty("flat", true);
    m_clearCompletedBtn->setCursor(Qt::PointingHandCursor);
    m_clearCompletedBtn->setMinimumHeight(36);
    m_clearAllBtn->setProperty("flat", true);
    m_clearAllBtn->setCursor(Qt::PointingHandCursor);
    m_clearAllBtn->setMinimumHeight(36);
    bottomLayout->addWidget(m_clearCompletedBtn);
    bottomLayout->addWidget(m_clearAllBtn);
    bottomLayout->addSpacing(8);
    m_cancelBtn->setProperty("flat", true);
    m_cancelBtn->setCursor(Qt::PointingHandCursor);
    m_cancelBtn->setMinimumHeight(36);
    m_cancelBtn->setEnabled(false);
    bottomLayout->addWidget(m_cancelBtn);
    m_startBtn->setProperty("primaryBtn", true);
    m_startBtn->setCursor(Qt::PointingHandCursor);
    m_startBtn->setMinimumWidth(120);
    m_startBtn->setMinimumHeight(38);
    bottomLayout->addWidget(m_startBtn);
    mainLayout->addLayout(bottomLayout);

    // Connect new buttons
    connect(addFileBtn, &QPushButton::clicked, this, &UploadDialog::onSelectFiles);
    connect(addFolderBtn, &QPushButton::clicked, this, &UploadDialog::onSelectFolder);
    connect(m_startBtn, &QPushButton::clicked, this, &UploadDialog::onStartUpload);
    connect(m_cancelBtn, &QPushButton::clicked, this, &UploadDialog::onCancelUpload);
    connect(m_clearCompletedBtn, &QPushButton::clicked, this, &UploadDialog::onClearCompleted);
    connect(m_clearAllBtn, &QPushButton::clicked, this, &UploadDialog::onClearAll);

    // Sync upload settings to Settings
    connect(m_storageDestCombo, &QComboBox::currentTextChanged, this, [this](const QString& text) {
        Application::instance()->settings()->setDefaultStorageDest(text);
        Application::instance()->settings()->save();
    });
    connect(m_outputFormatCombo, &QComboBox::currentTextChanged, this, [this](const QString& text) {
        Application::instance()->settings()->setDefaultOutputFormat(text);
        Application::instance()->settings()->save();
    });
    connect(m_cdnDomainCombo, &QComboBox::currentTextChanged, this, [this](const QString& text) {
        Application::instance()->settings()->setDefaultCdnDomain(text);
        Application::instance()->settings()->save();
    });
}

void UploadDialog::addFiles(const QStringList& filePaths) {
    QMimeDatabase mimeDb;
    QStringList supportedImages = {"image/jpeg", "image/png", "image/webp",
                                    "image/gif", "image/bmp", "image/tiff"};
    QStringList supportedVideos = {"video/mp4", "video/webm", "video/quicktime",
                                    "video/x-msvideo"};

    auto* queue = Application::instance()->imageUploader()->queue();
    QString storageDest = m_storageDestCombo->currentText();
    QString outputFormat = m_outputFormatCombo->currentText();
    QString cdnDomain = m_cdnDomainCombo->currentText();

    for (const auto& path : filePaths) {
        QString mime = mimeDb.mimeTypeForFile(path).name();
        bool isImage = supportedImages.contains(mime);
        bool isVideo = supportedVideos.contains(mime);

        if (!isImage && !isVideo) {
            LOG_WARNING("Unsupported file type: " + path + " (" + mime + ")");
            continue;
        }

        UploadItem item;
        item.localFilePath = path;
        item.storageDestination = storageDest;
        item.outputFormat = outputFormat;
        item.cdnDomain = cdnDomain;
        item.state = UploadState::Pending;
        queue->enqueue(item);
    }

    refreshList();
}

void UploadDialog::onSelectFiles() {
    QStringList files = QFileDialog::getOpenFileNames(this, tr("选择图片"),
        QString(),
        tr("图片与视频 (*.jpg *.jpeg *.png *.webp *.gif *.bmp *.tiff *.mp4 *.webm *.mov *.avi);;所有文件 (*)"));
    if (!files.isEmpty()) {
        addFiles(files);
    }
}

void UploadDialog::onSelectFolder() {
    QString dir = QFileDialog::getExistingDirectory(this, tr("选择文件夹"));
    if (dir.isEmpty()) return;

    QDir d(dir);
    QStringList filters = {"*.jpg", "*.jpeg", "*.png", "*.webp", "*.gif",
                           "*.bmp", "*.tiff", "*.mp4", "*.webm", "*.mov"};
    QStringList files;
    for (const auto& f : d.entryInfoList(filters, QDir::Files)) {
        files.append(f.absoluteFilePath());
    }
    if (!files.isEmpty()) {
        addFiles(files);
    }
}

void UploadDialog::onStartUpload() {
    auto* queue = Application::instance()->imageUploader()->queue();
    if (queue->pendingCount() == 0) {
        QMessageBox::information(this, tr("提示"), tr("请先添加要上传的文件。"));
        return;
    }

    // Check login
    if (!Application::instance()->settings()->isLoggedIn()) {
        QMessageBox::warning(this, tr("未登录"),
            tr("请先通过「账号 → 登录」使用校园墙 OAuth 登录后再上传。"));
        return;
    }

    auto* uploader = Application::instance()->imageUploader();

    m_startBtn->setEnabled(false);
    m_cancelBtn->setEnabled(true);
    m_overallProgress->setVisible(true);
    m_overallProgress->setRange(0, queue->count());
    m_overallProgress->setValue(0);
    m_statusLabel->setText(tr("上传中..."));

    uploader->startUpload();
}

void UploadDialog::onCancelUpload() {
    Application::instance()->imageUploader()->cancelUpload();
    m_startBtn->setEnabled(true);
    m_cancelBtn->setEnabled(false);
    m_statusLabel->setText(tr("已取消"));
}

void UploadDialog::onClearCompleted() {
    Application::instance()->imageUploader()->queue()->clearCompleted();
    refreshList();
}

void UploadDialog::onClearAll() {
    Application::instance()->imageUploader()->queue()->clear();
    refreshList();
    m_startBtn->setEnabled(true);
    m_cancelBtn->setEnabled(false);
    m_overallProgress->setVisible(false);
}

void UploadDialog::onItemProgress(int index, int progress) {
    Q_UNUSED(index)
    Q_UNUSED(progress)
    refreshList();
}

void UploadDialog::onItemStateChanged(int index, UploadState state) {
    Q_UNUSED(index)
    Q_UNUSED(state)
    refreshList();
}

void UploadDialog::onUploadCompleted(const UploadItem& item) {
    m_statusLabel->setText(tr("已完成: ") + QFileInfo(item.localFilePath).fileName());
    m_overallProgress->setValue(m_overallProgress->value() + 1);
}

void UploadDialog::onUploadFailed(const QString& path, const QString& error) {
    m_statusLabel->setText(tr("失败: ") + QFileInfo(path).fileName());
    QMessageBox::warning(this, tr("上传失败"),
        QFileInfo(path).fileName() + ": " + error);
}

void UploadDialog::onAllCompleted() {
    m_startBtn->setEnabled(true);
    m_cancelBtn->setEnabled(false);
    m_overallProgress->setVisible(false);
    m_statusLabel->setText(tr("全部上传完成"));

    // Show notification
    QMessageBox::information(this, tr("上传完成"),
        tr("所有文件已成功上传。"));
}

void UploadDialog::refreshList() {
    auto* queue = Application::instance()->imageUploader()->queue();
    const auto& items = queue->items();

    m_listWidget->clear();
    for (int i = 0; i < items.size(); ++i) {
        QFileInfo fi(items[i].localFilePath);
        qint64 size = fi.size();
        QString sizeStr;
        if (size < 1024) sizeStr = QString("%1 B").arg(size);
        else if (size < 1024*1024) sizeStr = QString("%1 KB").arg(size/1024.0, 0, 'f', 1);
        else sizeStr = QString("%1 MB").arg(size/(1024.0*1024.0), 0, 'f', 1);

        QString text = QString("📄 %1  (%2)").arg(fi.fileName(), sizeStr);
        switch (items[i].state) {
            case UploadState::Pending:       text += " ⏳ 等待中"; break;
            case UploadState::UploadingToScndio: text += " ⬆️ 上传图床..."; break;
            case UploadState::UploadingToMemories: text += " ⬆️ 提交记录..."; break;
            case UploadState::Completed:     text += " ✅ 完成"; break;
            case UploadState::Failed:        text += " ❌ " + items[i].errorMessage; break;
            case UploadState::Cancelled:     text += " 🚫 已取消"; break;
        }
        m_listWidget->addItem(text);
    }

    m_countLabel->setText(tr("共 %1 个文件（%2 完成，%3 失败）")
        .arg(items.size())
        .arg(queue->completedCount())
        .arg(queue->failedCount()));
}
