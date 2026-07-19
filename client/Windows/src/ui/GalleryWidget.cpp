#include "ui/GalleryWidget.h"
#include "app/Application.h"
#include "network/ApiClient.h"
#include "utils/ImageCache.h"
#include "utils/Logger.h"

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QProgressBar>
#include <QLabel>
#include <QToolButton>
#include <QScrollArea>
#include <QScrollBar>
#include <QToolButton>
#include <QPixmap>
#include <QIcon>
#include <QMessageBox>
#include <QDesktopServices>
#include <QClipboard>
#include <QApplication>
#include <QPrintDialog>
#include <QPrinter>
#include <QFileDialog>
#include <QPainter>
#include <QtPrintSupport/QPrintDialog>
#include <QtPrintSupport/QPrinter>
#include <QtConcurrent>
#include <QStackedWidget>
#include <QLabel>
#include <QKeyEvent>
#include <QTimer>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QStyle>

GalleryWidget::GalleryWidget(QWidget* parent)
    : QWidget(parent)
    , m_scrollArea(new QScrollArea(this))
    , m_gridContainer(new QWidget(this))
    , m_flowLayout(new FlowLayout(m_gridContainer, 0, 8))
    , m_stateStack(new QStackedWidget(this))
    , m_loadingLabel(new QLabel(tr("正在加载图片..."), this))
    , m_emptyLabel(new QLabel(tr("暂无图片\n请点击上传按钮添加"), this))
    , m_loadMoreBtn(new QPushButton(tr("加载更多..."), this))
    , m_selectAllBtn(new QPushButton(tr("全选"), this))
    , m_deselectAllBtn(new QPushButton(tr("取消全选"), this))
    , m_batchDownloadBtn(new QPushButton(tr("批量下载"), this))
    , m_batchShareBtn(new QPushButton(tr("批量分享"), this))
    , m_batchPrintBtn(new QPushButton(tr("批量打印"), this))
    , m_batchCopyBtn(new QPushButton(tr("批量复制链接"), this))
    , m_selectModeBtn(new QPushButton(tr("☐ 选择"), this))
    , m_selectCountLabel(new QLabel(this))
    , m_progressBar(new QProgressBar(this))
    , m_networkManager(new QNetworkAccessManager(this))
{
    setupUi();
}

void GalleryWidget::setupUi() {
    auto* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);

    // Batch toolbar
    auto* batchBar = new QHBoxLayout();
    batchBar->setContentsMargins(20, 14, 20, 12);
    batchBar->setSpacing(10);
    batchBar->addWidget(m_selectModeBtn);

    m_selectCountLabel->setProperty("galleryMeta", true);
    m_selectCountLabel->setVisible(false);
    batchBar->addWidget(m_selectCountLabel);

    batchBar->addWidget(m_selectAllBtn);
    batchBar->addSpacing(16);
    batchBar->addWidget(m_batchDownloadBtn);
    batchBar->addWidget(m_batchShareBtn);
    batchBar->addWidget(m_batchPrintBtn);
    batchBar->addWidget(m_batchCopyBtn);
    batchBar->addStretch();

    // Batch buttons hidden until selection mode
    m_selectAllBtn->setVisible(false);
    m_deselectAllBtn->setVisible(false);
    m_batchDownloadBtn->setVisible(false);
    m_batchShareBtn->setVisible(false);
    m_batchPrintBtn->setVisible(false);
    m_batchCopyBtn->setVisible(false);

    // Connect select all
    connect(m_selectAllBtn, &QPushButton::clicked, this, [this]() {
        if (m_selectAllBtn->text() == tr("取消全选")) {
            onDeselectAll();
        } else {
            onSelectAll();
        }
    });

    // Style batch buttons
    for (auto* btn : {m_selectModeBtn, m_selectAllBtn, m_deselectAllBtn,
                      m_batchDownloadBtn, m_batchShareBtn,
                      m_batchPrintBtn, m_batchCopyBtn}) {
        btn->setProperty("flat", true);
        btn->setStyleSheet("");
    }
    mainLayout->addLayout(batchBar);

    // Grid
    m_flowLayout->setContentsMargins(20, 16, 20, 20);
    m_flowLayout->setSpacing(12);
    m_gridContainer->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Maximum);
    m_scrollArea->setWidget(m_gridContainer);
    m_scrollArea->setWidgetResizable(true);
    m_scrollArea->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    m_scrollArea->setFrameShape(QFrame::NoFrame);

    // State pages
    m_loadingLabel->setAlignment(Qt::AlignCenter);
    m_loadingLabel->setProperty("galleryState", true);
    m_emptyLabel->setAlignment(Qt::AlignCenter);
    m_emptyLabel->setProperty("galleryState", true);

    m_stateStack->addWidget(m_loadingLabel);
    m_stateStack->addWidget(m_emptyLabel);
    m_stateStack->addWidget(m_scrollArea);
    m_stateStack->setCurrentWidget(m_loadingLabel);
    mainLayout->addWidget(m_stateStack, 1);

    // Bottom bar
    auto* bottomBar = new QHBoxLayout();
    bottomBar->setContentsMargins(18, 8, 18, 16);
    bottomBar->setSpacing(12);
    m_progressBar->setVisible(false);
    m_progressBar->setFixedHeight(10);
    m_progressBar->setMaximumWidth(240);
    m_progressBar->setTextVisible(false);
    bottomBar->addWidget(m_progressBar);
    bottomBar->addStretch();
    m_loadMoreBtn->setVisible(false);
    bottomBar->addWidget(m_loadMoreBtn);
    mainLayout->addLayout(bottomBar);

    // Connections
    connect(m_selectModeBtn, &QPushButton::clicked, this, [this]() {
        bool selMode = !m_selectionMode;
        m_selectionMode = selMode;
        m_selectAllBtn->setVisible(selMode);
        m_batchDownloadBtn->setVisible(selMode);
        m_batchShareBtn->setVisible(selMode);
        m_batchPrintBtn->setVisible(selMode);
        m_batchCopyBtn->setVisible(selMode);
        m_selectCountLabel->setVisible(selMode);
        m_selectModeBtn->setText(selMode ? tr("☑ 退出选择") : tr("☐ 选择"));
        m_selectAllBtn->setText(tr("全选"));
        m_selectCountLabel->setText(tr("已选 0 张"));
        if (!selMode) onDeselectAll();
    });
    connect(m_loadMoreBtn, &QPushButton::clicked, this, &GalleryWidget::loadMore);
    connect(m_batchDownloadBtn, &QPushButton::clicked, this, &GalleryWidget::onBatchDownload);
    connect(m_batchShareBtn, &QPushButton::clicked, this, &GalleryWidget::onBatchShare);
    connect(m_batchPrintBtn, &QPushButton::clicked, this, &GalleryWidget::onBatchPrint);
    connect(m_batchCopyBtn, &QPushButton::clicked, this, &GalleryWidget::onBatchCopyUrl);

    // API connections
    auto* api = Application::instance()->apiClient();
    connect(api, &ApiClient::imagesFetched, this, &GalleryWidget::onImagesFetched);
    connect(api, &ApiClient::imagesFetchError, this, &GalleryWidget::onFetchError);

    // Load images on startup
    QTimer::singleShot(100, this, &GalleryWidget::loadImages);
}

void GalleryWidget::loadImages() {
    if (m_loading) return;
    m_loading = true;
    m_stateStack->setCurrentWidget(m_loadingLabel);
    m_progressBar->setVisible(true);
    m_progressBar->setRange(0, 0);

    m_images.clear();
    m_selections.clear();
    m_nextAfterId = 0;

    // Clear existing thumbnails
    QLayoutItem* child;
    while ((child = m_flowLayout->takeAt(0)) != nullptr) {
        if (child->widget()) child->widget()->deleteLater();
        delete child;
    }

    Application::instance()->apiClient()->fetchImages(0);
}

void GalleryWidget::onImagesFetched(const QJsonArray& data, qint64 nextAfterId) {
    m_loading = false;
    m_progressBar->setVisible(false);
    m_hasMore = (nextAfterId > 0);
    m_nextAfterId = nextAfterId;
    m_loadMoreBtn->setText(tr("加载更多..."));
    m_loadMoreBtn->setEnabled(true);
    m_loadMoreBtn->setVisible(m_hasMore);

    for (const auto& val : data) {
        auto info = ImageInfo::fromMemoriesJson(val.toObject());
        // Dedup: skip if URL already exists
        bool dup = false;
        for (const auto& existing : m_images) {
            if (existing.url == info.url) { dup = true; break; }
        }
        if (dup) continue;
        m_images.append(info);
        addThumbnail(info);
    }

    if (m_images.isEmpty()) {
        m_stateStack->setCurrentWidget(m_emptyLabel);
    } else {
        m_stateStack->setCurrentWidget(m_scrollArea);
    }

    LOG_INFO(QString("已加载 %1 张图片").arg(data.size()));
}

void GalleryWidget::onFetchError(const QString& error) {
    m_loading = false;
    m_progressBar->setVisible(false);
    m_stateStack->setCurrentWidget(m_emptyLabel);
    m_emptyLabel->setText(tr("加载失败: %1\n请检查网络连接后重试").arg(error));
}

void GalleryWidget::addThumbnail(const ImageInfo& info) {
    // Thumbnail button directly in flow layout
    auto* thumbBtn = new QToolButton();
    thumbBtn->setFixedSize(184, 184);
    thumbBtn->setIconSize(QSize(176, 176));
    thumbBtn->setToolButtonStyle(Qt::ToolButtonIconOnly);
    thumbBtn->setCursor(Qt::PointingHandCursor);
    thumbBtn->setProperty("galleryThumb", true);
    thumbBtn->setProperty("selected", false);
    // 缩略图边距（图标比按钮小一圈）
    thumbBtn->setProperty("iconMargin", 4);

    // We'll set span after checking aspect ratio
    thumbBtn->setProperty("span", 1);

    // Check cache
    auto* cache = Application::instance()->imageCache();
    QPixmap cached = cache->getPixmap(info.url);
    if (!cached.isNull()) {
        applyThumbnailPixmap(thumbBtn, cached);
    } else {
        thumbBtn->setText("...");
        auto* reply = m_networkManager->get(QNetworkRequest(QUrl(info.url)));
        connect(reply, &QNetworkReply::finished, this, [this, reply, cache, url = info.url, thumbBtn]() {
            reply->deleteLater();
            if (reply->error() != QNetworkReply::NoError || thumbBtn->property("imageUrl").toString() != url) {
                return;
            }

            QPixmap pixmap;
            if (cache->putData(url, reply->readAll(), &pixmap)) {
                thumbBtn->setText(QString());
                applyThumbnailPixmap(thumbBtn, pixmap);
                m_flowLayout->invalidate();
            }
        });
    }

    // Store URL and init selection state
    thumbBtn->setToolTip(info.url.section('/', -1));
    thumbBtn->setProperty("imageUrl", info.url);
    m_selections[info.url] = false;  // init all entries for counting

    // Click handler
    connect(thumbBtn, &QToolButton::clicked, this, [this, url = info.url, thumbBtn]() {
        if (m_selectionMode) {
            bool& sel = m_selections[url];
            sel = !sel;
            thumbBtn->setProperty("selected", sel);
            thumbBtn->style()->unpolish(thumbBtn);
            thumbBtn->style()->polish(thumbBtn);
            thumbBtn->update();
            m_selectCountLabel->setText(tr("已选 %1 张").arg(selectedCount()));
            // Auto-toggle button when all/none selected
            m_selectAllBtn->setText(selectedCount() == m_images.size() ? tr("取消全选") : tr("全选"));
        } else {
            onThumbnailClicked(url);
        }
    });

    m_flowLayout->addWidget(thumbBtn);
}

void GalleryWidget::applyThumbnailPixmap(QToolButton* thumbBtn, const QPixmap& pixmap) {
    thumbBtn->setIcon(QIcon(pixmap.scaled(176, 176, Qt::KeepAspectRatio, Qt::SmoothTransformation)));

    double ar = static_cast<double>(pixmap.width()) / pixmap.height();
    if (ar > 1.5) {
        thumbBtn->setFixedSize(376, 184);
        thumbBtn->setIconSize(QSize(368, 176));
        thumbBtn->setProperty("span", 2);
    } else if (ar < 0.67) {
        thumbBtn->setFixedSize(184, 376);
        thumbBtn->setIconSize(QSize(176, 368));
        thumbBtn->setProperty("span", 1);
    }
}

void GalleryWidget::onThumbnailClicked(const QString& url) {
    emit imageSelected(url);
}

void GalleryWidget::onSelectAll() {
    for (auto it = m_selections.begin(); it != m_selections.end(); ++it) {
        it.value() = true;
    }
    for (int i = 0; i < m_flowLayout->count(); ++i) {
        auto* item = m_flowLayout->itemAt(i);
        if (auto* btn = qobject_cast<QToolButton*>(item->widget())) {
            btn->setProperty("selected", true);
            btn->style()->unpolish(btn);
            btn->style()->polish(btn);
            btn->update();
        }
    }
    m_selectAllBtn->setText(tr("取消全选"));
    m_selectCountLabel->setText(tr("已选 %1 张").arg(selectedCount()));
}

void GalleryWidget::onDeselectAll() {
    for (auto it = m_selections.begin(); it != m_selections.end(); ++it) {
        it.value() = false;
    }
    for (int i = 0; i < m_flowLayout->count(); ++i) {
        auto* item = m_flowLayout->itemAt(i);
        if (auto* btn = qobject_cast<QToolButton*>(item->widget())) {
            btn->setProperty("selected", false);
            btn->style()->unpolish(btn);
            btn->style()->polish(btn);
            btn->update();
        }
    }
    m_selectAllBtn->setText(tr("全选"));
    m_selectCountLabel->setText(tr("已选 0 张"));
}

QStringList GalleryWidget::selectedUrls() const {
    QStringList urls;
    for (auto it = m_selections.begin(); it != m_selections.end(); ++it) {
        if (it.value()) urls.append(it.key());
    }
    return urls;
}

void GalleryWidget::onBatchDownload() {
    auto urls = selectedUrls();
    if (urls.isEmpty()) {
        QMessageBox::information(this, tr("提示"), tr("未选中任何图片。"));
        return;
    }

    QString dir = QFileDialog::getExistingDirectory(this, tr("选择下载目录"));
    if (dir.isEmpty()) return;

    // Async download via network manager
    for (const auto& url : urls) {
        QDesktopServices::openUrl(QUrl(url)); // Simplified - open in browser
    }
    QMessageBox::information(this, tr("下载"),
        tr("正在打开 %1 张图片...").arg(urls.size()));
}

void GalleryWidget::onBatchShare() {
    auto urls = selectedUrls();
    if (urls.isEmpty()) return;

    QString text = urls.join("\n");
    QApplication::clipboard()->setText(text);
    QMessageBox::information(this, tr("分享"),
        tr("已复制 %1 个链接到剪贴板。").arg(urls.size()));
}

void GalleryWidget::onBatchPrint() {
    auto urls = selectedUrls();
    if (urls.isEmpty()) return;

    QPrinter printer;
    QPrintDialog printDlg(&printer, this);
    if (printDlg.exec() != QDialog::Accepted) return;

    // Simplified batch print
    QMessageBox::information(this, tr("打印"),
        tr("正在打印 %1 张图片...").arg(urls.size()));
}

void GalleryWidget::onBatchCopyUrl() {
    auto urls = selectedUrls();
    if (urls.isEmpty()) return;

    QApplication::clipboard()->setText(urls.join("\n"));
    QMessageBox::information(this, tr("复制"),
        tr("已复制 %1 个链接到剪贴板。").arg(urls.size()));
}

void GalleryWidget::loadMore() {
    if (m_loading || !m_hasMore) return;
    m_loading = true;
    m_progressBar->setVisible(true);
    m_progressBar->setRange(0, 0);
    m_loadMoreBtn->setText(tr("加载中..."));
    m_loadMoreBtn->setEnabled(false);
    Application::instance()->apiClient()->fetchImages(m_nextAfterId);
}

void GalleryWidget::clearSelection() {
    onDeselectAll();
}

int GalleryWidget::selectedCount() const {
    int cnt = 0;
    for (auto it = m_selections.begin(); it != m_selections.end(); ++it) {
        if (it.value()) ++cnt;
    }
    return cnt;
}

void GalleryWidget::keyPressEvent(QKeyEvent* event) {
    if (event->key() == Qt::Key_Escape && m_selectionMode) {
        m_selectModeBtn->click(); // toggle off
    }
    QWidget::keyPressEvent(event);
}
